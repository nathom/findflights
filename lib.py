import argparse
import asyncio
import concurrent.futures
import csv
import datetime
import json
import re
import sys
from itertools import product

from bs4 import BeautifulSoup
from playwright.async_api import async_playwright
from rich.console import Console
from rich.progress import (
    Progress,
    SpinnerColumn,
    BarColumn,
    TimeRemainingColumn,
    TextColumn,
)
from rich.table import Table

console = Console()


# helper: convert time string to 24-hour format
def convert_to_24(time_str):
    try:
        dt = datetime.datetime.strptime(time_str, "%I:%M%p")
        return dt.strftime("%H:%M")
    except Exception:
        try:
            dt = datetime.datetime.strptime(time_str, "%H:%M")
            return dt.strftime("%H:%M")
        except Exception:
            return time_str


def parse_date(date_str, default_year=None):
    for fmt in ("%m/%d/%Y", "%m/%d"):
        try:
            dt = datetime.datetime.strptime(date_str, fmt).date()
            if fmt == "%m/%d" and default_year:
                dt = dt.replace(year=default_year)
            return dt
        except ValueError:
            continue
    raise ValueError(f"invalid date format: {date_str}")


def parse_date_range(range_str):
    # if no '-' present, treat it as a single date
    if "-" not in range_str:
        today = datetime.date.today()
        single_date = parse_date(range_str, default_year=today.year)
        return [single_date]
    parts = range_str.split("-")
    if len(parts) != 2:
        raise ValueError("date range must be in 'start-end' format")
    today = datetime.date.today()
    start = parse_date(parts[0], default_year=today.year)
    end = parse_date(parts[1], default_year=today.year)
    if start > end:
        raise ValueError("start date must not be after end date")
    return [start + datetime.timedelta(days=i) for i in range((end - start).days + 1)]


async def create_browser():
    playwright = await async_playwright().start()
    browser = await playwright.chromium.launch(
        headless=True,
        args=["--disable-gpu", "--no-sandbox"]
    )
    return browser, playwright


async def fetch_flights_page(origin, destination, depart_date, browser):
    url = f"https://skiplagged.com/flights/{origin}/{destination}/{depart_date.isoformat()}"
    page = await browser.new_page()
    await page.set_extra_http_headers({
        "User-Agent": "mozilla/5.0 (macintosh; intel mac os x 10_15_7) applewebkit/605.1.15 (khtml, like gecko) version/18.0.1 safari/605.1.15"
    })
    try:
        await page.goto(url)
        try:
            trip_list_locator = page.locator(".trip-list-section")
            trip_list_empty_locator = page.locator(".trip-list-empty")
            from playwright.async_api import expect

            try:
                await expect(trip_list_locator).to_be_visible(timeout=15000)
                result = "found_trips"
            except:
                try:
                    await expect(trip_list_empty_locator).to_be_visible(timeout=15000)
                    result = "no_trips"
                except:
                    result = "timeout"
            await asyncio.sleep(2)
        except Exception as e:
            console.print(f"[red]timeout waiting for page {url}: {e}[/red]")
        html = await page.content()
    finally:
        await page.close()
    return html

def parse_flights(html, origin, destination):
    soup = BeautifulSoup(html, "html.parser")
    flights = []
    for div in soup.find_all("div", class_="trip", id=True):
        flight_id = div.get("id", "")
        if "|" not in flight_id:
            continue
        flight = {}
        try:
            _, json_part = flight_id.split("|", 1)
            flight.update(json.loads(json_part))
        except Exception:
            continue

        # Parse stops information
        stops_elem = div.find("span", class_="trip-stops")
        flight["stops"] = stops_elem.get_text(strip=True) if stops_elem else ""

        # Parse airline information
        airline_elem = div.find("span", class_="airlines")
        flight["airline"] = airline_elem.get_text(strip=True) if airline_elem else ""

        # Parse flight numbers from tooltip
        flight_numbers = []
        if airline_elem and airline_elem.has_attr("data-original-title"):
            tooltip = airline_elem.get("data-original-title", "")
            flight_num_matches = re.findall(r"Flight (\d+)", tooltip)
            flight_numbers = flight_num_matches
        flight["flight_numbers"] = flight_numbers

        # Parse departure and arrival times
        first_point = div.find("div", class_="trip-path-point trip-path-point-first")
        if first_point:
            time_elem = first_point.find("div", class_="trip-path-point-time")
            flight["dep_time"] = (
                convert_to_24(time_elem.get_text(strip=True)) if time_elem else ""
            )
        else:
            flight["dep_time"] = ""

        last_point = div.find("div", class_="trip-path-point trip-path-point-last")
        if last_point:
            time_elem = last_point.find("div", class_="trip-path-point-time")
            flight["arr_time"] = (
                convert_to_24(time_elem.get_text(strip=True)) if time_elem else ""
            )
        else:
            flight["arr_time"] = ""

        # Parse intermediate airports (layover points)
        # Using a set to avoid duplicates
        intermediate_airports = set()
        layover_points = div.find_all("div", class_="trip-path-point-airport-demp")
        for point in layover_points:
            airport_code_elem = point.find("span", class_="airport-code")
            if airport_code_elem and airport_code_elem.text.strip():
                intermediate_airports.add(airport_code_elem.text.strip())
        flight["intermediate_airports"] = list(intermediate_airports)

        # Calculate number of stops based on intermediate airports
        flight["num_stops"] = len(flight["intermediate_airports"])

        # Parse cost
        cost_elem = div.find("div", class_="trip-cost")
        if cost_elem:
            price_elem = cost_elem.find("span")
            if price_elem:
                price_text = price_elem.get_text(strip=True)
                digits = re.sub(r"[^\d]", "", price_text)
                if digits:
                    flight["cost"] = int(digits) * 100

        # Parse duration
        dur_elem = div.find("div", class_="trip-path-duration")
        flight["duration"] = (
            dur_elem.get_text(strip=True).split("|")[0].strip() if dur_elem else ""
        )

        # Set source and destination
        flight.setdefault("from", origin)
        flight.setdefault("to", destination)

        flights.append(flight)
    return flights

async def search_flights(origin, destination, depart_date, browser):
    html = await fetch_flights_page(origin, destination, depart_date, browser)
    return parse_flights(html, origin, destination)


async def fetch_flights_for_page(origin, destination, depart_date):
    browser, playwright = await create_browser()
    try:
        flights = await search_flights(origin, destination, depart_date, browser)
    finally:
        await browser.close()
        await playwright.stop()
    return flights


def parse_duration_str(dur_str):
    match = re.search(r"(\d+)\s*h", dur_str)
    hours = int(match.group(1)) if match else 0
    match = re.search(r"(\d+)\s*m", dur_str)
    minutes = int(match.group(1)) if match else 0
    return hours * 60 + minutes


def humanize_duration(minutes):
    days = minutes // 1440
    rem = minutes % 1440
    hours = rem // 60
    result = ""
    if days:
        result += f"{days}d "
    result += f"{hours}h"
    return result.strip()


def compute_stay_duration(o, i):
    try:
        out_date = datetime.datetime.strptime(o["depart"], "%Y-%m-%d").date()
        in_date = datetime.datetime.strptime(i["depart"], "%Y-%m-%d").date()
        out_arr = datetime.datetime.strptime(o["arr_time"], "%H:%M").time()
        in_dep = datetime.datetime.strptime(i["dep_time"], "%H:%M").time()
        out_dt = datetime.datetime.combine(out_date, out_arr)
        in_dt = datetime.datetime.combine(in_date, in_dep)
        stay = in_dt - out_dt
        if stay.total_seconds() < 0:
            stay += datetime.timedelta(days=1)
        return int(stay.total_seconds() // 60)
    except Exception:
        return None


def pair_flights(outbound_list, inbound_list):
    pairs = []
    for o, i in product(outbound_list, inbound_list):
        try:
            o_date = datetime.datetime.strptime(o["depart"], "%Y-%m-%d").date()
            i_date = datetime.datetime.strptime(i["depart"], "%Y-%m-%d").date()
        except Exception:
            continue
        if o_date < i_date:
            out_cost = o.get("cost", 0)
            in_cost = i.get("cost", 0)
            total_cost = out_cost + in_cost
            out_dur = parse_duration_str(o.get("duration", ""))
            in_dur = parse_duration_str(i.get("duration", ""))
            total_dur = out_dur + in_dur
            stay_min = compute_stay_duration(o, i)
            pair = {
                "out_src": o.get("from", ""),
                "out_dest": o.get("to", ""),
                "in_src": i.get("from", ""),
                "in_dest": i.get("to", ""),
                "out_date": o.get("depart", ""),
                "in_date": i.get("depart", ""),
                "out_dep_time": o.get("dep_time", ""),
                "out_arr_time": o.get("arr_time", ""),
                "in_dep_time": i.get("dep_time", ""),
                "in_arr_time": i.get("arr_time", ""),
                "out_duration": o.get("duration", ""),
                "in_duration": i.get("duration", ""),
                "out_cost": out_cost,
                "in_cost": in_cost,
                "total_cost": total_cost,
                "out_airline": o.get("airline", ""),
                "in_airline": i.get("airline", ""),
                "out_stops": o.get("stops", ""),
                "in_stops": i.get("stops", ""),
                "total_dur": total_dur,
                "stay_dur": stay_min,
            }
            pairs.append(pair)
    return pairs


def format_date_with_day(date_str):
    try:
        d = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
        return f"{date_str} ({d.strftime('%a')})"
    except Exception:
        return date_str


def display_pairs(pairs, top, sort_metric, depart_time_range, direct=False):
    # filter by outbound depart time range if provided
    if depart_time_range:
        try:
            start_str, end_str = depart_time_range.split("-")
            start_time = datetime.datetime.strptime(start_str, "%H:%M").time()
            end_time = datetime.datetime.strptime(end_str, "%H:%M").time()
            filtered = []
            for p in pairs:
                try:
                    dep = datetime.datetime.strptime(p["out_dep_time"], "%H:%M").time()
                    if start_time <= dep <= end_time:
                        filtered.append(p)
                except Exception:
                    continue
            pairs = filtered
        except Exception as e:
            console.print(f"[red]error parsing depart time range: {e}[/red]")
    # filter by direct flights if enabled (both legs must be nonstop)
    if direct:
        pairs = [
            p
            for p in pairs
            if "nonstop" in p["out_stops"].lower()
            and "nonstop" in p["in_stops"].lower()
        ]
    if sort_metric == "price":
        sorted_pairs = sorted(pairs, key=lambda x: x["total_cost"])
    elif sort_metric == "total time":
        sorted_pairs = sorted(
            pairs,
            key=lambda x: x["stay_dur"] if x["stay_dur"] is not None else float("inf"),
        )
    else:
        sorted_pairs = pairs
    topn = sorted_pairs[:top]
    table = Table(title="cheapest round-trip options")
    table.add_column("route")
    table.add_column("outbound (dep-arr, duration)")
    table.add_column("outbound date")
    table.add_column("inbound (dep-arr, duration)")
    table.add_column("inbound date")
    table.add_column("stay", justify="center")
    table.add_column("prices (out/in/total)", justify="right")
    table.add_column("airlines")
    table.add_column("direct?", justify="center")
    table.add_column("flight time", style="green")
    for p in topn:
        route = f"{p['out_src']} -> {p['out_dest']} / {p['in_src']} -> {p['in_dest']}"
        outbound_str = (
            f"{p['out_dep_time']} - {p['out_arr_time']} ({p['out_duration']})"
        )
        inbound_str = f"{p['in_dep_time']} - {p['in_arr_time']} ({p['in_duration']})"
        prices = f"${p['out_cost']/100:.2f} / ${p['in_cost']/100:.2f} / ${p['total_cost']/100:.2f}"
        airlines = f"{p['out_airline']} / {p['in_airline']}"
        direct = (
            "yes"
            if (
                "nonstop" in p["out_stops"].lower()
                and "nonstop" in p["in_stops"].lower()
            )
            else "no"
        )
        flight_time = f"{p['total_dur']} min"
        stay_str = (
            humanize_duration(p["stay_dur"]) if p["stay_dur"] is not None else "n/a"
        )
        out_date_str = format_date_with_day(p["out_date"])
        in_date_str = format_date_with_day(p["in_date"])
        table.add_row(
            route,
            outbound_str,
            out_date_str,
            inbound_str,
            in_date_str,
            stay_str,
            prices,
            airlines,
            direct,
            flight_time,
        )
    console.print(table)
    return sorted_pairs


def save_csv(pairs, path):
    keys = [
        "out_src",
        "out_dest",
        "in_src",
        "in_dest",
        "out_date",
        "in_date",
        "out_dep_time",
        "out_arr_time",
        "in_dep_time",
        "in_arr_time",
        "out_duration",
        "in_duration",
        "out_cost",
        "in_cost",
        "total_cost",
        "out_airline",
        "in_airline",
        "out_stops",
        "in_stops",
        "total_dur",
        "stay_dur",
    ]
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=keys)
        writer.writeheader()
        for row in pairs:
            writer.writerow(row)

async def run_tasks(tasks, workers=5):
    results = []
    semaphore = asyncio.Semaphore(workers)

    async def bounded_task(task):
        async with semaphore:
            return await task

    for result in await asyncio.gather(
        *[bounded_task(task) for task in tasks], return_exceptions=True
    ):
        if not isinstance(result, Exception):
            results.append(result)
    return results

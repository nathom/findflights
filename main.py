#!/usr/bin/env python3
import argparse
import concurrent.futures
import csv
import datetime
import json
import re
import sys
import time
from itertools import product

from bs4 import BeautifulSoup
from rich.console import Console
from rich.progress import (
    Progress,
    SpinnerColumn,
    BarColumn,
    TimeRemainingColumn,
    TextColumn,
)
from rich.table import Table
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

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
    parts = range_str.split("-")
    if len(parts) != 2:
        raise ValueError("date range must be in 'start-end' format")
    today = datetime.date.today()
    start = parse_date(parts[0], default_year=today.year)
    end = parse_date(parts[1], default_year=today.year)
    if start > end:
        raise ValueError("start date must not be after end date")
    return [start + datetime.timedelta(days=i) for i in range((end - start).days + 1)]


def create_driver():
    opts = Options()
    opts.add_argument("--headless")
    opts.add_argument("--disable-gpu")
    opts.add_argument("--no-sandbox")
    opts.add_argument(
        "user-agent=mozilla/5.0 (macintosh; intel mac os x 10_15_7) applewebkit/605.1.15 (khtml, like gecko) version/18.0.1 safari/605.1.15"
    )
    return webdriver.Chrome(options=opts)


def fetch_flights_page(origin, destination, depart_date, driver):
    url = f"https://skiplagged.com/flights/{origin}/{destination}/{depart_date.isoformat()}"
    driver.get(url)
    try:
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CLASS_NAME, "trip-list-section"))
        )
        time.sleep(2)
    except Exception as e:
        console.print(f"[red]timeout waiting for page {url}: {e}[/red]")
    return driver.page_source


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
        stops_elem = div.find("span", class_="trip-stops")
        flight["stops"] = stops_elem.get_text(strip=True) if stops_elem else ""
        airline_elem = div.find("span", class_="airlines")
        flight["airline"] = airline_elem.get_text(strip=True) if airline_elem else ""
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
        cost_elem = div.find("div", class_="trip-cost")
        if cost_elem:
            digits = re.sub(r"[^\d]", "", cost_elem.get_text(strip=True))
            if digits:
                flight["cost"] = int(digits) * 100
        dur_elem = div.find("div", class_="trip-path-duration")
        flight["duration"] = (
            dur_elem.get_text(strip=True).split("|")[0].strip() if dur_elem else ""
        )
        flight.setdefault("from", origin)
        flight.setdefault("to", destination)
        # assume flight json includes "depart" field (yyyy-mm-dd)
        flights.append(flight)
    return flights


def search_flights(origin, destination, depart_date, driver):
    html = fetch_flights_page(origin, destination, depart_date, driver)
    return parse_flights(html, origin, destination)


def fetch_flights_for_page(origin, destination, depart_date):
    driver = create_driver()
    try:
        flights = search_flights(origin, destination, depart_date, driver)
    finally:
        driver.quit()
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


def display_pairs(pairs, top, sort_metric, depart_time_range):
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
    if args.direct:
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


parser = argparse.ArgumentParser(
    description="Find the cheapest/fastest flights (using Skiplagged)!"
)
parser.add_argument(
    "origin", help="comma separated candidate source airports (e.g. SAN,SNA,LAX)"
)
parser.add_argument(
    "destinations",
    help="comma separated candidate destination airports (e.g. SFO,OAK,SJC)",
)
parser.add_argument(
    "--depart", required=True, help="outbound date range (e.g. 3/7-3/8)"
)
parser.add_argument(
    "--return",
    dest="return_range",
    required=True,
    help="return date range (e.g. 3/9-3/10)",
)
parser.add_argument(
    "--top", type=int, default=5, help="number of top results to show (default 5)"
)
parser.add_argument(
    "--sort",
    choices=["price", "total time"],
    default="price",
    help="metric to sort by (default price)",
)
parser.add_argument(
    "--exclude",
    default="",
    help="comma separated list of airlines to exclude (default none)",
)
parser.add_argument(
    "--save-csv",
    default=None,
    help="path to save full sorted results as csv (default none)",
)
parser.add_argument(
    "--depart-time-range",
    default=None,
    help="filter outbound departures within time range, e.g. '08:00-12:00'",
)
# add --direct flag; filtering by direct flights is on by default
group = parser.add_mutually_exclusive_group()
group.add_argument(
    "--direct",
    dest="direct",
    action="store_true",
    help="only show direct flights (default)",
)
group.add_argument(
    "--no-direct",
    dest="direct",
    action="store_false",
    help="include flights with stops",
)
parser.set_defaults(direct=True)
parser.add_argument(
    "--workers", type=int, default=5, help="number of threadpool workers (default 5)"
)
args = parser.parse_args()


def main():
    sources = [s.strip().upper() for s in args.origin.split(",")]
    dests = [d.strip().upper() for d in args.destinations.split(",")]
    try:
        depart_dates = parse_date_range(args.depart)
        return_dates = parse_date_range(args.return_range)
    except Exception as e:
        console.print(f"[red]error parsing date ranges: {e}[/red]")
        sys.exit(1)

    exclude_airlines = (
        [x.strip().lower() for x in args.exclude.split(",") if x.strip()]
        if args.exclude
        else []
    )

    outbound_tasks = []
    inbound_tasks = []
    for src in sources:
        for dest in dests:
            for d in depart_dates:
                outbound_tasks.append((src, dest, d))
    for dest in dests:
        for src in sources:
            for d in return_dates:
                inbound_tasks.append((dest, src, d))

    outbound_flights = []
    inbound_flights = []

    total_out = len(outbound_tasks)
    total_in = len(inbound_tasks)
    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        BarColumn(),
        TimeRemainingColumn(),
        transient=True,
    ) as progress:
        out_task = progress.add_task("fetching outbound flights...", total=total_out)
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=args.workers
        ) as executor:
            out_futures = [
                executor.submit(fetch_flights_for_page, o, d, dt)
                for o, d, dt in outbound_tasks
            ]
            for future in concurrent.futures.as_completed(out_futures):
                try:
                    outbound_flights.extend(future.result())
                except Exception as exc:
                    console.print(f"[red]outbound task error: {exc}[/red]")
                progress.advance(out_task)
        in_task = progress.add_task("fetching inbound flights...", total=total_in)
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=args.workers
        ) as executor:
            in_futures = [
                executor.submit(fetch_flights_for_page, o, d, dt)
                for o, d, dt in inbound_tasks
            ]
            for future in concurrent.futures.as_completed(in_futures):
                try:
                    inbound_flights.extend(future.result())
                except Exception as exc:
                    console.print(f"[red]inbound task error: {exc}[/red]")
                progress.advance(in_task)

    if not outbound_flights:
        console.print("[yellow]no outbound flights found[/yellow]")
    if not inbound_flights:
        console.print("[yellow]no inbound flights found[/yellow]")

    all_pairs = pair_flights(outbound_flights, inbound_flights)
    if exclude_airlines:
        all_pairs = [
            p
            for p in all_pairs
            if p["out_airline"].lower() not in exclude_airlines
            and p["in_airline"].lower() not in exclude_airlines
        ]

    sorted_pairs = display_pairs(all_pairs, args.top, args.sort, args.depart_time_range)
    if args.save_csv:
        try:
            save_csv(sorted_pairs, args.save_csv)
            console.print(f"[green]saved full results to {args.save_csv}[/green]")
        except Exception as e:
            console.print(f"[red]error saving csv: {e}[/red]")


if __name__ == "__main__":
    main()

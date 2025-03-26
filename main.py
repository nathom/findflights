import argparse
import asyncio
import datetime
import sys
from rich.console import Console
from rich.progress import (
    Progress,
    SpinnerColumn,
    BarColumn,
    TimeRemainingColumn,
    TextColumn,
)

from lib import (
    parse_date,
    parse_date_range,
    fetch_flights_for_page,
    run_tasks,
    pair_flights,
    display_pairs,
    save_csv,
)

console = Console()

parser = argparse.ArgumentParser(
    description="cli for round-trip flight search via headless browser simulation (parallel)"
)
parser.add_argument(
    "origin", help="comma separated candidate source airports (e.g. SAN,SNA,LAX)"
)
parser.add_argument(
    "destinations",
    help="comma separated candidate destination airports (e.g. SFO,OAK,SJC)",
)
parser.add_argument(
    "--depart", help="outbound date or date range (e.g. 3/7 or 3/7-3/8)"
)
parser.add_argument(
    "--return",
    dest="return_range",
    help="return date or date range (e.g. 3/9 or 3/9-3/10)",
)
# new weekend flag - if provided, computes weekend dates automatically
parser.add_argument(
    "--weekend",
    default=None,
    help="specify a date (mm/dd or mm/dd/yyyy) for a weekend trip; computes depart as friday/saturday and return as sunday/monday",
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


async def async_main():
    sources = [s.strip().upper() for s in args.origin.split(",")]
    dests = [d.strip().upper() for d in args.destinations.split(",")]

    # if weekend flag is provided, compute weekend dates; else use provided dates/ranges
    if args.weekend:
        try:
            today = datetime.date.today()
            weekend_date = parse_date(args.weekend, default_year=today.year)
        except Exception as e:
            console.print(f"[red]error parsing weekend date: {e}[/red]")
            sys.exit(1)
        wd = weekend_date.weekday()
        # valid weekend days: friday (4), saturday (5), sunday (6), monday (0)
        if wd not in (4, 5, 6, 0):
            console.print(
                f"[red]provided weekend date {args.weekend} is not part of a weekend (fri-sat-sun-mon)[/red]"
            )
            sys.exit(1)

        friday_date = None
        if wd == 4:  # friday
            friday_date = weekend_date
        elif wd == 5:  # saturday
            friday_date = weekend_date - datetime.timedelta(days=1)
        elif wd == 6:  # sunday
            friday_date = weekend_date - datetime.timedelta(days=2)
        elif wd == 0:  # monday
            friday_date = weekend_date - datetime.timedelta(days=3)

        depart_dates = [friday_date, friday_date + datetime.timedelta(days=1)]
        return_dates = [
            friday_date + datetime.timedelta(days=2),
            friday_date + datetime.timedelta(days=3),
        ]
    else:
        try:
            depart_dates = parse_date_range(args.depart)
            return_dates = parse_date_range(args.return_range)
        except Exception as e:
            console.print(f"[red]error parsing date(s): {e}[/red]")
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
                outbound_tasks.append(fetch_flights_for_page(src, dest, d))
    for dest in dests:
        for src in sources:
            for d in return_dates:
                inbound_tasks.append(fetch_flights_for_page(dest, src, d))

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

        # Process outbound flights in batches to show progress
        outbound_flights = []
        for i in range(0, len(outbound_tasks), args.workers):
            batch = outbound_tasks[i:i+args.workers]
            try:
                results = await run_tasks(batch)
                outbound_flights.extend([flight for flights in results for flight in flights])
                progress.update(out_task, advance=len(batch))
            except Exception as exc:
                console.print(f"[red]outbound task error: {exc}[/red]")

        in_task = progress.add_task("fetching inbound flights...", total=total_in)
        inbound_flights = []

        # Process inbound flights in batches to show progress
        for i in range(0, len(inbound_tasks), args.workers):
            batch = inbound_tasks[i:i+args.workers]
            try:
                results = await run_tasks(batch)
                inbound_flights.extend([flight for flights in results for flight in flights])
                progress.update(in_task, advance=len(batch))
            except Exception as exc:
                console.print(f"[red]inbound task error: {exc}[/red]")

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


def main():
    asyncio.run(async_main())


if __name__ == "__main__":
    main()

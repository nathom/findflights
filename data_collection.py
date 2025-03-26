#!/usr/bin/env python3

import argparse
import asyncio
import datetime
import json
import os
import signal
import sys
import time
from pathlib import Path

from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeRemainingColumn

from lib import (
    parse_date_range,
    create_browser,
    search_flights,
    run_tasks
)

# Configuration
DATA_DIR = Path("flight_data")
AIRPORTS = ["SFO", "OAK", "SAN", "SJC", "SMF", "LAX", "SNA", "LGB", "BUR"]
DAYS_AHEAD = 90  # Look 90 days ahead
MAX_WORKERS = 5  # Maximum concurrent tasks
COLLECTION_INTERVAL_HOURS = 24  # Run daily
RATE_LIMIT_PER_MINUTE = 60  # Maximum requests per minute
DEBUG = False  # Debug flag for verbose logging

# Ensure data directory exists
DATA_DIR.mkdir(exist_ok=True)

# Status tracking
status = {
    "last_run": None,
    "next_run": None,
    "total_collections": 0,
    "current_status": "initializing",
    "flights_collected": 0,
}

def log(message, level="info"):
    """Log messages based on debug flag"""
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if level == "debug" and not DEBUG:
        return
    print(f"[{timestamp}] [{level.upper()}] {message}")

def save_status():
    """Save current status to a status file for monitoring"""
    with open(DATA_DIR / "collection_status.json", "w") as f:
        json.dump(status, f, default=str, indent=2)
    if DEBUG:
        log(f"Status saved: {status}", "debug")

def handle_exit(signum, frame):
    """Handle graceful shutdown"""
    status["current_status"] = "shutting down"
    save_status()
    log("\nGracefully shutting down...")
    sys.exit(0)

# Register signal handlers
signal.signal(signal.SIGINT, handle_exit)
signal.signal(signal.SIGTERM, handle_exit)

class RateLimiter:
    """Simple token bucket rate limiter"""
    def __init__(self, rate_limit_per_minute):
        self.rate = rate_limit_per_minute
        self.tokens = self.rate
        self.last_check = time.monotonic()
        self.lock = asyncio.Lock()

    async def acquire(self):
        """Acquire a token, waiting if necessary"""
        async with self.lock:
            while True:
                now = time.monotonic()
                time_passed = now - self.last_check

                # Add new tokens based on time passed
                self.tokens += time_passed * (self.rate / 60.0)
                self.tokens = min(self.tokens, self.rate)  # Cap at max tokens
                self.last_check = now

                if self.tokens >= 1:
                    self.tokens -= 1
                    if DEBUG:
                        log(f"Token acquired, {self.tokens:.2f} tokens remaining", "debug")
                    return

                # Calculate time to wait for next token
                wait_time = (1 - self.tokens) * (60.0 / self.rate)
                if DEBUG:
                    log(f"Rate limit reached, waiting {wait_time:.2f}s for next token", "debug")
                await asyncio.sleep(wait_time)

async def collect_flight_data():
    """Collect flight data for all airport pairs and dates"""
    log_date = datetime.datetime.now()
    status["current_status"] = "collecting data"
    status["last_run"] = log_date
    save_status()
    log(f"Starting data collection at {log_date}")

    # Generate date range to look ahead
    today = datetime.date.today()
    future_dates = [today + datetime.timedelta(days=i) for i in range(1, DAYS_AHEAD)]
    if DEBUG:
        log(f"Generated {len(future_dates)} dates from {future_dates[0]} to {future_dates[-1]}", "debug")

    # Generate all airport pairs (both directions)
    airport_pairs = []
    for src in AIRPORTS:
        for dst in AIRPORTS:
            if src != dst:
                airport_pairs.append((src, dst))
    if DEBUG:
        log(f"Generated {len(airport_pairs)} airport pairs", "debug")

    # Create a list of all tasks
    all_tasks = []
    for date in future_dates:
        for src, dst in airport_pairs:
            all_tasks.append((src, dst, date))
    if DEBUG:
        log(f"Created {len(all_tasks)} total tasks", "debug")

    # Create output filename for today's data
    output_file = DATA_DIR / f"flights_{log_date.strftime('%Y-%m-%d')}.jsonl"
    log(f"Output file: {output_file}")

    # Initialize browser
    log("Initializing browser")
    browser, playwright = await create_browser()

    # Initialize rate limiter
    rate_limiter = RateLimiter(RATE_LIMIT_PER_MINUTE)
    log(f"Rate limiter initialized with {RATE_LIMIT_PER_MINUTE} requests per minute")

    try:
        total_tasks = len(all_tasks)
        completed = 0


        # Process tasks in batches to avoid memory issues
        for i in range(0, total_tasks, 100):
            batch = all_tasks[i:i+100]
            batch_size = len(batch)
            if DEBUG:
                log(f"Processing batch {i//100 + 1}/{(total_tasks+99)//100}, size: {batch_size}", "debug")

            # Create async tasks for the batch with rate limiting
            async def process_flight_task(item):
                src, dst, date = item
                if DEBUG:
                    log(f"Fetching flights: {src} to {dst} on {date}", "debug")
                await rate_limiter.acquire()  # Wait for rate limit
                try:
                    result = await search_flights(src, dst, date, browser)
                    return src, dst, date, result
                except Exception as e:
                    log(f"Error fetching {src} to {dst} on {date}: {e}", "error")
                    return src, dst, date, []

            # Create progress bar for this batch
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TextColumn("[progress.percentage]{task.percentage:>3.0f}%"),
                TimeRemainingColumn(),
                TextColumn("({task.completed}/{task.total})"),
            ) as progress:
                batch_task = progress.add_task(f"Batch {i//100 + 1}/{(total_tasks+99)//100}", total=batch_size)

                # Run tasks in parallel with limited concurrency
                task_results = []
                for j in range(0, len(batch), MAX_WORKERS):
                    sub_batch = batch[j:j+MAX_WORKERS]
                    results = await run_tasks([process_flight_task(item) for item in sub_batch], workers=MAX_WORKERS)
                    task_results.extend(results)
                    progress.update(batch_task, advance=len(sub_batch))

            # Process results
            for result in task_results:
                if result:
                    src, dst, date, flights = result

                    # Write flights directly to file as they are received
                    flight_count = 0
                    for flight in flights:
                        flight["log_date"] = log_date.isoformat()
                        flight["search_date"] = date.isoformat()

                        # Append to the JSONL file
                        with open(output_file, "a") as f:
                            f.write(json.dumps(flight) + "\n")

                        status["flights_collected"] += 1
                        flight_count += 1

                    if DEBUG:
                        log(f"Found and saved {flight_count} flights for {src} to {dst} on {date}", "debug")

                # Update status after each result
                completed += 1
                status["current_status"] = f"collected {completed}/{total_tasks} searches"
                save_status()
                if completed % 10 == 0 or DEBUG:
                    log(f"Progress: {completed}/{total_tasks} ({completed/total_tasks*100:.1f}%)")

    finally:
        log("Closing browser")
        await browser.close()
        await playwright.stop()

    status["total_collections"] += 1
    status["current_status"] = "idle"
    status["next_run"] = log_date + datetime.timedelta(hours=COLLECTION_INTERVAL_HOURS)
    save_status()
    log(f"Collection completed. Added {status['flights_collected']} flights.")

async def main():
    """Main loop for continuous data collection"""

    # Set debug flag
    global DEBUG

    log(f"Starting flight data collection service (debug={DEBUG})...")

    while True:
        try:
            await collect_flight_data()

            # Sleep until next collection
            log(f"Collection complete. Next run in {COLLECTION_INTERVAL_HOURS} hours.")
            for i in range(COLLECTION_INTERVAL_HOURS * 60):
                if DEBUG and i % 60 == 0:
                    log(f"Waiting: {i//60}/{COLLECTION_INTERVAL_HOURS} hours elapsed", "debug")
                time.sleep(60)  # Check every minute
                save_status()  # Update timestamp
        except Exception as e:
            log(f"Error in collection cycle: {e}", "error")
            if DEBUG:
                import traceback
                log(traceback.format_exc(), "debug")
            status["current_status"] = f"error: {e}"
            save_status()
            time.sleep(300)  # Wait 5 minutes after error

if __name__ == "__main__":
    asyncio.run(main())

#!/usr/bin/env python3
"""
Scrape liturgical calendar using Claude's WebFetch
Since direct requests failed, we'll use curl/wget to download the pages first
"""

import re
import csv
from datetime import datetime
import subprocess

def fetch_page(url):
    """Fetch page content using curl"""
    result = subprocess.run(
        ['curl', '-s', url],
        capture_output=True,
        text=True
    )
    return result.stdout

def parse_calendar_text(text, year):
    """Parse the calendar text format"""
    lines = text.split('\n')
    entries = []

    current_month = 1  # Start with January
    months = {
        'January': 1, 'February': 2, 'March': 3, 'April': 4,
        'May': 5, 'June': 6, 'July': 7, 'August': 8,
        'September': 9, 'October': 10, 'November': 11, 'December': 12
    }

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Check for month names
        for month_name, month_num in months.items():
            if month_name in line and len(line) < 30:
                current_month = month_num
                print(f"  Month: {month_name}")
                break

        # Try to match date pattern (e.g., "1 January" or "15 January")
        date_match = re.match(r'^(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)?', line)

        if date_match:
            day = int(date_match.group(1))

            # If month name in same line, update current_month
            if date_match.group(2):
                current_month = months[date_match.group(2)]

            try:
                calendar_date = datetime(year, current_month, day)
            except ValueError:
                i += 1
                continue

            # Look ahead for liturgical name
            liturgical_name = None
            season = 'Ordinary Time'
            rank = 'Feria'
            week_number = None

            # Check next few non-empty lines
            j = i + 1
            while j < len(lines) and j < i + 5:
                next_line = lines[j].strip()

                if next_line and not re.match(r'^\d{1,2}\s', next_line):
                    # This is likely the liturgical name
                    if not liturgical_name:
                        liturgical_name = next_line

                        # Determine rank
                        if next_line.isupper():
                            rank = 'Solemnity'
                        elif 'Saint' in next_line or 'Blessed' in next_line:
                            if next_line.startswith('_') or next_line.endswith('_'):
                                rank = 'Optional Memorial'
                            else:
                                rank = 'Memorial'

                        # Determine season and extract week number
                        if 'Advent' in next_line:
                            season = 'Advent'
                            week_match = re.search(r'(\w+) week', next_line, re.IGNORECASE)
                            if week_match:
                                week_words = {'first': 1, 'second': 2, 'third': 3, 'fourth': 4}
                                week_number = week_words.get(week_match.group(1).lower())
                        elif 'Christmas' in next_line or 'Epiphany' in next_line or (current_month == 12 and day >= 25):
                            season = 'Christmas'
                        elif 'Lent' in next_line or 'Ash Wednesday' in next_line:
                            season = 'Lent'
                            week_match = re.search(r'(\w+) week', next_line, re.IGNORECASE)
                            if week_match:
                                week_words = {'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5}
                                week_number = week_words.get(week_match.group(1).lower())
                        elif 'Easter' in next_line or 'Resurrection' in next_line:
                            season = 'Easter'
                            week_match = re.search(r'(\w+) week', next_line, re.IGNORECASE)
                            if week_match:
                                week_words = {'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5, 'sixth': 6, 'seventh': 7}
                                week_number = week_words.get(week_match.group(1).lower())
                        elif 'Holy Week' in next_line or 'Palm Sunday' in next_line:
                            season = 'Holy Week'
                        elif 'Ordinary Time' in next_line:
                            season = 'Ordinary Time'
                            week_match = re.search(r'(\w+) week', next_line, re.IGNORECASE)
                            if week_match:
                                week_words = {'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5}
                                week_number = week_words.get(week_match.group(1).lower())

                j += 1

            # Clean up liturgical name (remove formatting markers)
            if liturgical_name:
                liturgical_name = liturgical_name.replace('_', '').strip()

            entry = {
                'calendar_date': calendar_date.strftime('%Y-%m-%d'),
                'year': year,
                'month': current_month,
                'day': day,
                'day_of_week': calendar_date.strftime('%A'),
                'liturgical_name': liturgical_name or 'Weekday',
                'liturgical_season': season,
                'liturgical_rank': rank,
                'week_number': week_number
            }

            entries.append(entry)

        i += 1

    return entries

def main():
    print("="*80)
    print("SCRAPING LITURGICAL CALENDARS")
    print("="*80)

    all_entries = []

    for year in [2025, 2026]:
        url = f"https://www.liturgybrisbane.net.au/resources/liturgical-calendars/{year}-liturgical-calendar/"
        print(f"\nFetching {year}...")

        try:
            html = fetch_page(url)

            if not html:
                print(f"  ERROR: No content received")
                continue

            print(f"  Received {len(html)} characters")
            print(f"  Parsing...")

            entries = parse_calendar_text(html, year)
            print(f"  Extracted {len(entries)} entries")

            all_entries.extend(entries)

        except Exception as e:
            print(f"  ERROR: {e}")

    # Save to CSV
    if all_entries:
        filename = 'liturgical_calendar_scraped.csv'
        fieldnames = ['calendar_date', 'year', 'month', 'day', 'day_of_week',
                      'liturgical_name', 'liturgical_season', 'liturgical_rank', 'week_number']

        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(all_entries)

        print(f"\n{'='*80}")
        print(f"SAVED {len(all_entries)} entries to {filename}")
        print(f"{'='*80}")

        # Show samples
        print("\nSample entries:")
        for entry in all_entries[:10]:
            print(f"  {entry['calendar_date']} ({entry['day_of_week']}): {entry['liturgical_name']}")

if __name__ == '__main__':
    main()

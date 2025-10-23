#!/usr/bin/env python3
"""
Scrape liturgical calendar from liturgybrisbane.net.au
Extracts dates, liturgical names, and seasons
"""

import requests
from bs4 import BeautifulSoup
import re
import csv
from datetime import datetime, timedelta
import json

def scrape_calendar(year):
    """Scrape liturgical calendar for a given year"""
    url = f"https://www.liturgybrisbane.net.au/resources/liturgical-calendars/{year}-liturgical-calendar/"

    print(f"\n{'='*80}")
    print(f"SCRAPING {year} LITURGICAL CALENDAR")
    print(f"URL: {url}")
    print(f"{'='*80}\n")

    response = requests.get(url)
    response.raise_for_status()

    soup = BeautifulSoup(response.content, 'html.parser')

    # Find the main content area
    content = soup.find('div', class_='entry-content')
    if not content:
        content = soup.find('article')

    if not content:
        print("ERROR: Could not find content area")
        return []

    # Get all text content
    text = content.get_text()
    lines = [line.strip() for line in text.split('\n') if line.strip()]

    entries = []
    current_date = None
    current_month = None

    # Month name to number mapping
    months = {
        'January': 1, 'February': 2, 'March': 3, 'April': 4,
        'May': 5, 'June': 6, 'July': 7, 'August': 8,
        'September': 9, 'October': 10, 'November': 11, 'December': 12
    }

    print(f"Parsing {len(lines)} lines of text...")

    for i, line in enumerate(lines):
        # Skip empty lines
        if not line:
            continue

        # Check for month headers
        for month_name in months.keys():
            if month_name in line and len(line) < 20:  # Short line, likely a header
                current_month = months[month_name]
                print(f"  Found month: {month_name} ({current_month})")
                break

        # Try to parse date line (e.g., "1 Wednesday" or "15 Sunday")
        date_match = re.match(r'^(\d{1,2})\s+([A-Z][a-z]+)', line)
        if date_match and current_month:
            day = int(date_match.group(1))
            day_of_week = date_match.group(2)

            try:
                current_date = datetime(year, current_month, day)

                # Look ahead for liturgical name (usually next line)
                liturgical_name = None
                season = 'Ordinary Time'  # Default
                rank = 'Feria'

                if i + 1 < len(lines):
                    next_line = lines[i + 1]

                    # Determine rank based on formatting/keywords
                    if next_line.isupper():
                        rank = 'Solemnity'
                    elif 'Feast' in next_line or 'Birth' in next_line:
                        rank = 'Feast'
                    elif 'Memorial' in next_line or 'St' in next_line or 'Ss' in next_line:
                        rank = 'Memorial'

                    # Determine season
                    if 'Advent' in next_line:
                        season = 'Advent'
                    elif 'Christmas' in next_line or current_month == 12:
                        season = 'Christmas'
                    elif 'Lent' in next_line or 'Ash Wednesday' in next_line:
                        season = 'Lent'
                    elif 'Easter' in next_line or 'Paschal' in next_line:
                        season = 'Easter'
                    elif 'Holy Week' in next_line or 'Palm Sunday' in next_line:
                        season = 'Holy Week'

                    liturgical_name = next_line

                entry = {
                    'calendar_date': current_date.strftime('%Y-%m-%d'),
                    'year': year,
                    'month': current_month,
                    'day': day,
                    'day_of_week': day_of_week,
                    'liturgical_name': liturgical_name or 'Weekday',
                    'liturgical_season': season,
                    'liturgical_rank': rank
                }

                entries.append(entry)

            except ValueError:
                # Invalid date
                continue

    print(f"\nExtracted {len(entries)} calendar entries")
    return entries

def save_to_csv(entries, filename):
    """Save entries to CSV file"""
    if not entries:
        print("No entries to save")
        return

    fieldnames = ['calendar_date', 'year', 'month', 'day', 'day_of_week',
                  'liturgical_name', 'liturgical_season', 'liturgical_rank']

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(entries)

    print(f"Saved to {filename}")

def main():
    all_entries = []

    # Scrape multiple years
    for year in [2025, 2026]:
        try:
            entries = scrape_calendar(year)
            all_entries.extend(entries)
        except Exception as e:
            print(f"ERROR scraping {year}: {e}")

    if all_entries:
        # Save combined
        save_to_csv(all_entries, 'liturgical_calendar_scraped.csv')

        # Print sample
        print("\n" + "="*80)
        print("SAMPLE ENTRIES")
        print("="*80)
        for entry in all_entries[:20]:
            print(f"{entry['calendar_date']}: {entry['liturgical_name']} ({entry['liturgical_season']})")

if __name__ == '__main__':
    main()

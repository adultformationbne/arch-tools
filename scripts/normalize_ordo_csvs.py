#!/usr/bin/env python3
"""
Normalize 2025.csv and 2026.csv to extract PRIMARY liturgical days only.
This creates a clean mapping of date -> primary liturgical celebration.

Rules:
1. For each date, only the FIRST row is the primary celebration
2. Subsequent rows (starting with comma) are optional memorials/alternatives
3. Empty description rows are skipped
"""

import csv
import re
from datetime import datetime

def normalize_ordo_csv(input_file, year):
    """
    Parse authoritative Ordo CSV and extract only primary celebrations.
    Returns list of normalized entries.
    """
    entries = []
    current_date = None

    month_map = {
        'January': 1, 'February': 2, 'March': 3, 'April': 4,
        'May': 5, 'June': 6, 'July': 7, 'August': 8,
        'September': 9, 'October': 10, 'November': 11, 'December': 12
    }

    with open(input_file, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)

        for row in reader:
            if len(row) < 2:
                continue

            date_str = row[0].strip()
            description = row[1].strip() if len(row) > 1 else ''

            # Skip empty descriptions and header rows
            if not description or 'YEAR' in date_str:
                continue

            # Check if this is a new date (not starting with comma)
            if date_str:
                # Parse date: "7 August" format
                match = re.match(r'(\d+)\s+(\w+)', date_str)
                if match:
                    day = int(match.group(1))
                    month_name = match.group(2)

                    if month_name in month_map:
                        month = month_map[month_name]
                        current_date = f"{year}-{month:02d}-{day:02d}"

                        # Detect liturgical week and season from description
                        week = None
                        season = None
                        rank = None

                        # Week markers: "2 ORDINARY", "3 LENT", etc.
                        week_match = re.match(r'^(\d+)\s+(ORDINARY|LENT|ADVENT|EASTER)', description)
                        if week_match:
                            week = int(week_match.group(1))
                            season_raw = week_match.group(2)
                            season = 'Ordinary Time' if season_raw == 'ORDINARY' else season_raw.title()
                            rank = 'Sunday'

                        # Detect rank from formatting
                        elif description.isupper():
                            # ALL CAPS = Solemnity or major feast
                            rank = 'Solemnity'
                        elif description[0].isupper() and not 'of the' in description.lower():
                            # Title Case (but not "Monday of the...") = Feast or Memorial
                            if 'Saint' in description or 'Blessed' in description:
                                rank = 'Memorial'  # Could be Memorial or Feast - would need more data
                            else:
                                rank = 'Feast'
                        else:
                            # Lowercase or "day of the week" = Feria
                            rank = 'Feria'

                        # Extract season from description for ferial days
                        if not season:
                            if 'Ordinary Time' in description:
                                season = 'Ordinary Time'
                                # Extract week: "Thursday of the eighteenth week in Ordinary Time"
                                week_match = re.search(r'of the (\w+(?:-\w+)?) week in Ordinary Time', description, re.IGNORECASE)
                                if week_match:
                                    week_word = week_match.group(1)
                                    week = parse_week_word(week_word)
                            elif 'Lent' in description:
                                season = 'Lent'
                                week_match = re.search(r'of the (\w+(?:-\w+)?) week of Lent', description, re.IGNORECASE)
                                if week_match:
                                    week = parse_week_word(week_match.group(1))
                            elif 'Advent' in description:
                                season = 'Advent'
                                week_match = re.search(r'of the (\w+(?:-\w+)?) week of Advent', description, re.IGNORECASE)
                                if week_match:
                                    week = parse_week_word(week_match.group(1))
                            elif 'Easter' in description:
                                season = 'Easter'
                                week_match = re.search(r'of the (\w+(?:-\w+)?) week of Easter', description, re.IGNORECASE)
                                if week_match:
                                    week = parse_week_word(week_match.group(1))
                            elif 'Christmas' in description or 'Epiphany' in description or 'before Epiphany' in description or 'after Epiphany' in description:
                                season = 'Christmas'
                            elif 'Holy Week' in description:
                                season = 'Holy Week'

                        # Store the primary entry
                        entries.append({
                            'calendar_date': current_date,
                            'year': year,
                            'liturgical_season': season,
                            'liturgical_week': week,
                            'liturgical_name': description,
                            'liturgical_rank': rank
                        })

    return entries

def parse_week_word(word):
    """Convert week word to number"""
    week_map = {
        'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
        'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
        'eleventh': 11, 'twelfth': 12, 'thirteenth': 13, 'fourteenth': 14,
        'fifteenth': 15, 'sixteenth': 16, 'seventeenth': 17, 'eighteenth': 18,
        'nineteenth': 19, 'twentieth': 20, 'twenty-first': 21, 'twenty-second': 22,
        'twenty-third': 23, 'twenty-fourth': 24, 'twenty-fifth': 25, 'twenty-sixth': 26,
        'twenty-seventh': 27, 'twenty-eighth': 28, 'twenty-ninth': 29, 'thirtieth': 30,
        'thirty-first': 31, 'thirty-second': 32, 'thirty-third': 33, 'thirty-fourth': 34
    }
    return week_map.get(word.lower())

def main():
    print("="*80)
    print("NORMALIZING ORDO CSV FILES")
    print("="*80)

    all_entries = []

    # Process 2025
    print("\nProcessing 2025.csv...")
    entries_2025 = normalize_ordo_csv('data/source/2025.csv', 2025)
    print(f"  Extracted {len(entries_2025)} primary liturgical days")
    all_entries.extend(entries_2025)

    # Process 2026
    print("\nProcessing 2026.csv...")
    entries_2026 = normalize_ordo_csv('data/source/2026.csv', 2026)
    print(f"  Extracted {len(entries_2026)} primary liturgical days")
    all_entries.extend(entries_2026)

    # Save to CSV
    output_file = 'data/generated/ordo_normalized.csv'
    fieldnames = ['calendar_date', 'year', 'liturgical_season', 'liturgical_week',
                  'liturgical_name', 'liturgical_rank']

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_entries)

    print(f"\n{'='*80}")
    print(f"COMPLETE!")
    print(f"  Total entries: {len(all_entries)}")
    print(f"  Saved to: {output_file}")
    print(f"{'='*80}")

    # Show samples
    print("\nSample entries:")
    for entry in all_entries[:10]:
        week = f"Week {entry['liturgical_week']}" if entry['liturgical_week'] else ""
        print(f"  {entry['calendar_date']}: {entry['liturgical_season']} {week}")
        print(f"    {entry['liturgical_name']} ({entry['liturgical_rank']})")

if __name__ == '__main__':
    main()

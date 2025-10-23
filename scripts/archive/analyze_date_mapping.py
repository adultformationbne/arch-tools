#!/usr/bin/env python3
"""
Analyze how to map lectionary entries to calendar dates
Need to understand:
1. Fixed feast days (can extract date from liturgical_day)
2. Moving feasts (depend on Easter)
3. Ordinary Time Sundays (depend on liturgical calendar structure)
"""

import csv
import re

def analyze_date_mapping():
    print("=" * 80)
    print("ANALYZING DATE MAPPING REQUIREMENTS")
    print("=" * 80)

    with open('Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # Check for dates in liturgical_day names
    print("\n1. FIXED FEAST DAYS WITH DATES")
    print("-" * 80)
    date_pattern = re.compile(r'(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)')

    fixed_dates = []
    for row in rows:
        match = date_pattern.search(row['Liturgical Day'])
        if match:
            fixed_dates.append({
                'date': match.group(),
                'year': row['Year'],
                'day': row['Liturgical Day']
            })

    print(f"Found {len(fixed_dates)} entries with explicit dates")
    print("\nSample fixed dates:")
    for entry in fixed_dates[:10]:
        print(f"  {entry['date']}: {entry['day']}")

    # Analyze what needs liturgical calendar mapping
    print("\n\n2. ENTRIES NEEDING LITURGICAL CALENDAR MAPPING")
    print("-" * 80)

    needs_mapping = {
        'ordinary_sundays': [],
        'ordinary_weekdays': [],
        'advent': [],
        'christmas': [],
        'lent': [],
        'easter': [],
        'holy_week': [],
        'moveable_feasts': []
    }

    for row in rows:
        time_period = row['Time']
        day_type = row['Day']
        year_cycle = row['Year']
        week = row['Week']

        # Skip fixed dates
        if date_pattern.search(row['Liturgical Day']):
            continue

        if time_period == 'Ordinary' and day_type == 'Sunday':
            needs_mapping['ordinary_sundays'].append({
                'year': year_cycle,
                'week': week,
                'day': row['Liturgical Day']
            })
        elif time_period == 'Ordinary' and day_type in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']:
            needs_mapping['ordinary_weekdays'].append({
                'year': year_cycle,
                'week': week,
                'day_type': day_type,
                'name': row['Liturgical Day']
            })
        elif time_period == 'Advent':
            needs_mapping['advent'].append(row['Liturgical Day'])
        elif time_period == 'Christmas':
            needs_mapping['christmas'].append(row['Liturgical Day'])
        elif time_period == 'Lent':
            needs_mapping['lent'].append(row['Liturgical Day'])
        elif time_period == 'Easter':
            needs_mapping['easter'].append(row['Liturgical Day'])
        elif time_period == 'Holy Week':
            needs_mapping['holy_week'].append(row['Liturgical Day'])
        elif row['Day'] == 'Moving Feast':
            needs_mapping['moveable_feasts'].append(row['Liturgical Day'])

    for category, items in needs_mapping.items():
        if items:
            print(f"\n{category.upper()}: {len(items)} entries")
            if category in ['ordinary_sundays', 'ordinary_weekdays']:
                print(f"  Sample: {items[0]}")
            else:
                unique = list(set(items))[:5]
                for item in unique:
                    print(f"  - {item}")

    # Analyze what we'd need from liturgybrisbane.net.au
    print("\n\n3. REQUIRED DATA FROM LITURGYBRISBANE.NET.AU")
    print("-" * 80)
    print("""
To map lectionary entries to calendar dates, we need:

FOR EACH YEAR (e.g., 2025, 2026...):

  1. Key moveable dates:
     - 1st Sunday of Advent (starts liturgical year)
     - Ash Wednesday
     - Easter Sunday
     - Pentecost Sunday
     - Last Sunday of Ordinary Time (Christ the King)

  2. Ordinary Time structure:
     - Weeks 1-N before Lent (usually 5-9 weeks)
     - Weeks after Pentecost until Christ the King (varies)
     - Week numbers and their calendar dates

  3. Special solemnities:
     - Trinity Sunday (1st Sunday after Pentecost)
     - Corpus Christi (Thursday after Trinity Sunday)
     - Sacred Heart (Friday after Corpus Christi)

EXAMPLE FORMAT NEEDED:
  liturgical_calendar table with columns:
    - calendar_date (DATE)
    - liturgical_week (INTEGER, e.g., 2 for "2nd Sunday")
    - liturgical_season (TEXT: 'ordinary', 'advent', 'lent', etc.)
    - day_of_week (INTEGER: 0-6)
    - liturgical_name (TEXT: matches lectionary_readings.liturgical_day)
    """)

    print("\n\n4. RECOMMENDED APPROACH")
    print("-" * 80)
    print("""
OPTION A - Manual Calendar Import:
  1. Download Brisbane liturgical calendar PDFs/HTML for each year
  2. Create liturgical_calendar table
  3. Manually map key dates for 2025, 2026, 2027...
  4. Join lectionary_readings with liturgical_calendar

OPTION B - Algorithm (Complex):
  1. Calculate Easter date for each year (computus algorithm)
  2. Calculate all moveable dates based on Easter
  3. Map Ordinary Time weeks around Lent/Easter
  4. More error-prone, harder to verify

RECOMMENDATION: Use Option A with liturgybrisbane.net.au calendars
  - More reliable
  - Already Brisbane-specific
  - Can verify against official source
    """)

if __name__ == '__main__':
    analyze_date_mapping()

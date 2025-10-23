#!/usr/bin/env python3
"""
Validate that the generated liturgical calendar uses every row from Lectionary.csv
This catches missing feasts, solemnities, and special liturgical days
"""

import csv
import os
from supabase import create_client
from dotenv import load_dotenv

load_dotenv()

def main():
    print("=" * 80)
    print("VALIDATING CALENDAR COVERAGE")
    print("=" * 80)

    # Load all lectionary entries
    print("\n1. Loading Lectionary.csv...")
    lectionary_entries = []
    with open('Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            lectionary_entries.append({
                'admin_order': row['Admin Order'],
                'year_cycle': row['Year'],
                'week': row['Week'],
                'day': row['Day'],
                'time': row['Time'],
                'liturgical_day': row['Liturgical Day'],
                'gospel': row['Gospel Reading']
            })

    print(f"   Found {len(lectionary_entries)} lectionary entries")

    # Connect to database
    print("\n2. Connecting to database...")
    supabase = create_client(
        os.getenv('PUBLIC_SUPABASE_URL'),
        os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    )

    # Get all unique liturgical names from calendar (2025-2030)
    print("   Fetching calendar data...")
    response = supabase.table('liturgical_calendar')\
        .select('liturgical_name, liturgical_season, day_of_week')\
        .execute()

    calendar_entries = response.data
    unique_calendar_names = set(entry['liturgical_name'] for entry in calendar_entries)

    print(f"   Found {len(unique_calendar_names)} unique liturgical names in calendar")

    # Check which lectionary entries have NO match in the calendar
    print("\n3. Checking for unmatched lectionary entries...")
    unmatched = []

    for lect in lectionary_entries:
        liturgical_day = lect['liturgical_day']

        # Try exact match
        if liturgical_day in unique_calendar_names:
            continue

        # Try case-insensitive match
        if any(liturgical_day.lower() == cal_name.lower() for cal_name in unique_calendar_names):
            continue

        # Try partial match (for entries like "Monday of first week of Advent - Year A")
        base_name = liturgical_day.split(' - ')[0] if ' - ' in liturgical_day else liturgical_day
        if any(base_name.lower() in cal_name.lower() or cal_name.lower() in base_name.lower()
               for cal_name in unique_calendar_names):
            continue

        # No match found
        unmatched.append(lect)

    # Report results
    print("\n" + "=" * 80)
    print(f"RESULTS: {len(lectionary_entries) - len(unmatched)}/{len(lectionary_entries)} lectionary entries have calendar matches")
    print("=" * 80)

    if unmatched:
        print(f"\n⚠️  WARNING: {len(unmatched)} lectionary entries have NO matching calendar dates!")
        print("\nUnmatched entries (likely missing feasts/solemnities):\n")

        # Group by type
        by_type = {}
        for entry in unmatched:
            time_period = entry['time']
            if time_period not in by_type:
                by_type[time_period] = []
            by_type[time_period].append(entry)

        for time_period, entries in sorted(by_type.items()):
            print(f"\n{time_period} ({len(entries)} entries):")
            for entry in entries[:10]:  # Show first 10
                print(f"  • [{entry['year_cycle']}] {entry['liturgical_day']}")
                print(f"    Gospel: {entry['gospel']}")
            if len(entries) > 10:
                print(f"  ... and {len(entries) - 10} more")

        print("\n" + "=" * 80)
        print("RECOMMENDATION: Update generate_liturgical_calendar.py to include these dates")
        print("=" * 80)

        return 1  # Exit with error code
    else:
        print("\n✅ SUCCESS! All lectionary entries have matching calendar dates!")
        return 0

if __name__ == '__main__':
    exit(main())

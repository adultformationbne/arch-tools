#!/usr/bin/env python3
"""
Import LitugricalYears.csv into Supabase
Reads CSV and inserts into liturgical_years table
"""

import csv
import os
from supabase import create_client, Client
from dotenv import load_dotenv

def import_liturgical_years():
    # Load .env file
    load_dotenv()

    # Get Supabase credentials from environment
    url = os.environ.get("PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("ERROR: SUPABASE_URL and SUPABASE_KEY environment variables must be set")
        print("Run: source .env")
        return

    supabase: Client = create_client(url, key)

    print("=" * 80)
    print("IMPORTING LITURGICALYEARS.CSV TO SUPABASE")
    print("=" * 80)

    # Read CSV (skip first 2 header rows)
    with open('LitugricalYears.csv', 'r', encoding='utf-8-sig') as f:
        lines = f.readlines()
        # Skip first 2 rows, then read as CSV
        reader = csv.DictReader(lines[2:])
        rows = list(reader)

    print(f"\nTotal rows to import: {len(rows)}")

    # Transform and insert
    inserted = 0
    errors = 0

    for i, row in enumerate(rows, 1):
        try:
            data = {
                'year': int(row['Year']),
                'sunday_cycle': row['Sundays'],
                'weekday_cycle': row['Weekdays'].replace('I', 'I').replace('II', 'II')  # Ensure proper format
            }

            result = supabase.table('liturgical_years').insert(data).execute()
            inserted += 1

            if i % 20 == 0:
                print(f"  Progress: {i}/{len(rows)} rows")

        except Exception as e:
            errors += 1
            print(f"  Error on row {i} (Year {row.get('Year', 'unknown')}): {e}")
            if errors > 10:
                print("\n  Too many errors, stopping import")
                break

    print("\n" + "=" * 80)
    print(f"IMPORT COMPLETE")
    print(f"  Total rows: {len(rows)}")
    print(f"  Inserted: {inserted}")
    print(f"  Errors: {errors}")
    print("=" * 80)

if __name__ == '__main__':
    import_liturgical_years()

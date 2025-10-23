#!/usr/bin/env python3
"""
Import corrected liturgical_calendar_full.csv into Supabase using UPSERT
"""

import csv
import os
from supabase import create_client, Client
from dotenv import load_dotenv

def import_calendar():
    load_dotenv()

    url = os.environ.get("PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        print("ERROR: Environment variables not set")
        print(f"URL: {url}")
        print(f"KEY: {'set' if key else 'not set'}")
        return

    supabase: Client = create_client(url, key)

    print("=" * 80)
    print("IMPORTING CORRECTED LITURGICAL CALENDAR TO SUPABASE")
    print("=" * 80)

    # Read CSV
    csv_path = 'data/generated/liturgical_calendar_full.csv'
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"\nTotal rows to import: {len(rows)}")
    print(f"Date range: {rows[0]['calendar_date']} to {rows[-1]['calendar_date']}")

    # First, delete all existing records
    print("\nDeleting existing calendar data...")
    try:
        supabase.table('liturgical_calendar').delete().neq('id', '00000000-0000-0000-0000-000000000000').execute()
        print("  ✓ Existing data deleted")
    except Exception as e:
        print(f"  Error deleting: {e}")
        return

    # Batch insert
    batch_size = 100
    batches = []
    current_batch = []

    for row in rows:
        # Handle liturgical_week conversion
        week_value = row['liturgical_week']
        if week_value and week_value.strip() and week_value != 'Solemnity':
            try:
                liturgical_week = int(week_value)
            except ValueError:
                liturgical_week = None
        else:
            liturgical_week = None

        data = {
            'calendar_date': row['calendar_date'],
            'year': int(row['year']),
            'liturgical_season': row['liturgical_season'],
            'liturgical_week': liturgical_week,
            'day_of_week': row['day_of_week'],
            'liturgical_name': row['liturgical_name'],
            'liturgical_rank': row['liturgical_rank']
        }
        current_batch.append(data)

        if len(current_batch) >= batch_size:
            batches.append(current_batch)
            current_batch = []

    if current_batch:
        batches.append(current_batch)

    # Insert batches
    print(f"\nInserting {len(batches)} batches...")
    inserted = 0
    errors = 0

    for i, batch in enumerate(batches, 1):
        try:
            result = supabase.table('liturgical_calendar').insert(batch).execute()
            inserted += len(batch)
            print(f"  Batch {i}/{len(batches)}: Inserted {len(batch)} rows (Total: {inserted}/{len(rows)})")
        except Exception as e:
            errors += len(batch)
            print(f"  Error on batch {i}: {e}")
            if errors > 200:
                print("  Too many errors, stopping...")
                break

    print(f"\n{'='*80}")
    print(f"IMPORT COMPLETE")
    print(f"  Total rows: {len(rows)}")
    print(f"  Inserted: {inserted}")
    print(f"  Errors: {errors}")
    print(f"{'='*80}")

    # Verify the fixes
    print("\nVerifying key dates...")
    test_dates = ['2025-03-19', '2025-03-25', '2025-12-08']
    for date in test_dates:
        result = supabase.table('liturgical_calendar').select('*').eq('calendar_date', date).execute()
        if result.data and len(result.data) > 0:
            row = result.data[0]
            print(f"  {date}: {row['liturgical_season']}, Week {row['liturgical_week']}, {row['liturgical_name']}")

if __name__ == '__main__':
    import_calendar()

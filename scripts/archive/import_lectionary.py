#!/usr/bin/env python3
"""
Import Lectionary.csv into Supabase
Reads CSV and inserts into lectionary_readings table
"""

import csv
import os
from supabase import create_client, Client
from dotenv import load_dotenv

def import_lectionary():
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
    print("IMPORTING LECTIONARY.CSV TO SUPABASE")
    print("=" * 80)

    # Read CSV
    with open('Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"\nTotal rows to import: {len(rows)}")

    # Transform data
    batch_size = 50
    batches = []
    current_batch = []

    for row in rows:
        data = {
            'admin_order': int(row['Admin Order']),
            'year_cycle': row['Year'],
            'week_number': row['Week'],
            'day_type': row['Day'],
            'time_period': row['Time'],
            'liturgical_day': row['Liturgical Day'],
            'first_reading': row['First Reading'] or None,
            'psalm': row['Psalm'] or None,
            'second_reading': row['Second Reading'] or None,
            'gospel_reading': row['Gospel Reading']
        }
        current_batch.append(data)

        if len(current_batch) >= batch_size:
            batches.append(current_batch)
            current_batch = []

    # Add remaining
    if current_batch:
        batches.append(current_batch)

    # Insert in batches
    inserted = 0
    errors = 0

    for i, batch in enumerate(batches, 1):
        try:
            result = supabase.table('lectionary_readings').insert(batch).execute()
            inserted += len(batch)
            print(f"  Batch {i}/{len(batches)}: Inserted {len(batch)} rows (Total: {inserted}/{len(rows)})")

        except Exception as e:
            errors += len(batch)
            print(f"  Error on batch {i}: {e}")
            if errors > 100:
                print("\n  Too many errors, stopping import")
                break

    print("\n" + "=" * 80)
    print(f"IMPORT COMPLETE")
    print(f"  Total rows: {len(rows)}")
    print(f"  Inserted: {inserted}")
    print(f"  Errors: {errors}")
    print("=" * 80)

if __name__ == '__main__':
    import_lectionary()

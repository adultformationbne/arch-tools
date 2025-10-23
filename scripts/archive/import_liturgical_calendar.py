#!/usr/bin/env python3
"""
Import liturgical_calendar_full.csv into Supabase
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
        return

    supabase: Client = create_client(url, key)

    print("=" * 80)
    print("IMPORTING LITURGICAL CALENDAR TO SUPABASE")
    print("=" * 80)

    # Read CSV
    with open('liturgical_calendar_full.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"\nTotal rows to import: {len(rows)}")

    # Batch insert
    batch_size = 100
    batches = []
    current_batch = []

    for row in rows:
        data = {
            'calendar_date': row['calendar_date'],
            'year': int(row['year']),
            'liturgical_season': row['liturgical_season'],
            'liturgical_week': int(row['liturgical_week']) if row['liturgical_week'] and row['liturgical_week'] != 'Solemnity' else None,
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

    # Insert
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
                break

    print(f"\n{'='*80}")
    print(f"IMPORT COMPLETE")
    print(f"  Total rows: {len(rows)}")
    print(f"  Inserted: {inserted}")
    print(f"  Errors: {errors}")
    print(f"{'='*80}")

if __name__ == '__main__':
    import_calendar()

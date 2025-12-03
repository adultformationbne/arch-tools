#!/usr/bin/env python3
"""
Import ordo_lectionary_mapping from CSV to Supabase.

Usage:
  python scripts/import_lectionary_mapping.py           # Import to production
  python scripts/import_lectionary_mapping.py --temp    # Import to temp table
"""

import csv
import os
import sys
import argparse
from dotenv import load_dotenv

load_dotenv()

def get_supabase():
    from supabase import create_client
    url = os.environ.get('PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if not url or not key:
        print("ERROR: Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
        sys.exit(1)
    return create_client(url, key)

def import_mapping(table_name='ordo_lectionary_mapping'):
    supabase = get_supabase()

    # Read CSV
    csv_file = 'data/generated/ordo_lectionary_mapping.csv'
    with open(csv_file, 'r') as f:
        reader = csv.DictReader(f)
        rows = [r for r in reader if r['lectionary_id']]  # Skip rows with no match

    print(f"Loaded {len(rows)} rows from {csv_file}")

    # Clear existing data
    print(f"Clearing {table_name}...")
    supabase.table(table_name).delete().neq('calendar_date', '1900-01-01').execute()

    # Insert in batches
    batch_size = 50
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i+batch_size]
        data = [{
            'calendar_date': r['calendar_date'],
            'lectionary_id': int(r['lectionary_id']),
            'match_type': r['match_type'],
            'match_method': r['match_method']
        } for r in batch]

        supabase.table(table_name).insert(data).execute()
        print(f"  Inserted {min(i+batch_size, len(rows))}/{len(rows)}")

    print(f"\n✅ Imported {len(rows)} rows to {table_name}")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--temp', action='store_true', help='Import to temp table')
    args = parser.parse_args()

    table = 'ordo_lectionary_mapping_temp' if args.temp else 'ordo_lectionary_mapping'
    import_mapping(table)

if __name__ == '__main__':
    main()

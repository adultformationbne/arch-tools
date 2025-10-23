#!/usr/bin/env python3
"""
Import Ordo, Lectionary, and mapping data into Supabase.
Run this after creating the tables with the migration.
"""

import csv
import os
from supabase import create_client

# Get Supabase credentials from environment
SUPABASE_URL = os.getenv('PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: Missing Supabase credentials in environment variables")
    print("Please set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def import_ordo():
    """Import Ordo calendar data"""
    print("Importing Ordo calendar...")

    with open('data/generated/ordo_normalized.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = []

        for row in reader:
            # Determine year cycle (A, B, C) based on year
            year = int(row['year'])
            # Year cycle: 2025=C, 2026=A, 2027=B, 2028=C, 2029=A, 2030=B
            cycles = ['C', 'A', 'B']
            year_cycle = cycles[(year - 2025) % 3]

            rows.append({
                'calendar_date': row['calendar_date'],
                'liturgical_year': year,
                'liturgical_season': row['liturgical_season'] or None,
                'liturgical_week': int(row['liturgical_week']) if row['liturgical_week'] else None,
                'liturgical_name': row['liturgical_name'],
                'liturgical_rank': row['liturgical_rank'] or None,
                'year_cycle': year_cycle
            })

    # Batch insert
    batch_size = 100
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        result = supabase.table('ordo_calendar').upsert(batch).execute()
        print(f"  Imported {len(batch)} Ordo entries ({i + len(batch)}/{len(rows)})")

    print(f"✅ Imported {len(rows)} Ordo entries")

def import_lectionary():
    """Import Lectionary data"""
    print("\nImporting Lectionary...")

    with open('data/source/Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = []

        for row in reader:
            admin_order = row.get('Admin Order', '').strip()
            if not admin_order:
                continue

            rows.append({
                'admin_order': int(admin_order),
                'year': row.get('Year', '').strip() or None,
                'week': row.get('Week', '').strip() or None,
                'day': row.get('Day', '').strip() or None,
                'time': row.get('Time', '').strip() or None,
                'liturgical_day': row.get('Liturgical Day', '').strip(),
                'first_reading': row.get('First Reading', '').strip() or None,
                'psalm': row.get('Psalm', '').strip() or None,
                'second_reading': row.get('Second Reading', '').strip() or None,
                'gospel_reading': row.get('Gospel Reading', '').strip() or None
            })

    # Batch insert
    batch_size = 100
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        result = supabase.table('lectionary').upsert(batch).execute()
        print(f"  Imported {len(batch)} Lectionary entries ({i + len(batch)}/{len(rows)})")

    print(f"✅ Imported {len(rows)} Lectionary entries")

def import_mapping():
    """Import Ordo-Lectionary mapping"""
    print("\nImporting Ordo-Lectionary mapping...")

    with open('data/generated/ordo_lectionary_mapping.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = []

        for row in reader:
            lectionary_id = row.get('lectionary_id', '').strip()

            rows.append({
                'calendar_date': row['calendar_date'],
                'lectionary_id': int(lectionary_id) if lectionary_id else None,
                'match_type': row['match_type'],
                'match_method': row.get('match_method', '').strip() or None
            })

    # Batch insert
    batch_size = 100
    for i in range(0, len(rows), batch_size):
        batch = rows[i:i + batch_size]
        result = supabase.table('ordo_lectionary_mapping').upsert(batch).execute()
        print(f"  Imported {len(batch)} mapping entries ({i + len(batch)}/{len(rows)})")

    print(f"✅ Imported {len(rows)} mapping entries")

def verify_import():
    """Verify the import was successful"""
    print("\nVerifying import...")

    # Check Ordo
    ordo_result = supabase.table('ordo_calendar').select('*', count='exact').limit(1).execute()
    print(f"  Ordo entries: {ordo_result.count}")

    # Check Lectionary
    lect_result = supabase.table('lectionary').select('*', count='exact').limit(1).execute()
    print(f"  Lectionary entries: {lect_result.count}")

    # Check Mapping
    map_result = supabase.table('ordo_lectionary_mapping').select('*', count='exact').limit(1).execute()
    print(f"  Mapping entries: {map_result.count}")

    # Test the function
    test_date = '2025-01-01'
    print(f"\nTesting get_readings_for_date('{test_date}')...")
    result = supabase.rpc('get_readings_for_date', {'target_date': test_date}).execute()

    if result.data and len(result.data) > 0:
        reading = result.data[0]
        print(f"  ✅ Found: {reading['liturgical_day']}")
        print(f"     Gospel: {reading.get('gospel_reading', 'N/A')}")
    else:
        print(f"  ❌ No reading found for {test_date}")

def main():
    print("="*60)
    print("IMPORTING LECTIONARY DATA TO SUPABASE")
    print("="*60)

    try:
        import_ordo()
        import_lectionary()
        import_mapping()
        verify_import()

        print("\n" + "="*60)
        print("✅ IMPORT COMPLETE!")
        print("="*60)
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()

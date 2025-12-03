#!/usr/bin/env python3
"""
Generate Ordo-to-Lectionary mapping for database import.

Usage:
  python scripts/generate_ordo_lectionary_mapping.py              # Generate CSV only
  python scripts/generate_ordo_lectionary_mapping.py --dry-run    # Push to temp table for testing
  python scripts/generate_ordo_lectionary_mapping.py --push       # Push to production table
  python scripts/generate_ordo_lectionary_mapping.py --check      # Query specific test dates
"""

import csv
import re
import datetime
import argparse
import os
import sys
from collections import defaultdict

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def normalize_for_comparison(text):
    """Comprehensive normalization for matching Ordo to Lectionary."""
    if not text:
        return ""

    text = text.upper().strip()
    text = text.lstrip('"').rstrip('"')

    # Remove date prefixes like "25 March – "
    text = re.sub(r'^\d{1,2}\s+[A-Z]+\s*[–—-]\s*', '', text)

    # Remove year suffixes like ", Year A"
    text = re.sub(r',?\s*YEAR\s+[ABC]\s*$', '', text)

    # Normalize ordinal numbers
    ordinal_map = {
        'FIRST': '1', 'SECOND': '2', 'THIRD': '3', 'FOURTH': '4', 'FIFTH': '5',
        'SIXTH': '6', 'SEVENTH': '7', 'EIGHTH': '8', 'NINTH': '9', 'TENTH': '10',
        'ELEVENTH': '11', 'TWELFTH': '12', 'THIRTEENTH': '13', 'FOURTEENTH': '14',
        'FIFTEENTH': '15', 'SIXTEENTH': '16', 'SEVENTEENTH': '17', 'EIGHTEENTH': '18',
        'NINETEENTH': '19', 'TWENTIETH': '20', 'TWENTY-FIRST': '21', 'TWENTY-SECOND': '22',
        'TWENTY-THIRD': '23', 'TWENTY-FOURTH': '24', 'TWENTY-FIFTH': '25',
        'TWENTY-SIXTH': '26', 'TWENTY-SEVENTH': '27', 'TWENTY-EIGHTH': '28',
        'TWENTY-NINTH': '29', 'THIRTIETH': '30', 'THIRTY-FIRST': '31',
        'THIRTY-SECOND': '32', 'THIRTY-THIRD': '33', 'THIRTY-FOURTH': '34'
    }

    for ordinal, num in sorted(ordinal_map.items(), key=lambda x: len(x[0]), reverse=True):
        text = text.replace(ordinal, num)

    # Normalize common liturgical name variations
    replacements = {
        'OUR LORD JESUS CHRIST': 'CHRIST THE KING',
        'THE MOST HOLY BODY AND BLOOD OF CHRIST': 'THE BODY AND BLOOD OF CHRIST',
        'THE MOST SACRED HEART OF JESUS': 'SACRED HEART OF JESUS',
        'THE ASCENSION OF THE LORD': 'ASCENSION',
        'PASSION SUNDAY (PALM SUNDAY)': 'PALM SUNDAY',
        'THE HOLY FAMILY': 'HOLY FAMILY',
        'THE MOST HOLY TRINITY': 'TRINITY SUNDAY',
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    # Normalize December date format
    december_dates = {
        '17 DECEMBER': '17TH DECEMBER', '18 DECEMBER': '18TH DECEMBER',
        '19 DECEMBER': '19TH DECEMBER', '20 DECEMBER': '20TH DECEMBER',
        '21 DECEMBER': '21ST DECEMBER', '22 DECEMBER': '22ND DECEMBER',
        '23 DECEMBER': '23RD DECEMBER', '24 DECEMBER': '24TH DECEMBER',
    }
    for old, new in december_dates.items():
        text = text.replace(old, new)

    # Expand saint abbreviations
    text = re.sub(r'\bSS\b\.?\s+', 'SAINTS ', text)
    text = re.sub(r'\bST\b\.?\s+', 'SAINT ', text)

    # Handle Ordo's compact Sunday format
    sunday_match = re.match(r'^(\d+)\s+(ORDINARY|LENT|ADVENT|EASTER)$', text.strip())
    if sunday_match:
        week_num = sunday_match.group(1)
        season = sunday_match.group(2)
        if season == 'ORDINARY':
            text = f"{week_num} SUNDAY"
        else:
            text = f"{week_num} SUNDAY {season}"

    # Normalize "SUNDAY IN <SEASON>" → "SUNDAY <SEASON>"
    text = text.replace(' SUNDAY IN LENT', ' SUNDAY LENT')
    text = text.replace(' SUNDAY IN ADVENT', ' SUNDAY ADVENT')
    text = text.replace(' SUNDAY IN EASTER', ' SUNDAY EASTER')
    text = text.replace(' SUNDAY OF LENT', ' SUNDAY LENT')
    text = text.replace(' SUNDAY OF ADVENT', ' SUNDAY ADVENT')
    text = text.replace(' SUNDAY OF EASTER', ' SUNDAY EASTER')

    # Normalize ferial weekday names
    text = text.replace(' IN ORDINARY TIME', '')
    text = text.replace(' OF ORDINARY TIME', '')

    text = ' '.join(text.split())
    return text


def load_ordo():
    """Load normalized ordo data"""
    ordo = {}
    with open('data/generated/ordo_normalized.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            date = row['calendar_date']
            ordo[date] = {
                'date': date,
                'year': row['year'],
                'season': row['liturgical_season'],
                'week': row['liturgical_week'],
                'name': row['liturgical_name'],
                'rank': row['liturgical_rank']
            }
    return ordo


def load_lectionary():
    """Load lectionary data"""
    lectionary = []
    with open('data/source/Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            lectionary.append(row)
    return lectionary


def get_weekday_name(dt):
    """Get the weekday name for lectionary matching."""
    days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    return days[dt.weekday()]


def week_to_ordinal(week):
    """Convert week number to ordinal word."""
    ordinals = {
        1: 'first', 2: 'second', 3: 'third', 4: 'fourth', 5: 'fifth',
        6: 'sixth', 7: 'seventh', 8: 'eighth', 9: 'ninth', 10: 'tenth',
        11: 'eleventh', 12: 'twelfth', 13: 'thirteenth', 14: 'fourteenth',
        15: 'fifteenth', 16: 'sixteenth', 17: 'seventeenth', 18: 'eighteenth',
        19: 'nineteenth', 20: 'twentieth', 21: 'twenty-first', 22: 'twenty-second',
        23: 'twenty-third', 24: 'twenty-fourth', 25: 'twenty-fifth',
        26: 'twenty-sixth', 27: 'twenty-seventh', 28: 'twenty-eighth',
        29: 'twenty-ninth', 30: 'thirtieth', 31: 'thirty-first',
        32: 'thirty-second', 33: 'thirty-third', 34: 'thirty-fourth'
    }
    try:
        return ordinals.get(int(week), str(week))
    except:
        return str(week)


def find_weekday_lectionary_entry(lectionary_entries, weekday, season, week, year_letter, calendar_year=None):
    """Find the weekday lectionary entry for a given season and week."""
    patterns = []
    ordinal_week = week_to_ordinal(week) if week else None

    if season == 'Lent':
        if ordinal_week:
            patterns.append(f"{weekday} of the {ordinal_week} week of Lent".lower())
        patterns.append(f"{weekday} after Ash Wednesday".lower())
    elif season == 'Easter':
        if ordinal_week:
            patterns.append(f"{weekday} of the {ordinal_week} week of Easter".lower())
        if not ordinal_week or ordinal_week == 'first':
            patterns.append(f"Easter {weekday}".lower())
    elif season == 'Advent':
        if ordinal_week:
            patterns.append(f"{weekday} of the {ordinal_week} week of Advent".lower())
    elif season == 'Ordinary Time':
        if ordinal_week:
            patterns.append(f"{weekday} of the {ordinal_week} week".lower())
    elif season == 'Christmas':
        patterns.append(f"{weekday} after Epiphany".lower())
        patterns.append(f"{weekday} before Epiphany".lower())

    # Year cycle for Ordinary Time first readings
    ordinary_year = None
    if calendar_year and season == 'Ordinary Time':
        ordinary_year = '1' if int(calendar_year) % 2 == 1 else '2'

    season_to_time = {
        'Ordinary Time': 'Ordinary',
        'Lent': 'Lent',
        'Easter': 'Easter',
        'Advent': 'Advent',
        'Christmas': 'Christmas',
    }
    expected_time = season_to_time.get(season, '')

    candidates = []
    for entry in lectionary_entries:
        lect_name = entry.get('Liturgical Day', '').lower()
        lect_year = entry.get('Year', '')
        lect_time = entry.get('Time', '')

        # Filter by season/time first
        if expected_time and lect_time and lect_time != expected_time:
            continue

        # Check if pattern matches
        matched = False
        for pattern in patterns:
            if pattern in lect_name or lect_name in pattern:
                matched = True
                break

        if not matched:
            continue

        # For Ordinary Time, prefer the correct year cycle
        if season == 'Ordinary Time' and lect_time == 'Ordinary':
            if ordinary_year and lect_year in ['1', '2']:
                if lect_year == ordinary_year:
                    return entry
                else:
                    candidates.append(entry)
            elif lect_year == 'Season' or not lect_year:
                return entry
        else:
            if lect_year and lect_year not in ['Season', '1', '2', '']:
                if year_letter and lect_year != year_letter:
                    continue
            return entry

    if candidates:
        return candidates[0]
    return None


def infer_season_and_week(ordo_date, ordo_data):
    """Infer season and week for a date by looking at surrounding dates."""
    dt = datetime.datetime.strptime(ordo_date, '%Y-%m-%d')
    current_weekday = dt.weekday()

    # Look back up to 7 days
    for days_back in range(1, 8):
        check_dt = dt - datetime.timedelta(days=days_back)
        check_date = check_dt.strftime('%Y-%m-%d')
        if check_date in ordo_data:
            entry = ordo_data[check_date]
            if entry.get('season') and entry.get('week'):
                week = entry['week']
                check_weekday = check_dt.weekday()

                if current_weekday < 6 and check_weekday != 6:
                    sundays_crossed = 0
                    for d in range(1, days_back):
                        test_dt = dt - datetime.timedelta(days=d)
                        if test_dt.weekday() == 6:
                            sundays_crossed += 1
                    if sundays_crossed > 0:
                        try:
                            week = str(int(week) + sundays_crossed)
                        except ValueError:
                            pass
                return entry['season'], week

    # Look forward if needed
    for days_forward in range(1, 8):
        check_dt = dt + datetime.timedelta(days=days_forward)
        check_date = check_dt.strftime('%Y-%m-%d')
        if check_date in ordo_data:
            entry = ordo_data[check_date]
            if entry.get('season') and entry.get('week'):
                week = entry['week']
                check_weekday = check_dt.weekday()

                if current_weekday < 6 and check_weekday != 6:
                    sundays_crossed = 0
                    for d in range(1, days_forward):
                        test_dt = dt + datetime.timedelta(days=d)
                        if test_dt.weekday() == 6:
                            sundays_crossed += 1
                    if sundays_crossed > 0:
                        try:
                            week = str(int(week) - sundays_crossed)
                        except ValueError:
                            pass
                return entry['season'], week

    return None, None


def find_lectionary_match(ordo_entry, lectionary_entries, year_letter, ordo_data=None):
    """Find matching lectionary entry for an ordo entry."""
    ordo_name = ordo_entry['name']
    ordo_name_norm = normalize_for_comparison(ordo_name)
    ordo_date = ordo_entry['date']

    season = ordo_entry['season']
    week = ordo_entry['week']
    ordo_rank = ordo_entry.get('rank', '').lower()

    # Extract date info
    try:
        dt = datetime.datetime.strptime(ordo_date, '%Y-%m-%d')
        ordo_month = dt.strftime('%B').upper()
        ordo_day = dt.day
        weekday = get_weekday_name(dt)
    except:
        ordo_month = None
        ordo_day = None
        weekday = None

    # For ALL Memorials, use weekday readings (not saint readings)
    is_memorial = ordo_rank in ['memorial', 'optional memorial']

    if is_memorial and ordo_data and weekday:
        inferred_season, inferred_week = infer_season_and_week(ordo_date, ordo_data)

        if inferred_season and inferred_week:
            calendar_year = ordo_date[:4] if ordo_date else None
            weekday_entry = find_weekday_lectionary_entry(
                lectionary_entries, weekday, inferred_season, inferred_week, year_letter, calendar_year
            )
            if weekday_entry:
                return {
                    'type': 'exact',
                    'method': 'weekday_for_memorial',
                    'entry': weekday_entry,
                    'ordo_name': ordo_name,
                    'lect_name': weekday_entry.get('Liturgical Day', '')
                }

    season_map = {
        'Ordinary Time': 'Ordinary',
        'Advent': 'Advent',
        'Christmas': 'Christmas',
        'Lent': 'Lent',
        'Holy Week': 'Holy Week',
        'Easter': 'Easter'
    }
    expected_time = season_map.get(season, '')

    matches = []

    for entry in lectionary_entries:
        lect_name = entry.get('Liturgical Day', '')
        lect_name_norm = normalize_for_comparison(lect_name)
        lect_year = entry.get('Year', '')
        lect_time = entry.get('Time', '')
        lect_week = entry.get('Week', '')

        # Extract date from Lectionary name
        lect_day = None
        lect_month = None

        date_match = re.match(r'^(\d{1,2})\s+([A-Z]+)\s*[–—-]', lect_name.upper())
        if date_match:
            lect_day = int(date_match.group(1))
            lect_month = date_match.group(2)
        else:
            date_match = re.match(r'^(\d{1,2})(?:ST|ND|RD|TH)?\s+([A-Z]+)$', lect_name.upper())
            if date_match:
                lect_day = int(date_match.group(1))
                lect_month = date_match.group(2)

        # Year filter
        if year_letter and lect_year and lect_year not in [year_letter, 'Season', '1', '2', 'Feast', 'Solemnity', 'Memorial', '']:
            continue

        # Season filter
        if season and expected_time and lect_time:
            if expected_time.upper() != lect_time.upper():
                continue

        # Week filter
        if week and lect_week and lect_week != 'N/A':
            if str(week) != str(lect_week):
                continue

        # Date-based match
        is_seasonal_weekday = any(x in ordo_name.lower() for x in [
            'monday of', 'tuesday of', 'wednesday of', 'thursday of', 'friday of', 'saturday of',
            'after ash wednesday', 'holy week', 'easter week', 'octave'
        ])
        is_major_day = ordo_rank in ['solemnity'] or 'sunday' in ordo_name.lower()
        is_memorial = ordo_rank in ['memorial', 'optional memorial']

        if ordo_day and ordo_month and lect_day and lect_month:
            if ordo_day == lect_day and ordo_month == lect_month:
                if is_seasonal_weekday or is_major_day or is_memorial:
                    pass
                else:
                    return {
                        'type': 'exact',
                        'method': 'date',
                        'entry': entry,
                        'ordo_name': ordo_name,
                        'lect_name': lect_name
                    }

        # Exact name match
        if ordo_name_norm == lect_name_norm:
            return {
                'type': 'exact',
                'method': 'name',
                'entry': entry,
                'ordo_name': ordo_name,
                'lect_name': lect_name
            }

        # Partial match
        if ordo_name_norm in lect_name_norm or lect_name_norm in ordo_name_norm:
            ordo_words = set(ordo_name_norm.split())
            lect_words = set(lect_name_norm.split())
            overlap = ordo_words & lect_words
            matches.append({
                'type': 'partial',
                'method': 'substring',
                'score': len(overlap),
                'entry': entry,
                'ordo_name': ordo_name,
                'lect_name': lect_name
            })

    if matches:
        matches.sort(key=lambda x: x['score'], reverse=True)
        return matches[0]

    return None


def generate_mappings():
    """Generate all mappings and return as list."""
    ordo = load_ordo()
    lectionary = load_lectionary()

    print(f"Loaded {len(ordo)} Ordo entries")
    print(f"Loaded {len(lectionary)} Lectionary entries")

    year_letters = {'2025': 'C', '2026': 'A'}

    mappings = []
    stats = {'exact': 0, 'partial': 0, 'none': 0}

    for date, ordo_entry in sorted(ordo.items()):
        year = ordo_entry['year']
        year_letter = year_letters.get(str(year))

        match = find_lectionary_match(ordo_entry, lectionary, year_letter, ordo_data=ordo)

        if match:
            lect_entry = match['entry']
            mappings.append({
                'calendar_date': date,
                'ordo_name': ordo_entry['name'],
                'ordo_rank': ordo_entry['rank'],
                'lectionary_id': lect_entry.get('Admin Order', ''),
                'lectionary_name': lect_entry.get('Liturgical Day', ''),
                'match_type': match['type'],
                'match_method': match.get('method', 'substring'),
                'first_reading': lect_entry.get('First Reading', ''),
                'psalm': lect_entry.get('Psalm', ''),
                'second_reading': lect_entry.get('Second Reading', ''),
                'gospel': lect_entry.get('Gospel Reading', '')
            })

            if match['type'] == 'exact':
                stats['exact'] += 1
            else:
                stats['partial'] += 1
        else:
            stats['none'] += 1
            mappings.append({
                'calendar_date': date,
                'ordo_name': ordo_entry['name'],
                'ordo_rank': ordo_entry['rank'],
                'lectionary_id': '',
                'lectionary_name': 'NO MATCH',
                'match_type': 'none',
                'match_method': '',
                'first_reading': '',
                'psalm': '',
                'second_reading': '',
                'gospel': ''
            })

    print(f"\nStatistics:")
    print(f"  Exact matches: {stats['exact']} ({stats['exact']/len(ordo)*100:.1f}%)")
    print(f"  Partial matches: {stats['partial']} ({stats['partial']/len(ordo)*100:.1f}%)")
    print(f"  No matches: {stats['none']} ({stats['none']/len(ordo)*100:.1f}%)")
    print(f"  Total coverage: {(stats['exact']+stats['partial'])/len(ordo)*100:.1f}%")

    return mappings


def write_csv(mappings, output_file='data/generated/ordo_lectionary_mapping.csv'):
    """Write mappings to CSV."""
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'calendar_date', 'ordo_name', 'ordo_rank',
            'lectionary_id', 'lectionary_name', 'match_type', 'match_method',
            'first_reading', 'psalm', 'second_reading', 'gospel'
        ])
        writer.writeheader()
        writer.writerows(mappings)
    print(f"\n✅ Mapping saved to: {output_file}")


def get_supabase_client():
    """Get Supabase client from environment."""
    from dotenv import load_dotenv
    load_dotenv()

    url = os.environ.get('PUBLIC_SUPABASE_URL')
    key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

    if not url or not key:
        print("ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env")
        sys.exit(1)

    from supabase import create_client
    return create_client(url, key)


def push_to_temp_table(mappings):
    """Push mappings to temp table for testing."""
    supabase = get_supabase_client()

    # Create temp table if not exists and clear it
    print("\nCreating/clearing temp table...")
    supabase.rpc('exec_sql', {'query': '''
        CREATE TABLE IF NOT EXISTS ordo_lectionary_mapping_temp (
            id SERIAL PRIMARY KEY,
            calendar_date DATE NOT NULL,
            lectionary_id INTEGER,
            match_type TEXT,
            match_method TEXT,
            ordo_name TEXT,
            lectionary_name TEXT,
            first_reading TEXT,
            gospel TEXT
        );
        TRUNCATE ordo_lectionary_mapping_temp;
    '''}).execute()

    # Insert in batches
    print("Inserting mappings...")
    batch_size = 100
    for i in range(0, len(mappings), batch_size):
        batch = mappings[i:i+batch_size]
        rows = [{
            'calendar_date': m['calendar_date'],
            'lectionary_id': int(m['lectionary_id']) if m['lectionary_id'] else None,
            'match_type': m['match_type'],
            'match_method': m['match_method'],
            'ordo_name': m['ordo_name'],
            'lectionary_name': m['lectionary_name'],
            'first_reading': m['first_reading'],
            'gospel': m['gospel']
        } for m in batch]
        supabase.table('ordo_lectionary_mapping_temp').insert(rows).execute()
        print(f"  Inserted {min(i+batch_size, len(mappings))}/{len(mappings)}")

    print(f"\n✅ Pushed {len(mappings)} rows to ordo_lectionary_mapping_temp")
    print("\nQuery with: SELECT * FROM ordo_lectionary_mapping_temp WHERE calendar_date IN ('2025-01-17', '2025-04-28', '2025-11-10');")


def push_to_production(mappings):
    """Push mappings to production table."""
    supabase = get_supabase_client()

    print("\nClearing production table...")
    supabase.table('ordo_lectionary_mapping').delete().neq('calendar_date', '1900-01-01').execute()

    print("Inserting mappings...")
    batch_size = 100
    for i in range(0, len(mappings), batch_size):
        batch = mappings[i:i+batch_size]
        rows = [{
            'calendar_date': m['calendar_date'],
            'lectionary_id': int(m['lectionary_id']) if m['lectionary_id'] else None,
            'match_type': m['match_type'],
            'match_method': m['match_method']
        } for m in batch]
        supabase.table('ordo_lectionary_mapping').insert(rows).execute()
        print(f"  Inserted {min(i+batch_size, len(mappings))}/{len(mappings)}")

    print(f"\n✅ Pushed {len(mappings)} rows to ordo_lectionary_mapping (PRODUCTION)")


def check_test_dates():
    """Query specific test dates from temp table."""
    supabase = get_supabase_client()

    test_dates = [
        '2025-01-17',  # St Anthony (Memorial) - should get Friday Week 1 OT
        '2025-03-07',  # Friday after Ash Wed - should get Lent reading
        '2025-03-08',  # Saturday after Ash Wed
        '2025-03-17',  # St Patrick (Feast) - should get saint readings
        '2025-04-13',  # Palm Sunday
        '2025-04-28',  # St Peter Chanel (Memorial) - should get Easter Week 2 Mon
        '2025-04-29',  # St Catherine (Memorial) - should get Easter Week 2 Tue
        '2025-11-10',  # St Leo (Memorial) - should get Week 32 Mon
        '2025-12-03',  # St Francis Xavier (Memorial) - should get Advent reading
    ]

    print("\n" + "="*80)
    print("TEST DATE VERIFICATION")
    print("="*80)

    result = supabase.table('ordo_lectionary_mapping_temp')\
        .select('*')\
        .in_('calendar_date', test_dates)\
        .execute()

    for row in sorted(result.data, key=lambda x: x['calendar_date']):
        print(f"\n{row['calendar_date']}: {row['ordo_name']}")
        print(f"  → {row['lectionary_name']}")
        print(f"  Method: {row['match_method']}")
        print(f"  Readings: {row['first_reading'][:30]}... | {row['gospel'][:30]}...")


def main():
    parser = argparse.ArgumentParser(description='Generate Ordo-to-Lectionary mapping')
    parser.add_argument('--dry-run', action='store_true', help='Push to temp table for testing')
    parser.add_argument('--push', action='store_true', help='Push to production table')
    parser.add_argument('--check', action='store_true', help='Check test dates from temp table')
    args = parser.parse_args()

    if args.check:
        check_test_dates()
        return

    print("Generating Ordo-to-Lectionary mapping...")
    mappings = generate_mappings()

    # Always write CSV
    write_csv(mappings)

    if args.dry_run:
        push_to_temp_table(mappings)
    elif args.push:
        confirm = input("\n⚠️  This will overwrite PRODUCTION data. Type 'yes' to confirm: ")
        if confirm.lower() == 'yes':
            push_to_production(mappings)
        else:
            print("Cancelled.")


if __name__ == '__main__':
    main()

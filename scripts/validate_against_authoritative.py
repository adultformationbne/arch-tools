#!/usr/bin/env python3
"""
Validate our generated liturgical calendar against the authoritative 2025.csv and 2026.csv files
"""

import csv
import re
from datetime import datetime
from difflib import SequenceMatcher

def normalize_name(name):
    """Normalize liturgical names for comparison"""
    name = name.upper().strip()
    # Remove common variations
    name = re.sub(r'\s+', ' ', name)  # Multiple spaces to single
    name = re.sub(r'[,.]', '', name)  # Remove commas and periods
    name = re.sub(r'\bST\b', 'SAINT', name)
    name = re.sub(r'\bSS\b', 'SAINTS', name)
    name = re.sub(r'\bTHE\b', '', name)
    name = re.sub(r'\bOF\b', '', name)
    name = re.sub(r'\bIN\b', '', name)
    name = re.sub(r'\bAND\b', '&', name)
    # Remove extra words
    name = re.sub(r'\(.*?\)', '', name)  # Remove parentheses content
    name = re.sub(r'\s+', ' ', name).strip()
    return name

def similarity_ratio(str1, str2):
    """Calculate similarity ratio between two strings"""
    return SequenceMatcher(None, str1, str2).ratio()

def parse_authoritative_csv(filename, year):
    """Parse authoritative calendar CSV file"""
    calendar = {}

    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header row

        current_date = None
        current_names = []

        for row in reader:
            if not row or len(row) < 2:
                continue

            date_str = row[0].strip() if row[0] else ''
            name_str = row[1].strip() if len(row) > 1 and row[1] else ''

            # Skip empty rows and section headers
            if not date_str and not name_str:
                continue
            if 'YEAR' in name_str.upper() and not date_str:
                continue

            # If we have a date, save previous date's data and start new date
            if date_str and not date_str.startswith(','):
                # Save previous date
                if current_date and current_names:
                    calendar[current_date] = current_names

                # Parse new date
                try:
                    # Handle "1 January", "2 February", etc.
                    date_obj = datetime.strptime(f"{date_str} {year}", "%d %B %Y")
                    current_date = date_obj.strftime('%Y-%m-%d')
                    current_names = [name_str] if name_str else []
                except ValueError:
                    # Not a valid date, might be a continuation
                    if current_date and name_str:
                        current_names.append(name_str)
            else:
                # Row without date - this is an additional name for current date
                if current_date and name_str:
                    current_names.append(name_str)

        # Save last date
        if current_date and current_names:
            calendar[current_date] = current_names

    return calendar

def load_our_calendar(filename, year):
    """Load our generated calendar for a specific year"""
    calendar = {}

    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['year'] == str(year):
                date = row['calendar_date']
                name = row['liturgical_name']
                calendar[date] = name

    return calendar

def compare_calendars(auth_calendar, our_calendar, year):
    """Compare authoritative calendar with our generated calendar"""
    results = {
        'total_dates': len(auth_calendar),
        'exact_matches': 0,
        'fuzzy_matches': 0,
        'mismatches': [],
        'missing_dates': []
    }

    for date, auth_names in sorted(auth_calendar.items()):
        if date not in our_calendar:
            results['missing_dates'].append({
                'date': date,
                'expected': auth_names
            })
            continue

        our_name = our_calendar[date]

        # Check for exact match with any of the authoritative names
        exact_match = False
        best_match = None
        best_ratio = 0

        for auth_name in auth_names:
            # Exact match
            if our_name == auth_name:
                exact_match = True
                break

            # Fuzzy match
            norm_auth = normalize_name(auth_name)
            norm_our = normalize_name(our_name)

            if norm_auth == norm_our:
                exact_match = True
                break

            # Calculate similarity
            ratio = similarity_ratio(norm_auth, norm_our)
            if ratio > best_ratio:
                best_ratio = ratio
                best_match = auth_name

        if exact_match:
            results['exact_matches'] += 1
        elif best_ratio >= 0.6:  # 60% similarity threshold
            results['fuzzy_matches'] += 1
            results['mismatches'].append({
                'date': date,
                'expected': auth_names,
                'actual': our_name,
                'similarity': f"{best_ratio*100:.0f}%"
            })
        else:
            results['mismatches'].append({
                'date': date,
                'expected': auth_names,
                'actual': our_name,
                'similarity': f"{best_ratio*100:.0f}%"
            })

    return results

def main():
    print("=" * 80)
    print("VALIDATING CALENDAR AGAINST AUTHORITATIVE SOURCES")
    print("=" * 80)

    # Load our generated calendar
    print("\nLoading our generated calendar...")
    our_calendar_2025 = load_our_calendar('data/generated/liturgical_calendar_full.csv', 2025)
    our_calendar_2026 = load_our_calendar('data/generated/liturgical_calendar_full.csv', 2026)
    print(f"  2025: {len(our_calendar_2025)} dates")
    print(f"  2026: {len(our_calendar_2026)} dates")

    # Load authoritative calendars
    print("\nLoading authoritative calendars...")
    auth_calendar_2025 = parse_authoritative_csv('data/source/2025.csv', 2025)
    auth_calendar_2026 = parse_authoritative_csv('data/source/2026.csv', 2026)
    print(f"  2025.csv: {len(auth_calendar_2025)} dates")
    print(f"  2026.csv: {len(auth_calendar_2026)} dates")

    # Compare 2025
    print("\n" + "=" * 80)
    print("VALIDATING 2025")
    print("=" * 80)
    results_2025 = compare_calendars(auth_calendar_2025, our_calendar_2025, 2025)

    total = results_2025['total_dates']
    exact = results_2025['exact_matches']
    fuzzy = results_2025['fuzzy_matches']
    mismatches = len(results_2025['mismatches'])
    missing = len(results_2025['missing_dates'])

    print(f"\nResults:")
    print(f"  Total dates in authoritative calendar: {total}")
    print(f"  ✅ Exact matches: {exact} ({exact*100//total}%)")
    print(f"  ⚠️  Fuzzy matches: {fuzzy} ({fuzzy*100//total}%)")
    print(f"  ❌ Mismatches: {mismatches} ({mismatches*100//total}%)")
    print(f"  ❓ Missing dates: {missing}")
    print(f"\n  📊 Overall accuracy: {(exact+fuzzy)*100//total}%")

    if results_2025['mismatches']:
        print(f"\n⚠️  First 20 mismatches for 2025:")
        for i, mismatch in enumerate(results_2025['mismatches'][:20]):
            date = datetime.strptime(mismatch['date'], '%Y-%m-%d').strftime('%b %d')
            print(f"\n  {i+1}. {date} ({mismatch.get('similarity', 'N/A')} match)")
            print(f"     Expected: {', '.join(mismatch['expected'])}")
            print(f"     Got:      {mismatch['actual']}")

    if results_2025['missing_dates']:
        print(f"\n❌ Missing dates in 2025:")
        for missing in results_2025['missing_dates'][:10]:
            date = datetime.strptime(missing['date'], '%Y-%m-%d').strftime('%b %d')
            print(f"  • {date}: {', '.join(missing['expected'])}")

    # Compare 2026
    print("\n" + "=" * 80)
    print("VALIDATING 2026")
    print("=" * 80)
    results_2026 = compare_calendars(auth_calendar_2026, our_calendar_2026, 2026)

    total = results_2026['total_dates']
    exact = results_2026['exact_matches']
    fuzzy = results_2026['fuzzy_matches']
    mismatches = len(results_2026['mismatches'])
    missing = len(results_2026['missing_dates'])

    print(f"\nResults:")
    print(f"  Total dates in authoritative calendar: {total}")
    print(f"  ✅ Exact matches: {exact} ({exact*100//total}%)")
    print(f"  ⚠️  Fuzzy matches: {fuzzy} ({fuzzy*100//total}%)")
    print(f"  ❌ Mismatches: {mismatches} ({mismatches*100//total}%)")
    print(f"  ❓ Missing dates: {missing}")
    print(f"\n  📊 Overall accuracy: {(exact+fuzzy)*100//total}%")

    if results_2026['mismatches']:
        print(f"\n⚠️  First 10 mismatches for 2026:")
        for i, mismatch in enumerate(results_2026['mismatches'][:10]):
            date = datetime.strptime(mismatch['date'], '%Y-%m-%d').strftime('%b %d')
            print(f"\n  {i+1}. {date} ({mismatch.get('similarity', 'N/A')} match)")
            print(f"     Expected: {', '.join(mismatch['expected'])}")
            print(f"     Got:      {mismatch['actual']}")

    print("\n" + "=" * 80)
    print("VALIDATION COMPLETE")
    print("=" * 80)

if __name__ == '__main__':
    main()

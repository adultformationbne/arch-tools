#!/usr/bin/env python3
"""
Comprehensive validation of generated calendar against authoritative source files
Compares 2025.csv and 2026.csv against generated liturgical_calendar_full.csv
"""
import csv
import re
from datetime import datetime, timedelta
from collections import defaultdict

def parse_authoritative_csv(filename, year):
    """Parse authoritative CSV and extract key information"""
    entries = {}
    current_week = None
    current_season = 'Ordinary Time'

    with open(filename, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue

            date_str = row[0].strip()
            description = row[1].strip() if len(row) > 1 else ''

            # Skip header rows and empty descriptions
            if not date_str or not description or 'YEAR' in date_str:
                continue

            # Parse date (format: "1 January" or just empty if continuation)
            if date_str:
                # Extract day and month
                match = re.match(r'(\d+)\s+(\w+)', date_str)
                if match:
                    day = int(match.group(1))
                    month_name = match.group(2)

                    # Convert month name to number
                    month_map = {
                        'January': 1, 'February': 2, 'March': 3, 'April': 4,
                        'May': 5, 'June': 6, 'July': 7, 'August': 8,
                        'September': 9, 'October': 10, 'November': 11, 'December': 12
                    }

                    if month_name in month_map:
                        month = month_map[month_name]
                        date_key = f"{year}-{month:02d}-{day:02d}"

                        # Detect week numbers from description
                        # Format: "2 ORDINARY", "3 LENT", "FIRST SUNDAY OF ADVENT"
                        week_match = re.match(r'^(\d+)\s+(ORDINARY|LENT|ADVENT|EASTER)', description)
                        if week_match:
                            current_week = int(week_match.group(1))
                            current_season = week_match.group(2).title()
                            if current_season == 'Ordinary':
                                current_season = 'Ordinary Time'
                        elif 'FIRST SUNDAY OF ADVENT' in description.upper():
                            current_week = 1
                            current_season = 'Advent'
                        elif 'PASSION SUNDAY' in description.upper() or 'PALM SUNDAY' in description.upper():
                            current_season = 'Holy Week'
                            current_week = None
                        elif 'EASTER SUNDAY' in description.upper():
                            current_season = 'Easter'
                            current_week = 1
                        elif 'Christmas' in description or 'NATIVITY OF THE LORD' in description.upper():
                            current_season = 'Christmas'
                            current_week = None

                        # Extract week from description for weekdays
                        # Format: "Monday of the first week in Ordinary Time"
                        weekday_match = re.search(r'of the (\w+) week in Ordinary Time', description, re.IGNORECASE)
                        if weekday_match:
                            week_word = weekday_match.group(1)
                            week_map = {
                                'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
                                'sixth': 6, 'seventh': 7, 'eighth': 8, 'ninth': 9, 'tenth': 10,
                                'eleventh': 11, 'twelfth': 12, 'thirteenth': 13, 'fourteenth': 14,
                                'fifteenth': 15, 'sixteenth': 16, 'seventeenth': 17, 'eighteenth': 18,
                                'nineteenth': 19, 'twentieth': 20, 'twenty-first': 21, 'twenty-second': 22,
                                'twenty-third': 23, 'twenty-fourth': 24, 'twenty-fifth': 25, 'twenty-sixth': 26,
                                'twenty-seventh': 27, 'twenty-eighth': 28, 'twenty-ninth': 29, 'thirtieth': 30,
                                'thirty-first': 31, 'thirty-second': 32, 'thirty-third': 33, 'thirty-fourth': 34
                            }
                            if week_word in week_map:
                                current_week = week_map[week_word]

                        # Similar for other seasons
                        for season_name in ['Lent', 'Advent', 'Easter']:
                            weekday_match = re.search(rf'of the (\w+(?:-\w+)?) week (?:in|of) {season_name}', description, re.IGNORECASE)
                            if weekday_match:
                                week_word = weekday_match.group(1)
                                week_map = {
                                    'first': 1, 'second': 2, 'third': 3, 'fourth': 4, 'fifth': 5,
                                    'sixth': 6, 'seventh': 7
                                }
                                if week_word in week_map:
                                    current_week = week_map[week_word]
                                    current_season = season_name

                        entries[date_key] = {
                            'date': date_key,
                            'season': current_season,
                            'week': current_week,
                            'description': description
                        }

    return entries

def load_generated_calendar():
    """Load generated calendar"""
    entries = {}
    with open('data/generated/liturgical_calendar_full.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            date_key = row['calendar_date']
            week_val = row['liturgical_week']
            entries[date_key] = {
                'date': date_key,
                'season': row['liturgical_season'],
                'week': int(week_val) if week_val and week_val != '' else None,
                'name': row['liturgical_name'],
                'rank': row['liturgical_rank']
            }
    return entries

def validate_year(year, auth_file):
    """Validate a specific year"""
    print(f"\n{'='*80}")
    print(f"VALIDATING {year}")
    print(f"{'='*80}\n")

    # Load data
    print(f"Loading authoritative data from {auth_file}...")
    auth_data = parse_authoritative_csv(auth_file, year)
    print(f"  Found {len(auth_data)} entries")

    print(f"Loading generated calendar...")
    gen_data = load_generated_calendar()
    gen_year_data = {k: v for k, v in gen_data.items() if k.startswith(str(year))}
    print(f"  Found {len(gen_year_data)} entries for {year}")

    # Validation
    mismatches = []
    season_errors = 0
    week_errors = 0
    missing_dates = 0

    print(f"\nValidating dates...\n")

    for date_key, auth_entry in sorted(auth_data.items()):
        if date_key not in gen_year_data:
            missing_dates += 1
            mismatches.append({
                'date': date_key,
                'type': 'MISSING',
                'auth': auth_entry,
                'gen': None
            })
            continue

        gen_entry = gen_year_data[date_key]

        # Compare season
        season_match = auth_entry['season'] == gen_entry['season']

        # Compare week (more lenient - only compare if auth has a week)
        week_match = True
        if auth_entry['week'] is not None:
            week_match = auth_entry['week'] == gen_entry['week']

        if not season_match:
            season_errors += 1
            mismatches.append({
                'date': date_key,
                'type': 'SEASON',
                'auth': auth_entry,
                'gen': gen_entry
            })
        elif not week_match:
            week_errors += 1
            mismatches.append({
                'date': date_key,
                'type': 'WEEK',
                'auth': auth_entry,
                'gen': gen_entry
            })

    # Report results
    print(f"{'='*80}")
    print(f"VALIDATION RESULTS FOR {year}")
    print(f"{'='*80}")
    print(f"Total dates checked: {len(auth_data)}")
    print(f"Missing dates: {missing_dates}")
    print(f"Season mismatches: {season_errors}")
    print(f"Week mismatches: {week_errors}")
    print(f"Total errors: {len(mismatches)}")

    if mismatches:
        print(f"\n{'='*80}")
        print(f"ERRORS FOUND ({len(mismatches)} total)")
        print(f"{'='*80}\n")

        # Group by type
        by_type = defaultdict(list)
        for m in mismatches:
            by_type[m['type']].append(m)

        for error_type, errors in sorted(by_type.items()):
            print(f"\n{error_type} ERRORS ({len(errors)}):")
            print("-" * 80)
            for err in errors[:10]:  # Show first 10 of each type
                print(f"\n  Date: {err['date']}")
                if err['type'] == 'MISSING':
                    print(f"    ❌ Missing from generated calendar")
                    print(f"    Expected: {err['auth']['season']} Week {err['auth']['week']}")
                    print(f"    Description: {err['auth']['description']}")
                else:
                    print(f"    Auth: {err['auth']['season']} Week {err['auth']['week']}")
                    print(f"    Gen:  {err['gen']['season']} Week {err['gen']['week']}")
                    print(f"    Description: {err['auth']['description']}")
                    print(f"    Generated: {err['gen']['name']} ({err['gen']['rank']})")

            if len(errors) > 10:
                print(f"\n  ... and {len(errors) - 10} more {error_type} errors")
    else:
        print(f"\n✅ ALL VALIDATIONS PASSED!")

    print(f"\n{'='*80}\n")

    return len(mismatches) == 0

def main():
    print("="*80)
    print("COMPREHENSIVE LITURGICAL CALENDAR VALIDATION")
    print("="*80)

    all_pass = True

    # Validate 2025
    if not validate_year(2025, 'data/source/2025.csv'):
        all_pass = False

    # Validate 2026 if file exists
    try:
        if not validate_year(2026, 'data/source/2026.csv'):
            all_pass = False
    except FileNotFoundError:
        print("\n⚠️  2026.csv not found - skipping 2026 validation")

    # Final summary
    print("\n" + "="*80)
    if all_pass:
        print("✅ ALL YEARS VALIDATED SUCCESSFULLY!")
    else:
        print("❌ VALIDATION FAILED - See errors above")
    print("="*80)

if __name__ == '__main__':
    main()

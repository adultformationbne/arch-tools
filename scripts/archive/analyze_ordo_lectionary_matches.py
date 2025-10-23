#!/usr/bin/env python3
"""
Analyze matching between normalized Ordo and Lectionary.
Identifies all mismatches and suggests Lectionary updates.
"""

import csv
from collections import defaultdict

def normalize_for_comparison(text):
    """Simple normalization for comparison"""
    if not text:
        return ""
    return text.upper().strip()

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
    """Load lectionary data, indexed by liturgical day name"""
    lectionary = []
    with open('data/source/Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            lectionary.append(row)
    return lectionary

def find_lectionary_match(ordo_entry, lectionary_entries, year_letter):
    """
    Find matching lectionary entry for an ordo entry.
    Tries exact match first, then fuzzy matching.
    """
    ordo_name = ordo_entry['name']
    ordo_name_norm = normalize_for_comparison(ordo_name)

    season = ordo_entry['season']
    week = ordo_entry['week']

    # Map season to Lectionary "Time"
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

        # Check year match
        if year_letter and lect_year not in [year_letter, '']:
            continue

        # Check season/time match
        if expected_time and lect_time and expected_time.upper() != lect_time.upper():
            continue

        # Check week match
        if week and lect_week and str(week) != str(lect_week):
            continue

        # Exact match
        if ordo_name_norm == lect_name_norm:
            return {
                'type': 'exact',
                'lectionary_entry': entry,
                'ordo_name': ordo_name,
                'lectionary_name': lect_name
            }

        # Check if ordo name contains lectionary name or vice versa
        if ordo_name_norm in lect_name_norm or lect_name_norm in ordo_name_norm:
            matches.append({
                'type': 'partial',
                'score': len(set(ordo_name_norm.split()) & set(lect_name_norm.split())),
                'lectionary_entry': entry,
                'ordo_name': ordo_name,
                'lectionary_name': lect_name
            })

    # Return best partial match
    if matches:
        matches.sort(key=lambda x: x['score'], reverse=True)
        return matches[0]

    return None

def main():
    print("="*80)
    print("ORDO-LECTIONARY MATCHING ANALYSIS")
    print("="*80)

    # Load data
    print("\nLoading data...")
    ordo = load_ordo()
    lectionary = load_lectionary()
    print(f"  Ordo entries: {len(ordo)}")
    print(f"  Lectionary entries: {len(lectionary)}")

    # Determine year letters for 2025 and 2026
    # 2025: Year C (starts Nov 30, 2024) continues through Nov 29, 2025
    # 2026: Year A (starts Nov 30, 2025)
    year_letters = {
        '2025': 'C',  # Simplified - actually transitions during year
        '2026': 'A'
    }

    # Analyze matches
    print("\n" + "="*80)
    print("ANALYZING MATCHES")
    print("="*80)

    exact_matches = 0
    partial_matches = 0
    no_matches = []

    for date, entry in sorted(ordo.items()):
        year = entry['year']
        year_letter = year_letters.get(str(year))

        match = find_lectionary_match(entry, lectionary, year_letter)

        if match:
            if match['type'] == 'exact':
                exact_matches += 1
            else:
                partial_matches += 1
                print(f"\n⚠️  PARTIAL MATCH: {date}")
                print(f"    Ordo:       {entry['name']}")
                print(f"    Lectionary: {match['lectionary_name']}")
        else:
            no_matches.append({
                'date': date,
                'ordo': entry
            })

    # Report results
    print("\n" + "="*80)
    print("RESULTS SUMMARY")
    print("="*80)
    print(f"Total ordo entries: {len(ordo)}")
    print(f"Exact matches: {exact_matches} ({exact_matches/len(ordo)*100:.1f}%)")
    print(f"Partial matches: {partial_matches} ({partial_matches/len(ordo)*100:.1f}%)")
    print(f"No matches: {len(no_matches)} ({len(no_matches)/len(ordo)*100:.1f}%)")

    if no_matches:
        print("\n" + "="*80)
        print(f"NO MATCHES FOUND ({len(no_matches)} entries)")
        print("="*80)

        # Group by season
        by_season = defaultdict(list)
        for item in no_matches:
            season = item['ordo']['season'] or 'Unknown'
            by_season[season].append(item)

        for season, items in sorted(by_season.items()):
            print(f"\n{season} ({len(items)} entries):")
            print("-" * 80)
            for item in items[:10]:  # Show first 10
                entry = item['ordo']
                print(f"  {item['date']}: {entry['name']}")
                print(f"    Season: {entry['season']}, Week: {entry['week']}, Rank: {entry['rank']}")

            if len(items) > 10:
                print(f"  ... and {len(items) - 10} more")

    print("\n" + "="*80)
    print("RECOMMENDATIONS")
    print("="*80)
    print("""
1. For EXACT matches: No action needed - readings will auto-link

2. For PARTIAL matches: Review and decide:
   - Update Lectionary.csv to use Ordo naming, OR
   - Create alias/mapping table

3. For NO matches: These need manual review:
   - Check if Lectionary has the entry under different name
   - Check if it's a ferial day (uses seasonal readings)
   - Add missing entries to Lectionary if needed
    """)

if __name__ == '__main__':
    main()

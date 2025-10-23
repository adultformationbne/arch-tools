#!/usr/bin/env python3
"""
Link Ordo entries to Lectionary readings.
Generates a complete CSV with all matches for review before database import.

Output: data/generated/ordo_lectionary_linked.csv
"""

import csv
import re
from collections import defaultdict

def normalize_for_matching(text):
    """Normalize text for flexible matching"""
    if not text:
        return ""

    # Uppercase and strip
    normalized = text.upper().strip()

    # Remove year suffixes: " - Year A", ", Year C", " Year A", etc.
    normalized = re.sub(r'[,\-\s]+YEAR\s+[ABC](?:/[ABC])?$', '', normalized)

    # Remove "THE" prefix
    normalized = re.sub(r'^THE\s+', '', normalized)

    # Remove season suffixes from ferial day names
    # e.g., "Monday of the first week in Ordinary Time" -> "Monday of the first week"
    normalized = re.sub(r'\s+IN\s+(ORDINARY TIME|ADVENT|LENT|EASTER)$', '', normalized)
    normalized = re.sub(r'\s+OF\s+(ORDINARY TIME|ADVENT|LENT|EASTER)$', '', normalized)

    return normalized

def extract_matching_key(ordo_entry):
    """
    Extract key components from Ordo entry for matching.
    Returns: (season, week, day_type, normalized_name)
    """
    name = ordo_entry['name']
    season = ordo_entry['season']
    week = ordo_entry['week']
    rank = ordo_entry['rank']

    # Determine day type from name
    day_type = None
    if 'Monday' in name:
        day_type = 'Monday'
    elif 'Tuesday' in name:
        day_type = 'Tuesday'
    elif 'Wednesday' in name:
        day_type = 'Wednesday'
    elif 'Thursday' in name:
        day_type = 'Thursday'
    elif 'Friday' in name:
        day_type = 'Friday'
    elif 'Saturday' in name:
        day_type = 'Saturday'
    elif 'Sunday' in name or rank == 'Sunday':
        day_type = 'Sunday'

    normalized_name = normalize_for_matching(name)

    return (season, week, day_type, normalized_name)

def load_ordo():
    """Load normalized ordo data"""
    ordo = []
    with open('data/generated/ordo_normalized.csv', 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            ordo.append({
                'date': row['calendar_date'],
                'year': row['year'],
                'season': row['liturgical_season'],
                'week': row['liturgical_week'],
                'name': row['liturgical_name'],
                'rank': row['liturgical_rank']
            })
    return ordo

def load_lectionary():
    """Load lectionary and create lookup indices"""
    lectionary = []

    # Index by different criteria for fast lookup
    by_name = defaultdict(list)
    by_season_week_day = defaultdict(list)

    with open('data/source/Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            lectionary.append(row)

            # Index by normalized name
            name = row.get('Liturgical Day', '')
            name_norm = normalize_for_matching(name)
            by_name[name_norm].append(row)

            # Index by season/week/day
            season = row.get('Time', '')
            week = row.get('Week', '')
            day = row.get('Day', '')
            if season and day:
                key = (season.upper(), week, day.title())
                by_season_week_day[key].append(row)

    return {
        'entries': lectionary,
        'by_name': by_name,
        'by_season_week_day': by_season_week_day
    }

def find_lectionary_match(ordo_entry, lectionary_indices, year_letter):
    """
    Find matching lectionary reading(s) for an ordo entry.

    Strategy:
    1. Try exact name match (after normalization)
    2. Try season + week + day match (for ferial days)
    3. Return all candidates with confidence scores
    """
    season, week, day_type, name_norm = extract_matching_key(ordo_entry)

    matches = []

    # Strategy 1: Exact name match
    if name_norm in lectionary_indices['by_name']:
        candidates = lectionary_indices['by_name'][name_norm]
        for candidate in candidates:
            # Filter by year if applicable
            cand_year = candidate.get('Year', '')
            if year_letter and cand_year and cand_year not in [year_letter, '']:
                continue

            matches.append({
                'entry': candidate,
                'confidence': 'EXACT_NAME',
                'method': 'Name match'
            })

    # Strategy 2: Season + Week + Day match (for ferial days)
    if season and day_type:
        # Map our season names to Lectionary "Time" values
        season_map = {
            'Ordinary Time': 'Ordinary',
            'Advent': 'Advent',
            'Christmas': 'Christmas',
            'Lent': 'Lent',
            'Holy Week': 'Holy Week',
            'Easter': 'Easter'
        }
        lect_season = season_map.get(season, season)

        # Try with week number
        if week:
            key = (lect_season.upper(), str(week), day_type)
            if key in lectionary_indices['by_season_week_day']:
                for candidate in lectionary_indices['by_season_week_day'][key]:
                    # Filter by year if applicable
                    cand_year = candidate.get('Year', '')
                    if year_letter and cand_year and cand_year not in [year_letter, 'Year I', 'Year II', '']:
                        continue

                    matches.append({
                        'entry': candidate,
                        'confidence': 'SEASON_WEEK_DAY',
                        'method': f'{lect_season} Week {week} {day_type}'
                    })

        # Try without week number (for special days)
        key_no_week = (lect_season.upper(), '', day_type)
        if key_no_week in lectionary_indices['by_season_week_day']:
            for candidate in lectionary_indices['by_season_week_day'][key_no_week]:
                cand_year = candidate.get('Year', '')
                if year_letter and cand_year and cand_year not in [year_letter, '']:
                    continue

                matches.append({
                    'entry': candidate,
                    'confidence': 'SEASON_DAY',
                    'method': f'{lect_season} {day_type}'
                })

    # Remove duplicates (same lectionary entry matched multiple ways)
    seen = set()
    unique_matches = []
    for match in matches:
        entry_id = match['entry'].get('Admin Order', '')
        if entry_id not in seen:
            seen.add(entry_id)
            unique_matches.append(match)

    # Sort by confidence
    confidence_order = ['EXACT_NAME', 'SEASON_WEEK_DAY', 'SEASON_DAY']
    unique_matches.sort(key=lambda m: confidence_order.index(m['confidence']) if m['confidence'] in confidence_order else 999)

    return unique_matches

def main():
    print("="*80)
    print("LINKING ORDO TO LECTIONARY")
    print("="*80)

    # Load data
    print("\nLoading data...")
    ordo = load_ordo()
    lectionary_indices = load_lectionary()
    print(f"  Ordo entries: {len(ordo)}")
    print(f"  Lectionary entries: {len(lectionary_indices['entries'])}")

    # Determine year letters and weekday cycles
    # Sunday Year: C for 2025, A for 2026 (changes at Advent)
    # Weekday Year: I for odd years (2025), II for even years (2026)
    year_info = {
        '2025': {'sunday': 'C', 'weekday': '1'},  # Odd year = Year I
        '2026': {'sunday': 'A', 'weekday': '2'}   # Even year = Year II
    }

    # Process each ordo entry
    print("\nMatching entries...")
    results = []
    stats = {
        'exact_name': 0,
        'season_week_day': 0,
        'season_day': 0,
        'no_match': 0,
        'multiple_matches': 0
    }

    for ordo_entry in ordo:
        year_data = year_info.get(ordo_entry['year'], {})

        # Determine which year to use based on rank
        # Sundays and Solemnities use Sunday year (A/B/C)
        # Weekdays use weekday year (I/II represented as 1/2 in Lectionary)
        rank = ordo_entry['rank']
        if rank in ['Sunday', 'Solemnity', 'Feast']:
            year_letter = year_data.get('sunday')
        else:
            year_letter = year_data.get('weekday')

        matches = find_lectionary_match(ordo_entry, lectionary_indices, year_letter)

        if not matches:
            stats['no_match'] += 1
            results.append({
                **ordo_entry,
                'match_status': 'NO_MATCH',
                'match_method': '',
                'lectionary_day': '',
                'first_reading': '',
                'psalm': '',
                'second_reading': '',
                'gospel': '',
                'admin_order': ''
            })
        elif len(matches) == 1:
            match = matches[0]
            stats[match['confidence'].lower()] = stats.get(match['confidence'].lower(), 0) + 1

            lect_entry = match['entry']
            results.append({
                **ordo_entry,
                'match_status': 'MATCHED',
                'match_confidence': match['confidence'],
                'match_method': match['method'],
                'lectionary_day': lect_entry.get('Liturgical Day', ''),
                'first_reading': lect_entry.get('First Reading', ''),
                'psalm': lect_entry.get('Psalm', ''),
                'second_reading': lect_entry.get('Second Reading', ''),
                'gospel': lect_entry.get('Gospel Reading', ''),
                'admin_order': lect_entry.get('Admin Order', ''),
                'year_cycle': lect_entry.get('Year', '')
            })
        else:
            # Multiple matches - take the best one but flag it
            stats['multiple_matches'] += 1
            match = matches[0]  # Best match

            lect_entry = match['entry']
            results.append({
                **ordo_entry,
                'match_status': 'MULTIPLE_MATCHES',
                'match_confidence': match['confidence'],
                'match_method': match['method'],
                'match_count': len(matches),
                'lectionary_day': lect_entry.get('Liturgical Day', ''),
                'first_reading': lect_entry.get('First Reading', ''),
                'psalm': lect_entry.get('Psalm', ''),
                'second_reading': lect_entry.get('Second Reading', ''),
                'gospel': lect_entry.get('Gospel Reading', ''),
                'admin_order': lect_entry.get('Admin Order', ''),
                'year_cycle': lect_entry.get('Year', '')
            })

    # Save results
    output_file = 'data/generated/ordo_lectionary_linked.csv'
    fieldnames = [
        'date', 'year', 'season', 'week', 'name', 'rank',
        'match_status', 'match_confidence', 'match_method', 'match_count',
        'lectionary_day', 'year_cycle', 'admin_order',
        'first_reading', 'psalm', 'second_reading', 'gospel'
    ]

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(results)

    # Report statistics
    print(f"\n{'='*80}")
    print("RESULTS")
    print(f"{'='*80}")
    print(f"Total entries processed: {len(results)}")
    print(f"\nMatching statistics:")
    print(f"  Exact name matches: {stats.get('exact_name', 0)} ({stats.get('exact_name', 0)/len(results)*100:.1f}%)")
    print(f"  Season+Week+Day matches: {stats.get('season_week_day', 0)} ({stats.get('season_week_day', 0)/len(results)*100:.1f}%)")
    print(f"  Season+Day matches: {stats.get('season_day', 0)} ({stats.get('season_day', 0)/len(results)*100:.1f}%)")
    print(f"  Multiple matches (using best): {stats['multiple_matches']} ({stats['multiple_matches']/len(results)*100:.1f}%)")
    print(f"  No matches: {stats['no_match']} ({stats['no_match']/len(results)*100:.1f}%)")
    print(f"\nOutput saved to: {output_file}")

    # Show sample of no-matches
    if stats['no_match'] > 0:
        print(f"\n{'='*80}")
        print("SAMPLE OF NO MATCHES (first 20)")
        print(f"{'='*80}")
        no_matches = [r for r in results if r['match_status'] == 'NO_MATCH']
        for entry in no_matches[:20]:
            print(f"\n{entry['date']}: {entry['name']}")
            print(f"  Season: {entry['season']}, Week: {entry['week']}, Rank: {entry['rank']}")

    print(f"\n{'='*80}")
    print("NEXT STEPS")
    print(f"{'='*80}")
    print(f"""
1. Review the output file: {output_file}
2. Check NO_MATCH entries - may need manual mapping or lectionary updates
3. Check MULTIPLE_MATCHES entries - verify best match was chosen
4. Once satisfied, this data can be imported to database
""")

if __name__ == '__main__':
    main()

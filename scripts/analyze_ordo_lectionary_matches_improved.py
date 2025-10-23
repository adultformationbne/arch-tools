#!/usr/bin/env python3
"""
Improved Ordo-Lectionary matching with better normalization.
Handles date prefixes, year suffixes, and ordinal/number conversions.
"""

import csv
import re
from collections import defaultdict

def normalize_for_comparison(text):
    """
    Comprehensive normalization for matching Ordo to Lectionary.
    """
    if not text:
        return ""

    text = text.upper().strip()

    # Remove leading quote marks from CSV
    text = text.lstrip('"').rstrip('"')

    # Remove date prefixes like "25 March – " or "1 January — "
    text = re.sub(r'^\d{1,2}\s+[A-Z]+\s*[–—-]\s*', '', text)

    # Remove year suffixes like ", Year A"
    text = re.sub(r',?\s*YEAR\s+[ABC]\s*$', '', text)

    # Normalize ordinal numbers
    ordinal_map = {
        'FIRST': '1',
        'SECOND': '2',
        'THIRD': '3',
        'FOURTH': '4',
        'FIFTH': '5',
        'SIXTH': '6',
        'SEVENTH': '7',
        'EIGHTH': '8',
        'NINTH': '9',
        'TENTH': '10',
        'ELEVENTH': '11',
        'TWELFTH': '12',
        'THIRTEENTH': '13',
        'FOURTEENTH': '14',
        'FIFTEENTH': '15',
        'SIXTEENTH': '16',
        'SEVENTEENTH': '17',
        'EIGHTEENTH': '18',
        'NINETEENTH': '19',
        'TWENTIETH': '20',
        'TWENTY-FIRST': '21',
        'TWENTY-SECOND': '22',
        'TWENTY-THIRD': '23',
        'TWENTY-FOURTH': '24',
        'TWENTY-FIFTH': '25',
        'TWENTY-SIXTH': '26',
        'TWENTY-SEVENTH': '27',
        'TWENTY-EIGHTH': '28',
        'TWENTY-NINTH': '29',
        'THIRTIETH': '30',
        'THIRTY-FIRST': '31',
        'THIRTY-SECOND': '32',
        'THIRTY-THIRD': '33',
        'THIRTY-FOURTH': '34'
    }

    # Sort by length (longest first) to avoid partial replacements
    # e.g., replace "TWENTY-FIRST" before "FIRST"
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

    # Normalize December date format: "17 December" → "17TH DECEMBER"
    december_dates = {
        '17 DECEMBER': '17TH DECEMBER',
        '18 DECEMBER': '18TH DECEMBER',
        '19 DECEMBER': '19TH DECEMBER',
        '20 DECEMBER': '20TH DECEMBER',
        '21 DECEMBER': '21ST DECEMBER',
        '22 DECEMBER': '22ND DECEMBER',
        '23 DECEMBER': '23RD DECEMBER',
        '24 DECEMBER': '24TH DECEMBER',
    }
    for old, new in december_dates.items():
        text = text.replace(old, new)

    # Expand saint abbreviations AFTER other replacements to avoid "MOST" → "MOSAINT"
    # Use word boundaries to avoid replacing ST in MOST, CHRIST, etc.
    text = re.sub(r'\bSS\b\.?\s+', 'SAINTS ', text)
    text = re.sub(r'\bST\b\.?\s+', 'SAINT ', text)

    # Handle Ordo's compact format for Sundays
    # "2 ORDINARY" → "2 SUNDAY"
    # "1 LENT" → "1 SUNDAY LENT"
    # "3 ADVENT" → "3 SUNDAY ADVENT"
    # "5 EASTER" → "5 SUNDAY EASTER"

    # Pattern: "<number> <SEASON>" where season is ORDINARY, LENT, ADVENT, EASTER
    import re as re_module
    sunday_match = re_module.match(r'^(\d+)\s+(ORDINARY|LENT|ADVENT|EASTER)$', text.strip())
    if sunday_match:
        week_num = sunday_match.group(1)
        season = sunday_match.group(2)
        if season == 'ORDINARY':
            text = f"{week_num} SUNDAY"
        else:
            text = f"{week_num} SUNDAY {season}"

    # Normalize "SUNDAY IN <SEASON>" → "SUNDAY <SEASON>"
    # Normalize "SUNDAY OF <SEASON>" → "SUNDAY <SEASON>"
    text = text.replace(' SUNDAY IN LENT', ' SUNDAY LENT')
    text = text.replace(' SUNDAY IN ADVENT', ' SUNDAY ADVENT')
    text = text.replace(' SUNDAY IN EASTER', ' SUNDAY EASTER')
    text = text.replace(' SUNDAY OF LENT', ' SUNDAY LENT')
    text = text.replace(' SUNDAY OF ADVENT', ' SUNDAY ADVENT')
    text = text.replace(' SUNDAY OF EASTER', ' SUNDAY EASTER')

    # Normalize ferial weekday names
    # "Monday of the first week in Ordinary Time" → "Monday of the first week"
    # "Wednesday of the fourth week of Advent" → "Wednesday of the fourth week of Advent" (keep season for special ferias)
    text = text.replace(' IN ORDINARY TIME', '')
    text = text.replace(' OF ORDINARY TIME', '')

    # Remove extra whitespace
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

def find_lectionary_match(ordo_entry, lectionary_entries, year_letter):
    """
    Find matching lectionary entry for an ordo entry.
    Uses improved normalization for better matching.
    """
    ordo_name = ordo_entry['name']
    ordo_name_norm = normalize_for_comparison(ordo_name)
    ordo_date = ordo_entry['date']  # Calendar date like "2025-11-09"

    season = ordo_entry['season']
    week = ordo_entry['week']

    # Extract month and day from ordo date for fixed feast matching
    # "2025-11-09" → (9, "NOVEMBER")
    import datetime
    try:
        dt = datetime.datetime.strptime(ordo_date, '%Y-%m-%d')
        ordo_month = dt.strftime('%B').upper()  # "NOVEMBER"
        ordo_day = dt.day  # 9
    except:
        ordo_month = None
        ordo_day = None

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

        # Extract date from Lectionary name if it has one
        # Pattern 1: "20 September – Ss Andrew Kim..." → (20, "SEPTEMBER")
        # Pattern 2: "3RD JANUARY" → (3, "JANUARY")
        lect_day = None
        lect_month = None

        # Try pattern with dash first
        date_match = re.match(r'^(\d{1,2})\s+([A-Z]+)\s*[–—-]', lect_name.upper())
        if date_match:
            lect_day = int(date_match.group(1))
            lect_month = date_match.group(2)
        else:
            # Try pattern without dash: "3RD JANUARY", "2ND JANUARY"
            date_match = re.match(r'^(\d{1,2})(?:ST|ND|RD|TH)?\s+([A-Z]+)$', lect_name.upper())
            if date_match:
                lect_day = int(date_match.group(1))
                lect_month = date_match.group(2)

        # Skip if wrong year (but allow Season, Feast, and ferial entries which may have Year 1/2)
        # Ferial entries use Year 1 (odd years) or Year 2 (even years) cycles, independent of A/B/C
        # Fixed feast days use Year = 'Feast', Solemnity, or Memorial
        if year_letter and lect_year and lect_year not in [year_letter, 'Season', '1', '2', 'Feast', 'Solemnity', 'Memorial', '']:
            continue

        # For seasonal entries, match on season/time
        # Skip this check if Ordo has no season (saint feast days, memorials have blank season)
        if season and expected_time and lect_time:
            if expected_time.upper() != lect_time.upper():
                continue

        # For weeks, allow flexible matching
        # Skip this check if either week is blank or N/A (ferial entries may have blank week in Ordo)
        if week and lect_week and lect_week != 'N/A':
            if str(week) != str(lect_week):
                continue

        # FIRST: Check for date-based match (for fixed feasts)
        # If both have dates and they match, it's the same feast regardless of name differences
        if ordo_day and ordo_month and lect_day and lect_month:
            if ordo_day == lect_day and ordo_month == lect_month:
                return {
                    'type': 'exact',
                    'match_method': 'date',
                    'lectionary_entry': entry,
                    'ordo_name': ordo_name,
                    'lectionary_name': lect_name,
                    'ordo_norm': ordo_name_norm,
                    'lect_norm': lect_name_norm
                }

        # SECOND: Exact match on normalized names
        if ordo_name_norm == lect_name_norm:
            return {
                'type': 'exact',
                'lectionary_entry': entry,
                'ordo_name': ordo_name,
                'lectionary_name': lect_name,
                'ordo_norm': ordo_name_norm,
                'lect_norm': lect_name_norm
            }

        # Partial match - contains or word overlap
        if ordo_name_norm in lect_name_norm or lect_name_norm in ordo_name_norm:
            ordo_words = set(ordo_name_norm.split())
            lect_words = set(lect_name_norm.split())
            overlap = ordo_words & lect_words
            matches.append({
                'type': 'partial',
                'score': len(overlap),
                'lectionary_entry': entry,
                'ordo_name': ordo_name,
                'lectionary_name': lect_name,
                'ordo_norm': ordo_name_norm,
                'lect_norm': lect_name_norm
            })

    # Return best partial match
    if matches:
        matches.sort(key=lambda x: x['score'], reverse=True)
        return matches[0]

    return None

def main():
    print("="*80)
    print("IMPROVED ORDO-LECTIONARY MATCHING ANALYSIS")
    print("="*80)

    # Load data
    print("\nLoading data...")
    ordo = load_ordo()
    lectionary = load_lectionary()
    print(f"  Ordo entries: {len(ordo)}")
    print(f"  Lectionary entries: {len(lectionary)}")

    # Year letters for liturgical years
    year_letters = {
        '2025': 'C',
        '2026': 'A'
    }

    # Analyze matches
    print("\n" + "="*80)
    print("ANALYZING MATCHES")
    print("="*80)

    exact_matches = 0
    partial_matches = 0
    partial_match_details = []
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
                partial_match_details.append({
                    'date': date,
                    'match': match,
                    'ordo': entry
                })
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

    # Show sample partial matches
    if partial_match_details:
        print("\n" + "="*80)
        print(f"PARTIAL MATCHES - Sample (showing first 20 of {len(partial_match_details)})")
        print("="*80)
        for item in partial_match_details[:20]:
            print(f"\n{item['date']}: {item['ordo']['name']}")
            print(f"  → Lectionary: {item['match']['lectionary_name']}")
            print(f"  Normalized:")
            print(f"    Ordo: {item['match']['ordo_norm']}")
            print(f"    Lect: {item['match']['lect_norm']}")

    # Show no matches by rank
    if no_matches:
        print("\n" + "="*80)
        print(f"NO MATCHES ({len(no_matches)} entries)")
        print("="*80)

        # Group by rank
        by_rank = defaultdict(list)
        for item in no_matches:
            rank = item['ordo']['rank'] or 'Unknown'
            by_rank[rank].append(item)

        for rank, items in sorted(by_rank.items(), key=lambda x: len(x[1]), reverse=True):
            print(f"\n{rank} ({len(items)} entries):")
            print("-" * 80)
            for item in items[:10]:
                entry = item['ordo']
                print(f"  {item['date']}: {entry['name']}")
                print(f"    Season: {entry['season']}, Week: {entry['week']}")

            if len(items) > 10:
                print(f"  ... and {len(items) - 10} more")

    # Save unmatched to CSV for review
    if no_matches:
        with open('data/generated/lectionary_unmatched.csv', 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['Date', 'Ordo Name', 'Season', 'Week', 'Rank', 'Normalized'])
            for item in no_matches:
                entry = item['ordo']
                writer.writerow([
                    item['date'],
                    entry['name'],
                    entry['season'],
                    entry['week'],
                    entry['rank'],
                    normalize_for_comparison(entry['name'])
                ])
        print(f"\n✅ Saved unmatched entries to: data/generated/lectionary_unmatched.csv")

if __name__ == '__main__':
    main()

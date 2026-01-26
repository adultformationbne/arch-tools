#!/usr/bin/env python3
"""
Generate Ordo-to-Lectionary mapping for database import.

Usage:
  python scripts/generate_ordo_lectionary_mapping.py                      # Generate CSV only
  python scripts/generate_ordo_lectionary_mapping.py --compare            # Compare against baseline
  python scripts/generate_ordo_lectionary_mapping.py --check-date 2026-05-25  # Check a specific date
  python scripts/generate_ordo_lectionary_mapping.py --list-unmatched     # Show dates with no match
  python scripts/generate_ordo_lectionary_mapping.py --list-apostles      # Show apostles list
  python scripts/generate_ordo_lectionary_mapping.py --list-aliases       # Show name alias mappings
  python scripts/generate_ordo_lectionary_mapping.py --push               # Push to production table
"""

import csv
import re
import datetime
import argparse
import os
import sys

# Add parent dir to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# File paths
ORDO_CSV = 'data/generated/ordo_normalized.csv'
LECTIONARY_CSV = 'data/source/Lectionary.csv'
OUTPUT_CSV = 'data/generated/ordo_lectionary_mapping.csv'
BASELINE_CSV = 'data/generated/ordo_lectionary_mapping.baseline.csv'

# Canonical ordinal mapping: number -> word
ORDINALS = {
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
# Reverse mapping: word -> number (uppercase for normalization)
ORDINALS_TO_NUM = {v.upper(): str(k) for k, v in ORDINALS.items()}

# Season name -> Lectionary 'Time' field mapping
SEASON_TO_TIME = {
    'Ordinary Time': 'Ordinary',
    'Advent': 'Advent',
    'Christmas': 'Christmas',
    'Lent': 'Lent',
    'Holy Week': 'Holy Week',
    'Easter': 'Easter'
}

# Saints who get proper readings even as Memorials
# (Most Apostles are Feasts, not Memorials, so not listed here)
SAINTS_WITH_PROPER_READINGS = [
    'barnabas', 'matthias', 'mark', 'luke', 'timothy', 'titus',
    'mary magdalene',  # "Apostle to the Apostles" - elevated to Feast 2016
    'martha',  # Saints Martha, Mary and Lazarus
    'dominic',  # St Dominic - Year A has different gospel
    'vianney',  # St John Vianney - Year A has different gospel
]

def get_year_letter(year):
    """Calculate Sunday lectionary cycle (A/B/C) for a given year.

    The cycle is: 2025=C, 2026=A, 2027=B, 2028=C, ...
    Pattern: year % 3 == 0 → C, year % 3 == 1 → A, year % 3 == 2 → B
    """
    year = int(year)
    return {0: 'C', 1: 'A', 2: 'B'}[year % 3]


def get_weekday_year(year):
    """Calculate weekday lectionary cycle (1/2) for a given year.

    Odd years = Year 1, Even years = Year 2
    """
    return '1' if int(year) % 2 == 1 else '2'

# Liturgical name normalizations (Ordo format → Lectionary format)
NAME_NORMALIZATIONS = {
    'OUR LORD JESUS CHRIST': 'CHRIST THE KING',
    'THE MOST HOLY BODY AND BLOOD OF CHRIST': 'THE BODY AND BLOOD OF CHRIST',
    'THE MOST SACRED HEART OF JESUS': 'SACRED HEART OF JESUS',
    'THE ASCENSION OF THE LORD': 'ASCENSION',
    'PASSION SUNDAY (PALM SUNDAY)': 'PALM SUNDAY',
    'THE HOLY FAMILY': 'HOLY FAMILY',
    'THE MOST HOLY TRINITY': 'TRINITY SUNDAY',
}

# Name aliases: (required_word1, required_word2, ..., lectionary_search_pattern)
# Maps Ordo naming variations to Lectionary search patterns
FEAST_NAME_ALIASES = [
    # Australian moveable feasts
    ('our lady', 'help of christians', 'mary help of christians'),
    ('mary', 'help of christians', 'mary help of christians'),
    # Name variations between Ordo and Lectionary
    ('nativity', 'john', 'baptist', 'birth of john the baptist'),
    ('beheading', 'john', 'baptist', 'beheading of john the baptist'),
    ('exaltation', 'cross', 'exaltation of the cross'),
    ('chair', 'peter', 'chair of peter'),
    ('dedication', 'lateran', 'dedication of st john lateran'),
    ('faithful departed', 'all souls'),
    ('commemoration', 'faithful departed', 'all souls'),
]


def ordinal_suffix(n):
    """Return ordinal suffix for a number (1->ST, 2->ND, 3->RD, 4->TH, etc)."""
    if 11 <= n <= 13:
        return 'TH'
    return {1: 'ST', 2: 'ND', 3: 'RD'}.get(n % 10, 'TH')


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

    # Normalize ordinal numbers (use global ORDINALS_TO_NUM)
    for ordinal, num in sorted(ORDINALS_TO_NUM.items(), key=lambda x: len(x[0]), reverse=True):
        text = text.replace(ordinal, num)

    # Normalize common liturgical name variations
    for old, new in NAME_NORMALIZATIONS.items():
        text = text.replace(old, new)

    # Normalize date formats: "17 DECEMBER" -> "17TH DECEMBER"
    def add_ordinal(match):
        day = int(match.group(1))
        month = match.group(2)
        return f"{day}{ordinal_suffix(day)} {month}"
    text = re.sub(r'\b(\d{1,2})\s+(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\b', add_ordinal, text)

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

    # Normalize "SUNDAY IN/OF <SEASON>" → "SUNDAY <SEASON>"
    text = re.sub(r' SUNDAY (IN|OF) (LENT|ADVENT|EASTER)', r' SUNDAY \2', text)

    # Normalize ferial weekday names - remove "IN/OF ORDINARY TIME"
    text = re.sub(r' (IN|OF) ORDINARY TIME', '', text)

    text = ' '.join(text.split())
    return text


def load_ordo():
    """Load normalized ordo data"""
    ordo = {}
    with open(ORDO_CSV, 'r', encoding='utf-8') as f:
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
    with open(LECTIONARY_CSV, 'r', encoding='utf-8-sig') as f:
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
    try:
        return ORDINALS.get(int(week), str(week))
    except (ValueError, TypeError):
        return str(week)


def find_weekday_lectionary_entry(lectionary_entries, weekday, season, week, year_letter, calendar_year=None, ordo_date=None):
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
        # Christmas season also uses date-based entries (e.g., "2nd January")
        if ordo_date:
            dt = datetime.datetime.strptime(ordo_date, '%Y-%m-%d')
            day = dt.day
            month = dt.strftime('%B')
            patterns.append(f"{day}{ordinal_suffix(day)} {month}".lower())
            patterns.append(f"{day} {month}".lower())

    # Year cycle for Ordinary Time first readings
    ordinary_year = None
    if calendar_year and season == 'Ordinary Time':
        ordinary_year = get_weekday_year(calendar_year)

    expected_time = SEASON_TO_TIME.get(season, '')

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
    """Infer season and week for a date by looking at surrounding dates.

    Liturgical weeks start on Sunday. So if we find:
    - A weekday with week N, and no Sunday between it and current date -> we're in week N
    - A weekday with week N, and a Sunday between it and current date -> adjust week
    - A Sunday with week N -> if looking back, we're in week N; if looking forward, we're in week N-1
    """
    dt = datetime.datetime.strptime(ordo_date, '%Y-%m-%d')

    # Look back up to 7 days
    for days_back in range(1, 8):
        check_dt = dt - datetime.timedelta(days=days_back)
        check_date = check_dt.strftime('%Y-%m-%d')
        if check_date in ordo_data:
            entry = ordo_data[check_date]
            if entry.get('season') and entry.get('week'):
                week = entry['week']

                # Count Sundays BETWEEN reference date and current date (not including either)
                sundays_crossed = 0
                for d in range(1, days_back):
                    test_dt = dt - datetime.timedelta(days=d)
                    if test_dt.weekday() == 6:  # Sunday
                        sundays_crossed += 1

                # If we crossed Sundays going back, we're in a later week
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

                # If reference is a Sunday, we're in the previous week
                if check_weekday == 6:
                    try:
                        week = str(int(week) - 1)
                    except ValueError:
                        pass
                else:
                    # Count Sundays between current date and reference date
                    sundays_crossed = 0
                    for d in range(1, days_forward):
                        test_dt = dt + datetime.timedelta(days=d)
                        if test_dt.weekday() == 6:
                            sundays_crossed += 1

                    # If we crossed Sundays going forward, we're in an earlier week
                    if sundays_crossed > 0:
                        try:
                            week = str(int(week) - sundays_crossed)
                        except ValueError:
                            pass

                return entry['season'], week

    return None, None


def _find_memorial_match(ordo_name, ordo_date, ordo_day, ordo_month, weekday, season, week,
                         lectionary_entries, year_letter, ordo_data):
    """Find lectionary match for memorial days.

    Apostles/Evangelists get their proper readings; other memorials use weekday readings.
    Returns match dict or None if no match found.
    """
    ordo_name_lower = ordo_name.lower()
    has_proper_readings = any(apostle in ordo_name_lower for apostle in SAINTS_WITH_PROPER_READINGS)

    # Check for saint proper readings by date
    if has_proper_readings and ordo_day and ordo_month:
        candidates = []
        for entry in lectionary_entries:
            lect_name = entry.get('Liturgical Day', '')
            lect_year = entry.get('Year', '')
            date_match = re.match(r'^(\d{1,2})\s+([A-Z]+)\s*[–—-]', lect_name.upper())
            if date_match:
                lect_day = int(date_match.group(1))
                lect_month = date_match.group(2)
                if ordo_day == lect_day and ordo_month == lect_month:
                    candidates.append((entry, lect_year))

        if candidates:
            # Prefer year-specific entry (A/B/C) matching current year
            for entry, lect_year in candidates:
                if year_letter and lect_year == year_letter:
                    return {
                        'type': 'exact',
                        'method': 'proper_for_saint',
                        'entry': entry,
                        'ordo_name': ordo_name,
                        'lect_name': entry.get('Liturgical Day', '')
                    }
            # Fall back to generic entry
            entry, _ = candidates[0]
            return {
                'type': 'exact',
                'method': 'proper_for_saint',
                'entry': entry,
                'ordo_name': ordo_name,
                'lect_name': entry.get('Liturgical Day', '')
            }

    # No proper readings found - use weekday readings
    if ordo_data and weekday:
        memorial_season = season if season else None
        memorial_week = week if week else None

        if not memorial_season or not memorial_week:
            inferred_season, inferred_week = infer_season_and_week(ordo_date, ordo_data)
            if not memorial_season:
                memorial_season = inferred_season
            if not memorial_week:
                memorial_week = inferred_week

        # For Christmas season, week may be empty (date-based entries)
        if memorial_season and (memorial_week or memorial_season == 'Christmas'):
            calendar_year = ordo_date[:4] if ordo_date else None
            weekday_entry = find_weekday_lectionary_entry(
                lectionary_entries, weekday, memorial_season, memorial_week, year_letter, calendar_year, ordo_date
            )
            if weekday_entry:
                return {
                    'type': 'exact',
                    'method': 'weekday_for_memorial',
                    'entry': weekday_entry,
                    'ordo_name': ordo_name,
                    'lect_name': weekday_entry.get('Liturgical Day', '')
                }

    return None


def _find_name_alias_match(ordo_name, lectionary_entries, year_letter):
    """Find lectionary match using FEAST_NAME_ALIASES for naming variations.

    Used for moveable feasts and solemnities where Ordo and Lectionary use different names.
    Returns match dict or None if no alias applies.
    """
    ordo_name_lower = ordo_name.lower().strip()
    search_pattern = None

    for keywords in FEAST_NAME_ALIASES:
        *required_words, pattern = keywords
        if all(word in ordo_name_lower for word in required_words):
            search_pattern = pattern
            break

    if not search_pattern:
        return None

    # Find lectionary entry by name pattern, filtered by year
    candidates = []
    for entry in lectionary_entries:
        lect_name = entry.get('Liturgical Day', '').lower()
        lect_year = entry.get('Year', '')

        if search_pattern in lect_name:
            # Match year cycle (A, B, C) if specified
            if year_letter and f'year {year_letter.lower()}' in lect_name:
                candidates.append(entry)
            elif not year_letter or lect_year in ['', 'Feast', 'Solemnity']:
                candidates.append(entry)

    if candidates:
        # Prefer Day mass over Vigil (entries without "vigil" in name)
        day_entries = [e for e in candidates if 'vigil' not in e.get('Liturgical Day', '').lower()]
        best_entry = day_entries[0] if day_entries else candidates[0]
        return {
            'type': 'exact',
            'method': 'name_alias',
            'entry': best_entry,
            'ordo_name': ordo_name,
            'lect_name': best_entry.get('Liturgical Day', '')
        }

    return None


def find_lectionary_match(ordo_entry, lectionary_entries, year_letter, ordo_data=None):
    """Find matching lectionary entry for an ordo entry.

    Matching priority (first match wins):
    1. MEMORIALS: Apostles/Evangelists get proper readings by date;
       other memorials use weekday readings for their season/week
    2. SOLEMNITIES/FEASTS: Try FEAST_NAME_ALIASES for moveable feasts
       and naming variations (e.g., "Our Lady Help of Christians")
    3. DATE MATCH: Fixed feasts matched by day/month (skipped for seasonal weekdays)
    4. EXACT NAME: Normalized ordo name == normalized lectionary name
    5. PARTIAL: Substring match, scored by word overlap
    """
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
    except (ValueError, TypeError):
        ordo_month = None
        ordo_day = None
        weekday = None

    is_memorial = ordo_rank in ['memorial', 'optional memorial']
    is_major_day = ordo_rank in ['solemnity', 'feast'] or 'sunday' in ordo_name.lower()

    # For Memorials: Apostles get proper readings, others use weekday readings
    if is_memorial:
        match = _find_memorial_match(
            ordo_name, ordo_date, ordo_day, ordo_month, weekday, season, week,
            lectionary_entries, year_letter, ordo_data
        )
        if match:
            return match

    # For SOLEMNITIES and FEASTS, try name-based matching first (handles moveable feasts)
    if ordo_rank in ['solemnity', 'feast']:
        match = _find_name_alias_match(ordo_name, lectionary_entries, year_letter)
        if match:
            return match

    expected_time = SEASON_TO_TIME.get(season, '')

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

        # Weekday year cycle filter for Ordinary Time feria days
        is_feria_weekday = ordo_rank == 'feria' and season == 'Ordinary Time'
        if is_feria_weekday and lect_year in ['1', '2'] and lect_time == 'Ordinary':
            calendar_year = int(ordo_date[:4]) if ordo_date else None
            if calendar_year:
                if lect_year != get_weekday_year(calendar_year):
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

    mappings = []
    stats = {'exact': 0, 'partial': 0, 'none': 0}

    for date, ordo_entry in sorted(ordo.items()):
        year = ordo_entry['year']
        year_letter = get_year_letter(year)

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


def write_csv(mappings, output_file=OUTPUT_CSV):
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


def _batch_insert(supabase, table_name, mappings, row_builder):
    """Insert mappings in batches using the provided row_builder function."""
    print("Inserting mappings...")
    batch_size = 100
    for i in range(0, len(mappings), batch_size):
        batch = mappings[i:i+batch_size]
        rows = [row_builder(m) for m in batch]
        supabase.table(table_name).insert(rows).execute()
        print(f"  Inserted {min(i+batch_size, len(mappings))}/{len(mappings)}")


def _build_temp_row(m):
    """Build row dict for temp table (includes extra fields for debugging)."""
    return {
        'calendar_date': m['calendar_date'],
        'lectionary_id': int(m['lectionary_id']) if m['lectionary_id'] else None,
        'match_type': m['match_type'],
        'match_method': m['match_method'],
        'ordo_name': m['ordo_name'],
        'lectionary_name': m['lectionary_name'],
        'first_reading': m['first_reading'],
        'gospel': m['gospel']
    }


def _build_production_row(m):
    """Build row dict for production table (minimal fields)."""
    return {
        'calendar_date': m['calendar_date'],
        'lectionary_id': int(m['lectionary_id']) if m['lectionary_id'] else None,
        'match_type': m['match_type'],
        'match_method': m['match_method']
    }


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

    _batch_insert(supabase, 'ordo_lectionary_mapping_temp', mappings, _build_temp_row)

    print(f"\n✅ Pushed {len(mappings)} rows to ordo_lectionary_mapping_temp")
    print("\nQuery with: SELECT * FROM ordo_lectionary_mapping_temp WHERE calendar_date IN ('2025-01-17', '2025-04-28', '2025-11-10');")


def push_to_production(mappings):
    """Push mappings to production table."""
    supabase = get_supabase_client()

    print("\nClearing production table...")
    supabase.table('ordo_lectionary_mapping').delete().neq('calendar_date', '1900-01-01').execute()

    _batch_insert(supabase, 'ordo_lectionary_mapping', mappings, _build_production_row)

    print(f"\n✅ Pushed {len(mappings)} rows to ordo_lectionary_mapping (PRODUCTION)")


def check_specific_date(date_str):
    """Check mapping for a specific date without touching database."""
    ordo = load_ordo()
    lectionary = load_lectionary()

    if date_str not in ordo:
        print(f"❌ Date {date_str} not found in ordo data")
        return None

    ordo_entry = ordo[date_str]
    year = ordo_entry['year']
    year_letter = get_year_letter(year)

    print(f"\n{'='*80}")
    print(f"CHECKING DATE: {date_str}")
    print(f"{'='*80}")
    print(f"Ordo Name: {ordo_entry['name']}")
    print(f"Ordo Rank: {ordo_entry['rank']}")
    print(f"Season: {ordo_entry['season']}")
    print(f"Week: {ordo_entry['week']}")
    print(f"Year Cycle: {year_letter}")

    match = find_lectionary_match(ordo_entry, lectionary, year_letter, ordo_data=ordo)

    if match:
        entry = match['entry']
        print(f"\n✅ MATCHED:")
        print(f"  Lectionary: {entry.get('Liturgical Day', '')}")
        print(f"  Method: {match.get('method', 'unknown')}")
        print(f"  Type: {match['type']}")
        print(f"\n  Readings:")
        print(f"    First: {entry.get('First Reading', 'N/A')}")
        print(f"    Psalm: {entry.get('Psalm', 'N/A')}")
        print(f"    Second: {entry.get('Second Reading', 'N/A') or 'N/A'}")
        print(f"    Gospel: {entry.get('Gospel Reading', 'N/A')}")
        return match
    else:
        print(f"\n❌ NO MATCH FOUND")
        return None


def find_problematic_dates(mappings):
    """Flag dates that might have incorrect mappings."""
    problematic = []

    # Known moveable feast patterns that should NOT match by date
    # (Note: "Our Lady of the Rosary" is fixed Oct 7, not moveable)
    moveable_patterns = [
        'help of christians',  # Australian moveable solemnity
    ]

    for m in mappings:
        ordo_name = m.get('ordo_name', '').lower()
        ordo_rank = m.get('ordo_rank', '').lower()
        match_method = m.get('match_method', '')
        lect_name = m.get('lectionary_name', '').lower()

        # Flag: Solemnity/Feast matched by date where names don't align
        if ordo_rank in ['solemnity', 'feast'] and match_method == 'date':
            # Check if the ordo name and lectionary name are about the same thing
            ordo_words = set(ordo_name.split())
            lect_words = set(lect_name.split())
            # Remove common words
            common_ignore = {'the', 'of', 'and', 'in', 'saint', 'st', 'a', 'an', '–', '-'}
            ordo_words = ordo_words - common_ignore
            lect_words = lect_words - common_ignore
            overlap = ordo_words & lect_words

            if len(overlap) < 2:  # Very little overlap - likely wrong match
                problematic.append({
                    'date': m['calendar_date'],
                    'issue': 'Solemnity/Feast date-match with mismatched names',
                    'ordo': m['ordo_name'],
                    'lect': m['lectionary_name'],
                    'method': match_method
                })

        # Flag: Moveable feast matched by date
        if any(p in ordo_name for p in moveable_patterns) and match_method == 'date':
            problematic.append({
                'date': m['calendar_date'],
                'issue': 'Moveable feast matched by date instead of name',
                'ordo': m['ordo_name'],
                'lect': m['lectionary_name'],
                'method': match_method
            })

    return problematic


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


def edit_ordo(date_str, name=None, rank=None, season=None, week=None):
    """Edit an entry in ordo_normalized.csv."""
    csv_path = ORDO_CSV
    found = False
    rows = []

    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            if row['calendar_date'] == date_str:
                found = True
                old_values = dict(row)
                if name:
                    row['liturgical_name'] = name
                if rank:
                    row['liturgical_rank'] = rank
                if season:
                    row['liturgical_season'] = season
                if week:
                    row['liturgical_week'] = week
                print(f"✏️  Editing {date_str}:")
                for key in ['liturgical_name', 'liturgical_rank', 'liturgical_season', 'liturgical_week']:
                    if old_values[key] != row[key]:
                        print(f"   {key}: '{old_values[key]}' → '{row[key]}'")
            rows.append(row)

    if not found:
        print(f"❌ Date {date_str} not found in ordo_normalized.csv")
        return False

    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"✅ Saved to {csv_path}")
    return True


def edit_lectionary(admin_order, first_reading=None, psalm=None, second_reading=None, gospel=None):
    """Edit an entry in Lectionary.csv."""
    csv_path = LECTIONARY_CSV
    found = False
    rows = []

    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            if row['Admin Order'] == str(admin_order):
                found = True
                old_values = dict(row)
                if first_reading:
                    row['First Reading'] = first_reading
                if psalm:
                    row['Psalm'] = psalm
                if second_reading:
                    row['Second Reading'] = second_reading
                if gospel:
                    row['Gospel Reading'] = gospel
                print(f"✏️  Editing lectionary {admin_order} ({row['Liturgical Day']}):")
                for key in ['First Reading', 'Psalm', 'Second Reading', 'Gospel Reading']:
                    if old_values.get(key) != row.get(key):
                        print(f"   {key}: '{old_values.get(key)}' → '{row.get(key)}'")
            rows.append(row)

    if not found:
        print(f"❌ Lectionary entry {admin_order} not found")
        return False

    with open(csv_path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"✅ Saved to {csv_path}")
    return True


def list_unmatched():
    """List all dates with no lectionary match."""
    ordo = load_ordo()
    lectionary = load_lectionary()

    unmatched = []
    for date, entry in sorted(ordo.items()):
        year_letter = get_year_letter(entry['year'])
        match = find_lectionary_match(entry, lectionary, year_letter, ordo_data=ordo)
        if not match:
            unmatched.append(entry)

    if unmatched:
        print(f"\n❌ UNMATCHED DATES ({len(unmatched)}):")
        print("-" * 60)
        for entry in unmatched:
            print(f"  {entry['date']}: {entry['name']} ({entry['rank']})")
    else:
        print("\n✅ All dates have matches!")

    return unmatched


def list_apostles():
    """List saints who get proper readings even as memorials."""
    print("\n📜 SAINTS WITH PROPER READINGS (as Memorials):")
    print("-" * 60)
    for saint in SAINTS_WITH_PROPER_READINGS:
        print(f"  • {saint.title()}")
    print(f"\nTo add: edit SAINTS_WITH_PROPER_READINGS at top of script")


def list_aliases():
    """List current name aliases."""
    print("\n🔗 NAME ALIASES (Ordo → Lectionary patterns):")
    print("-" * 60)
    for keywords in FEAST_NAME_ALIASES:
        *required_words, pattern = keywords
        print(f"  {' + '.join(required_words)} → {pattern}")
    print(f"\nTo add: edit FEAST_NAME_ALIASES at top of script")


def compare_with_baseline(mappings, baseline_path=BASELINE_CSV):
    """Compare current mappings against baseline and report differences."""
    if not os.path.exists(baseline_path):
        print(f"❌ No baseline found at {baseline_path}")
        print(f"   Run without --compare first, then: cp {OUTPUT_CSV} {BASELINE_CSV}")
        return False

    # Load baseline
    baseline = {}
    with open(baseline_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            baseline[row['calendar_date']] = row

    # Compare
    current = {m['calendar_date']: m for m in mappings}
    differences = []

    all_dates = set(baseline.keys()) | set(current.keys())
    for date in sorted(all_dates):
        b = baseline.get(date)
        c = current.get(date)

        if not b:
            differences.append({'date': date, 'type': 'added', 'current': c})
        elif not c:
            differences.append({'date': date, 'type': 'removed', 'baseline': b})
        else:
            # Compare key fields
            changes = []
            for field in ['lectionary_id', 'lectionary_name', 'match_type', 'match_method']:
                if b.get(field) != c.get(field):
                    changes.append(f"{field}: '{b.get(field)}' → '{c.get(field)}'")
            if changes:
                differences.append({
                    'date': date,
                    'type': 'changed',
                    'ordo_name': c.get('ordo_name'),
                    'changes': changes
                })

    if not differences:
        print("\n✅ No changes from baseline - safe to keep edits!")
        return True
    else:
        print(f"\n⚠️  {len(differences)} DIFFERENCES from baseline:")
        print("-" * 80)
        for d in differences:
            if d['type'] == 'added':
                print(f"  + {d['date']}: ADDED")
            elif d['type'] == 'removed':
                print(f"  - {d['date']}: REMOVED")
            else:
                print(f"  Δ {d['date']}: {d['ordo_name']}")
                for change in d['changes']:
                    print(f"      {change}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description='Generate Ordo-to-Lectionary mapping',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --check-date 2026-05-25              Check a specific date
  %(prog)s --compare                            Compare output against baseline
  %(prog)s --list-unmatched                     Show dates with no match
  %(prog)s --list-apostles                      Show apostles list
  %(prog)s --list-aliases                       Show name alias mappings
  %(prog)s --edit-ordo 2026-05-26 --rank Feast --season "Ordinary Time" --week 8
  %(prog)s --edit-lectionary 586 --gospel "John 19:25-27"
  %(prog)s --push                               Regenerate and push to database
        """
    )
    parser.add_argument('--dry-run', action='store_true', help='Push to temp table for testing')
    parser.add_argument('--push', action='store_true', help='Push to production table')
    parser.add_argument('--check', action='store_true', help='Check test dates from temp table')
    parser.add_argument('--check-date', type=str, help='Check mapping for a specific date (YYYY-MM-DD)')
    parser.add_argument('--compare', action='store_true', help='Compare output against baseline')
    parser.add_argument('--flag-issues', action='store_true', help='Flag potentially problematic mappings')

    # New CLI commands
    parser.add_argument('--list-unmatched', action='store_true', help='List dates with no lectionary match')
    parser.add_argument('--list-apostles', action='store_true', help='List apostles who get proper readings')
    parser.add_argument('--list-aliases', action='store_true', help='List name alias mappings')

    # Edit ordo
    parser.add_argument('--edit-ordo', type=str, metavar='DATE', help='Edit ordo entry (YYYY-MM-DD)')
    parser.add_argument('--name', type=str, help='Set liturgical name (for --edit-ordo)')
    parser.add_argument('--rank', type=str, help='Set rank: Solemnity/Feast/Memorial/Feria (for --edit-ordo)')
    parser.add_argument('--season', type=str, help='Set season: Ordinary Time/Lent/Easter/Advent/Christmas (for --edit-ordo)')
    parser.add_argument('--week', type=str, help='Set week number (for --edit-ordo)')

    # Edit lectionary
    parser.add_argument('--edit-lectionary', type=int, metavar='ID', help='Edit lectionary entry by admin_order')
    parser.add_argument('--first-reading', type=str, help='Set first reading (for --edit-lectionary)')
    parser.add_argument('--psalm', type=str, help='Set psalm (for --edit-lectionary)')
    parser.add_argument('--second-reading', type=str, help='Set second reading (for --edit-lectionary)')
    parser.add_argument('--gospel', type=str, help='Set gospel (for --edit-lectionary)')

    args = parser.parse_args()

    # Handle list commands
    if args.list_unmatched:
        list_unmatched()
        return

    if args.list_apostles:
        list_apostles()
        return

    if args.list_aliases:
        list_aliases()
        return

    # Handle edit commands
    if args.edit_ordo:
        edit_ordo(args.edit_ordo, name=args.name, rank=args.rank, season=args.season, week=args.week)
        # Also check the date after editing
        print()
        check_specific_date(args.edit_ordo)
        return

    if args.edit_lectionary:
        edit_lectionary(args.edit_lectionary, first_reading=args.first_reading, psalm=args.psalm,
                       second_reading=args.second_reading, gospel=args.gospel)
        return

    if args.check:
        check_test_dates()
        return

    if args.check_date:
        check_specific_date(args.check_date)
        return

    print("Generating Ordo-to-Lectionary mapping...")
    mappings = generate_mappings()

    # Always write CSV
    write_csv(mappings)

    # Compare against baseline if requested
    if args.compare:
        compare_with_baseline(mappings)
        return

    # Flag problematic dates
    if args.flag_issues or True:  # Always flag for now
        problematic = find_problematic_dates(mappings)
        if problematic:
            print(f"\n⚠️  POTENTIALLY PROBLEMATIC DATES ({len(problematic)}):")
            print("-" * 80)
            for p in problematic:
                print(f"  {p['date']}: {p['issue']}")
                print(f"    Ordo: {p['ordo']}")
                print(f"    Lect: {p['lect']}")
                print()
        else:
            print("\n✅ No problematic dates detected")

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

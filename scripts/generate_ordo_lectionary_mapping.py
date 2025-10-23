#!/usr/bin/env python3
"""
Generate Ordo-to-Lectionary mapping for database import.
Creates a CSV that maps each Ordo date to its Lectionary entry.
"""

import csv
import re
import datetime
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

    # Sort by length (longest first) to avoid partial replacements
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
        '17 DECEMBER': '17TH DECEMBER', '18 DECEMBER': '18TH DECEMBER',
        '19 DECEMBER': '19TH DECEMBER', '20 DECEMBER': '20TH DECEMBER',
        '21 DECEMBER': '21ST DECEMBER', '22 DECEMBER': '22ND DECEMBER',
        '23 DECEMBER': '23RD DECEMBER', '24 DECEMBER': '24TH DECEMBER',
    }
    for old, new in december_dates.items():
        text = text.replace(old, new)

    # Expand saint abbreviations AFTER other replacements
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
    """Find matching lectionary entry for an ordo entry."""
    ordo_name = ordo_entry['name']
    ordo_name_norm = normalize_for_comparison(ordo_name)
    ordo_date = ordo_entry['date']

    season = ordo_entry['season']
    week = ordo_entry['week']

    # Extract month and day from ordo date
    try:
        dt = datetime.datetime.strptime(ordo_date, '%Y-%m-%d')
        ordo_month = dt.strftime('%B').upper()
        ordo_day = dt.day
    except:
        ordo_month = None
        ordo_day = None

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

        # Date-based match (highest priority)
        if ordo_day and ordo_month and lect_day and lect_month:
            if ordo_day == lect_day and ordo_month == lect_month:
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

def main():
    print("Generating Ordo-to-Lectionary mapping...")

    ordo = load_ordo()
    lectionary = load_lectionary()

    print(f"Loaded {len(ordo)} Ordo entries")
    print(f"Loaded {len(lectionary)} Lectionary entries")

    year_letters = {'2025': 'C', '2026': 'A'}

    # Generate mapping
    mappings = []
    stats = {'exact': 0, 'partial': 0, 'none': 0}

    for date, ordo_entry in sorted(ordo.items()):
        year = ordo_entry['year']
        year_letter = year_letters.get(str(year))

        match = find_lectionary_match(ordo_entry, lectionary, year_letter)

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

    # Write mapping to CSV
    output_file = 'data/generated/ordo_lectionary_mapping.csv'
    with open(output_file, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=[
            'calendar_date', 'ordo_name', 'ordo_rank',
            'lectionary_id', 'lectionary_name', 'match_type', 'match_method',
            'first_reading', 'psalm', 'second_reading', 'gospel'
        ])
        writer.writeheader()
        writer.writerows(mappings)

    print(f"\n✅ Mapping saved to: {output_file}")
    print(f"\nStatistics:")
    print(f"  Exact matches: {stats['exact']} ({stats['exact']/len(ordo)*100:.1f}%)")
    print(f"  Partial matches: {stats['partial']} ({stats['partial']/len(ordo)*100:.1f}%)")
    print(f"  No matches: {stats['none']} ({stats['none']/len(ordo)*100:.1f}%)")
    print(f"  Total coverage: {(stats['exact']+stats['partial'])/len(ordo)*100:.1f}%")

if __name__ == '__main__':
    main()

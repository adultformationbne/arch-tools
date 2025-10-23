#!/usr/bin/env python3
"""
Generate a list of required Lectionary updates to achieve 100% Ordo matching.

For each unmatched Ordo entry, this script will:
1. Check if there's a close match in Lectionary that should be renamed
2. Identify entries that need to be added to Lectionary
3. Output a CSV of proposed changes for review
"""

import csv
from difflib import SequenceMatcher

def load_ordo_linked():
    """Load the linked ordo data"""
    with open('data/generated/ordo_lectionary_linked.csv', 'r') as f:
        reader = csv.DictReader(f)
        return list(reader)

def load_lectionary():
    """Load lectionary data"""
    with open('data/source/Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        return list(reader)

def find_closest_lectionary_entry(ordo_entry, lectionary_entries, year_letter):
    """Find the closest lectionary entry for potential renaming"""
    ordo_name = ordo_entry['name'].upper()
    season = ordo_entry['season']
    week = ordo_entry['week']
    rank = ordo_entry['rank']

    candidates = []

    for lect_entry in lectionary_entries:
        lect_name = lect_entry.get('Liturgical Day', '').upper()
        lect_season = lect_entry.get('Time', '').upper()
        lect_week = lect_entry.get('Week', '')
        lect_year = lect_entry.get('Year', '')

        # Skip if already has good year filter
        if year_letter and lect_year and lect_year not in [year_letter, '1', '2', '']:
            continue

        # Calculate similarity
        similarity = SequenceMatcher(None, ordo_name, lect_name).ratio()

        # Bonus for season match
        if season and lect_season:
            season_match = season.upper().replace('ORDINARY TIME', 'ORDINARY') == lect_season.replace('ORDINARY', 'ORDINARY')
            if season_match:
                similarity += 0.2

        # Bonus for week match
        if week and lect_week and str(week) == str(lect_week):
            similarity += 0.1

        if similarity > 0.3:  # Threshold for consideration
            candidates.append({
                'entry': lect_entry,
                'similarity': similarity,
                'admin_order': lect_entry.get('Admin Order', '')
            })

    # Sort by similarity
    candidates.sort(key=lambda x: x['similarity'], reverse=True)

    return candidates[0] if candidates else None

def main():
    print("="*80)
    print("GENERATING LECTIONARY UPDATE RECOMMENDATIONS")
    print("="*80)

    # Load data
    print("\nLoading data...")
    ordo_linked = load_ordo_linked()
    lectionary = load_lectionary()

    # Get unmatched entries
    no_matches = [r for r in ordo_linked if r['match_status'] == 'NO_MATCH']
    print(f"  Unmatched Ordo entries: {len(no_matches)}")

    # Analyze each unmatched entry
    updates = []
    additions = []

    year_info = {
        '2025': {'sunday': 'C', 'weekday': '1'},
        '2026': {'sunday': 'A', 'weekday': '2'}
    }

    for ordo_entry in no_matches:
        year_data = year_info.get(ordo_entry['year'], {})
        rank = ordo_entry['rank']

        # Determine year letter
        if rank in ['Sunday', 'Solemnity', 'Feast']:
            year_letter = year_data.get('sunday')
        else:
            year_letter = year_data.get('weekday')

        # Find closest match
        closest = find_closest_lectionary_entry(ordo_entry, lectionary, year_letter)

        if closest and closest['similarity'] > 0.5:
            # Potential rename
            updates.append({
                'action': 'RENAME',
                'ordo_date': ordo_entry['date'],
                'ordo_name': ordo_entry['name'],
                'ordo_season': ordo_entry['season'],
                'ordo_week': ordo_entry['week'],
                'ordo_rank': ordo_entry['rank'],
                'lectionary_admin_order': closest['admin_order'],
                'lectionary_current_name': closest['entry'].get('Liturgical Day', ''),
                'lectionary_proposed_name': ordo_entry['name'],
                'similarity': f"{closest['similarity']:.2f}",
                'confidence': 'HIGH' if closest['similarity'] > 0.7 else 'MEDIUM'
            })
        else:
            # Needs to be added
            additions.append({
                'action': 'ADD',
                'ordo_date': ordo_entry['date'],
                'ordo_name': ordo_entry['name'],
                'ordo_season': ordo_entry['season'],
                'ordo_week': ordo_entry['week'],
                'ordo_rank': ordo_entry['rank'],
                'year_letter': year_letter,
                'note': 'Missing from Lectionary - needs manual addition'
            })

    # Save updates
    output_file = 'data/generated/lectionary_updates_needed.csv'

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        if updates:
            fieldnames = list(updates[0].keys())
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(updates)

        # Add a separator
        if updates and additions:
            writer.writerow({k: '' for k in fieldnames})

        if additions:
            fieldnames = list(additions[0].keys())
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            if not updates:
                writer.writeheader()
            writer.writerows(additions)

    # Report
    print(f"\n{'='*80}")
    print("RECOMMENDATIONS")
    print(f"{'='*80}")
    print(f"Total unmatched: {len(no_matches)}")
    print(f"  Recommended RENAMES: {len(updates)}")
    print(f"  Recommended ADDITIONS: {len(additions)}")
    print(f"\nOutput saved to: {output_file}")

    # Show samples
    if updates:
        print(f"\n{'='*80}")
        print("SAMPLE RENAMES (first 10)")
        print(f"{'='*80}")
        for update in updates[:10]:
            print(f"\n{update['ordo_date']}: {update['ordo_name']}")
            print(f"  Rename in Lectionary (row {update['lectionary_admin_order']}):")
            print(f"    FROM: {update['lectionary_current_name']}")
            print(f"    TO:   {update['lectionary_proposed_name']}")
            print(f"  Confidence: {update['confidence']} (similarity: {update['similarity']})")

    if additions:
        print(f"\n{'='*80}")
        print("SAMPLE ADDITIONS NEEDED (first 10)")
        print(f"{'='*80}")
        for addition in additions[:10]:
            print(f"\n{addition['ordo_date']}: {addition['ordo_name']}")
            print(f"  Season: {addition['ordo_season']}, Week: {addition['ordo_week']}, Rank: {addition['ordo_rank']}")
            print(f"  Year: {addition['year_letter']}")

if __name__ == '__main__':
    main()

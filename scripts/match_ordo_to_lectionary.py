#!/usr/bin/env python3
"""
Robust matching system between Ordo CSV and Lectionary.csv

Handles:
- Case insensitivity
- Punctuation variations
- Name variations (e.g., "Solemnity of Christ the King" vs "Christ the King")
- Ordinal number formats ("First Sunday" vs "1st Sunday" vs "1 ORDINARY")
- Saint name variations ("St." vs "Saint")
"""

import csv
import re
from difflib import SequenceMatcher
from datetime import datetime

def normalize_title(title):
    """
    Normalize a liturgical title for matching.
    Removes common prefixes, punctuation, and standardizes format.
    """
    if not title:
        return ""

    # Convert to lowercase
    normalized = title.lower()

    # Remove dates at the beginning (e.g., "25 March – ")
    normalized = re.sub(r'^\d+\s+\w+\s*[–—-]\s*', '', normalized)

    # Remove common prefixes that don't affect identity
    prefixes_to_remove = [
        'solemnity of ',
        'feast of ',
        'memorial of ',
        'our lord jesus christ ',  # Add specific pattern
        'the ',
        'our lord ',
        'blessed ',
        'most holy ',
        'most sacred ',
    ]
    for prefix in prefixes_to_remove:
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix):]

    # Standardize saint abbreviations
    normalized = re.sub(r'\bsts?\b\.?\s+', 'saint ', normalized)
    normalized = re.sub(r'\bss\b\.?\s+', 'saints ', normalized)

    # Remove punctuation and extra whitespace
    normalized = re.sub(r'[,\.\-–—\']', ' ', normalized)
    normalized = re.sub(r'\s+', ' ', normalized)
    normalized = normalized.strip()

    # Standardize ordinal numbers
    ordinal_map = {
        'first': '1', 'second': '2', 'third': '3', 'fourth': '4',
        'fifth': '5', 'sixth': '6', 'seventh': '7', 'eighth': '8',
        'ninth': '9', 'tenth': '10', 'eleventh': '11', 'twelfth': '12',
        'thirteenth': '13', 'fourteenth': '14', 'fifteenth': '15',
        'sixteenth': '16', 'seventeenth': '17', 'eighteenth': '18',
        'nineteenth': '19', 'twentieth': '20', 'twenty first': '21',
        'twenty second': '22', 'twenty third': '23', 'twenty fourth': '24',
        'twenty fifth': '25', 'twenty sixth': '26', 'twenty seventh': '27',
        'twenty eighth': '28', 'twenty ninth': '29', 'thirtieth': '30',
        'thirty first': '31', 'thirty second': '32', 'thirty third': '33',
        'thirty fourth': '34'
    }

    for word, num in ordinal_map.items():
        normalized = normalized.replace(word, num)

    # Remove 'st', 'nd', 'rd', 'th' from numbers
    normalized = re.sub(r'(\d+)(?:st|nd|rd|th)', r'\1', normalized)

    return normalized

def extract_key_terms(title):
    """
    Extract key identifying terms from a title.
    Returns set of important words (excluding common filler words).
    """
    normalized = normalize_title(title)

    # Words to ignore (too common to be useful for matching)
    stopwords = {
        'of', 'the', 'in', 'on', 'at', 'to', 'a', 'an', 'and', 'or',
        'week', 'day', 'sunday', 'monday', 'tuesday', 'wednesday',
        'thursday', 'friday', 'saturday', 'feria', 'mass', 'vigil'
    }

    words = normalized.split()
    key_terms = {w for w in words if w not in stopwords and len(w) > 1}

    return key_terms

def similarity_score(title1, title2):
    """
    Calculate similarity score between two titles (0-1).
    Uses combination of:
    - Normalized string similarity
    - Key term overlap
    """
    norm1 = normalize_title(title1)
    norm2 = normalize_title(title2)

    # Direct normalized string similarity
    string_sim = SequenceMatcher(None, norm1, norm2).ratio()

    # Key term overlap similarity
    terms1 = extract_key_terms(title1)
    terms2 = extract_key_terms(title2)

    if not terms1 or not terms2:
        term_sim = 0
    else:
        intersection = len(terms1 & terms2)
        union = len(terms1 | terms2)
        term_sim = intersection / union if union > 0 else 0

    # Weighted combination (favor term overlap for semantic matching)
    combined_score = (0.4 * string_sim) + (0.6 * term_sim)

    return combined_score

def match_ordo_to_lectionary(ordo_entry, lectionary_entries, year_letter, season, week):
    """
    Find best matching lectionary entry for an ordo entry.

    Args:
        ordo_entry: Dict with ordo data (liturgical_name, etc.)
        lectionary_entries: List of lectionary entries to match against
        year_letter: 'A', 'B', or 'C'
        season: Liturgical season
        week: Week number (if applicable)

    Returns:
        Best matching lectionary entry or None
    """
    ordo_name = ordo_entry.get('liturgical_name', '')
    ordo_rank = ordo_entry.get('liturgical_rank', '')

    # Filter lectionary entries by year and season (if applicable)
    candidates = []

    for entry in lectionary_entries:
        # Check year match (A, B, C, or Year I/II)
        entry_year = entry.get('Year', '')
        if year_letter and entry_year:
            # Match ABC years or accept entries without year specification
            if entry_year not in [year_letter, 'Year I', 'Year II', '']:
                continue

        # Check season/time match
        entry_time = entry.get('Time', '')
        if season and entry_time:
            season_lower = season.lower()
            time_lower = entry_time.lower()

            # Map seasons to lectionary "Time" values
            season_map = {
                'advent': 'advent',
                'christmas': 'christmas',
                'lent': 'lent',
                'holy week': 'holy week',
                'easter': 'easter',
                'ordinary time': 'ordinary'
            }

            expected_time = season_map.get(season_lower, '')
            if expected_time and expected_time not in time_lower:
                continue

        candidates.append(entry)

    if not candidates:
        return None

    # Score each candidate
    scored_candidates = []
    for candidate in candidates:
        candidate_name = candidate.get('Liturgical Day', '')
        score = similarity_score(ordo_name, candidate_name)
        scored_candidates.append((score, candidate))

    # Sort by score descending
    scored_candidates.sort(key=lambda x: x[0], reverse=True)

    # Return best match if score is above threshold
    best_score, best_match = scored_candidates[0]

    if best_score >= 0.5:  # Threshold for acceptable match
        return {
            'match': best_match,
            'confidence': best_score,
            'ordo_name': ordo_name,
            'lectionary_name': best_match.get('Liturgical Day', '')
        }

    return None

def load_lectionary():
    """Load all lectionary entries"""
    entries = []
    with open('data/source/Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            entries.append(row)
    return entries

def test_matching():
    """Test the matching algorithm with known examples"""
    test_cases = [
        # (ordo_name, lectionary_name, should_match)
        ("OUR LORD JESUS CHRIST, KING OF THE UNIVERSE", "Christ the King", True),
        ("Thursday of the eighteenth week in Ordinary Time", "Thursday Week 18 Ordinary Time", True),
        ("SAINT MARY OF THE CROSS", "Saint Mary MacKillop", True),
        ("Saint Sixtus II, pope, and companions, martyrs", "Saints Sixtus II and Companions", True),
        ("First Sunday of Advent", "1 ADVENT", True),
        ("25 March – Annunciation", "THE ANNUNCIATION OF THE LORD", True),
        ("St Joseph", "Saint Joseph", True),
        ("Ss Peter and Paul", "Saints Peter and Paul", True),
    ]

    print("="*80)
    print("TESTING MATCHING ALGORITHM")
    print("="*80)
    print()

    for ordo_name, lect_name, should_match in test_cases:
        score = similarity_score(ordo_name, lect_name)
        match = "✓ MATCH" if score >= 0.5 else "✗ NO MATCH"
        expected = "✓" if should_match else "✗"
        status = "PASS" if (score >= 0.5) == should_match else "FAIL"

        print(f"{status}: {ordo_name}")
        print(f"     vs {lect_name}")
        print(f"     Score: {score:.2f} {match} (expected: {expected})")
        print()

def main():
    """Run matching tests"""
    test_matching()

    print("\n" + "="*80)
    print("NORMALIZATION EXAMPLES")
    print("="*80)
    print()

    examples = [
        "OUR LORD JESUS CHRIST, KING OF THE UNIVERSE",
        "Thursday of the eighteenth week in Ordinary Time",
        "SAINT MARY OF THE CROSS",
        "First Sunday of Advent",
        "25 March – Annunciation",
        "St. Joseph",
        "Ss. Peter and Paul",
    ]

    for example in examples:
        print(f"Original:   {example}")
        print(f"Normalized: {normalize_title(example)}")
        print(f"Key terms:  {extract_key_terms(example)}")
        print()

if __name__ == '__main__':
    main()

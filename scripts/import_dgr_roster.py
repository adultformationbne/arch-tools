#!/usr/bin/env python3
"""
Import DGR contributors and schedule from CSV files.

Usage:
    python scripts/import_dgr_roster.py [--dry-run]

Files required:
    - scripts/people.csv (initials, name)
    - scripts/schedule.csv (day-of-month roster for 2026)

Blank spots in schedule.csv represent blocked dates (Lent, Advent, Christmas).
"""

import csv
import os
import sys
import uuid
import secrets
from datetime import date
from dotenv import load_dotenv
from supabase import create_client

# Load environment
load_dotenv()

SUPABASE_URL = os.environ.get('PUBLIC_SUPABASE_URL') or os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY') or os.environ.get('PRIVATE_SUPABASE_SERVICE_ROLE')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials in environment")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Year for schedule import
YEAR = 2026

# Month name to number mapping
MONTHS = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
}


def generate_token():
    """Generate a secure random token for contributor access."""
    return secrets.token_urlsafe(32)


def load_people(filepath='scripts/people.csv'):
    """Load contributors from CSV. Returns dict of initials -> {name, email}."""
    people = {}
    with open(filepath, 'r') as f:
        reader = csv.DictReader(f)
        for row in reader:
            initials = row['initials'].strip()
            name = row['name'].strip()
            email = row.get('email', '').strip() if 'email' in row else ''
            people[initials] = {'name': name, 'email': email}
    return people


def load_schedule(filepath='scripts/schedule.csv'):
    """Load schedule from CSV. Returns list of (date, initials) tuples."""
    assignments = []

    with open(filepath, 'r') as f:
        reader = csv.reader(f)
        rows = list(reader)

    # Row 0: "DGR Roster 2026,,,,..."
    # Row 1: "Day,Jan,Feb,Mar,..."
    # Row 2+: day number, then initials per month

    header = rows[1]  # ['Day', 'Jan', 'Feb', ...]
    month_cols = {}
    for col_idx, col_name in enumerate(header):
        if col_name in MONTHS:
            month_cols[col_idx] = MONTHS[col_name]

    for row in rows[2:]:
        if not row or not row[0]:
            continue

        try:
            day = int(row[0])
        except ValueError:
            continue

        for col_idx, month_num in month_cols.items():
            if col_idx >= len(row):
                continue

            initials = row[col_idx].strip() if row[col_idx] else ''

            if not initials:
                # Blank = blocked date (Lent/Advent/Christmas)
                continue

            # Validate the date exists (e.g., Feb 30 doesn't exist)
            try:
                assignment_date = date(YEAR, month_num, day)
                assignments.append((assignment_date, initials))
            except ValueError:
                # Invalid date (e.g., Feb 30)
                pass

    return assignments


def import_contributors(people, dry_run=False):
    """Import contributors to dgr_contributors table."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Importing {len(people)} contributors...")

    # Check existing contributors
    existing = supabase.table('dgr_contributors').select('name').execute()
    existing_names = {c['name'] for c in existing.data}

    contributors = {}  # initials -> uuid mapping
    missing_emails = []

    for initials in sorted(people.keys()):
        info = people[initials]
        name = info['name']
        email = info['email']

        if name in existing_names:
            # Get existing ID
            result = supabase.table('dgr_contributors').select('id').eq('name', name).execute()
            if result.data:
                contributors[initials] = result.data[0]['id']
                print(f"  [EXISTS] {initials}: {name}")
                continue

        contributor_id = str(uuid.uuid4())
        contributors[initials] = contributor_id

        # Use provided email or generate placeholder
        if not email:
            email = f"{initials.lower()}@dgr.placeholder"
            missing_emails.append(initials)

        record = {
            'id': contributor_id,
            'name': name,
            'email': email,
            'active': True,
            'access_token': generate_token(),
            'notes': f'Imported from roster. Initials: {initials}'
        }

        if dry_run:
            print(f"  [WOULD CREATE] {initials}: {name} <{email}>")
        else:
            supabase.table('dgr_contributors').insert(record).execute()
            print(f"  [CREATED] {initials}: {name} <{email}>")

    if missing_emails:
        print(f"\n  ⚠️  {len(missing_emails)} contributors missing emails (using placeholders):")
        print(f"     {', '.join(missing_emails)}")

    return contributors


def import_schedule(assignments, contributors, dry_run=False):
    """Import schedule assignments to dgr_schedule table."""
    print(f"\n{'[DRY RUN] ' if dry_run else ''}Importing {len(assignments)} schedule assignments...")

    # Check existing schedule entries for the year
    start_date = date(YEAR, 1, 1).isoformat()
    end_date = date(YEAR, 12, 31).isoformat()

    existing = supabase.table('dgr_schedule').select('date').gte('date', start_date).lte('date', end_date).execute()
    existing_dates = {row['date'] for row in existing.data}

    created = 0
    skipped = 0
    errors = []

    for assignment_date, initials in sorted(assignments):
        date_str = assignment_date.isoformat()

        if date_str in existing_dates:
            skipped += 1
            continue

        if initials not in contributors:
            errors.append(f"Unknown initials '{initials}' for {date_str}")
            continue

        contributor_id = contributors[initials]

        record = {
            'id': str(uuid.uuid4()),
            'date': date_str,
            'contributor_id': contributor_id,
            'status': 'pending'
        }

        if not dry_run:
            supabase.table('dgr_schedule').insert(record).execute()

        created += 1

    print(f"  Created: {created}")
    print(f"  Skipped (existing): {skipped}")

    if errors:
        print(f"\n  Errors ({len(errors)}):")
        for err in errors[:10]:
            print(f"    - {err}")
        if len(errors) > 10:
            print(f"    ... and {len(errors) - 10} more")

    return created


def show_blocked_dates():
    """Show which dates are blocked (Lent, Advent, Christmas)."""
    print("\n--- Blocked Date Ranges (No Assignments) ---")

    # Based on 2026 liturgical calendar:
    # Lent: Ash Wednesday (Feb 18) - Easter Sunday (Apr 5)
    # Advent: First Sunday (Nov 29) - Dec 24
    # Christmas: Dec 25 - ?

    print("""
Based on the blank spots in schedule.csv, these periods are blocked:
- January 1-4: End of Christmas season
- March (entire month): Lent season
- April 1-5: Holy Week / Easter Triduum
- November 28-30: Start of Advent
- December: Advent and Christmas season

These align with the liturgical calendar for 2026.
""")


def main():
    dry_run = '--dry-run' in sys.argv

    if dry_run:
        print("=" * 50)
        print("DRY RUN MODE - No changes will be made")
        print("=" * 50)

    # Load data
    people = load_people()
    print(f"Loaded {len(people)} contributors from people.csv")

    assignments = load_schedule()
    print(f"Loaded {len(assignments)} schedule assignments from schedule.csv")

    # Show blocked dates
    show_blocked_dates()

    # Import
    contributors = import_contributors(people, dry_run)
    import_schedule(assignments, contributors, dry_run)

    print("\n" + "=" * 50)
    if dry_run:
        print("DRY RUN COMPLETE - Run without --dry-run to apply changes")
    else:
        print("IMPORT COMPLETE")
    print("=" * 50)


if __name__ == '__main__':
    main()

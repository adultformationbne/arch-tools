#!/usr/bin/env python3
"""
Calculate Easter date using Computus algorithm
Then verify against known dates
"""

from datetime import datetime, timedelta

def calculate_easter(year):
    """
    Calculate Easter Sunday using the Meeus/Jones/Butcher algorithm
    (Gregorian calendar, valid for years 1583-4099)
    """
    a = year % 19
    b = year // 100
    c = year % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = ((h + l - 7 * m + 114) % 31) + 1

    return datetime(year, month, day)

def verify_against_known():
    """Verify our calculation against known Easter dates"""
    # Known Easter dates from reliable sources
    known_dates = {
        2020: "April 12",
        2021: "April 4",
        2022: "April 17",
        2023: "April 9",
        2024: "March 31",
        2025: "April 20",
        2026: "April 5",
        2027: "March 28",
        2028: "April 16",
        2029: "April 1",
        2030: "April 21"
    }

    print("=" * 80)
    print("VERIFYING EASTER CALCULATION")
    print("=" * 80)
    print(f"\n{'Year':<8} {'Calculated':<15} {'Known Date':<15} {'Match':<10}")
    print("-" * 80)

    all_match = True

    for year, known_date in known_dates.items():
        calculated = calculate_easter(year)
        calculated_str = calculated.strftime("%B %d")

        # Parse known date
        known_datetime = datetime.strptime(f"{known_date} {year}", "%B %d %Y")

        match = calculated == known_datetime
        match_str = "✓" if match else "✗ MISMATCH"

        if not match:
            all_match = False

        print(f"{year:<8} {calculated_str:<15} {known_date:<15} {match_str:<10}")

    print("-" * 80)
    if all_match:
        print("✓ All dates match! Algorithm is correct.")
    else:
        print("✗ Some dates don't match. Algorithm needs adjustment.")

    return all_match

def generate_key_dates(year):
    """Generate all key liturgical dates for a year"""
    easter = calculate_easter(year)

    # Calculate moveable dates relative to Easter
    dates = {
        'easter_sunday': easter,
        'ash_wednesday': easter - timedelta(days=46),
        'palm_sunday': easter - timedelta(days=7),
        'holy_thursday': easter - timedelta(days=3),
        'good_friday': easter - timedelta(days=2),
        'holy_saturday': easter - timedelta(days=1),
        'pentecost': easter + timedelta(days=49),
        'trinity_sunday': easter + timedelta(days=56),
        'corpus_christi': easter + timedelta(days=60),  # Thursday after Trinity
        'sacred_heart': easter + timedelta(days=68),    # Friday after Corpus Christi
        'christ_the_king': None  # Calculated separately
    }

    # First Sunday of Advent (4 Sundays before Christmas)
    christmas = datetime(year, 12, 25)
    # Go back to find the 4th Sunday before Christmas
    days_to_subtract = christmas.weekday() + 1  # Days until previous Sunday
    fourth_sunday_before = christmas - timedelta(days=days_to_subtract + 21)  # 3 weeks back
    dates['first_advent'] = fourth_sunday_before

    # Christ the King (last Sunday before Advent, which is 1 week before 1st Advent)
    dates['christ_the_king'] = dates['first_advent'] - timedelta(days=7)

    return dates

def main():
    # First verify
    if verify_against_known():
        print("\n\n" + "=" * 80)
        print("GENERATING KEY LITURGICAL DATES FOR 2025-2030")
        print("=" * 80)

        for year in range(2025, 2031):
            print(f"\n{year}:")
            dates = generate_key_dates(year)

            for name, date in dates.items():
                if date:
                    print(f"  {name:<20}: {date.strftime('%Y-%m-%d (%A)')}")

if __name__ == '__main__':
    main()

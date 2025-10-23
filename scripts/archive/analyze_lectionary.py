#!/usr/bin/env python3
"""
Analyze Lectionary.csv to understand data structure
- Shows unique values for each column
- Shows data distribution
- Helps design database schema
"""

import csv
from collections import Counter, defaultdict

def analyze_lectionary():
    print("=" * 80)
    print("LECTIONARY.CSV ANALYSIS")
    print("=" * 80)

    # Read the CSV
    with open('Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    print(f"\nTotal rows: {len(rows)}")
    print(f"\nColumns: {list(rows[0].keys())}")

    # Analyze each column
    print("\n" + "=" * 80)
    print("UNIQUE VALUES BY COLUMN")
    print("=" * 80)

    for column in rows[0].keys():
        unique_values = set(row[column] for row in rows if row[column])
        print(f"\n{column}:")
        print(f"  Unique count: {len(unique_values)}")

        if len(unique_values) <= 50:  # Show all if reasonable
            sorted_values = sorted(unique_values)
            for val in sorted_values:
                count = sum(1 for row in rows if row[column] == val)
                print(f"    - {val}: {count} occurrences")
        else:
            print(f"    (Too many to display - showing first 20)")
            sorted_values = sorted(unique_values)[:20]
            for val in sorted_values:
                count = sum(1 for row in rows if row[column] == val)
                print(f"    - {val}: {count} occurrences")

    # Analyze Time + Week combinations
    print("\n" + "=" * 80)
    print("TIME PERIOD + WEEK COMBINATIONS")
    print("=" * 80)

    time_week_combos = defaultdict(set)
    for row in rows:
        time_period = row['Time']
        week = row['Week']
        time_week_combos[time_period].add(week)

    for time_period, weeks in sorted(time_week_combos.items()):
        print(f"\n{time_period}:")
        print(f"  Weeks: {sorted(weeks, key=lambda x: int(x) if x.isdigit() else 999)}")
        print(f"  Week count: {len(weeks)}")

    # Analyze Year + Day combinations
    print("\n" + "=" * 80)
    print("YEAR CYCLE + DAY COMBINATIONS")
    print("=" * 80)

    year_day_combos = defaultdict(set)
    for row in rows:
        year = row['Year']
        day = row['Day']
        year_day_combos[year].add(day)

    for year, days in sorted(year_day_combos.items()):
        count = sum(1 for row in rows if row['Year'] == year)
        print(f"\nYear {year}: {count} entries")
        print(f"  Days: {sorted(days)}")

    # Sample data for each Time period
    print("\n" + "=" * 80)
    print("SAMPLE DATA BY TIME PERIOD")
    print("=" * 80)

    time_samples = defaultdict(list)
    for row in rows:
        time_period = row['Time']
        time_samples[time_period].append(row)

    for time_period, samples in sorted(time_samples.items()):
        print(f"\n{time_period} - showing first 3 entries:")
        for i, sample in enumerate(samples[:3], 1):
            print(f"  {i}. Year {sample['Year']}, Week {sample['Week']}, {sample['Day']}")
            print(f"     {sample['Liturgical Day']}")
            print(f"     Gospel: {sample['Gospel Reading']}")

if __name__ == '__main__':
    analyze_lectionary()

#!/usr/bin/env python3
"""
Generate complete liturgical calendar for multiple years
Uses Easter calculation to determine all moveable dates
"""

from datetime import datetime, timedelta
import csv

def calculate_easter(year):
    """Calculate Easter Sunday using Computus algorithm"""
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

def generate_full_calendar(year):
    """Generate complete liturgical calendar for a year"""
    entries = []

    # Calculate key dates
    easter = calculate_easter(year)
    ash_wednesday = easter - timedelta(days=46)
    palm_sunday = easter - timedelta(days=7)
    pentecost = easter + timedelta(days=49)
    trinity_sunday = easter + timedelta(days=56)
    corpus_christi = easter + timedelta(days=60)
    sacred_heart = easter + timedelta(days=68)

    # First Sunday of Advent
    christmas = datetime(year, 12, 25)
    days_to_subtract = christmas.weekday() + 1
    first_advent = christmas - timedelta(days=days_to_subtract + 21)
    christ_the_king = first_advent - timedelta(days=7)

    # Baptism of the Lord (Sunday after Epiphany, Jan 6)
    epiphany = datetime(year, 1, 6)
    if epiphany.weekday() == 6:  # If Sunday
        baptism_lord = epiphany + timedelta(days=7)
    else:
        baptism_lord = epiphany + timedelta(days=(6 - epiphany.weekday()))

    # Start of Ordinary Time after Baptism
    ordinary_time_1_start = baptism_lord  # Baptism itself is start of Ordinary Time
    ordinary_time_1_end = ash_wednesday - timedelta(days=1)    # Day before Ash Wed

    # Ordinary Time after Pentecost
    ordinary_time_2_start = pentecost + timedelta(days=1)  # Monday after Pentecost
    ordinary_time_2_end = first_advent - timedelta(days=1)  # Day before Advent

    # Week counting for Ordinary Time
    # Week 1 includes Baptism of the Lord Sunday, then continues Mon-Sat
    # Week 2 starts on the SUNDAY after Baptism (not Monday)
    ordinary_weeks = {}
    current_date = baptism_lord
    week_num = 1
    while current_date <= ordinary_time_1_end:
        ordinary_weeks[current_date.strftime('%Y-%m-%d')] = week_num
        current_date += timedelta(days=1)
        if current_date.weekday() == 6:  # Sunday (0=Mon, 6=Sun)
            week_num += 1

    # Continue week counting after Pentecost
    # Figure out which week number to resume at
    # Week after Pentecost continues the count
    current_date = ordinary_time_2_start
    # Trinity Sunday is week after Pentecost
    week_num = 9  # Approximate - will need adjustment

    # Better approach: count backwards from Christ the King (Week 34)
    current_date = christ_the_king
    week_num = 34
    temp_weeks = {}
    while current_date >= ordinary_time_2_start:
        temp_weeks[current_date.strftime('%Y-%m-%d')] = week_num
        current_date -= timedelta(days=1)
        if current_date.weekday() == 6:  # New Sunday going backwards
            week_num -= 1
    ordinary_weeks.update(temp_weeks)

    # Generate every day of the year
    current_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31)

    while current_date <= end_date:
        date_str = current_date.strftime('%Y-%m-%d')
        dow = current_date.weekday()  # 0=Monday, 6=Sunday
        dow_name = current_date.strftime('%A')

        # Determine season and liturgical info
        season = 'Ordinary Time'
        liturgical_name = f"{dow_name}"
        week_number = None
        rank = 'Feria'

        # Christmas Season (Dec 25 - Baptism of Lord)
        if current_date >= datetime(year, 12, 25) or current_date < baptism_lord:
            season = 'Christmas'
            if current_date == datetime(year, 12, 25):
                liturgical_name = 'Christmas Day'
                rank = 'Solemnity'
            elif current_date == datetime(year, 1, 1):
                liturgical_name = 'Mary, Mother of God'
                rank = 'Solemnity'
            elif current_date == epiphany:
                liturgical_name = 'Epiphany of the Lord'
                rank = 'Solemnity'
            elif current_date == baptism_lord:
                liturgical_name = 'Baptism of the Lord'
                rank = 'Feast'

        # Advent (1st Sunday of Advent - Dec 24)
        elif current_date >= first_advent and current_date < datetime(year, 12, 25):
            season = 'Advent'
            # Count Advent weeks
            days_since_advent = (current_date - first_advent).days
            advent_week = (days_since_advent // 7) + 1
            week_number = advent_week
            if dow == 6:  # Sunday
                liturgical_name = f"{self_ordinal(advent_week)} Sunday of Advent"
                rank = 'Sunday'
            else:
                liturgical_name = f"{dow_name} of {self_ordinal(advent_week)} week of Advent"

        # Lent (Ash Wednesday - Holy Saturday)
        elif current_date >= ash_wednesday and current_date < easter:
            if current_date >= palm_sunday:
                season = 'Holy Week'
                if current_date == palm_sunday:
                    liturgical_name = 'Palm Sunday'
                    rank = 'Sunday'
                elif current_date == easter - timedelta(days=3):
                    liturgical_name = 'Holy Thursday'
                    rank = 'Triduum'
                elif current_date == easter - timedelta(days=2):
                    liturgical_name = 'Good Friday'
                    rank = 'Triduum'
                elif current_date == easter - timedelta(days=1):
                    liturgical_name = 'Holy Saturday'
                    rank = 'Triduum'
                else:
                    liturgical_name = f"{dow_name} of Holy Week"
            else:
                season = 'Lent'
                # Find the first Sunday of Lent to calculate week numbers
                # Ash Wednesday is always a Wednesday, first Sunday is 4 days later
                first_sunday_lent = ash_wednesday + timedelta(days=(6 - ash_wednesday.weekday()))

                if current_date == ash_wednesday:
                    liturgical_name = 'Ash Wednesday'
                    rank = 'Ash Wednesday'
                    week_number = 1
                elif current_date < first_sunday_lent:
                    # Thursday, Friday, Saturday after Ash Wednesday
                    liturgical_name = f"{dow_name} after Ash Wednesday"
                    week_number = 1
                else:
                    # Week 1 starts on First Sunday of Lent
                    days_since_first_sunday = (current_date - first_sunday_lent).days
                    lent_week = (days_since_first_sunday // 7) + 1
                    week_number = lent_week

                    if dow == 6:  # Sunday
                        liturgical_name = f"{self_ordinal(lent_week)} Sunday of Lent"
                        rank = 'Sunday'
                    else:
                        liturgical_name = f"{dow_name} of {self_ordinal(lent_week)} week of Lent"

        # Easter Season (Easter Sunday - Pentecost)
        elif current_date >= easter and current_date <= pentecost:
            season = 'Easter'
            if current_date == easter:
                liturgical_name = 'Easter Sunday'
                rank = 'Solemnity'
            elif current_date == pentecost:
                liturgical_name = 'Pentecost Sunday'
                rank = 'Solemnity'
            else:
                days_since_easter = (current_date - easter).days
                easter_week = (days_since_easter // 7) + 1
                week_number = easter_week
                if dow == 6:  # Sunday
                    liturgical_name = f"{self_ordinal(easter_week)} Sunday of Easter"
                    rank = 'Sunday'
                else:
                    liturgical_name = f"{dow_name} of {self_ordinal(easter_week)} week of Easter"

        # Trinity Sunday and following special days
        elif current_date == trinity_sunday:
            season = 'Ordinary Time'
            liturgical_name = 'Trinity Sunday'
            rank = 'Solemnity'
            week_number = 'Solemnity'
        elif current_date == corpus_christi:
            season = 'Ordinary Time'
            liturgical_name = 'THE BODY AND BLOOD OF CHRIST'
            rank = 'Solemnity'
            week_number = ordinary_weeks.get(date_str, None)  # Keep the week number
        elif current_date == sacred_heart:
            season = 'Ordinary Time'
            liturgical_name = 'Sacred Heart of Jesus'
            rank = 'Solemnity'
            week_number = 'Solemnity'

        # Christ the King
        elif current_date == christ_the_king:
            season = 'Ordinary Time'
            liturgical_name = 'Our Lord Jesus Christ, King of the Universe'
            rank = 'Solemnity'
            week_number = 34

        # Ordinary Time
        elif date_str in ordinary_weeks:
            season = 'Ordinary Time'
            week_number = ordinary_weeks[date_str]
            if dow == 6:  # Sunday
                if week_number == 1:
                    liturgical_name = 'Baptism of the Lord'
                    rank = 'Feast'
                else:
                    liturgical_name = f"{self_ordinal(week_number)} Sunday in Ordinary Time"
                    rank = 'Sunday'
            else:
                liturgical_name = f"{dow_name} of Week {week_number} in Ordinary Time"

        entries.append({
            'calendar_date': date_str,
            'year': year,
            'liturgical_season': season,
            'liturgical_week': week_number,
            'day_of_week': dow_name,
            'liturgical_name': liturgical_name,
            'liturgical_rank': rank
        })

        current_date += timedelta(days=1)

    return entries

def self_ordinal(n):
    """Convert number to ordinal (1st, 2nd, 3rd, etc.)"""
    if n == 1:
        return "First"
    elif n == 2:
        return "Second"
    elif n == 3:
        return "Third"
    elif n == 4:
        return "Fourth"
    elif n == 5:
        return "Fifth"
    elif n == 6:
        return "Sixth"
    elif n == 7:
        return "Seventh"
    else:
        return str(n)

def main():
    print("=" * 80)
    print("GENERATING LITURGICAL CALENDAR")
    print("=" * 80)

    all_entries = []

    for year in range(2025, 2031):
        print(f"\nGenerating {year}...")
        entries = generate_full_calendar(year)
        print(f"  {len(entries)} days generated")
        all_entries.extend(entries)

    # Save to CSV
    filename = 'liturgical_calendar_full.csv'
    fieldnames = ['calendar_date', 'year', 'liturgical_season', 'liturgical_week',
                  'day_of_week', 'liturgical_name', 'liturgical_rank']

    with open(filename, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_entries)

    print(f"\n{'='*80}")
    print(f"COMPLETE! Generated {len(all_entries)} days")
    print(f"Saved to: {filename}")
    print(f"{'='*80}")

    # Show samples
    print("\nSample entries from 2025:")
    for entry in all_entries[:15]:
        if entry['year'] == 2025:
            week = f"Week {entry['liturgical_week']}" if entry['liturgical_week'] else ""
            print(f"  {entry['calendar_date']} ({entry['day_of_week']}): {entry['liturgical_name']} {week}")

if __name__ == '__main__':
    main()

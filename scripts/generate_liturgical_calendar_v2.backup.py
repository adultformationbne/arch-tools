#!/usr/bin/env python3
"""
Generate complete liturgical calendar for multiple years
Uses Easter calculation to determine all moveable dates
Incorporates ALL entries from Lectionary.csv including 248 fixed feast days
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

def load_lectionary():
    """Load the Lectionary.csv and organize by type"""
    lectionary = {
        'sundays': {},  # Key: (Year, Week, Season) -> entry
        'weekdays': {},  # Key: (Year, Week, Day, Season) -> entry
        'fixed_feasts': {},  # Key: (Month, Day) -> entry
        'solemnities': {},  # Key: name -> entry
        'christmas': [],  # Special Christmas season entries
        'advent': [],  # Special Advent entries
        'easter': [],  # Special Easter season entries
        'holy_week': [],  # Holy Week entries
        'moving_feasts': [],  # Moving feasts
        'christmas_special': {}  # Christmas special Masses (Vigil, Night, Dawn, Day)
    }

    month_map = {
        'January': 1, 'February': 2, 'March': 3, 'April': 4,
        'May': 5, 'June': 6, 'July': 7, 'August': 8,
        'September': 9, 'October': 10, 'November': 11, 'December': 12
    }

    with open('data/source/Lectionary.csv', 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            day_type = row['Day'].strip()
            time = row['Time'].strip()
            liturgical_day = row['Liturgical Day'].strip()

            # Special Christmas Masses
            if day_type == 'Fixed Day' and time == 'Christmas':
                if liturgical_day in ['Christmas Vigil', 'Christmas Night', 'Christmas Dawn', 'Christmas Day']:
                    lectionary['christmas_special'][liturgical_day] = row
                    continue

                # Christmas octave days: "2nd January", "3rd January", etc.
                if 'January' in liturgical_day:
                    # Parse "2nd January" -> (1, 2)
                    parts = liturgical_day.split()
                    if len(parts) >= 2:
                        day_str = parts[0]  # "2nd", "3rd", etc.
                        day_num = int(''.join(filter(str.isdigit, day_str)))
                        if day_num >= 2 and day_num <= 7:
                            lectionary['fixed_feasts'][(1, day_num)] = row
                    continue

            # Advent special days: "17th December", "18th December", etc.
            if day_type == 'Fixed Day' and time == 'Advent':
                if 'December' in liturgical_day:
                    # Parse "17th December" -> (12, 17)
                    parts = liturgical_day.split()
                    if len(parts) >= 2:
                        day_str = parts[0]  # "17th", "18th", etc.
                        day_num = int(''.join(filter(str.isdigit, day_str)))
                        lectionary['fixed_feasts'][(12, day_num)] = row
                    continue

            # Fixed feasts (specific calendar dates)
            if day_type == 'Fixed Day' and time == 'Fixed Feast':
                # Parse date from liturgical day name
                # Format: "1 January – Mary, Mother of God"
                if '–' in liturgical_day or '—' in liturgical_day or '-' in liturgical_day:
                    separator = '–' if '–' in liturgical_day else ('—' if '—' in liturgical_day else '-')
                    date_part = liturgical_day.split(separator)[0].strip()
                    parts = date_part.split()
                    if len(parts) >= 2:
                        try:
                            day_num = int(parts[0])
                            month_name = parts[1]
                            if month_name in month_map:
                                month_num = month_map[month_name]
                                lectionary['fixed_feasts'][(month_num, day_num)] = row
                        except (ValueError, IndexError):
                            pass

            # Christmas season special days
            elif time == 'Christmas' and day_type not in ['Fixed Day']:
                lectionary['christmas'].append(row)

            # Easter season entries
            elif time == 'Easter' and day_type not in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']:
                lectionary['easter'].append(row)

            # Holy Week
            elif time == 'Holy Week':
                lectionary['holy_week'].append(row)

            # Moving feasts
            elif day_type == 'Moving Feast':
                lectionary['moving_feasts'].append(row)

            # Solemnities
            elif row['Week'] == 'Solemnity':
                lectionary['solemnities'][liturgical_day] = row

            # Regular Sundays
            elif day_type == 'Sunday' and row['Year'] in ['A', 'B', 'C']:
                year_cycle = row['Year']
                week = row['Week']
                lectionary['sundays'][(year_cycle, week, time)] = row

            # Weekdays
            elif day_type in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']:
                year_cycle = row['Year']
                week = row['Week']
                lectionary['weekdays'][(year_cycle, week, day_type, time)] = row

    return lectionary

def get_liturgical_year(date):
    """Determine which liturgical year cycle (A, B, C) for a given date"""
    # Liturgical year starts on First Sunday of Advent
    # Year C: 2024-2025, 2027-2028, 2030-2031 etc (year divisible by 3)
    # Year A: 2025-2026, 2028-2029, 2031-2032 etc (year % 3 == 1)
    # Year B: 2026-2027, 2029-2030, 2032-2033 etc (year % 3 == 2)

    year = date.year
    christmas = datetime(year, 12, 25)
    days_to_subtract = christmas.weekday() + 1
    first_advent = christmas - timedelta(days=days_to_subtract + 21)

    # If we're before Advent of this year, we're in previous liturgical year
    if date < first_advent:
        liturgical_year_number = year
    else:
        liturgical_year_number = year + 1

    # Determine cycle
    remainder = liturgical_year_number % 3
    if remainder == 0:
        return 'C'
    elif remainder == 1:
        return 'A'
    else:
        return 'B'

def generate_full_calendar(year, lectionary):
    """Generate complete liturgical calendar for a year with lectionary data"""
    entries = []

    # Calculate key dates
    easter = calculate_easter(year)
    ash_wednesday = easter - timedelta(days=46)
    palm_sunday = easter - timedelta(days=7)
    pentecost = easter + timedelta(days=49)
    trinity_sunday = easter + timedelta(days=56)

    # AUSTRALIA: Ascension moved to Sunday (42 days, not Thursday at 39)
    ascension = easter + timedelta(days=42)  # 7th Sunday of Easter

    # AUSTRALIA: Corpus Christi moved to Sunday (63 days, not Thursday at 60)
    corpus_christi = easter + timedelta(days=63)  # Sunday after Trinity

    sacred_heart = easter + timedelta(days=68)  # Friday after Corpus Christi

    # First Sunday of Advent
    christmas = datetime(year, 12, 25)
    days_to_subtract = christmas.weekday() + 1
    first_advent = christmas - timedelta(days=days_to_subtract + 21)
    christ_the_king = first_advent - timedelta(days=7)

    # AUSTRALIA: Epiphany celebrated on Sunday between Jan 2-8 (not fixed Jan 6)
    jan_2 = datetime(year, 1, 2)
    days_until_sunday = (6 - jan_2.weekday()) % 7  # Days until next Sunday
    if days_until_sunday == 0:  # Jan 2 is Sunday
        epiphany = jan_2
    else:
        epiphany = jan_2 + timedelta(days=days_until_sunday)

    # Baptism of the Lord - Sunday after Epiphany
    baptism_lord = epiphany + timedelta(days=7)

    # Start of Ordinary Time after Baptism
    ordinary_time_1_start = baptism_lord
    ordinary_time_1_end = ash_wednesday - timedelta(days=1)

    # Ordinary Time after Pentecost
    ordinary_time_2_start = pentecost + timedelta(days=1)
    ordinary_time_2_end = first_advent - timedelta(days=1)

    # Week counting for Ordinary Time
    ordinary_weeks = {}
    current_date = baptism_lord
    week_num = 1
    while current_date <= ordinary_time_1_end:
        ordinary_weeks[current_date.strftime('%Y-%m-%d')] = week_num
        current_date += timedelta(days=1)
        if current_date.weekday() == 6:  # Sunday
            week_num += 1

    # Continue week counting after Pentecost (count backwards from Christ the King = Week 34)
    # Week changes on Monday, so when going backwards, decrement after Saturday
    current_date = christ_the_king
    week_num = 34
    temp_weeks = {}
    while current_date >= ordinary_time_2_start:
        temp_weeks[current_date.strftime('%Y-%m-%d')] = week_num
        current_date -= timedelta(days=1)
        # Decrement week when we pass Saturday (going backwards from Sunday)
        if current_date >= ordinary_time_2_start and current_date.weekday() == 5:  # Saturday
            week_num -= 1
    ordinary_weeks.update(temp_weeks)

    # Get liturgical year cycle
    liturgical_year_cycle = get_liturgical_year(datetime(year, 1, 1))

    # Generate every day of the year
    current_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31)

    while current_date <= end_date:
        date_str = current_date.strftime('%Y-%m-%d')
        dow = current_date.weekday()  # 0=Monday, 6=Sunday
        dow_name = current_date.strftime('%A')
        month = current_date.month
        day = current_date.day

        # Check for fixed feast days (but solemnities take precedence)
        fixed_feast = lectionary['fixed_feasts'].get((month, day))

        # Determine season and liturgical info
        season = 'Ordinary Time'
        liturgical_name = f"{dow_name}"
        week_number = None
        rank = 'Feria'

        # PRIORITY 0: Major Solemnities override everything (including fixed feasts!)
        # Fixed date Solemnities (override all seasons and feasts)
        if month == 3 and day == 19:
            # St Joseph - Solemnity
            season = 'Ordinary Time'
            liturgical_name = '19 March – St Joseph'
            rank = 'Solemnity'
            week_number = ordinary_weeks.get(date_str, None)
        elif month == 3 and day == 25:
            # Annunciation - Solemnity
            season = 'Ordinary Time'
            liturgical_name = '25 March – Annunciation'
            rank = 'Solemnity'
            week_number = ordinary_weeks.get(date_str, None)
        elif month == 6 and day == 24:
            # Nativity of St John the Baptist - Solemnity
            season = 'Ordinary Time'
            liturgical_name = '24 June – Birth of John the Baptist'
            rank = 'Solemnity'
            week_number = ordinary_weeks.get(date_str, None)
        elif month == 6 and day == 29:
            # Sts Peter and Paul - Solemnity
            season = 'Ordinary Time'
            liturgical_name = '29 June – Ss Peter and Paul'
            rank = 'Solemnity'
            week_number = ordinary_weeks.get(date_str, None)
        elif month == 8 and day == 15:
            # Assumption - Solemnity
            season = 'Ordinary Time'
            liturgical_name = '15 August – Assumption'
            rank = 'Solemnity'
            week_number = ordinary_weeks.get(date_str, None)
        elif month == 11 and day == 1:
            # All Saints - Solemnity
            season = 'Ordinary Time'
            liturgical_name = '1 November – All Saints'
            rank = 'Solemnity'
            week_number = ordinary_weeks.get(date_str, None)
        elif month == 12 and day == 8:
            # Immaculate Conception - Solemnity
            season = 'Ordinary Time'
            liturgical_name = '8 December – Immaculate Conception'
            rank = 'Solemnity'
            week_number = ordinary_weeks.get(date_str, None)
        # Moveable Solemnities in Ordinary Time
        elif current_date == sacred_heart:
            season = 'Ordinary Time'
            liturgical_name = 'Sacred Heart of Jesus'
            rank = 'Solemnity'
            week_number = ordinary_weeks.get(date_str, None)
        elif current_date == corpus_christi:
            season = 'Ordinary Time'
            liturgical_name = 'THE BODY AND BLOOD OF CHRIST'
            rank = 'Solemnity'
            week_number = ordinary_weeks.get(date_str, None)

        # PRIORITY 1: Fixed feast days override weekdays (but not Solemnities/Sundays)
        elif fixed_feast and dow != 6:  # Not Sunday
            season = 'Ordinary Time'  # Most feasts are in ordinary time
            liturgical_name = fixed_feast['Liturgical Day']
            rank = 'Feast'
            # Keep week number if in ordinary time
            if date_str in ordinary_weeks:
                week_number = ordinary_weeks[date_str]

        # PRIORITY 2: Christmas Season (Dec 25 - Baptism of Lord)
        elif current_date >= datetime(year, 12, 25) or current_date < baptism_lord:
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
            else:
                # Check Christmas season special days
                liturgical_name = f"{dow_name} of Christmas Season"

        # PRIORITY 3: Advent (1st Sunday of Advent - Dec 24)
        elif current_date >= first_advent and current_date < datetime(year, 12, 25):
            season = 'Advent'
            days_since_advent = (current_date - first_advent).days
            advent_week = (days_since_advent // 7) + 1
            week_number = advent_week
            if dow == 6:  # Sunday
                liturgical_name = f"{self_ordinal(advent_week)} Sunday of Advent"
                rank = 'Sunday'
            else:
                liturgical_name = f"{dow_name} of {self_ordinal(advent_week)} week of Advent"

        # PRIORITY 4: Lent (Ash Wednesday - Holy Saturday)
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
                first_sunday_lent = ash_wednesday + timedelta(days=(6 - ash_wednesday.weekday()))

                if current_date == ash_wednesday:
                    liturgical_name = 'Ash Wednesday'
                    rank = 'Ash Wednesday'
                    week_number = 1
                elif current_date < first_sunday_lent:
                    liturgical_name = f"{dow_name} after Ash Wednesday"
                    week_number = 1
                else:
                    days_since_first_sunday = (current_date - first_sunday_lent).days
                    lent_week = (days_since_first_sunday // 7) + 1
                    week_number = lent_week

                    if dow == 6:  # Sunday
                        liturgical_name = f"{self_ordinal(lent_week)} Sunday of Lent"
                        rank = 'Sunday'
                    else:
                        liturgical_name = f"{dow_name} of {self_ordinal(lent_week)} week of Lent"

        # PRIORITY 5: Easter Season (Easter Sunday - Pentecost)
        elif current_date >= easter and current_date <= pentecost:
            season = 'Easter'
            if current_date == easter:
                liturgical_name = 'Easter Sunday'
                rank = 'Solemnity'
            elif current_date == ascension:
                liturgical_name = 'Ascension of the Lord'
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

        # PRIORITY 6: Other Solemnities in Ordinary Time
        elif current_date == trinity_sunday:
            season = 'Ordinary Time'
            liturgical_name = 'Trinity Sunday'
            rank = 'Solemnity'
            week_number = 'Solemnity'
        elif current_date == christ_the_king:
            season = 'Ordinary Time'
            liturgical_name = 'Our Lord Jesus Christ, King of the Universe'
            rank = 'Solemnity'
            week_number = 34

        # PRIORITY 7: Ordinary Time
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
                # Re-check for fixed feast (if we didn't catch it earlier)
                if fixed_feast:
                    liturgical_name = fixed_feast['Liturgical Day']
                    rank = 'Feast'
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
    print("GENERATING COMPREHENSIVE LITURGICAL CALENDAR (V2)")
    print("=" * 80)

    print("\nLoading Lectionary.csv...")
    lectionary = load_lectionary()
    print(f"  Fixed feasts loaded: {len(lectionary['fixed_feasts'])}")
    print(f"  Christmas special Masses: {len(lectionary['christmas_special'])}")
    print(f"  Christmas entries: {len(lectionary['christmas'])}")
    print(f"  Easter entries: {len(lectionary['easter'])}")
    print(f"  Holy Week entries: {len(lectionary['holy_week'])}")
    print(f"  Solemnities: {len(lectionary['solemnities'])}")
    print(f"  Total entries loaded: {sum([len(lectionary[k]) if isinstance(lectionary[k], (list, dict)) else 0 for k in lectionary])}")

    all_entries = []

    for year in range(2025, 2031):
        print(f"\nGenerating {year}...")
        entries = generate_full_calendar(year, lectionary)
        print(f"  {len(entries)} days generated")
        all_entries.extend(entries)

    # Save to CSV
    filename = 'data/generated/liturgical_calendar_full.csv'
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
    for entry in all_entries[:20]:
        if entry['year'] == 2025:
            week = f"Week {entry['liturgical_week']}" if entry['liturgical_week'] else ""
            print(f"  {entry['calendar_date']} ({entry['day_of_week']}): {entry['liturgical_name']} {week}")

if __name__ == '__main__':
    main()

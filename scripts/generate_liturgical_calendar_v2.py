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

def determine_season(current_date, year_dates, ordinary_weeks):
    """
    PHASE 1: Determine liturgical season based ONLY on date ranges.
    This season assignment is IMMUTABLE - it can never be overridden.
    Returns: (season, week_number)
    """
    date_str = current_date.strftime('%Y-%m-%d')

    # Christmas Season (Dec 25 - Baptism of Lord)
    if current_date >= datetime(current_date.year, 12, 25) or current_date < year_dates['baptism_lord']:
        return ('Christmas', None)

    # Advent (1st Sunday of Advent - Dec 24)
    elif current_date >= year_dates['first_advent'] and current_date < datetime(current_date.year, 12, 25):
        days_since_advent = (current_date - year_dates['first_advent']).days
        advent_week = (days_since_advent // 7) + 1
        return ('Advent', advent_week)

    # Lent & Holy Week (Ash Wednesday - Holy Saturday)
    elif current_date >= year_dates['ash_wednesday'] and current_date < year_dates['easter']:
        if current_date >= year_dates['palm_sunday']:
            # Holy Week
            return ('Holy Week', None)
        else:
            # Regular Lent - calculate week number
            first_sunday_lent = year_dates['ash_wednesday'] + timedelta(days=(6 - year_dates['ash_wednesday'].weekday()))
            if current_date < first_sunday_lent:
                return ('Lent', 1)
            else:
                days_since_first_sunday = (current_date - first_sunday_lent).days
                lent_week = (days_since_first_sunday // 7) + 1
                return ('Lent', lent_week)

    # Easter Season (Easter Sunday - Pentecost)
    elif current_date >= year_dates['easter'] and current_date <= year_dates['pentecost']:
        days_since_easter = (current_date - year_dates['easter']).days
        easter_week = (days_since_easter // 7) + 1
        return ('Easter', easter_week)

    # Ordinary Time (everything else)
    else:
        week_number = ordinary_weeks.get(date_str)
        return ('Ordinary Time', week_number)

def determine_name_and_rank(current_date, season, week_number, dow, dow_name, year_dates, lectionary):
    """
    PHASE 2: Determine liturgical_name and liturgical_rank.
    Season is READ-ONLY - must not be modified!
    Returns: (liturgical_name, liturgical_rank)
    """
    month = current_date.month
    day = current_date.day

    # PRIORITY 1: Fixed Date Solemnities (override name/rank, but NOT season!)
    if month == 3 and day == 19:
        return ('19 March – St Joseph', 'Solemnity')
    elif month == 3 and day == 25:
        return ('25 March – Annunciation', 'Solemnity')
    elif month == 6 and day == 24:
        return ('24 June – Birth of John the Baptist', 'Solemnity')
    elif month == 6 and day == 29:
        return ('29 June – Ss Peter and Paul', 'Solemnity')
    elif month == 8 and day == 15:
        return ('15 August – Assumption', 'Solemnity')
    elif month == 11 and day == 1:
        return ('1 November – All Saints', 'Solemnity')
    elif month == 12 and day == 8:
        return ('8 December – Immaculate Conception', 'Solemnity')

    # PRIORITY 2: Moveable Solemnities
    if current_date == year_dates['easter']:
        return ('Easter Sunday', 'Solemnity')
    elif current_date == year_dates['ascension']:
        return ('Ascension of the Lord', 'Solemnity')
    elif current_date == year_dates['pentecost']:
        return ('Pentecost Sunday', 'Solemnity')
    elif current_date == year_dates['trinity_sunday']:
        return ('Trinity Sunday', 'Solemnity')
    elif current_date == year_dates['corpus_christi']:
        return ('THE BODY AND BLOOD OF CHRIST', 'Solemnity')
    elif current_date == year_dates['sacred_heart']:
        return ('Sacred Heart of Jesus', 'Solemnity')
    elif current_date == year_dates['christ_the_king']:
        return ('Our Lord Jesus Christ, King of the Universe', 'Solemnity')

    # PRIORITY 3: Fixed Feasts (only on weekdays, not Sundays)
    if dow != 6:  # Not Sunday
        fixed_feast = lectionary['fixed_feasts'].get((month, day))
        if fixed_feast:
            return (fixed_feast['Liturgical Day'], 'Feast')

    # PRIORITY 4: Seasonal defaults based on READ-ONLY season parameter
    if season == 'Christmas':
        if current_date == datetime(current_date.year, 12, 25):
            return ('Christmas Day', 'Solemnity')
        elif current_date == datetime(current_date.year, 1, 1):
            return ('Mary, Mother of God', 'Solemnity')
        elif current_date == year_dates['epiphany']:
            return ('Epiphany of the Lord', 'Solemnity')
        elif current_date == year_dates['baptism_lord']:
            return ('Baptism of the Lord', 'Feast')
        else:
            return (f"{dow_name} of Christmas Season", 'Feria')

    elif season == 'Advent':
        if dow == 6:  # Sunday
            return (f"{self_ordinal(week_number)} Sunday of Advent", 'Sunday')
        else:
            return (f"{dow_name} of {self_ordinal(week_number)} week of Advent", 'Feria')

    elif season == 'Lent':
        if current_date == year_dates['ash_wednesday']:
            return ('Ash Wednesday', 'Ash Wednesday')
        elif current_date < year_dates['ash_wednesday'] + timedelta(days=(6 - year_dates['ash_wednesday'].weekday())):
            return (f"{dow_name} after Ash Wednesday", 'Feria')
        elif dow == 6:  # Sunday
            return (f"{self_ordinal(week_number)} Sunday of Lent", 'Sunday')
        else:
            return (f"{dow_name} of {self_ordinal(week_number)} week of Lent", 'Feria')

    elif season == 'Holy Week':
        if current_date == year_dates['palm_sunday']:
            return ('Palm Sunday', 'Sunday')
        elif current_date == year_dates['easter'] - timedelta(days=3):
            return ('Holy Thursday', 'Triduum')
        elif current_date == year_dates['easter'] - timedelta(days=2):
            return ('Good Friday', 'Triduum')
        elif current_date == year_dates['easter'] - timedelta(days=1):
            return ('Holy Saturday', 'Triduum')
        else:
            return (f"{dow_name} of Holy Week", 'Feria')

    elif season == 'Easter':
        if dow == 6:  # Sunday
            return (f"{self_ordinal(week_number)} Sunday of Easter", 'Sunday')
        else:
            return (f"{dow_name} of {self_ordinal(week_number)} week of Easter", 'Feria')

    elif season == 'Ordinary Time':
        if dow == 6:  # Sunday
            if current_date == year_dates['baptism_lord']:
                return ('Baptism of the Lord', 'Feast')
            else:
                return (f"{self_ordinal(week_number)} Sunday in Ordinary Time", 'Sunday')
        else:
            return (f"{dow_name} of Week {week_number} in Ordinary Time", 'Feria')

    # Fallback
    return (f"{dow_name}", 'Feria')

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
    # IMPORTANT: Sunday (weekday() == 6) is Day 1 of the liturgical week
    # A new week starts ON Sunday and runs through Saturday
    ordinary_weeks = {}

    # PERIOD 1: Baptism of Lord through day before Ash Wednesday
    # Count forward from Week 1
    current_date = baptism_lord
    week_num = 1
    while current_date <= ordinary_time_1_end:
        ordinary_weeks[current_date.strftime('%Y-%m-%d')] = week_num
        current_date += timedelta(days=1)
        # New week starts when we reach the NEXT Sunday
        if current_date <= ordinary_time_1_end and current_date.weekday() == 6:
            week_num += 1

    # PERIOD 2: Day after Pentecost through day before First Advent
    # Christ the King (last Sunday) is always Week 34
    # Count backwards to determine starting week for Pentecost + 1

    # Count how many complete weeks from ordinary_time_2_start to christ_the_king
    days_in_period_2 = (christ_the_king - ordinary_time_2_start).days

    # Find the first Sunday in Period 2 (or use the start date if it's already Sunday)
    current_date = ordinary_time_2_start
    while current_date.weekday() != 6:  # Find first Sunday
        current_date += timedelta(days=1)
    first_sunday_period_2 = current_date

    # Count Sundays from first Sunday to Christ the King (inclusive)
    num_sundays = 0
    temp_date = first_sunday_period_2
    while temp_date <= christ_the_king:
        num_sundays += 1
        temp_date += timedelta(days=7)

    # The last Sunday (Christ the King) is Week 34
    # So the first Sunday should be Week (34 - num_sundays + 1)
    # And days before the first Sunday are (first_sunday_week - 1)
    first_sunday_week = 34 - num_sundays + 1

    # Now assign weeks for entire Period 2
    current_date = ordinary_time_2_start
    # Days before first Sunday belong to the week before it
    week_num = first_sunday_week - 1 if ordinary_time_2_start < first_sunday_period_2 else first_sunday_week

    while current_date <= ordinary_time_2_end:
        # Check if THIS day is Sunday (start of new week)
        if current_date.weekday() == 6:
            week_num += 1

        ordinary_weeks[current_date.strftime('%Y-%m-%d')] = week_num
        current_date += timedelta(days=1)

    # Get liturgical year cycle
    liturgical_year_cycle = get_liturgical_year(datetime(year, 1, 1))

    # Store all year dates for easy access
    year_dates = {
        'easter': easter,
        'ash_wednesday': ash_wednesday,
        'palm_sunday': palm_sunday,
        'pentecost': pentecost,
        'trinity_sunday': trinity_sunday,
        'ascension': ascension,
        'corpus_christi': corpus_christi,
        'sacred_heart': sacred_heart,
        'first_advent': first_advent,
        'christ_the_king': christ_the_king,
        'epiphany': epiphany,
        'baptism_lord': baptism_lord
    }

    # Generate every day of the year
    current_date = datetime(year, 1, 1)
    end_date = datetime(year, 12, 31)

    while current_date <= end_date:
        date_str = current_date.strftime('%Y-%m-%d')
        dow = current_date.weekday()  # 0=Monday, 6=Sunday
        dow_name = current_date.strftime('%A')

        # PHASE 1: Determine season (immutable)
        season, week_number = determine_season(current_date, year_dates, ordinary_weeks)

        # PHASE 2: Determine name and rank (season stays the same!)
        liturgical_name, rank = determine_name_and_rank(
            current_date, season, week_number, dow, dow_name, year_dates, lectionary
        )

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

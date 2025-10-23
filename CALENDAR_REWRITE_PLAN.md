# Calendar Generator Rewrite Plan

## Problem
Current generator incorrectly sets `season = 'Ordinary Time'` for Fixed Feasts/Solemnities that occur during Lent/Advent/Easter/Christmas, breaking the continuous seasonal blocks.

## Example of Bug
```csv
2025-03-24,2025,Lent,3,Monday,Monday of Third week of Lent,Feria
2025-03-25,2025,Ordinary Time,,Tuesday,25 March – Annunciation,Solemnity  ❌ WRONG!
2025-03-26,2025,Lent,3,Wednesday,Wednesday of Third week of Lent,Feria
```

Should be:
```csv
2025-03-24,2025,Lent,3,Monday,Monday of Third week of Lent,Feria
2025-03-25,2025,Lent,3,Tuesday,25 March – Annunciation,Solemnity  ✅ CORRECT!
2025-03-26,2025,Lent,3,Wednesday,Wednesday of Third week of Lent,Feria
```

## Solution Architecture

### Two-Phase Processing

**PHASE 1: Determine Base Season** (based on date ranges only)
- Christmas: Dec 25 - Baptism of the Lord
- Advent: First Sunday of Advent - Dec 24
- Lent: Ash Wednesday - Holy Saturday
- Easter: Easter Sunday - Pentecost
- Ordinary Time: Everything else

**PHASE 2: Determine Name & Rank** (overrides name/rank, but preserves season!)
- Check for Fixed Solemnities
- Check for Fixed Feasts
- Check for Moveable Solemnities
- Fallback to seasonal default

### Key Principle
**Season is IMMUTABLE once set in Phase 1.**
Only `liturgical_name` and `liturgical_rank` can be overridden in Phase 2.

## Implementation Plan

### Step 1: Extract Season Determination Logic
Create new function:
```python
def determine_season(current_date, year_dates):
    """
    Determine liturgical season based ONLY on date ranges.
    Returns: (season, week_number)
    """
    # Christmas check
    if in_christmas_range:
        return ('Christmas', None)

    # Advent check
    elif in_advent_range:
        week = calculate_advent_week()
        return ('Advent', week)

    # Lent check
    elif in_lent_range:
        week = calculate_lent_week()
        if in_holy_week:
            return ('Holy Week', week)
        return ('Lent', week)

    # Easter check
    elif in_easter_range:
        week = calculate_easter_week()
        return ('Easter', week)

    # Ordinary Time
    else:
        week = ordinary_weeks.get(date_str)
        return ('Ordinary Time', week)
```

### Step 2: Extract Name/Rank Determination Logic
Create new function:
```python
def determine_name_and_rank(current_date, season, week_number, dow, year_dates, lectionary):
    """
    Determine liturgical_name and liturgical_rank.
    Season is READ-ONLY - must not be modified!
    Returns: (liturgical_name, liturgical_rank)
    """
    month = current_date.month
    day = current_date.day

    # PRIORITY 1: Fixed Date Solemnities (override everything)
    if month == 3 and day == 19:
        return ('19 March – St Joseph', 'Solemnity')
    elif month == 3 and day == 25:
        return ('25 March – Annunciation', 'Solemnity')
    # ... all other fixed solemnities

    # PRIORITY 2: Moveable Solemnities
    if current_date == year_dates['easter']:
        return ('Easter Sunday', 'Solemnity')
    elif current_date == year_dates['ascension']:
        return ('Ascension of the Lord', 'Solemnity')
    # ... etc

    # PRIORITY 3: Fixed Feasts
    fixed_feast = lectionary['fixed_feasts'].get((month, day))
    if fixed_feast:
        return (fixed_feast['Liturgical Day'], 'Feast')

    # PRIORITY 4: Seasonal Defaults
    # Based on season parameter (read-only!)
    if season == 'Lent':
        if dow == 6:  # Sunday
            return (f"{ordinal(week_number)} Sunday of Lent", 'Sunday')
        else:
            return (f"{dow_name} of {ordinal(week_number)} week of Lent", 'Feria')

    elif season == 'Advent':
        if dow == 6:
            return (f"{ordinal(week_number)} Sunday of Advent", 'Sunday')
        else:
            return (f"{dow_name} of {ordinal(week_number)} week of Advent", 'Feria')

    # ... handle other seasons
```

### Step 3: Main Loop Rewrite
```python
while current_date <= end_date:
    # PHASE 1: Determine season (immutable)
    season, week_number = determine_season(current_date, year_dates)

    # PHASE 2: Determine name and rank (season stays same!)
    liturgical_name, liturgical_rank = determine_name_and_rank(
        current_date, season, week_number, dow, year_dates, lectionary
    )

    entries.append({
        'calendar_date': date_str,
        'year': year,
        'liturgical_season': season,  # From Phase 1 only!
        'liturgical_week': week_number,
        'day_of_week': dow_name,
        'liturgical_name': liturgical_name,
        'liturgical_rank': liturgical_rank
    })
```

## Validation Criteria

### Test Cases
1. **March 25, 2025** (Annunciation during Lent)
   - Season: `Lent`
   - Week: `3`
   - Name: `25 March – Annunciation`
   - Rank: `Solemnity`

2. **April 2, 2025** (St Francis during Lent)
   - Season: `Lent`
   - Week: `4`
   - Name: `2 April – St Francis of Paola`
   - Rank: `Feast`

3. **Dec 8, 2025** (Immaculate Conception during Advent)
   - Season: `Advent`
   - Week: `2`
   - Name: `8 December – Immaculate Conception`
   - Rank: `Solemnity`

4. **Regular ferial day**
   - Season: `Lent`
   - Week: `3`
   - Name: `Monday of Third week of Lent`
   - Rank: `Feria`

### Verification Query
```python
# Check no "Ordinary Time" interrupts Lent
lent_dates = [entry for entry in entries
              if entry['calendar_date'] >= '2025-03-05'
              and entry['calendar_date'] <= '2025-04-19']

ordinary_in_lent = [e for e in lent_dates if e['liturgical_season'] == 'Ordinary Time']
assert len(ordinary_in_lent) == 0, "Found Ordinary Time during Lent!"
```

### Cross-Check Against 2025.csv
Compare generated output with authoritative 2025.csv for ALL March-April dates:
- Every Solemnity should match (exact name)
- Every season should be continuous
- Week numbers should align

## Implementation Steps

1. ✅ Create this plan document
2. ⏳ Create backup of current script
3. ⏳ Implement `determine_season()` function
4. ⏳ Implement `determine_name_and_rank()` function
5. ⏳ Rewrite main loop with two-phase logic
6. ⏳ Test with March 2025 (Lent with Solemnities)
7. ⏳ Test with December 2025 (Advent with Solemnities)
8. ⏳ Run full generation for 2025-2030
9. ⏳ Validate against 2025.csv
10. ⏳ Import to database

## Risks & Mitigation

**Risk:** Breaking existing functionality
**Mitigation:** Keep backup of working script, test incrementally

**Risk:** Missing edge cases
**Mitigation:** Extensive validation against authoritative 2025.csv

**Risk:** Christmas season handling (crosses year boundary)
**Mitigation:** Special handling for dates in early January

## Success Criteria

1. No "Ordinary Time" appears during Lent/Advent/Easter/Christmas
2. All Fixed Solemnities present with correct rank
3. All Fixed Feasts present with correct rank
4. Season blocks are 100% continuous
5. 100% match against 2025.csv for season assignments
6. All 158 Fixed Feasts still return correct readings from database

---
**Status:** Planning Complete - Ready for Implementation
**Next:** Backup current script and begin Phase 1

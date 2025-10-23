# Lectionary Database System

## Summary

Successfully imported Catholic lectionary readings into Supabase database.

## Database Tables

### `lectionary_readings` (942 rows)
Stores all lectionary readings by liturgical date.

**Year Cycle Values:**
- `1`, `2` = Weekday cycles (Year I, Year II) - 204 entries each
- `A`, `B`, `C` = Sunday cycles - 60 entries each
- `Feast` = Fixed feast days (saints, solemnities) - 219 entries
- `Season` = Seasonal liturgical days (Advent, Christmas, Lent, Easter, Holy Week) - 135 entries

**Columns:**
- `admin_order` - Unique sequential ID from CSV
- `year_cycle` - Year type (1/2/A/B/C/Feast/Season)
- `week_number` - Week in liturgical season (1-34 for Ordinary Time, "N/A" for special days, "Solemnity" for moveable solemnities)
- `day_type` - Day of week or feast type (Sunday, Monday, Fixed Day, Moving Feast, etc.)
- `time_period` - Liturgical season (Ordinary, Advent, Christmas, Lent, Easter, Easter Triduum, Holy Week, Fixed Feast, Moving Feast, VIGIL)
- `liturgical_day` - Full liturgical name (e.g., "SECOND SUNDAY", "St Teresa of Ávila")
- `first_reading`, `psalm`, `second_reading`, `gospel_reading` - Scripture citations

### `liturgical_years` (98 rows)
Maps calendar years to Sunday and Weekday cycles (2011-2108).

**Columns:**
- `year` - Calendar year
- `sunday_cycle` - A, B, or C
- `weekday_cycle` - I or II

## Usage Examples

### Get Readings for a Specific Year/Week/Day

```sql
-- Example: 2nd Sunday of Ordinary Time in 2025 (Year A)
SELECT
  lr.liturgical_day,
  lr.gospel_reading,
  lr.first_reading,
  lr.psalm,
  lr.second_reading
FROM lectionary_readings lr
JOIN liturgical_years ly ON ly.year = 2025
WHERE lr.year_cycle = ly.sunday_cycle
  AND lr.week_number = '2'
  AND lr.day_type = 'Sunday'
  AND lr.time_period = 'Ordinary';
```

### Get All Sunday Readings for a Year

```sql
SELECT
  lr.week_number,
  lr.liturgical_day,
  lr.gospel_reading
FROM lectionary_readings lr
JOIN liturgical_years ly ON ly.year = 2026
WHERE lr.year_cycle = ly.sunday_cycle
  AND lr.day_type = 'Sunday'
  AND lr.time_period = 'Ordinary'
ORDER BY CAST(lr.week_number AS INTEGER);
```

### Get Fixed Feast Day Readings

```sql
-- Example: St Teresa of Ávila (October 15)
SELECT
  liturgical_day,
  gospel_reading,
  first_reading,
  psalm
FROM lectionary_readings
WHERE year_cycle = 'Feast'
  AND liturgical_day LIKE '%Teresa%';
```

### Get Seasonal Readings

```sql
-- Example: Ash Wednesday
SELECT
  liturgical_day,
  gospel_reading,
  first_reading
FROM lectionary_readings
WHERE year_cycle = 'Season'
  AND liturgical_day = 'Ash Wednesday';
```

## Special Cases

### Moveable Solemnities in Ordinary Time
These have `week_number = 'Solemnity'` and occur at specific times:
- **Trinity Sunday** - 1st Sunday after Pentecost
- **Corpus Christi** - Thursday after Trinity Sunday
- **Sacred Heart** - Friday after Corpus Christi

```sql
-- Example: Trinity Sunday readings for Year A
SELECT *
FROM lectionary_readings
WHERE year_cycle = 'A'
  AND week_number = 'Solemnity'
  AND liturgical_day LIKE 'TRINITY SUNDAY%';
```

### Weekday Readings
Use Year 1 or 2 based on the calendar year's weekday cycle:

```sql
-- Example: Monday of Week 5 in Ordinary Time for 2025 (Year II)
SELECT
  lr.liturgical_day,
  lr.gospel_reading,
  lr.first_reading
FROM lectionary_readings lr
JOIN liturgical_years ly ON ly.year = 2025
WHERE lr.year_cycle = ly.weekday_cycle::TEXT
  AND lr.week_number = '5'
  AND lr.day_type = 'Monday'
  AND lr.time_period = 'Ordinary';
```

## Data Files

- **Source CSV:** `Lectionary.csv` (942 rows)
- **Years CSV:** `LitugricalYears.csv` (98 rows, covers 2011-2108)
- **Import Scripts:**
  - `scripts/import_lectionary.py`
  - `scripts/import_liturgical_years.py`
  - `scripts/analyze_lectionary.py`

## Import Status

✅ **liturgical_years**: 98 rows imported
✅ **lectionary_readings**: 942 rows imported

All data successfully loaded into Supabase (October 14, 2025).

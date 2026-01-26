# Liturgical System - Complete Reference

> **Last Updated:** January 2026
> **Coverage:** 2025-2030 (730 days currently mapped)

This document covers the complete liturgical calendar, lectionary readings, and DGR (Daily Gospel Reflection) integration.

---

## Table of Contents

1. [Overview](#overview)
2. [Liturgical Concepts](#liturgical-concepts)
3. [Database Schema](#database-schema)
4. [Mapping Algorithm](#mapping-algorithm)
5. [Scripts & Workflow](#scripts--workflow)
6. [CLI Reference](#cli-reference)
7. [DGR Integration](#dgr-integration)
8. [API Reference](#api-reference)
9. [Ordo CSV Import](#ordo-csv-import)

---

## Overview

The system connects three data sources:

```
Brisbane Ordo (source of truth)
         ↓
ordo_calendar (what celebration each day)
         ↓
ordo_lectionary_mapping (links dates to readings)
         ↓
lectionary (all scripture readings)
         ↓
DGR System (contributor reflections)
```

### Quick Query

```sql
-- Get readings for any date
SELECT oc.liturgical_name, l.first_reading, l.psalm, l.gospel_reading
FROM ordo_calendar oc
JOIN ordo_lectionary_mapping olm ON oc.calendar_date = olm.calendar_date
JOIN lectionary l ON olm.lectionary_id = l.admin_order
WHERE oc.calendar_date = '2025-12-25';
```

---

## Liturgical Concepts

### Year Cycles

**Sunday Cycle (A/B/C)** - 3-year rotation:
| Year | Cycle | Gospel |
|------|-------|--------|
| 2025 | C | Luke |
| 2026 | A | Matthew |
| 2027 | B | Mark |

**Weekday Cycle (1/2)** - 2-year rotation:
- Odd years (2025, 2027): Year 1
- Even years (2026, 2028): Year 2

### Liturgical Ranks (Precedence Order)

| Rank | Examples | Readings Used |
|------|----------|---------------|
| **Solemnity** | Easter, Christmas, Assumption | Proper readings |
| **Feast** | Apostles, St Patrick (AU) | Proper readings |
| **Sunday** | All Sundays | Sunday cycle |
| **Memorial** | Most saints' days | **WEEKDAY readings** |
| **Feria** | Ordinary weekdays | Weekday cycle |

**Key Rule:** Memorials use WEEKDAY readings, not saint readings. Only Feasts and Solemnities use their proper readings. **Exception:** Apostles and Evangelists get proper readings even as Memorials.

### Seasons

| Season | Dates | Color |
|--------|-------|-------|
| Advent | 4 Sundays before Christmas | Purple |
| Christmas | Dec 25 - Baptism of Lord | White |
| Ordinary Time I | After Baptism - Ash Wednesday | Green |
| Lent | Ash Wednesday - Holy Thursday | Purple |
| Easter | Easter Sunday - Pentecost | White |
| Ordinary Time II | After Pentecost - Advent | Green |

---

## Database Schema

### `lectionary` (942 rows)

All scripture readings organized by liturgical pattern.

```sql
CREATE TABLE lectionary (
    admin_order INTEGER PRIMARY KEY,  -- 1-942
    year TEXT,                        -- 'A', 'B', 'C', '1', '2', 'Feast', 'Season'
    week TEXT,                        -- Week number or 'N/A'
    day TEXT,                         -- 'Sunday', 'Monday', etc.
    time TEXT,                        -- 'Ordinary', 'Lent', 'Easter', etc.
    liturgical_day TEXT,              -- Full name
    first_reading TEXT,
    psalm TEXT,
    second_reading TEXT,
    gospel_reading TEXT
);
```

### `ordo_calendar` (730+ rows per year range)

Brisbane Ordo calendar - the source of truth for Australian liturgical calendar.

```sql
CREATE TABLE ordo_calendar (
    calendar_date DATE PRIMARY KEY,
    liturgical_year INTEGER,
    liturgical_season TEXT,
    liturgical_week INTEGER,
    liturgical_name TEXT,
    liturgical_rank TEXT,  -- 'solemnity', 'feast', 'memorial', 'optional memorial', 'feria'
    year_cycle TEXT        -- 'A', 'B', or 'C'
);
```

### `ordo_lectionary_mapping` (730+ rows)

Links each calendar date to its lectionary entry.

```sql
CREATE TABLE ordo_lectionary_mapping (
    id SERIAL PRIMARY KEY,
    calendar_date DATE REFERENCES ordo_calendar(calendar_date),
    lectionary_id INTEGER REFERENCES lectionary(admin_order),
    match_type TEXT,    -- 'exact' or 'partial'
    match_method TEXT   -- 'name', 'date', 'weekday_for_memorial', 'substring'
);
```

**Match Methods:**
- `name` - Exact liturgical name match
- `date` - Fixed feast by calendar date (e.g., March 17 = St Patrick)
- `weekday_for_memorial` - Memorial using weekday readings
- `substring` - Partial name match

---

## Mapping Algorithm

Located in `scripts/generate_ordo_lectionary_mapping.py`

### Core Logic

```python
def find_lectionary_match(ordo_entry, lectionary_entries, year_letter, ordo_data):
    # 1. For MEMORIALS: Use weekday readings (except apostles/evangelists)
    if ordo_rank in ['memorial', 'optional memorial']:
        if is_apostle_or_evangelist(ordo_name):
            # Apostles get proper readings even as memorials
            return match_by_name_or_date(ordo_name, ordo_date)
        season, week = infer_season_and_week(ordo_date, ordo_data)
        return find_weekday_lectionary_entry(weekday, season, week)

    # 2. For FEASTS/SOLEMNITIES: Match by name aliases, then date
    # 3. For SUNDAYS: Match by name
    # 4. For FERIA: Match by name
```

### Name Alias System

Ordo names often differ from Lectionary names. The algorithm uses keyword matching:

```python
# If Ordo name contains these keywords...     → Match this Lectionary pattern
('our lady', 'help of christians')            → 'mary help of christians'
('nativity', 'john', 'baptist')               → 'birth of john the baptist'
('exaltation', 'cross')                       → 'exaltation of the cross'
```

This handles Australian-specific feasts and common naming variations.

### Memorial Handling

Memorials don't have season/week in the Ordo, so we infer from surrounding dates:

```python
def infer_season_and_week(ordo_date, ordo_data):
    # Look back up to 7 days for a date with season info
    # Account for Sunday boundaries (Sunday starts new week)
    # Return inferred season and week number
```

### Weekday Pattern Matching

```python
def find_weekday_lectionary_entry(weekday, season, week):
    # Build patterns like:
    # "Friday of the first week of Lent"
    # "Monday of the thirty-second week"
    # "Easter Monday" (for Octave)

    # CRITICAL: Filter by season to avoid cross-season matches
    # (e.g., don't match "Monday Week 2" in Ordinary Time
    #  when looking for Easter Week 2)
```

---

## Scripts & Workflow

### Generate Mapping (Dry Run)

```bash
# Generate CSV only - review before pushing
python scripts/generate_ordo_lectionary_mapping.py
```

Output: `data/generated/ordo_lectionary_mapping.csv`

### Verify Test Dates

```bash
# Check specific problematic dates
grep -E "2025-01-17|2025-04-28|2025-11-10" data/generated/ordo_lectionary_mapping.csv
```

**Expected Results:**
| Date | Saint | Should Map To |
|------|-------|---------------|
| Jan 17 | St Anthony (Memorial) | Friday Week 1 OT |
| Apr 28 | St Peter Chanel (Memorial) | Monday Easter Week 2 |
| Nov 10 | St Leo (Memorial) | Monday Week 32 |
| Mar 17 | St Patrick (Feast) | 17 March St Patrick |

### Push to Production

```bash
# Import to database
python scripts/import_lectionary_mapping.py
```

### Full Workflow

```bash
# 1. Make algorithm changes to generate_ordo_lectionary_mapping.py

# 2. Generate and verify
python scripts/generate_ordo_lectionary_mapping.py
grep "2025-04-28" data/generated/ordo_lectionary_mapping.csv

# 3. When happy, push to production
python scripts/import_lectionary_mapping.py

# 4. Verify in database
# SELECT * FROM ordo_lectionary_mapping WHERE calendar_date = '2025-04-28';
```

### Backfill Seasons for Feasts/Memorials

After importing Ordo data, feasts and memorials may have NULL seasons. Run this to backfill:

```sql
-- Infer season from nearest previous date
WITH dates_with_season AS (
  SELECT calendar_date, liturgical_season FROM ordo_calendar WHERE liturgical_season IS NOT NULL
),
dates_missing AS (
  SELECT calendar_date FROM ordo_calendar WHERE liturgical_season IS NULL
),
inferred AS (
  SELECT d.calendar_date,
    (SELECT s.liturgical_season FROM dates_with_season s
     WHERE s.calendar_date < d.calendar_date ORDER BY s.calendar_date DESC LIMIT 1) as season
  FROM dates_missing d
)
UPDATE ordo_calendar oc SET liturgical_season = i.season
FROM inferred i WHERE oc.calendar_date = i.calendar_date AND i.season IS NOT NULL;

-- Fix Christmas season boundaries (Dec 25 starts Christmas, not Advent)
UPDATE ordo_calendar SET liturgical_season = 'Christmas'
WHERE calendar_date >= '2025-12-25' AND calendar_date <= '2026-01-11';
```

---

## CLI Reference

The mapping script includes CLI commands for checking dates, editing source data, and managing the mapping process.

### Check a Specific Date

```bash
# Check mapping for a specific date
python3 scripts/generate_ordo_lectionary_mapping.py --check-date 2026-05-25
```

Output shows: Ordo entry, matched lectionary entry, readings, and match method.

### List Unmatched Dates

```bash
# Find all dates with no lectionary match
python3 scripts/generate_ordo_lectionary_mapping.py --list-unmatched
```

### List Special Handling

```bash
# List apostles/evangelists who get proper readings (not weekday)
python3 scripts/generate_ordo_lectionary_mapping.py --list-apostles

# List name alias mappings (Ordo → Lectionary)
python3 scripts/generate_ordo_lectionary_mapping.py --list-aliases
```

### Edit Ordo CSV

Edit `data/generated/ordo_normalized.csv` entries:

```bash
# Edit liturgical name
python3 scripts/generate_ordo_lectionary_mapping.py --edit-ordo 2026-05-25 --name "OUR LADY HELP OF CHRISTIANS"

# Edit rank
python3 scripts/generate_ordo_lectionary_mapping.py --edit-ordo 2026-05-25 --rank Solemnity

# Edit season and week
python3 scripts/generate_ordo_lectionary_mapping.py --edit-ordo 2026-05-26 --season "Ordinary Time" --week 8

# Combine multiple edits
python3 scripts/generate_ordo_lectionary_mapping.py --edit-ordo 2026-07-22 --rank Feast --name "SAINT MARY MAGDALENE"
```

**Valid ranks:** `Solemnity`, `Feast`, `Memorial`, `Optional Memorial`, `Feria`
**Valid seasons:** `Ordinary Time`, `Lent`, `Easter`, `Advent`, `Christmas`

### Edit Lectionary CSV

Edit `data/source/Lectionary.csv` entries (by admin_order ID):

```bash
# Edit first reading
python3 scripts/generate_ordo_lectionary_mapping.py --edit-lectionary 586 --first-reading "Sir 4:11-19"

# Edit psalm
python3 scripts/generate_ordo_lectionary_mapping.py --edit-lectionary 586 --psalm "Ps 119:165, 168, 171-172, 174-175"

# Edit gospel
python3 scripts/generate_ordo_lectionary_mapping.py --edit-lectionary 586 --gospel "Jn 19:25-27"

# Combine multiple edits
python3 scripts/generate_ordo_lectionary_mapping.py --edit-lectionary 586 --first-reading "Sir 4:11-19" --psalm "Ps 119" --gospel "Jn 19:25-27"
```

### Generate and Push Mappings

```bash
# Generate CSV only (dry run)
python3 scripts/generate_ordo_lectionary_mapping.py

# Generate and push to database
python3 scripts/generate_ordo_lectionary_mapping.py --push
```

### Typical Workflow

```bash
# 1. Check a date that seems wrong
python3 scripts/generate_ordo_lectionary_mapping.py --check-date 2026-05-25

# 2. If Ordo data is wrong, fix it
python3 scripts/generate_ordo_lectionary_mapping.py --edit-ordo 2026-05-25 --rank Solemnity

# 3. Regenerate and verify the fix
python3 scripts/generate_ordo_lectionary_mapping.py --check-date 2026-05-25

# 4. Check for any remaining unmatched dates
python3 scripts/generate_ordo_lectionary_mapping.py --list-unmatched

# 5. When satisfied, push to production
python3 scripts/generate_ordo_lectionary_mapping.py --push
```

### Apostles & Evangelists

These saints get their **proper readings** even when ranked as Memorial (exception to the memorial rule):

- Barnabas
- Matthias
- Mark
- Luke
- Timothy
- Titus
- Mary Magdalene (elevated to Feast by Pope Francis 2016)

### Name Aliases

The algorithm includes name mappings for Australian feasts and common variations:

| Ordo Name Pattern | Maps To |
|-------------------|---------|
| "our lady" + "help of christians" | Mary Help of Christians |
| "nativity" + "john" + "baptist" | Birth of John the Baptist |
| "beheading" + "john" + "baptist" | Beheading of John the Baptist |
| "exaltation" + "cross" | Exaltation of the Cross |
| "chair" + "peter" | Chair of Peter |
| "dedication" + "lateran" | Dedication of St John Lateran |
| "faithful departed" | All Souls |

---

## DGR Integration

The DGR (Daily Gospel Reflection) system uses the liturgical calendar for contributor assignments.

### How DGR Uses Readings

```sql
-- DGR fetches readings when creating schedule entry
SELECT * FROM get_readings_for_date('2025-12-25');
-- Stores in dgr_schedule.readings_data JSONB
```

### DGR Tables

| Table | Purpose |
|-------|---------|
| `dgr_schedule` | Tracks assignments and submissions |
| `dgr_contributors` | People who write reflections |
| `dgr_assignment_rules` | Block dates or force-assign contributors |
| `dgr_templates` | HTML templates for WordPress |

### DGR Workflow

```
1. View calendar → shows liturgical days
2. Click date → see readings from lectionary
3. Assign contributor → creates dgr_schedule row
4. Contributor submits reflection
5. Admin approves → publish to WordPress
```

### DGR Routes

| Route | Purpose |
|-------|---------|
| `/dgr` | Main admin dashboard |
| `/dgr/contributors` | Manage contributors |
| `/dgr/rules` | Assignment rules |
| `/dgr/templates` | Publication templates |
| `/dgr/liturgical-calendar` | View/import calendar |
| `/dgr/write/[token]` | Contributor submission |

---

## API Reference

### Get Readings for Date

```sql
SELECT * FROM get_readings_for_date('2025-04-20');
-- Returns: liturgical_day, first_reading, psalm, second_reading, gospel_reading
```

### REST Endpoint

```bash
POST /api/dgr/readings
Body: { "date": "2025-04-20" }
```

### Admin Schedule API

```bash
GET /api/dgr-admin/schedule?days=90
POST /api/dgr-admin/schedule
  Actions: assign_contributor, approve_reflection, send_to_wordpress, etc.
```

---

## Ordo CSV Import

### Required Format

Only 2 columns needed:

```csv
calendar_date,liturgical_name
2027-01-01,SOLEMNITY OF MARY THE HOLY MOTHER OF GOD
2027-01-02,Saint Basil and Gregory
2027-01-03,Sunday before Epiphany
```

### Auto-Populated Fields

Everything else is matched automatically:
- liturgical_rank
- liturgical_season
- liturgical_week
- first_reading, psalm, second_reading, gospel_reading
- year_cycle

### Upload Process

1. Navigate to `/dgr/liturgical-calendar`
2. Download template CSV
3. Fill in dates and names from your diocesan Ordo
4. Upload and click "Process & Match"
5. Review match statistics
6. Confirm import

### Name Normalization

The system handles variations:
- "St." → "Saint"
- "SS." → "Saints"
- "TWENTY-FIRST" → "21"
- "The Most Holy Trinity" → "Trinity Sunday"

---

## File Reference

### Data Files

| File | Purpose |
|------|---------|
| `data/source/Lectionary.csv` | Master lectionary (942 entries) |
| `data/generated/ordo_normalized.csv` | Processed Ordo calendar |
| `data/generated/ordo_lectionary_mapping.csv` | Generated mappings |

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/generate_ordo_lectionary_mapping.py` | Generate mappings from Ordo |
| `scripts/import_lectionary_mapping.py` | Push mappings to database |

### Key Source Files

| File | Purpose |
|------|---------|
| `src/routes/api/dgr/readings/+server.js` | Readings API |
| `src/routes/api/dgr-admin/schedule/+server.js` | Schedule management |
| `src/routes/dgr/liturgical-calendar/+page.svelte` | Calendar admin UI |

---

## Troubleshooting

### Wrong Readings for a Date

1. Check the Ordo entry:
```sql
SELECT * FROM ordo_calendar WHERE calendar_date = '2025-04-28';
-- Check liturgical_rank - is it 'memorial'?
```

2. Check the mapping:
```sql
SELECT * FROM ordo_lectionary_mapping WHERE calendar_date = '2025-04-28';
-- Check match_method - should be 'weekday_for_memorial' for memorials
```

3. Check the lectionary entry:
```sql
SELECT * FROM lectionary WHERE admin_order = 888;
-- Verify it's the correct weekday reading
```

### Regenerate Mappings

If mappings are wrong:
```bash
# Fix algorithm in generate_ordo_lectionary_mapping.py
python scripts/generate_ordo_lectionary_mapping.py
# Verify fixes
python scripts/import_lectionary_mapping.py
```

---

## Summary

- **Brisbane Ordo** is the source of truth for Australian liturgical calendar
- **Memorials always use weekday readings** (only Feasts/Solemnities use proper readings)
- **Mapping algorithm** infers season/week for memorials from surrounding dates
- **Workflow**: Generate CSV → Verify → Push to production
- **DGR** overlays contributor assignments on the calendar

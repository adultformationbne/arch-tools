# Liturgical System - Complete Reference

Last Updated: 2026-10-26

This document covers the complete liturgical calendar, lectionary readings, and DGR (Daily Gospel Reflection) integration.

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

## Mapping: the Ordo processor

**One processor, used everywhere:** `src/lib/server/ordo-processor.ts`. The upload page
(`/dgr/liturgical-calendar` → `/api/dgr/liturgical-calendar/upload`) and the CLI
(`scripts/process-ordo.ts`) both call it. Don't add another matcher — change this one and
`tests/ordo-processor.test.ts`.

### How a date gets its readings

1. **The date decides the season.** Easter (computus), Ash Wednesday, Pentecost, Advent,
   Epiphany (Sunday 2–8 Jan), Baptism, Holy Family, Trinity, Corpus Christi, Sacred Heart and
   Christ the King are all *calculated*. So are the season, week, A/B/C cycle (switching at
   the First Sunday of Advent) and I/II cycle. OT weeks after Pentecost count back from
   Christ the King (week 34). The Brisbane Ordo numbers Sundays the same way as the
   lectionary, so no "Brisbane adjustment" is needed.
2. **The Ordo decides the celebration.** The first dated line for each day is used:
   - Seasonal names ("Monday of the thirtieth week…", "15 ORDINARY", "2 LENT") take the
     calculated seasonal readings. The wording is cross-checked against the date, and any
     disagreement becomes a **warning** in the preview (e.g. the 2027 Ordo's "sixteenth weke"
     in week 15).
   - Fixed seasonal days always win: Sundays of Advent/Lent/Easter, Holy Week, the Triduum,
     the Easter octave, Christmas and its octave, 1 January, Epiphany, Baptism, Ascension,
     Pentecost, Trinity, Corpus Christi, Sacred Heart and Christ the King.
   - **Solemnities** (ALL CAPS in the Brisbane Ordo) and the entries in
     `PROPER_CELEBRATIONS` take their proper readings. A transferred celebration (e.g. Help of
     Christians moved to 25 May) is found by name.
   - **Every other saint's day is a memorial and uses the weekday readings.**
3. Cycle variants are picked automatically: "(Year B)" or ", Year B" entries, and the Year A
   gospels for St Dominic and St John Vianney.

### `PROPER_CELEBRATIONS`

The rule is "take the Ordo's first option to the lectionary". On a memorial that still
means the **weekday** readings, because that's what the Brisbane Ordo prints (checked
against its 2026 readings: St Anthony, St Dominic, St John Vianney, Queenship, St Thérèse,
Presentation of Mary and others all print weekday readings). The exceptions are the
memorials whose readings the lectionary makes compulsory, and the Ordo prints those with
their own readings: Timothy & Titus, Barnabas, Martha, Passion of John the Baptist, Our Lady
of Sorrows, Guardian Angels and Mary, Mother of the Church. The list holds these plus all the
feasts. `tests/ordo-processor.test.ts` pins the memorial readings to what the 2026 Ordo printed.

Lectionary rows #946/#947 ("St Dominic / St John Vianney (Year A)") are an old workaround
that stores 2026 weekday readings under a saint's name. They're no longer used.

### Australian calendar specifics

- Epiphany, Ascension and Corpus Christi are kept on Sundays.
- St Mark is on 26 April, because Anzac Day takes 25 April.
- Australia Day, Anzac Day, St Patrick and St Mary of the Cross have proper Masses.

## Importing a year

1. `/dgr/liturgical-calendar` → upload the Ordo CSV (`calendar_date,liturgical_name`; dates
   can be `DD/MM/YYYY`, `YYYY-MM-DD` or `1 January`) → **Process & Match**.
2. The preview lists every day that needs checking (Ordo wording that disagrees with the
   date, unknown saints) plus problems with the file (missing or duplicate dates). The
   **Show all days** list shows the readings chosen for each day.
3. **Confirm & Import** is disabled while any day has no readings, and the import endpoint
   refuses such days too.

To check a file from the terminal, which never writes to the database:

```bash
node --experimental-strip-types scripts/process-ordo.ts "data/source/ordo_template 2027.csv" 2027
```

Pending `dgr_schedule` rows read readings live from the mapping. Submitted, approved and
published rows keep a snapshot in `readings_data`, so fix those separately if a mapping
changes. Published reflections are also in WordPress, and republishing from the app
creates a new post.


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

## File Reference

| File | Purpose |
|------|---------|
| `src/lib/server/ordo-processor.ts` | **The** Ordo → lectionary processor |
| `tests/ordo-processor.test.ts` | Calendar maths vs `src/lib/data/liturgical-year.csv`, plus 2025–2027 Ordo checks |
| `scripts/process-ordo.ts` | CLI dry run of an Ordo CSV |
| `src/routes/api/dgr/liturgical-calendar/upload/+server.js` | Upload preview (no writes) |
| `src/routes/api/dgr/liturgical-calendar/import/+server.js` | Writes `ordo_calendar` + `ordo_lectionary_mapping` |
| `src/routes/dgr/liturgical-calendar/+page.svelte` | Calendar admin UI |
| `src/routes/api/dgr/readings/+server.js` | Readings API |
| `src/routes/api/dgr-admin/schedule/+server.js` | Schedule management |
| `data/source/*.csv` | Raw Brisbane Ordo files (2025, 2026, 2027) |

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

### Fixing a mapping

Fix the processor (and add a test case), then re-upload that year's Ordo on the calendar
page. Re-importing upserts by date. A one-off correction can also go straight into
`ordo_lectionary_mapping` (`match_method = 'manual_fix'`).

---

## Summary

- **Brisbane Ordo** is the source of truth for Australian liturgical calendar
- **Memorials always use weekday readings** (only Feasts/Solemnities use proper readings)
- **Mapping algorithm** infers season/week for memorials from surrounding dates
- **Workflow**: Generate CSV → Verify → Push to production
- **DGR** overlays contributor assignments on the calendar

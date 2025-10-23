# Ordo CSV Upload Format

## Simple Two-Column Format

The liturgical calendar upload system has been streamlined to require **only 2 columns** from your Ordo calendar:

```csv
calendar_date,liturgical_name
2027-01-01,SOLEMNITY OF MARY THE HOLY MOTHER OF GOD
2027-01-02,Saint Basil and Gregory
2027-01-03,Sunday before Epiphany
2027-01-06,THE EPIPHANY OF THE LORD
2027-01-10,THE BAPTISM OF THE LORD
```

## Column Descriptions

### Required Columns

1. **calendar_date** (Required)
   - Format: `YYYY-MM-DD`
   - Example: `2027-01-01`
   - The actual calendar date for the liturgical celebration

2. **liturgical_name** (Required)
   - The name of the liturgical day/celebration
   - Example: `SOLEMNITY OF MARY THE HOLY MOTHER OF GOD`
   - Example: `Saint Basil and Gregory`
   - Example: `3 ORDINARY` or `Third Sunday in Ordinary Time`

### Automatic Population

Everything else is **automatically populated** by matching the liturgical name to our Lectionary database:

- **liturgical_rank** - Solemnity, Feast, Sunday, Memorial, Feria
- **liturgical_season** - Ordinary Time, Advent, Christmas, Lent, Easter
- **liturgical_week** - Week number within the season
- **first_reading** - Scripture reference (e.g., Genesis 1:1-5)
- **psalm** - Psalm reference (e.g., Psalm 19:2-5)
- **second_reading** - Second reading reference (Sundays/Solemnities only)
- **gospel_reading** - Gospel reference (e.g., Mark 1:14-20)
- **year_cycle** - Automatically calculated (A, B, or C)

## Upload Process

1. **Download Template**
   - Click "Download Template" button to get properly formatted CSV

2. **Prepare Your CSV**
   - Only include `calendar_date` and `liturgical_name` columns
   - Use YYYY-MM-DD format for dates
   - Include all 365 days of the year (or 366 for leap years)

3. **Upload & Match**
   - Select the year (e.g., 2027)
   - Upload your CSV file
   - Click "Process & Match"
   - System will automatically match each entry to Lectionary readings

4. **Review Results**
   - **Exact Match** - Liturgical name matched perfectly
   - **Partial Match** - Name matched with minor variations
   - **No Match** - Entry could not be matched (will need manual review)

5. **Confirm Import**
   - Review matching statistics
   - Click "Confirm & Import [Year]"
   - All data (readings, rank, season) automatically populated

## Matching Algorithm

The system uses intelligent text normalization to match Ordo names to Lectionary entries:

- Converts ordinals: "Twenty-First" → "21"
- Expands abbreviations: "St." → "Saint", "SS." → "Saints"
- Removes year suffixes: ", Year A" → ""
- Normalizes variations:
  - "The Most Holy Trinity" → "Trinity Sunday"
  - "The Ascension of the Lord" → "Ascension"
  - "Passion Sunday (Palm Sunday)" → "Palm Sunday"

## Example CSV Files

### Minimal Valid CSV
```csv
calendar_date,liturgical_name
2027-01-01,SOLEMNITY OF MARY THE HOLY MOTHER OF GOD
2027-01-02,Feria
2027-01-03,Sunday before Epiphany
```

### Alternative Column Names (Also Accepted)
```csv
Date,Liturgical Day
2027-01-01,SOLEMNITY OF MARY THE HOLY MOTHER OF GOD
2027-01-02,Feria
```

The system accepts these alternative column names:
- Date column: `calendar_date`, `Date`, `date`
- Name column: `liturgical_name`, `Liturgical Day`, `name`, `Liturgical Name`

## Viewing Results

After import, the liturgical calendar table displays all matched data:

| Date | Liturgical Day | Rank | 1st Reading | Psalm | 2nd Reading | Gospel |
|------|---------------|------|-------------|-------|-------------|--------|
| Jan 1 | Solemnity of Mary | Solemnity | Num 6:22-27 | Ps 67:2-8 | Gal 4:4-7 | Luke 2:16-21 |

- Week and Season columns removed for cleaner display
- All 4 readings visible at a glance
- Compact formatting for maximum data density

## Tips for Best Results

1. **Use Official Names** - Match the names from your diocesan Ordo as closely as possible
2. **Check Solemnities** - Major feast names should be in ALL CAPS
3. **Ordinary Time Sundays** - Can use "2 ORDINARY" or "Second Sunday in Ordinary Time"
4. **Saints' Days** - Both "Saint Peter" and "St. Peter" work
5. **Review Partial Matches** - These may need manual verification in the calendar view

## Access

Navigate to: **DGR Admin → Liturgical Calendar tab**

The interface provides:
- Year selector to view existing calendars
- Upload new year functionality
- Template download
- Full calendar editing capabilities
- All readings displayed in table view

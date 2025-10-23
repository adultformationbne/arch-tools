# Scripts Directory

## Active Lectionary Scripts

### Production Scripts (Do Not Modify)
These scripts are used by the production Lectionary system:

- **`batch_import.js`** - Imports Ordo, Lectionary, and mapping data into Supabase
- **`generate_ordo_lectionary_mapping.py`** - Generates mappings between Ordo and Lectionary

### Analysis & Validation
- **`analyze_ordo_lectionary_matches_improved.py`** - Analyzes matching quality
- **`validate_calendar_coverage.py`** - Validates coverage for all years

### Data Generation (Source Data)
- **`generate_liturgical_calendar_v2.py`** - Generates Ordo calendar from scraped data
- **`normalize_ordo_csvs.py`** - Normalizes Ordo CSV format
- **`calculate_easter.py`** - Calculates Easter dates for liturgical year cycles

### Testing
- **`test_readings_api.js`** - Tests the `/api/dgr/readings` endpoint

## Book Structure Scripts
Scripts for managing book/chapter content (separate from Lectionary):
- `extract-book-structure.js`
- `extract-chapters-to-json.js`
- `summarize-chapters.js`

## Archive
Old experimental scripts are stored in `scripts/archive/` and can be safely ignored or deleted.

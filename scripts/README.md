# Scripts Directory

## Active Lectionary Scripts

### Production Scripts (Do Not Modify)
These scripts are used by the production Lectionary system:

- **`process-ordo.ts`** - Dry-runs an Ordo CSV through the shared processor (`src/lib/server/ordo-processor.ts`, the same code as the upload page). Import from `/dgr/liturgical-calendar`.

### Analysis & Validation
- **`validate_calendar_coverage.py`** - Validates coverage for all years

### Data Generation (Source Data)
- **`normalize_ordo_csvs.py`** - Normalizes Ordo CSV format

### Testing
- **`test_readings_api.js`** - Tests the `/api/dgr/readings` endpoint

## Book Structure Scripts
Scripts for managing book/chapter content (separate from Lectionary):
- `extract-book-structure.js`
- `extract-chapters-to-json.js`
- `summarize-chapters.js`

## Archive
Old experimental scripts are stored in `scripts/archive/` and can be safely ignored or deleted.

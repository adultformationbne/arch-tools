# Supabase CLI Guide for AHWGP Editor App

**Essential commands for managing the Archdiocesan Ministry Tools database.**

## Setup

```bash
# Install/Update CLI
brew install supabase/tap/supabase && brew upgrade supabase

# Login and link to project
supabase login
supabase link --project-ref snuifqzfezxqnkzizija

# Check status
supabase status
```

## Migration Management

```bash
# Create new migration
supabase migration new add_new_feature

# List migration status
supabase migration list

# Push to remote (with DB password from .env)
supabase db push -p $(grep SUPABASE_DB_PASSWORD .env | cut -d'=' -f2)

# Pull schema changes from remote
supabase db pull

# Reset local database (applies all migrations fresh)
supabase db reset

# Fix migration history if needed
supabase migration repair --status applied [migration-id] -p $(grep SUPABASE_DB_PASSWORD .env | cut -d'=' -f2)
```

## Type Generation

```bash
# Generate TypeScript types (most important command!)
supabase gen types typescript --local > src/lib/database.types.ts

# Generate from linked remote DB
supabase gen types typescript --linked > src/lib/database.types.ts
```

## Database Operations

```bash
# Direct SQL access
docker exec supabase_db_editor-app psql -U postgres -d postgres

# Run SQL file against local database
docker exec -i supabase_db_editor-app psql -U postgres -d postgres < migration.sql

# Database inspection
supabase inspect db table-sizes
supabase inspect db calls
supabase inspect db long-running-queries
```

## Project Schema Overview

### Core Editor Tables

- `blocks` - Versioned content blocks (immutable)
- `books` - Document structure versions (immutable)
- `chapters` - Chapter metadata and organization
- `editor_logs` - Complete audit trail
- `admin_settings` - Application configuration

### DGR System Tables

- `dgr_contributors` - Gospel reflection contributors
- `dgr_schedule` - Daily assignments and submissions
- `dgr_email_queue` - Email notification management

### Utility Functions

- `get_complete_book()` - Retrieve complete book with latest block content
- `get_book_by_chapters()` - Get book organized by chapters
- `assign_contributor_to_date()` - Smart contributor assignment
- `generate_submission_token()` - Secure token generation

## Troubleshooting

### Migration Issues

```bash
# Problem: "Remote migration versions not found"
supabase migration list
supabase migration repair --status applied [migration-id] -p $(grep SUPABASE_DB_PASSWORD .env | cut -d'=' -f2)
supabase db pull

# Problem: Connection fails
supabase login
supabase link --project-ref snuifqzfezxqnkzizija
```

### Common Fixes

```bash
# Types out of date after schema changes
supabase db push -p $(grep SUPABASE_DB_PASSWORD .env | cut -d'=' -f2)
supabase gen types typescript --local > src/lib/database.types.ts

# Local DB corrupted or needs fresh start
supabase stop && supabase start && supabase db reset

# Check what tables exist
docker exec supabase_db_editor-app psql -U postgres -d postgres -c "\dt"

# View current migration status
supabase migration list
```

## AHWGP Editor Specific Operations

```bash
# Check current content blocks
docker exec supabase_db_editor-app psql -U postgres -d postgres -c "SELECT COUNT(*) FROM blocks;"

# View latest book structure
docker exec supabase_db_editor-app psql -U postgres -d postgres -c "SELECT document_title, jsonb_array_length(blocks) as block_count FROM books ORDER BY created_at DESC LIMIT 1;"

# Check DGR contributor assignments
docker exec supabase_db_editor-app psql -U postgres -d postgres -c "SELECT date, contributor_email, status FROM dgr_schedule ORDER BY date DESC LIMIT 10;"

# View admin settings
docker exec supabase_db_editor-app psql -U postgres -d postgres -c "SELECT setting_key, description FROM admin_settings;"
```

## Development Workflow

```bash
# Standard development cycle
1. supabase migration list          # Check sync status
2. supabase migration new feature_name
3. # Edit the migration file
4. supabase db reset               # Test locally
5. supabase db push -p $(grep SUPABASE_DB_PASSWORD .env | cut -d'=' -f2)
6. supabase gen types typescript --local > src/lib/database.types.ts

# Emergency backup
docker exec supabase_db_editor-app pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql
```

## Quick Reference

```bash
# Daily commands
supabase status
supabase migration list
supabase db reset                  # Fresh local DB
supabase gen types typescript --local > src/lib/database.types.ts

# Project info
Project ID: snuifqzfezxqnkzizija
Project URL: https://snuifqzfezxqnkzizija.supabase.co
Local API: http://127.0.0.1:54321
Local DB: postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

## Security Notes

- All tables use Row Level Security (RLS)
- Authenticated users have full read/write access
- Public users can only submit DGR reflections via token
- Editor logs provide complete audit trail
- Immutable versioning prevents data loss

---

_Keep this guide handy - these are the commands you'll need for AHWGP Editor development._

# DGR (Daily Gospel Reflections) System

## Overview

The DGR system manages daily gospel reflections written by contributors. Contributors are assigned dates either through automatic patterns or manual assignment, then submit reflections which are reviewed and published.

## Key Tables

| Table | Purpose |
|-------|---------|
| `dgr_contributors` | People who write reflections (includes `title` field for Fr, Sr, Br, Deacon) |
| `dgr_schedule` | Actual assignments and submitted content |
| `dgr_assignment_rules` | Rules to block patterns during certain seasons |
| `dgr_templates` | Email templates (welcome, reminder) |

## Date Assignment Flow

### Two Types of Assignment

**1. Pattern-based (automatic)**
- Contributor has `schedule_pattern` in their record
- Examples:
  - `{type: "day_of_month", value: 3}` → 3rd of every month
  - `{type: "day_of_week", value: 2}` → every Tuesday
- No `dgr_schedule` row created until contributor takes action
- Calculated on-the-fly by `get_contributor_assigned_dates()` function

**2. Manual assignment**
- Admin assigns contributor to specific date via Schedule page
- Creates actual row in `dgr_schedule`
- Overrides any pattern-based assignment

### Pattern Blocking Logic

Pattern-generated dates are **blocked** (not shown to contributors) if:

```
1. Another contributor is assigned (dgr_schedule.contributor_id IS NOT NULL)
2. Content exists (even if unassigned)
3. Season is blocked by assignment rules (Lent, Advent, Christmas)
```

Pattern-generated dates **resume** if:
```
- Row has contributor_id = NULL AND no content (empty placeholder)
```

### Assignment Rules

Rules in `dgr_assignment_rules` with `action_type = 'skip_pattern'` block automatic pattern assignments during specific liturgical seasons:

| Rule | Season | Effect |
|------|--------|--------|
| Block Lent | Lent | Patterns skip Lent dates |
| Block Advent | Advent | Patterns skip Advent dates |
| Block Christmas | Christmas | Patterns skip Christmas dates |

**Note:** Manual assignments still work during blocked seasons - rules only affect pattern-generated dates.

### What Happens When...

**Scenario: Reassigning a date**
1. Date is pattern-assigned to Contributor A (no row exists)
2. Admin manually assigns to Contributor B → creates `dgr_schedule` row
3. Contributor A no longer sees that date (row blocks pattern)

**Scenario: Unassigning without submission**
1. Admin assigns date to A → row created
2. Admin unassigns A → `contributor_id` set to NULL, row remains
3. If row has no content → patterns can resume for that date
4. If row has content → patterns stay blocked

**Scenario: Contributor submits during blocked season**
- If contributor has a manual `dgr_schedule` row for a blocked-season date, they CAN submit
- Only pattern-generated dates are blocked, not manual assignments

## Key Files

| File | Purpose |
|------|---------|
| `src/routes/dgr/write/[token]/+page.svelte` | Contributor writing interface |
| `src/routes/api/dgr/contributor/[token]/+server.js` | Contributor API (get dates, save reflection) |
| `src/routes/api/dgr-admin/schedule/+server.js` | Admin schedule management |
| `src/lib/components/DGRContributorManager.svelte` | Admin contributor management UI |
| `src/routes/dgr/contributors/+page.svelte` | Contributors admin page |

## Database Function

`get_contributor_assigned_dates(contributor_uuid, months_ahead)` returns:

- All `dgr_schedule` rows where contributor is assigned
- Plus pattern-calculated dates that are NOT:
  - Already claimed by any contributor
  - In a blocked season (per assignment rules)
  - Empty rows with no contributor/content don't block

## Contributor Access

Contributors access their writing page via token URL:
```
/dgr/write/{access_token}
```

The token is stored in `dgr_contributors.access_token` and sent via welcome email.

## Status Flow

```
pending → submitted → approved → published
```

- **pending**: Assigned but no content yet
- **submitted**: Contributor has submitted reflection
- **approved**: Admin has reviewed and approved
- **published**: Sent to WordPress

# Arch Tools - Quick Reference

**Stack:** SvelteKit + Svelte 5 + Supabase + Tailwind v4 + Resend

**Env:** Copy `.env.example` → `.env` (Supabase + Resend keys)

**📚 Important:** See [SVELTE5_BEST_PRACTICES.md](./SVELTE5_BEST_PRACTICES.md) for Svelte 5 patterns (state management, reactivity, effects)

---

## Critical Patterns

### Auth (`$lib/server/auth.ts`)

Two modes: `throw_error` (API routes) or `redirect` (page routes)

```ts
import { requireModule, requireCourseAdmin, requireCourseAccess } from '$lib/server/auth';

// Platform-level auth
const { user, profile } = await requireModule(event, 'users');
const { user, profile } = await requireModule(event, 'users', { mode: 'redirect', redirectTo: '/my-courses' });

// Course-level auth
const { user, enrollment } = await requireCourseAdmin(event, courseSlug);
const { user, enrollment } = await requireCourseAccess(event, courseSlug);
```

**Platform modules:** `users` (platform admin), `editor`, `dgr`, `courses.participant`, `courses.manager`, `courses.admin`
**Course roles:** `admin`, `student`, `coordinator`

### Notifications

**NEVER use `alert()` or `confirm()`.** Always use:

```ts
import { toastError, toastSuccess, toastWarning } from '$lib/utils/toast-helpers.js';
toastError('Failed');
toastSuccess('Saved!');
```

For confirmations:
```svelte
<ConfirmationModal show={showConfirm} onConfirm={handleDelete} onCancel={() => showConfirm = false}>
  <p>Delete this?</p>
</ConfirmationModal>
```

### API Requests

```ts
import { apiPost, apiGet, apiDelete } from '$lib/utils/api-handler.js';

const data = await apiGet('/api/endpoint', { successMessage: 'Done!' });
await apiPost('/api/endpoint', formData, { successMessage: 'Saved' });
```

### Dropdowns (overflow-safe)

```ts
import { createDropdown } from '$lib/utils/dropdown.js';
```

See `/src/lib/utils/dropdown-usage-examples.md`

### Form Validation

```ts
import { validate, validators } from '$lib/utils/form-validator.js';

const result = validate(formData, {
  email: [validators.required, validators.email],
  password: [validators.required, validators.minLength(6)]
});
```

### Supabase

**Server:** Always use admin client
```ts
import { supabaseAdmin } from '$lib/server/supabase.js';

const { data } = await supabaseAdmin.from('table').select('*').eq('id', id);
```

**Client:** Access via `event.locals.supabase` in load functions

---

## Svelte 5 Quick Reference

```ts
// State & derived
let count = $state(0);
let doubled = $derived(count * 2);

// Props (NOT export let)
let { isOpen = false, onClose } = $props();

// Effects
$effect(() => { console.log(count); });

// Events: onclick= (NOT on:click=)
<button onclick={handler}>Click</button>
```

---

## Key Files

- **Auth:** `$lib/server/auth.ts`
- **Toast:** `$lib/utils/toast-helpers.js`
- **API:** `$lib/utils/api-handler.js`
- **Validation:** `$lib/utils/form-validator.js`
- **Dropdown:** `$lib/utils/dropdown.js`
- **Email:** `$lib/utils/email-service.js`
- **DB Types:** `$lib/database.types.ts` (auto-generated)

## Database

**Schema changes:** Follow **AGENTS.MD** workflow

### ⚠️ CRITICAL: Table Query Efficiency

**NEVER USE `mcp__supabase__list_tables` WITHOUT FILTERING - IT USES 14,000+ TOKENS AND KILLS THE CONTEXT WINDOW!**

**ALWAYS use targeted SQL queries filtered by table prefix:**

```sql
-- ✅ CORRECT: Query only relevant tables
SELECT table_name, column_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'courses%'  -- Filter by prefix!
ORDER BY table_name
```

### Table Groups (use these prefixes to filter queries)

- **Courses**: `courses%` (14 tables) - courses, courses_modules, courses_sessions, courses_materials, courses_cohorts, courses_enrollments, courses_reflection_questions, courses_reflection_responses, courses_hubs, courses_attendance, courses_activity_log, courses_community_feed, courses_email_templates, courses_enrollment_imports

- **DGR**: `dgr_%` (5 tables) - dgr_assignment_rules, dgr_contributors, dgr_promo_tiles, dgr_schedule, dgr_templates

- **Editor**: `editor_%` (4 tables) - editor_blocks, editor_books, editor_chapters, editor_logs

- **Liturgical**: `lectionary%` OR `liturgical_%` OR `ordo_%` (6 tables) - lectionary, lectionary_readings, liturgical_calendar, liturgical_years, ordo_calendar, ordo_lectionary_mapping

- **Platform**: `platform_%` OR `admin_%` OR `user_%` (4 tables) - platform_email_log, platform_email_templates, platform_settings, admin_settings, user_profiles

**REMEMBER: Filtered queries = ~500 tokens. Unfiltered queries = 14,000+ tokens. ALWAYS FILTER!**

---

## Testing & Validation

**Before pushing changes, run tests and validators:**

```bash
npm test              # Run all tests (database + API tests, ~90s)
npm run validate-api  # Check API endpoint/frontend parameter mismatches
```

### API Contract Validation

The `validate-api` script automatically detects mismatches between:
- Frontend API calls (`apiGet`, `apiPost`, `apiPut`, `apiDelete`, `fetch`)
- Backend endpoint definitions (+server.ts files)

It checks:
- Query parameter names (e.g., `?id=` vs `?template_id=`)
- Body parameter names
- HTTP methods

**Example issues caught:**
- DELETE endpoint expects `?template_id=` but frontend sends `?id=`
- PUT endpoint expects `{ template_id: ... }` but frontend sends `{ id: ... }`

See `tests/README.md` for test details. Tests auto-cleanup after running.

---

## Other Docs

- **AGENTS.MD** - Database migration workflow
- **AUTHENTICATION.md** - Detailed auth docs
- **COURSES.md** - Course architecture
- **EMAIL_SYSTEM.md** - Email setup

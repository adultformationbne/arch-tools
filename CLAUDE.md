# Arch Tools - Quick Reference

**Stack:** SvelteKit + Svelte 5 + Supabase + Tailwind v4 + Resend

**Env:** Copy `.env.example` → `.env` (Supabase + Resend keys)

### File Editing (Tab-Indented Files)

This codebase uses **tabs for indentation**. The Read tool renders tabs as spaces, which causes Edit `old_string` mismatches. To avoid whitespace rabbit holes:

- **Keep `old_string` short** — use 1-3 unique lines, not large blocks
- **If an Edit fails due to whitespace**, use `Bash` with a heredoc or `sed` to make the edit — do NOT loop trying `cat -vet`/`awk`/`sed -n` to diagnose indentation
- **Never copy-paste indentation from Read output** into Edit — it will be wrong

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
import { apiGet, apiPost, apiPut, apiDelete } from '$lib/utils/api-handler.js';

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

### Email Template Variables

Email templates use `{{variable}}` substitution. Variables containing HTML **must** use `data-type` patterns recognized by `convertToMjmlComponents()` in `compiler.js`. This ensures they work in both browser preview AND MJML email compilation.

**Rules:**
- **Buttons:** Use `createEmailButton()` from `$lib/email/email-button.ts` — NEVER raw HTML tables/VML/`<mj-button>`
- **All course variables:** Use `buildCourseVariablesFromEnrollment()` from `$lib/email/context-config.ts` — this is the single source of truth. `buildVariableContext()` in email-service.js is just a thin input adapter.
- **New HTML variables:** Must output `data-type="..."` patterns and add a corresponding conversion in `convertToMjmlComponents()`

```ts
import { createEmailButton } from '$lib/email/email-button';
// Works in both browser preview (styled <a> tag) and email sending (converts to <mj-button>)
variables.loginButton = createEmailButton('Go to Course', url, accentDark);
```

---

## Svelte 5 Essentials

Use `$state()`, `$derived()`, `$props()`, `$effect()`. **NOT** `export let`, `on:click`, or stores. See [SVELTE5_BEST_PRACTICES.md](./SVELTE5_BEST_PRACTICES.md) for full patterns.

---

## Key Files

- **Auth:** `$lib/server/auth.ts`
- **Toast:** `$lib/utils/toast-helpers.js`
- **API:** `$lib/utils/api-handler.js`
- **Validation:** `$lib/utils/form-validator.js`
- **Dropdown:** `$lib/utils/dropdown.js`
- **Email:** `$lib/utils/email-service.js`, `$lib/email/compiler.js`, `$lib/email/context-config.ts`
- **Email Button:** `$lib/email/email-button.ts` (shared, client+server importable)
- **Reflection Status:** `$lib/utils/reflection-status.ts` (status labels, badges, icons for courses reflections)
- **DB Types:** `$lib/database.types.ts` (regenerate with `npm run update-types`)

## Database

**Schema changes:** Follow **AGENTS.md** workflow

### Table Query Efficiency

**NEVER use `mcp__supabase__list_tables` unfiltered (14,000+ tokens).** Always use targeted SQL:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'courses%'
ORDER BY table_name;
```

### Table Groups (filter by prefix)

| Group | Prefix | Count | Tables |
|-------|--------|-------|--------|
| **Courses** | `courses%` | 16 | courses, courses_activity_log, courses_attendance, courses_cohorts, courses_community_feed, courses_discount_codes, courses_enrollment_imports, courses_enrollment_links, courses_enrollments, courses_hubs, courses_materials, courses_modules, courses_payments, courses_reflection_questions, courses_reflection_responses, courses_sessions |
| **DGR** | `dgr_%` | 5 | dgr_assignment_rules, dgr_contributors, dgr_promo_tiles, dgr_schedule, dgr_templates |
| **Email** | `email_%` | 2 | email_templates, email_images |
| **Liturgical** | `lectionary%` / `liturgical_%` / `ordo_%` | 6 | lectionary, lectionary_readings, liturgical_calendar, liturgical_years, ordo_calendar, ordo_lectionary_mapping |
| **Platform** | `platform_%` / `admin_%` / `user_%` | 4 | admin_settings, platform_email_log, platform_settings, user_profiles |
| **Other** | — | 4 | auth_otp_tracker, parishes, scheduled_tasks, stripe_events |

---

## Testing & Validation

**Before pushing changes, run tests and validators:**

```bash
npm test              # Run all tests (database + API tests, ~90s)
npm run validate-api  # Check API endpoint/frontend parameter mismatches
```

### API Contract Validation

`validate-api` detects mismatches between frontend API calls and backend endpoints (query params, body params, HTTP methods). See `tests/README.md` for details.

---

## Other Docs

- **AGENTS.md** - Database migration workflow
- **AUTHENTICATION.md** - Detailed auth docs
- **COURSES.md** - Course architecture
- **DGR.md** - Daily Gospel Reflections system
- **LITURGICAL_SYSTEM.md** - Liturgical calendar and readings
- **UNIFIED_EMAIL_SYSTEM.md** - Email templates, sending, and branding (courses, DGR, platform)

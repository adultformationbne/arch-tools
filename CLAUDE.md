# Arch Tools - Quick Reference

**Stack:** SvelteKit + Svelte 5 + Supabase + Tailwind v4 + Resend

**Env:** Copy `.env.example` → `.env` (Supabase + Resend keys)

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

Main tables: `user_profiles`, `courses`, `courses_modules`, `courses_enrollments`, `courses_materials`, `courses_reflections`

**Schema changes:** Follow **AGENTS.MD** workflow

---

## Other Docs

- **AGENTS.MD** - Database migration workflow
- **AUTHENTICATION.md** - Detailed auth docs
- **COURSES.md** - Course architecture
- **EMAIL_SYSTEM.md** - Email setup

# Enrollment System Build-Out — Agent Prompt

## Context

You are working on a SvelteKit + Supabase + Tailwind v4 application (arch-tools) that manages courses for an archdiocese. The codebase uses Svelte 5 (`$state`, `$derived`, `$props`, `$effect`), tabs for indentation, and has strict patterns documented in `/CLAUDE.md` — read it before writing any code.

The enrollment system already has a working MVP (enrollment links, Stripe payments, discount codes, public enrollment form). Your job is to build out the remaining features documented in `future-features/COURSES_FUTURE_FEATURES.md` under the "🔲 NEXT: Enrollment System Overhaul" section.

**Important terminology:** Never say "student" in user-facing UI — always use "participant". Internal variable names are fine.

---

## What Already Exists (DO NOT rebuild these)

### Feature Flags (just completed)
- `paymentsEnabled` has been renamed to `enrollmentEnabled` with sub-flags `acceptPayments` and `discountCodes`
- Type definitions: `src/lib/types/course-settings.ts` (lines 41-50)
- Defaults and parsing with backwards compat for `paymentsEnabled`: same file, lines 68-76, 120-128
- Settings UI: `src/routes/admin/courses/[slug]/settings/+page.svelte` — full-width enrollment toggle card with sub-options (lines ~794-857)
- Nav gating: `src/lib/components/CourseAdminSidebar.svelte` (lines 130-142), `CourseAdminMobileNav.svelte` (lines 131-142)

### Enrollment Links
- Table: `courses_enrollment_links` — has code, cohort_id, hub_id, is_active, expires_at, max_uses, uses_count, price_cents, name, created_by
- Code generation: `src/lib/utils/enrollment-links.ts` — 8-char alphanumeric, collision-safe
- Pricing logic: same file, lines 54-100 — hierarchy: link → hub → cohort → course
- Admin CRUD: `src/routes/admin/courses/[slug]/enrollment-links/api/+server.ts`
- Admin UI: `src/routes/admin/courses/[slug]/enrollment-links/+page.svelte`

### Public Enrollment Flow
- Load + validation: `src/routes/enroll/[code]/+page.server.ts` — validates link active, not expired, capacity, enrollment windows
- Form UI: `src/routes/enroll/[code]/+page.svelte` — collects firstName, surname, email, phone, parishId, referralSource
- POST handler: `src/routes/api/enroll/[code]/+server.ts`:
  - Rate limiting (10/IP/15min, 3/email/hour)
  - Free path: `safe_create_enrollment` RPC, status = pending (if approval_required) or invited (if auto)
  - Paid path: Creates Stripe customer + payment record with pending_data, redirects to Stripe Checkout
- Success page: `src/routes/enroll/[code]/success/+page.server.ts` — password setup, user creation, enrollment activation, welcome email

### Discount Codes
- Table: `courses_discount_codes` — code, course_id, cohort_id, discount_type, discount_value, Stripe sync
- Admin CRUD: `src/routes/admin/courses/[slug]/discounts/api/+server.ts`
- Admin UI: `src/routes/admin/courses/[slug]/discounts/+page.svelte`
- Applied at Stripe Checkout via `allowPromotionCodes: true`

### Cohort Enrollment Settings (partially built)
- `courses_cohorts` has: enrollment_type, enrollment_opens_at, enrollment_closes_at, max_enrollments, is_free, price_cents, currency
- These are set at cohort creation time via `src/routes/admin/courses/[slug]/api/+server.ts` (create_cohort action)
- Cohort settings modal: `src/lib/components/CohortSettingsModal.svelte` — currently only shows name, dates, status. Does NOT expose enrollment settings for editing.

### Enrollment Statuses
- `courses_enrollments.status`: not_invited, invited, pending, active, held, completed, withdrawn
- `courses_enrollments.payment_status`: not_required, pending, paid, failed

---

## What You Need to Build

### Phase 1: Enforce Feature Flags in Existing Flows

The `acceptPayments` and `discountCodes` flags exist in settings but aren't enforced yet. Wire them up:

1. **Enrollment link creation UI** (`/admin/courses/[slug]/enrollment-links/+page.svelte`):
   - When `acceptPayments = false`: Hide the price_cents field in the create/edit modal. Links can only be created as free.
   - When `acceptPayments = true`: Show price field as normal.

2. **Enrollment link creation API** (`/admin/courses/[slug]/enrollment-links/api/+server.ts`):
   - When `acceptPayments = false`: Reject any request that includes a non-null price_cents. Return 400 error.
   - Load course settings via `getCourseSettings(course.settings)` to check the flag.

3. **Discount codes admin page** (`/admin/courses/[slug]/discounts/+page.svelte` and `+page.server.ts`):
   - The nav link is already hidden when `discountCodes = false`, but the page itself is still accessible via direct URL.
   - In the page's `+page.server.ts` load function: if `discountCodes` is false AND `acceptPayments` is false, redirect to the course admin root.

4. **Enrollment links admin page** (`/admin/courses/[slug]/enrollment-links/+page.svelte` and `+page.server.ts`):
   - If `enrollmentEnabled = false`, redirect from the page load to course admin root.

### Phase 2: Cohort Enrollment Settings UI

The CohortSettingsModal currently doesn't expose enrollment settings. Add them.

**File:** `src/lib/components/CohortSettingsModal.svelte`

Add a new section (collapsible or tabbed) for enrollment settings when `enrollmentEnabled = true`:

1. **Enrollment Type** — Select dropdown:
   - "Auto-approve" (default) — participants get immediate access (or go to payment)
   - "Require approval" — participants go to pending, admin must approve

2. **Pricing** (only visible when `acceptPayments = true`):
   - Toggle: Free / Paid
   - If paid: price input (in dollars, stored as cents), currency selector (default AUD)

3. **Enrollment Window** (optional):
   - Opens at: date/time picker (nullable)
   - Closes at: date/time picker (nullable)

4. **Max Enrollments** — Number input (nullable, null = unlimited). This is the cohort-level cap.

**API:** Add an `update_cohort_enrollment` action to `src/routes/admin/courses/[slug]/api/+server.ts` that updates these fields on the cohort. Use `supabaseAdmin` for the update.

**Pass feature flags to the modal:** The parent page (`src/routes/admin/courses/[slug]/+page.svelte`) needs to pass `courseFeatures` (or specifically `enrollmentEnabled` and `acceptPayments`) as props to CohortSettingsModal so it knows which fields to show.

### Phase 3: Max Capacity (Course-Wide)

Add a course-wide enrollment cap that works independently of cohort-level caps.

1. **Settings UI** — In the enrollment toggle card on `settings/+page.svelte`, add a "Max capacity" number input below the existing sub-options. Show it when `enrollmentEnabled = true`. Use a text input with type="number", placeholder "Unlimited", allow empty (= null).

2. **Type system** — Add `maxCapacity?: number | null` to the features section in `course-settings.ts`. Default: `null`.

3. **Settings save** — The settings page already saves `settings.features` — just make sure `maxCapacity` is included.

4. **Enforcement** — In the enrollment POST handler (`src/routes/api/enroll/[code]/+server.ts`), before creating an enrollment:
   - Load course settings via `getCourseSettings`
   - If `maxCapacity` is set, count total active/invited/pending enrollments across ALL cohorts for this course
   - If at or over capacity, return a 400 with a user-friendly message ("This course is currently full")
   - This check should happen BEFORE the existing cohort-level `max_enrollments` check

5. **Display** — On the public enrollment page (`/enroll/[code]/+page.svelte`), if the course is at capacity, show a "Course Full" message instead of the form. Handle this in the load function.

### Phase 4: Require Approval (Course-Wide Default)

Add a course-wide default for approval requirement.

1. **Settings UI** — In the enrollment toggle card, add a "Require approval" checkbox below max capacity. Description: "Participants must be approved before gaining access. Can be overridden per cohort."

2. **Type system** — Add `requireApproval?: boolean` to features in `course-settings.ts`. Default: `false`.

3. **Enrollment flow** — In `/api/enroll/[code]/+server.ts`, update the approval check logic:
   - Current: checks `cohort.enrollment_type === 'approval_required'`
   - New: check cohort-level first (it's an override), then fall back to course-level `requireApproval`
   ```
   const requiresApproval = cohort.enrollment_type === 'approval_required' 
     || (cohort.enrollment_type !== 'auto_approve' && courseSettings.features.requireApproval);
   ```

4. **Cohort settings UI** — Update the enrollment type dropdown to have three options:
   - "Use course default" (null/empty — defers to course-level setting)
   - "Auto-approve" (overrides course default)
   - "Require approval" (overrides course default)

### Phase 5: Admin Approval UI

Currently there's no dedicated UI for approving pending enrollments. Build it.

1. **Participants page** (`src/routes/admin/courses/[slug]/participants/+page.svelte`):
   - Add a filter/tab for "Pending Approval" enrollments (status = 'pending')
   - Show pending count as a badge on the tab
   - For each pending enrollment, show: name, email, phone, parish, submitted date
   - Action buttons: "Approve" and "Reject"

2. **Approve action:**
   - Update enrollment status from 'pending' to 'invited'
   - If the enrollment is for a paid course (payment_status = 'pending'), this is where the future "approve then pay" flow would go. For now, just approve and mark as invited — the participant already paid via Stripe before reaching pending status (current flow only hits pending for FREE enrollments with approval_required).
   - Send an approval notification email (use the existing email system — `$lib/utils/email-service.js`)

3. **Reject action:**
   - Update enrollment status from 'pending' to 'withdrawn'
   - Optionally send a rejection email
   - Show a confirmation modal before rejecting (use ConfirmationModal component)

4. **API endpoint:** Add approve/reject actions to the existing participants API or create a new endpoint at `/admin/courses/[slug]/participants/api/+server.ts`.

---

## Implementation Guidelines

### Auth Pattern
All admin API routes must use auth:
```ts
import { requireCourseAdmin } from '$lib/server/auth';
const { user, enrollment } = await requireCourseAdmin(event, courseSlug);
```

### Database Access
Always use the admin client on server:
```ts
import { supabaseAdmin } from '$lib/server/supabase.js';
```

### Notifications
Never use `alert()` or `confirm()`. Use:
```ts
import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
```
For confirmations, use the `ConfirmationModal` component.

### API Requests from Client
```ts
import { apiGet, apiPost, apiPut, apiDelete } from '$lib/utils/api-handler.js';
```

### Feature Flag Access
Course features are typically available via `data.courseFeatures` in admin pages, loaded by the layout. Check how existing pages access them:
- `src/routes/admin/courses/[slug]/+page.svelte` — has `const courseFeatures = $derived(data.courseFeatures || {})`
- Features come from `getCourseSettings(course.settings).features` computed in server load functions

### Svelte 5
Use `$state()`, `$derived()`, `$props()`, `$effect()`. NOT `export let`, `on:click`, stores. See `SVELTE5_BEST_PRACTICES.md`.

### Tabs for Indentation
The codebase uses tabs. The Read tool shows them as spaces — don't trust the indentation you see. Keep Edit `old_string` blocks short (1-3 lines). If an Edit fails on whitespace, use Bash with a heredoc or Write instead. Do NOT loop trying to diagnose indentation.

---

## Order of Operations

1. Read `CLAUDE.md` and `SVELTE5_BEST_PRACTICES.md`
2. Phase 1 (flag enforcement) — small, safe, no schema changes
3. Phase 2 (cohort enrollment settings UI) — no schema changes, just exposing existing columns
4. Phase 3 (max capacity) — settings type change + enrollment flow check
5. Phase 4 (require approval) — settings type change + enrollment flow logic
6. Phase 5 (approval UI) — new UI + API endpoints

Test each phase before moving to the next. Run `npm run validate-api` after any API changes to check for frontend/backend mismatches.

---

## Files You'll Primarily Touch

| File | What |
|------|------|
| `src/lib/types/course-settings.ts` | Add maxCapacity, requireApproval |
| `src/lib/components/CohortSettingsModal.svelte` | Add enrollment settings section |
| `src/routes/admin/courses/[slug]/settings/+page.svelte` | Add maxCapacity + requireApproval to enrollment card |
| `src/routes/admin/courses/[slug]/enrollment-links/+page.svelte` | Hide price when acceptPayments=false |
| `src/routes/admin/courses/[slug]/enrollment-links/+page.server.ts` | Redirect if enrollmentEnabled=false |
| `src/routes/admin/courses/[slug]/enrollment-links/api/+server.ts` | Enforce acceptPayments flag |
| `src/routes/admin/courses/[slug]/discounts/+page.server.ts` | Redirect if flags disabled |
| `src/routes/admin/courses/[slug]/participants/+page.svelte` | Pending approval tab + approve/reject UI |
| `src/routes/admin/courses/[slug]/api/+server.ts` | update_cohort_enrollment action |
| `src/routes/api/enroll/[code]/+server.ts` | Max capacity check, approval logic update |
| `src/routes/enroll/[code]/+page.server.ts` | Course-full check in load |

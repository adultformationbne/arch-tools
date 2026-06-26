# Configurable Enrolment — Design Spec

> **Status:** proposed (not yet built, as of 2026-06-26). This is the durable design reference for turning the enrolment system from "hardcoded for ACCF" into "configured per-course from the dashboard." Read `SKILL.md` first — this builds directly on its data model, flows, and RPC contracts. When any phase below ships, fold the reality back into `SKILL.md` and trim the relevant section here.

---

## 1. Why & the headline idea

Today the signup form is **static markup** in `enroll/[code]/+page.svelte`, validated by hardcoded JS, written to fixed columns in `courses_enrollments`. The 7 referral options are a literal array in `enroll/[code]/+page.server.ts`. Adding/removing a participant field is a code+migration job (see the "Add a participant field" task in `SKILL.md §12`). We run **two live courses** off this one form — **ACCF** and **CLI** — and want more, each collecting different details.

**The reframe (the important part): the unit of configuration is not "a form" — it's a _field with a collection stage_.** A course defines the full set of participant fields it keeps, and tags *when* each is collected:

- `signup` — asked on the public enrol form.
- `onboarding` — asked in a **post-signup onboarding step**, after the account exists.
- `off` — not collected.

So signup shrinks to the few **critical** fields (name, email, hub) and everything else is gathered later, after the person is already in. This both generalises the form *and* improves conversion (shorter signup), and it's why the model is stage-based rather than a flat "form builder."

### What is already NOT hardcoded (don't rebuild it)
CLI runs cleanly with its own logo/theme/branding, which proves the per-course config layer already works. `courses.settings` (JSONB, typed by `CourseSettings` in `src/lib/types/course-settings.ts`, read via `getCourseSettings`) is the established home for theme, branding, feature flags, coordinator access, and session-progression rules. **We extend that pattern — we do not invent new config infrastructure.** Branding defaults like `/accf-logo.png` in `+layout.server.ts` are *fallbacks*, not hardcoding.

### What IS genuinely hardcoded (the real scope)
- The signup field set + markup + validation (`enroll/[code]/+page.svelte`, `+server.ts` `normalizeParticipant`/`resolveParticipant`).
- The referral-source options array (`enroll/[code]/+page.server.ts`).
- Module default session count `8` (`ModuleModal.svelte`).
- Stripe line-item product name `'Course Enrollment'` (`src/lib/server/stripe.ts`).
- Support-email *final* fallback `accf@archdiocesanministries.org.au` (`context-config.ts` — already prefers `emailBrandingConfig.reply_to_email`).
- Dead enum values `accf_admin`/`accf_student` — **only** in `database.types.ts`, zero code references. Drop in a DB cleanup; not load-bearing.

---

## 2. Core data model

### 2.1 Field schema — lives in `courses.settings`

Add a `participantFields` section to `CourseSettings` (`src/lib/types/course-settings.ts`) and give it a default in `DEFAULT_COURSE_SETTINGS` + a merge branch in `getCourseSettings`, exactly like the existing `features`/`sessionProgression` sections.

```ts
export type ParticipantFieldStage = 'signup' | 'onboarding' | 'off';

export type ParticipantFieldType =
  | 'text' | 'email' | 'phone' | 'textarea'
  | 'select' | 'checkbox'
  | 'parish'      // special: writes parish_id (+ parish_other free text)
  | 'address';    // special: writes mailing_address

export interface ParticipantField {
  key: string;                 // stable id, e.g. 'referral_source', 'dietary'
  label: string;               // UI label
  type: ParticipantFieldType;
  stage: ParticipantFieldStage;
  required: boolean;           // enforced only at its own stage
  options?: { value: string; label: string }[];  // for 'select'
  allowOther?: boolean;        // 'select' → adds an "Other" free-text escape
  helpText?: string;
  core?: true;                 // maps to a real column; cannot be set to 'off'
  order: number;
}

export interface CourseSettings {
  // ...existing...
  participantFields?: ParticipantField[];
}
```

### 2.2 Core vs custom fields — storage

Two classes of field, distinguished by `core`:

| Class | Examples | Stored in | Why |
|---|---|---|---|
| **Core** | name, email, hub, phone, parish, mailing address | their existing `courses_enrollments` columns (`full_name`, `email`, `phone`, `parish_id`, `parish_other`, `mailing_address`, `hub_id`) | already indexed/queried/used by emails, My Courses, hub logic |
| **Custom** | anything a course invents (dietary, diocese, t-shirt size…) | **new `courses_enrollments.custom_fields` JSONB** (`{ [key]: value }`) | no schema migration per field, ever again |

**Migration (expand/contract, per AGENTS.md):**
1. `ALTER TABLE courses_enrollments ADD COLUMN custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;`
2. Regenerate types (`npm run update-types`).
3. Ship code that reads/writes it. Nothing to contract — this is additive.

`name`, `email`, and `hub` are **always** core, always `signup`, never `off` — they're the minimum to create an enrolment + account. The builder UI hard-locks their stage.

### 2.3 RPC + paid-path threading

Custom fields must survive both the free and the paid path. Mirror the existing field plumbing (`SKILL.md §5`, §12):

- **Free path:** add `p_custom_fields jsonb DEFAULT '{}'` to `safe_create_enrollment` and write it into the insert. The enrol `POST` (`handleFreeBatch`) builds the `custom_fields` object from the schema + submission and passes it.
- **Paid path:** include `customFields` per participant inside `courses_payments.pending_data` (never the URL — `SKILL.md §11.4`). `complete_checkout_and_enroll_batch` reads it from `pending_data` and writes each enrolment's `custom_fields`. (`complete_checkout_and_enroll` single-path too if still used.)
- **Onboarding writes** (stage `onboarding`) go through a new authenticated endpoint, not the RPCs — see §4.

### 2.4 Generic submission shape

The enrol `POST` body becomes schema-driven. Today it's typed `RawParticipant` with named keys; generalise to:

```ts
type RawParticipant = {
  email: string;                       // always
  fields: Record<string, unknown>;     // keyed by ParticipantField.key
};
```

`normalizeParticipant`/`resolveParticipant` (`api/enroll/[code]/+server.ts`) iterate the course's `stage:signup` fields: validate required/length/type, split core→columns vs custom→`custom_fields`. **The existing security invariant is unchanged and must stay** (`SKILL.md §11.2`): for a registered email the *profile* is authoritative — typed values for core identity fields are ignored. Custom fields from a stranger should likewise never overwrite an existing participant's stored custom data.

---

## 3. Field types — rendering & validation

One renderer component (`<ParticipantFieldInput field={...} bind:value />`) used by **both** the signup form and the onboarding flow, so a field looks/validates identically wherever it's collected.

| Type | Renders | Writes | Validation |
|---|---|---|---|
| `text` / `textarea` | input / textarea | core col or custom | required, maxLength |
| `email` | email input | `email` (core only) | format (`isValidEmail`) |
| `phone` | tel input | `phone` | required, ≤30 chars |
| `select` | dropdown; `allowOther` adds "Other" + free text | custom (or core) | required, value ∈ options |
| `checkbox` | single checkbox / group | custom | required = must check |
| `parish` | parish picker + "other" text | `parish_id` + `parish_other` | — |
| `address` | textarea | `mailing_address` | maxLength |

The current **referral source** becomes a `select` field (`key:'referral_source'`, `allowOther:true`) whose `options` are the 7 values we hardcode today — now editable data, seeded so ACCF is unchanged. The `referralSource === 'other' ? referralOther : referralSource` collapse in `normalizeParticipant` generalises into the `allowOther` handling.

---

## 4. Post-signup onboarding flow

**Goal:** signup collects only `stage:signup` fields; `stage:onboarding` fields are collected after the account exists, prompting until complete.

- **Where:** a gate in the participant area (`/my-courses` / `courses/[slug]`). On load, if the enrolment has any `stage:onboarding` field that's `required` and missing from core columns/`custom_fields`, route to an onboarding step (e.g. `courses/[slug]/onboarding`) before the dashboard. Non-required onboarding fields can be a dismissible prompt rather than a hard gate.
- **Completion tracking:** derive from "are all required onboarding fields present?" (no extra flag needed), or store `custom_fields.__onboarded_at` if we want an explicit stamp. Prefer derived — fewer states to desync.
- **Write path:** new authenticated endpoint `POST /api/courses/[slug]/onboarding` → validates against the course's `stage:onboarding` schema → updates the caller's own enrolment (core cols + `custom_fields`). Auth via `requireCourseAccess` (`SKILL.md §`, `auth.ts`). This is the *only* place onboarding fields are written; it never touches the enrol RPCs.
- **Multi-enrolment:** a participant in several cohorts/courses onboards per course (fields are per-course). Keep it scoped by `slug`.
- **Edge case:** group signups where the payer enrols others — each enrollee completes their *own* onboarding on first login; the organiser only completes onboarding for enrolments they're a participant in.

---

## 5. "Rules" — the baked-in flow decisions to expose

"Rules" here means the **enrolment-flow decisions we hardcoded**, not a conditional-logic engine. Each becomes course/cohort/link config:

| Decision | Today | Make it |
|---|---|---|
| Hub selector on a link | only a dedicated `show_hub_selector` link shows hubs; the **Main link never does** even if the cohort has hubs (`+page.server.ts` hub block) | a per-link / per-cohort toggle in the links admin so the Main link *can* offer hubs without a separate override link |
| Billing model | two hardcoded modes (paying participant vs separate organiser) in `+page.svelte` | keep both; expose as a cohort/link option (some courses want organiser-pays only, some self-pay only) |
| Referral options | hardcoded 7-value array | the `select` field's editable `options` (§3) |
| Default session count | `8` in `ModuleModal.svelte` | per-module setting (default still 8) |
| Enrolment type / window / approval | already per-cohort (`enrollment_type`, `enrollment_opens_at/closes_at`, `requireApproval`) | **already configurable — leave as is** |
| Pricing | cohort price → link override → 0=free (`getEffectivePrice`) | **already the single source of truth — do not extend** |

Pricing and the cohort gates are explicitly **out of scope** — they already work and the model is intentionally minimal (`SKILL.md §1`). Don't reintroduce price in new places.

---

## 6. Admin form-builder UI

New **"Enrolment form"** tab under `admin/courses/[slug]/` (sibling of `settings`, `sessions`, `enrollment-links`). Model its conventions on the existing **quiz builder** (`admin/courses/[slug]/quizzes`) — the closest existing "admin authors structured fields" surface.

The tab:
- Lists `participantFields` ordered by `order`; drag to reorder.
- Per field: edit `label`, `type`, `required`, `options` (+ `allowOther`), `helpText`.
- **Stage control** — a 3-way segmented control (Signup / Onboarding / Off) per field. Core identity fields (name/email/hub) show their stage locked.
- Add field (custom → gets a `key` slug + `custom_fields` storage), delete field (warn if existing enrolments hold data for that key — soft-hide vs hard-delete, mirror the reflection-question "responses exist" confirm in `ReflectionEditor`).
- Live preview of the signup form and the onboarding form using the shared `<ParticipantFieldInput>` renderer.

Persists by writing `participantFields` back into `courses.settings` via the existing course-settings save path (`admin/courses/[slug]/settings` API + `CourseMutations`). No new table.

Conventions: tabs for indentation; `toast*` not `alert/confirm`; say **"participant"** not "student" in UI (memory).

---

## 7. Cleanup (narrowed by the CLI reality)

Small, do alongside Phase 4:
- `context-config.ts` — the `'accf@archdiocesanministries.org.au'` final fallback (lines ~113, 269, 389, 400): default to a platform-level support email or the course's branding `reply_to_email`; never a course-specific literal. It already prefers `emailBrandingConfig.reply_to_email`, so this is just the fallback.
- `stripe.ts` — `product_data.name: 'Course Enrollment'`: pass the module/course name through (the embedded-checkout helper already accepts a `description`; add a real product name).
- `ModuleModal.svelte` — session-count `8` → per-module default (keep 8 as the platform default).
- DB cleanup — drop the dead `accf_admin`/`accf_student` enum values (zero code refs) and the legacy `accf_user_imports_*` FK name if that table's being retired. Pure DB hygiene; no app code depends on them.

These are independent of the form work and can ship anytime.

---

## 8. Build phases

Each depends on the previous; ship in order.

**Phase 1 — Field schema + dynamic signup form**
- `participantFields` in `CourseSettings` (+ default + `getCourseSettings` merge).
- `custom_fields` JSONB on `courses_enrollments`; thread through `pending_data`, `safe_create_enrollment(p_custom_fields)`, `complete_checkout_and_enroll[_batch]`.
- `<ParticipantFieldInput>` renderer; `enroll/[code]/+page.svelte` renders `stage:signup` fields from schema; `+page.server.ts` returns the schema instead of the hardcoded `referralSources`.
- Generalise `normalizeParticipant`/`resolveParticipant` to schema-driven; **preserve the registered-email-is-authoritative invariant**.
- **Seed ACCF *and* CLI** with their current fields as `stage:signup` so neither course's live form changes on day one.

**Phase 2 — Post-signup onboarding** (§4)
- Onboarding route + `POST /api/courses/[slug]/onboarding`; gate `/my-courses`/`courses/[slug]` on missing required onboarding fields.
- Now courses can move fields from `signup` → `onboarding`.

**Phase 3 — Admin form-builder UI** (§6)
- The "Enrolment form" tab; persists to `courses.settings`.

**Phase 4 — Rules toggles + cleanup** (§5, §7)
- Hub-selector-on-main-link toggle, billing-model option, per-module session count; the small literal cleanups.

### Migration & rollout safety (non-negotiable)
- **Expand/contract** every schema change (add column → ship tolerant code → only later drop anything). We had a prod incident from dropping before deploying — see memory `project_course_signup_hub_selection` and `SKILL.md §5`.
- **Seed both live courses' current fields** before flipping any behaviour, so ACCF and CLI signups are byte-for-byte unchanged until an admin edits them in the new UI.
- Regenerate types after each migration; run `npm test` + `npm run validate-api` before pushing (the form POST contract changes — `validate-api` will catch frontend/backend param drift).

---

## 9. Open decisions (resolve before/within the relevant phase)

1. **Field scope** — current plan: per-course schema in `courses.settings`. Earlier option of a per-cohort override was deferred; revisit only if a real course needs two cohorts with different forms. (User leaned toward "define the data the course keeps" = course-level.)
2. **Onboarding completion** — derived (all required onboarding fields present) vs explicit `__onboarded_at` stamp. Lean derived.
3. **Custom-field deletion** — soft-hide (keep stored data) vs hard-delete. Mirror the reflection "responses exist" confirm; lean soft-hide.
4. **Field `key` immutability** — once a custom field has stored data, its `key` must be frozen (renaming orphans data). UI edits `label`, never `key`, after creation.
5. **Validation richness** — v1 = required / maxLength / type / select-membership. Regex/min-max deferred until asked.

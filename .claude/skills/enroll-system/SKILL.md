---
name: Enrolment System
description: Reference + working guide for the Arch Tools course ENROLMENT system — enrolment links, cohorts, hubs, pricing, free/paid signup flows, Stripe embedded checkout + webhook, account provisioning, smart-login/OTP, transactional emails, hub-coordinator notifications, and admin setup. Use when building, debugging, reviewing, or reasoning about anything in the enrolment / signup / checkout / payment / account-claim flow.
version: 1.0.0
author: Claude (deep-dive synthesis, 2026-06-26)
tags: [enrolment, enrollment, signup, stripe, payments, cohorts, hubs, auth, otp, emails, courses]
---

# Enrolment System

End-to-end map of how someone goes from an enrolment link to an active course participant. Stack: **SvelteKit (Svelte 5 runes) + Supabase (Postgres/Auth) + Stripe (embedded checkout) + Resend (email)**.

> **Future direction:** making the signup form + flow decisions configurable per-course from the dashboard (field schema with per-field collection stage — signup / post-signup onboarding / off — plus a post-signup onboarding flow) is fully spec'd in **[CONFIGURABLE-ENROLMENT-SPEC.md](./CONFIGURABLE-ENROLMENT-SPEC.md)**. Read it before touching the signup form, the participant field set, or anything described there as "hardcoded for ACCF."

> **Line numbers are hints** (as of 2026-06-26); files move. Anchor on file + symbol name, then grep. After schema changes run `npm run update-types`. Follow the repo conventions in `CLAUDE.md` (tabs for indentation; `toast*` not `alert/confirm`; say **"participant"** not "student" in UI).

---

## 1. Mental model

```
courses ─< courses_modules ─< courses_cohorts ─< courses_enrollment_links
                                      │  │
                                      │  └─< cohorts_hubs >─ courses_hubs   (which hubs a cohort offers)
                                      └─< courses_enrollments >─ user_profiles
                                                  │
                                              courses_payments  (1 payment → 1 or N enrollments)
```

- A **course** has **modules**; each module has **cohorts** (the actual class instance you enrol into).
- A **cohort** carries the **price**, the **enrolment window**, the **enrolment type**, and a **capacity**.
- **Enrolment links** (`/enroll/<code>`) are how the public signs up. Each cohort has exactly one canonical **Main link** plus optional **override links**.
- **Hubs** are physical/regional locations. A cohort *offers* a set of hubs via the `cohorts_hubs` join table. A **hub coordinator** is just an enrolment with `role='coordinator'` + a `hub_id`.
- An **enrolment** is created email-first (often before the auth account exists) and later **claimed** to a profile on login.

### Pricing model (single source of truth)
`getEffectivePrice()` in `src/lib/utils/enrollment-links.ts`:
- `cohort.price_cents` is the default; an enrolment **link's `price_cents` may override it**; **0 or null = free**.
- That's the whole model. The legacy `is_free` flag, per-hub price, and per-course default price were **removed** (columns dropped 2026-06-26). Don't reintroduce price in multiple places.

### Enrolment types (`courses_cohorts.enrollment_type`)
- `auto_approve` → anyone with the link is enrolled instantly (status `invited`).
- `approval_required` → link signups are created `pending`; an admin must approve before emails go out.
- `null` (admin-only) → no public self-serve; admins add people manually. (Free path defers to the course-level `requireApproval` flag when type is neither `auto_approve` nor `approval_required`.)

### Feature flags (`src/lib/types/course-settings.ts`, via `getCourseSettings`)
`enrollmentEnabled` (gates the whole enrol system + admin pages), `acceptPayments` (enables price fields/overrides + Stripe), `requireApproval` (default approval mode), `maxCapacity` (course-wide cap), `hubsEnabled`, `publicPagesEnabled`. Defaults: enrolment/payments OFF, hubs ON.

---

## 2. Data model (key columns)

- **courses_cohorts**: `price_cents`, `currency`, `enrollment_type`, `enrollment_opens_at`, `enrollment_closes_at`, `max_enrollments`, `current_session`.
- **courses_enrollment_links**: `code` (unique, 8–10 chars), `is_active`, `max_uses`/`uses_count`, `price_cents` (override), `hub_id` (single-hub lock), `show_hub_selector` (offer a dropdown of the cohort's hubs), `bypass_enrollment_window` (late access). A **Main link** = `name='Main link'` AND `hub_id=null` AND `price_cents=null` AND `bypass_enrollment_window=false` AND `show_hub_selector!=true` (`isMainLink` / `MAIN_LINK_NAME` in `src/lib/server/enrollment-main-link.ts`).
- **cohorts_hubs**: `(cohort_id, hub_id)` PK — the hubs a cohort offers. Empty = in-person only (no hub selector).
- **courses_hubs**: `id, name, location, slug, course_id`. (No price — hubs don't carry pricing.)
- **courses_enrollments**: `cohort_id` + `email` (unique per non-withdrawn), `user_profile_id` (null until claimed), `hub_id`, `role` (`student`|`coordinator`|`admin`), `status` (`pending`|`invited`|`active`|`withdrawn`), `payment_status` (`not_required`|`pending`|`paid`), `claim_token`, `enrollment_link_id`, plus participant fields `phone, parish_id, parish_other, referral_source, mailing_address`.
- **courses_payments**: `status` (`pending`|`completed`|`failed`|`abandoned`), `amount_cents`, `currency`, `stripe_checkout_session_id`, `stripe_payment_intent_id`, `stripe_customer_id`, `email`/`full_name` (payer), `discount_code`/`discount_amount_cents`, `stripe_invoice_url`, **`pending_data` (jsonb: `{participants[], billingContact, hubId}`)**, `enrollment_id` (single) or null (batch).
- **user_profiles**: `id` (= auth.users.id), `email` (unique), `full_name`, `phone`, `parish_id`, `stripe_customer_id` (unique), `modules` (text[]; `courses.participant` grants course access).
- **stripe_events**: webhook idempotency log (`stripe_event_id`).

---

## 3. The four signup flows

All start at `src/routes/enroll/[code]/+page.server.ts` (load) → `+page.svelte` (UI) → `POST src/routes/api/enroll/[code]/+server.ts`.

**Load** validates the link (active, uses), the enrolment window (unless `bypass_enrollment_window`), cohort + course capacity, computes pricing, and — only when `show_hub_selector && !hub_id` — loads the cohort's hubs from `cohorts_hubs`. Prefills the entry for a logged-in user.

**UI (3 steps):** (1) **email-first** participant entry, (2) billing contact (groups only), (3) review/confirm. On submit it POSTs `{participants[], billingContact, hubId}`.

**POST** rate-limits (10/IP/15min, 5/payer-email/hr), **resolves each participant against `user_profiles`** (see §6 — profile is authoritative), re-validates link/window/capacity, resolves the hub, rejects already-enrolled emails, then branches on `getEffectivePrice`:

### (a) Free single & (b) Free group → `handleFreeBatch`
- For each participant: RPC `safe_create_enrollment` (status `invited`, or `pending` if approval-required). 
- If **approval-required**: return `{pendingApproval:true}` — **no emails** until an admin approves.
- Else: `ensureParticipantAccount` (per person) → `sendBatchEnrollmentInvitation` (per person, incl. payer) → `notifyHubCoordinatorsOfEnrollment` (no-op if no hub).
- Payer who attends → `{successUrl: /enroll/<code>/success?enrollment_id=<id>&group=<n>}`. Non-attending organiser → `{invitationsSent:true}`.

### (c) Paid → `handlePaidBatch`
- Create/reuse Stripe customer for the payer. Insert a `courses_payments` row (status `pending`) with the **whole batch in `pending_data`** (never in the URL).
- `createEmbeddedCheckoutSession`: one line item, `quantity = N`, unit price, `description` = `"<module> — N participants — <payer>"`, rich `metadata` (incl. `batch:'true'`), `allow_promotion_codes:true`. Return `clientSecret`; the page mounts Stripe embedded checkout.
- Stripe → returns to `/enroll/<code>/success?session_id=...`. **Enrolments are created by the webhook**, not the page.

### (d) Existing-account (email-first) — overlays (a)/(c)
- UI calls `POST /api/enroll/check-email` → `{registered:boolean}` (boolean only, never PII). If registered: collapse the detail fields ("Has an account — they'll sign in").
- Server is authoritative: a registered email uses the **profile's** name/phone/parish and **ignores typed values** — a stranger can't overwrite or spoof an existing participant.

### Success page (`success/+page.server.ts` → `completeForPayer`)
Paid: verify `session.payment_status==='paid'`, read `pending_data` from the DB. Free: load the enrolment. Then `completeForPayer`: `ensureParticipantAccount`, and **only show the signed-in "order complete" view if the current session already belongs to this email** — otherwise redirect to the smart-login/OTP flow. **Never mint a session from an email alone** (see §8).

---

## 4. Key files

| Area | File |
|---|---|
| Enrol load / UI | `src/routes/enroll/[code]/+page.server.ts`, `+page.svelte` |
| Enrol POST (free/paid) | `src/routes/api/enroll/[code]/+server.ts` (`handleFreeBatch`, `handlePaidBatch`, `resolveParticipant`, `normalizeParticipant`) |
| Email-exists lookup | `src/routes/api/enroll/check-email/+server.ts` |
| Success / completion | `src/routes/enroll/[code]/success/+page.server.ts` |
| Pricing + link validity | `src/lib/utils/enrollment-links.ts` (`getEffectivePrice`, `isEnrollmentLinkValid`) |
| Accounts + emails | `src/lib/server/course-data.ts` (`CourseMutations.*`) |
| Stripe | `src/lib/server/stripe.ts` |
| Webhook | `src/routes/api/webhooks/stripe/+server.ts` |
| Main link helper | `src/lib/server/enrollment-main-link.ts` |
| Admin: links | `src/routes/admin/courses/[slug]/enrollment-links/{+page.svelte,+page.server.ts,api/+server.ts}` |
| Admin: cohorts/hubs actions | `src/routes/admin/courses/[slug]/api/+server.ts` |
| Admin: cohort UI | `src/lib/components/{CohortSettingsModal,CohortCreationWizard,CohortManager}.svelte` |
| Admin: hubs page | `src/routes/admin/courses/[slug]/hubs/{+page.svelte,+page.server.ts}` |
| Auth helpers | `src/lib/server/auth.ts` |
| Smart-login | `src/routes/login/+page.svelte`, `src/routes/api/auth/{check-email,send-otp}/+server.*`, `src/routes/login/{confirm,setup-password,callback}/*`, `src/routes/api/auth/track-login/+server.ts` |
| Course settings/flags | `src/lib/types/course-settings.ts` |

---

## 5. RPC contracts (Postgres, called via `supabaseAdmin.rpc`)

- **`safe_create_enrollment(p_cohort_id, p_user_profile_id, p_hub_id, p_enrollment_link_id, p_full_name, p_email, p_role, p_status, p_payment_status, p_payment_id, p_claim_token, p_phone, p_parish_id, p_parish_other, p_referral_source, p_mailing_address) → jsonb`** — locks the cohort row, returns `{error:'already_enrolled', enrollment_id}` or `{error:'cohort_full'}`, else inserts and `{success:true, enrollment_id}`. Increments the link's `uses_count`. Used by the **free** path.
- **`complete_checkout_and_enroll(p_stripe_session_id, p_stripe_payment_intent_id, p_stripe_customer_id, p_discount_code, p_discount_amount_cents) → jsonb`** — single paid. Idempotent (`already_completed`), tolerates the success-page race via `ON CONFLICT (cohort_id,email) DO NOTHING` + re-query.
- **`complete_checkout_and_enroll_batch(...same params...) → jsonb`** — multi paid. Reads `pending_data`, atomic capacity check, creates/reuses one enrolment per participant, points the payment at the billing contact, returns `{success:true, enrollments:[{enrollment_id,email,full_name,claim_token,is_billing_contact}]}`.
- **`handle_new_user()`** — trigger on `auth.users` INSERT. Inserts `user_profiles {id, email, full_name(fallback email), modules:[]}`. Defends against orphaned-email unique collisions by mangling a stale prior profile's email.

> Schema changes follow **AGENTS.md**. Expand/contract: add columns + ship code that ignores them, deploy, **then** drop old columns. (We had a prod incident from dropping before deploying — see memory `project_course_signup_hub_selection`.)

---

## 6. Account provisioning & the claim flow (`CourseMutations` in `course-data.ts`)

- **`ensureParticipantAccount({email, fullName})`** — if a profile exists: ensure `courses.participant` is in `modules` (idempotent) and **never overwrite name/phone**; else provision a pending auth user via `admin.generateLink({type:'invite', data:{full_name, password_setup_completed:false}})` (does NOT send Supabase's own email) and upsert the profile `{id,email,full_name,modules:['courses.participant']}`. Returns the user id.
- **`linkEnrollmentsToProfile({userId,email})`** — claims email-only enrolments (`user_profile_id IS NULL` matching email) onto the profile. Idempotent. Called inside `ensureParticipantAccount`, on every login via `/api/auth/track-login`, and from the `/courses` load (safety net). **This is why My Courses works even though enrolments are created email-first.**

---

## 7. Emails (Resend, course-branded)

Sent from `CourseMutations` via `src/lib/utils/email-service.js` (`sendEmail`, `buildVariableContext`, `buildCourseFromEmail`, `createEmailButton`) + `src/lib/email/compiler.js` (`generateEmailFromMjml`). See `UNIFIED_EMAIL_SYSTEM.md`.
- **`sendBatchEnrollmentInvitation`** → "you've been enrolled / sign in" to every enrolled participant. Button → the **smart-login URL** (below).
- **`sendPaymentReceipt`** → branded receipt + tax-invoice link to the payer (we send our own; Stripe's account-wide receipts stay OFF — shared Shopify account).
- **`notifyHubCoordinatorsOfEnrollment`** → tells the hub's coordinator(s) "X enrolled — you now have N (incl. coordinators)". No-op without a hub.
- **`notifyAdminOfEnrollment`** → internal "new enrolment" alert to the course support inbox (`email_branding_config.reply_to_email`, falling back to `platform_settings.reply_to_email` — never hardcoded). Fires once per enrolment from both the free path (`handleFreeBatch`, *including* pending-approval signups) and the paid webhook (`handleBatchCheckoutCompleted`). `replyTo` is set to the new participant so support can reply directly. `emailType:'enrollment_admin_notification'`.
- **To send a course email:** mirror `sendBatchEnrollmentInvitation` — build branding from `course.settings`, `createEmailButton(...)`, `generateEmailFromMjml(...)`, `sendEmail({emailType:'...', ...})`. `emailType` is a free string used for logging in `platform_email_log`.

**Smart-login URL** (the only link we put in enrolment emails): `"{siteUrl}/login?course={slug}&email={enc(email)}&send=true"`. `send=true` auto-sends an OTP for a pending account. Built by `buildCourseVariablesFromEnrollment` (`context-config.ts`) when `options.smartLogin`.

---

## 8. Auth / smart-login / OTP

`/login` reads `?email&course&send`, prefills, and (with `send=true`) auto-sends an OTP. `/api/auth/check-email` decides **password vs OTP** (`password_setup_completed===true`, or an existing user with a prior sign-in → password; pending accounts → OTP). `/api/auth/send-otp` sends + dedupes via `auth_otp_tracker`. `/login/confirm` calls `verifyOtp({type, token_hash})` to mint the session, then routes by role (`courses.participant`→`/my-courses`, etc.). `/login/setup-password` for invite/recovery. `/api/auth/track-login` claims enrolments + bumps `login_count`/`status='active'` on first login.

### 🔒 Security invariant (do not break)
**Never mint a session from an email alone on a public/unauthenticated page.** Sessions are only created from a token the user themselves supplied (an emailed magiclink they clicked, or an OTP they entered) — i.e. in `/login/confirm` and `/login/callback`. The enrol success page only shows the signed-in view when the **current** session already owns the email; everyone else is redirected to OTP. (This fixed an account-takeover — see memory `feedback-no-auto-signin-by-email`.) `admin.generateLink({type:'invite'|'magiclink'})` is fine: invite just provisions a user; magiclink is emailed to the owner.

---

## 9. Stripe (`stripe.ts` + webhook)

- **Mode switching:** one flag `STRIPE_MODE` (`'live'` is opt-in; anything else = test). Keys are mode-suffixed: `STRIPE_SECRET_KEY_{TEST,LIVE}`, `PUBLIC_STRIPE_PUBLISHABLE_KEY_{TEST,LIVE}`, `STRIPE_WEBHOOK_SECRET_{TEST,LIVE}` (falls back to unsuffixed). `getStripeMode/resolveStripeKey/getStripe{Secret,Publishable,Webhook}Key`. `isStripeMockMode()` is dev-only (ignored in prod). API pinned to `2026-06-24.dahlia`.
- **Checkout:** `createEmbeddedCheckoutSession` (the one in use) sets `payment_intent_data.description`+`metadata`, `invoice_creation`, 30-min expiry, `allow_promotion_codes`. `createCheckoutSession` (redirect) is **dead** — don't wire new things to it.
- **Webhook** `POST /api/webhooks/stripe`: verifies signature with `getStripeWebhookSecret()`, **idempotency via `stripe_events`** (record before processing, 200 on dup), handles `checkout.session.completed` (→ `complete_checkout_and_enroll` or `_batch` by `metadata.batch`) and `checkout.session.expired` (→ mark `abandoned`). Captures discount + invoice URL server-side. Fires `ensureParticipantAccount` → `sendBatchEnrollmentInvitation` (all) → `notifyHubCoordinatorsOfEnrollment` → `notifyAdminOfEnrollment` (support inbox) → `sendPaymentReceipt` (payer).

### Go-live (config, not code)
1. Stripe (Live): get `pk_live`/`sk_live`; add a webhook at `https://<prod-domain>/api/webhooks/stripe` subscribed to **`checkout.session.completed` + `checkout.session.expired`**; copy its signing secret. Keep account-wide "Successful payments"/"Refunds" customer emails **OFF**.
2. Vercel (Production): set the three `*_LIVE` vars, confirm `PUBLIC_SITE_URL`, then set **`STRIPE_MODE=live`** and **redeploy** (env applies on new deploys only). Keep Supabase **Email OTP enabled**. Verify: enrol page serves `pk_live_…`; do a real low-value enrolment → webhook 200 → enrolment created → receipt → OTP → refund.

---

## 10. Admin setup (how an admin runs it)

1. **Hubs** (optional): `admin/courses/[slug]/hubs` → create hubs; assign a coordinator (`assign_hub_coordinator` sets `role='coordinator'`, `hub_id`).
2. **Cohort**: CohortCreationWizard → name/module/dates, enrolment type, window, max, price (if `acceptPayments`). Then CohortSettingsModal → **Hubs** section ticks which hubs the cohort offers (`update_cohort_hubs` → `cohorts_hubs`).
3. **Links**: `enrollment-links` page. The **Main link** is auto-ensured (`ensureMainLink`). Add **override links** for: a **hub link** ("Show a hub dropdown" → `show_hub_selector`, usually + a discounted price override), a single-hub lock (`hub_id`), a **scholarship** (`price_cents=0`), or **late access** (`bypass_enrollment_window`). Actions in `enrollment-links/api/+server.ts`: `create`, `toggle`, `ensure_main_link`, `DELETE`.
4. Relevant course-API actions (`admin/courses/[slug]/api/+server.ts`): `create_cohort`, `update_cohort`, `update_cohort_enrollment`, `update_cohort_hubs`, `archive/unarchive/delete/duplicate_cohort`, `create/update/delete_hub`, `assign/remove_hub_coordinator`, `update_enrollment`, `delete/bulk_delete_enrollments`, `advance_students`, `upload_csv`, `send_welcome_emails`.

**Hub discount pattern:** hubs carry no price; a discounted hub rate = a hub link (`show_hub_selector=true`) with a `price_cents` override. One such link per discount tier.

---

## 11. Security invariants & gotchas (must-keep)

1. **No session from email alone** on public pages — OTP/login only (§8).
2. **Existing profile is authoritative** in `resolveParticipant` — typed values ignored for a registered email; never overwrite a profile.
3. **`check-email` returns a boolean only** — never PII; rate-limited (enumeration is already exposed via the login flow, so keep responses uniform).
4. **Batch data lives in `courses_payments.pending_data`**, never the URL; the success page reads it from the DB.
5. **Webhook idempotency** via `stripe_events`; RPCs tolerate the webhook↔success-page race with `ON CONFLICT DO NOTHING` + re-query.
6. **Rate limits** on enrol POST (10/IP/15m, 5/payer/hr) and check-email (30/IP/min).
7. **Stripe account-wide receipt/refund emails OFF** (shared Shopify account); **Supabase Email OTP must stay ON**.
8. Conventions: tabs; `toast*` not `alert/confirm`; "participant" not "student" in UI; regenerate types after schema changes; expand/contract migrations (drop columns only after the new code is live).

---

## 12. Common tasks

- **Add a participant field:** form state + entry in `+page.svelte`; `RawParticipant`/`Participant` + `normalizeParticipant`/`resolveParticipant` in the enrol POST; add `p_*` to `safe_create_enrollment` (migration) and pass it; thread into `pending_data` for the paid path + `complete_checkout_and_enroll_batch`. Regenerate types.
- **Add a transactional enrol email:** new `CourseMutations.sendX` mirroring `sendBatchEnrollmentInvitation`; call it from `handleFreeBatch` and the webhook batch handler.
- **New link variant:** add a column to `courses_enrollment_links` + the create form/api + read it in the enrol load/POST; update `isMainLink` if it should exclude the new variant.
- **Debugging "enrolled but not in My Courses":** the enrolment's `user_profile_id` is null and wasn't claimed — check `linkEnrollmentsToProfile` is firing (track-login / ensureParticipantAccount / `/courses` load).
- **Debugging a paid enrolment that didn't create rows:** check the **live webhook** exists + returns 200 in Stripe, and `stripe_events`/`courses_payments.status`. Enrolments are created by the webhook, not the success page.

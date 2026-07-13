-- Append-only log of failed / blocked Stripe checkout attempts for course enrolments.
--
-- A declined card or a Radar-blocked payment never reaches checkout.session.completed,
-- so it previously left no trace in our system (only the Stripe Dashboard). This table
-- captures every failed PaymentIntent attempt that carries our enrolment metadata, so
-- staff can see who tried to pay but couldn't and follow up. It is deliberately
-- orthogonal to courses_payments: we never overwrite the pending->completed/abandoned
-- lifecycle of that row, because a failed attempt can still succeed on retry within the
-- same 30-minute checkout session.
create table if not exists public.courses_payment_failures (
	id uuid primary key default gen_random_uuid(),
	created_at timestamptz not null default now(),

	-- What they were trying to enrol in (from PaymentIntent metadata).
	cohort_id uuid references public.courses_cohorts (id) on delete set null,
	course_id uuid references public.courses (id) on delete set null,
	enrollment_link_id uuid references public.courses_enrollment_links (id) on delete set null,
	hub_id uuid references public.courses_hubs (id) on delete set null,

	-- Who (the payer).
	email text,
	full_name text,

	-- Amount attempted.
	amount_cents integer,
	currency text,

	-- Stripe references.
	stripe_payment_intent_id text,
	stripe_charge_id text,

	-- Failure detail (charge.outcome + last_payment_error).
	failure_code text,        -- e.g. card_declined, incorrect_cvc, expired_card
	decline_code text,        -- e.g. generic_decline, insufficient_funds
	network_status text,      -- e.g. declined_by_network, not_sent_to_network
	risk_level text,          -- normal | elevated | highest
	outcome_type text,        -- issuer_declined | blocked | invalid | ...
	seller_message text,      -- human-readable Stripe explanation
	reason_category text,     -- derived bucket: bank_declined | fraud_blocked | card_error | other

	-- Card hints (no PAN — last4/brand/country only).
	card_brand text,
	card_last4 text,
	card_country text,

	-- Denormalised snapshots so the log stays readable even if the cohort/course is renamed or deleted.
	course_name text,
	module_name text,
	cohort_name text,

	-- Whether we've already emailed the support inbox about this attempt (throttle: one alert per PaymentIntent).
	notified boolean not null default false,

	-- Raw outcome / last_payment_error for debugging.
	raw jsonb
);

comment on table public.courses_payment_failures is
	'Append-only log of failed/blocked Stripe checkout attempts for course enrolments (declined cards, Radar blocks). Written by the Stripe webhook on payment_intent.payment_failed.';

create index if not exists courses_payment_failures_course_created_idx
	on public.courses_payment_failures (course_id, created_at desc);
create index if not exists courses_payment_failures_cohort_idx
	on public.courses_payment_failures (cohort_id);
create index if not exists courses_payment_failures_pi_idx
	on public.courses_payment_failures (stripe_payment_intent_id);
create index if not exists courses_payment_failures_email_idx
	on public.courses_payment_failures (email);

-- Service-role-only table (accessed exclusively via supabaseAdmin, which bypasses RLS).
-- RLS enabled with no policies => anon/authenticated clients are denied all access.
alter table public.courses_payment_failures enable row level security;

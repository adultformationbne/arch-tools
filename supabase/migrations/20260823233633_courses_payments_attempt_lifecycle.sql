-- Payments are an ATTEMPT log (one row per checkout session created), not a
-- payment ledger. Two changes make that legible:
--
-- 1. Store what Stripe actually told us ('expired'), not our inference
--    ('abandoned'). Stripe only ever says the checkout session expired; whether
--    the person truly gave up is derived, and it was wrong ~2/3 of the time.
-- 2. Record supersession: when a later checkout succeeds for the same person +
--    cohort, every earlier stalled attempt points at the winning payment.

alter table courses_payments
	add column if not exists superseded_by uuid references courses_payments(id) on delete set null;

comment on column courses_payments.superseded_by is
	'Winning payment for this attempt. Set when a later checkout completed for the same person + cohort, meaning this expired/pending row was a retry, not an abandonment.';

-- 'abandoned' -> 'expired'. The CHECK still allows 'abandoned' so an in-flight
-- checkout.session.expired webhook cannot 500 in the window between this
-- migration and the app deploy; nothing writes it after that deploy.
alter table courses_payments drop constraint if exists courses_payments_status_check;

update courses_payments set status = 'expired' where status = 'abandoned';

alter table courses_payments add constraint courses_payments_status_check
	check (status = any (array[
		'pending', 'processing', 'completed', 'failed', 'refunded',
		'expired',
		'abandoned'  -- legacy alias for 'expired'; retained for deploy-window safety
	]));

-- Supports the "did this person pay for this cohort?" supersession lookup.
create index if not exists idx_courses_payments_cohort_email
	on courses_payments (cohort_id, lower(email));

create index if not exists idx_courses_payments_superseded_by
	on courses_payments (superseded_by) where superseded_by is not null;

-- Backfill: point each stalled attempt at the earliest later success by the
-- same payer in the same cohort.
update courses_payments a
set superseded_by = (
	select c.id
	from courses_payments c
	where c.status = 'completed'
		and c.cohort_id = a.cohort_id
		and lower(c.email) = lower(a.email)
		and c.created_at >= a.created_at
		and c.id <> a.id
	order by c.created_at asc
	limit 1
)
where a.status in ('pending', 'expired')
	and a.superseded_by is null;

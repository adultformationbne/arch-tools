import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';

/**
 * Course-wide billing view. Auth is enforced by the admin layout
 * (requireCourseAdmin). Only available when the course accepts payments.
 *
 * courses_payments is an ATTEMPT log — a row is written every time someone opens
 * checkout — so rendering it one-row-per-record shows retries as separate
 * "abandoned" payments. This loader collapses it into one entry per
 * registration and splits the result in two:
 *
 *   entries      - the actual billing ledger
 *                  paid        : money landed (retries folded underneath)
 *                  in_progress : checkout open, Stripe session not yet expired
 *                  failed      : card declined or blocked
 *
 *   notCompleted - people who opened checkout, never finished, and never got
 *                  enrolled by any other route. Mostly someone filling in a form
 *                  to see the price and leaving. They stay on file, but out of
 *                  the ledger — the page tucks them behind a collapsed drawer so
 *                  they don't muddy the real numbers.
 *
 * An attempt whose person ended up enrolled anyway is dropped from the view
 * entirely: nothing about it is outstanding.
 *
 * Nothing here is deleted: every attempt remains in courses_payments as the
 * reconciliation trail against Stripe.
 */

/** Stripe checkout sessions are created with a 30-minute expiry. */
const CHECKOUT_WINDOW_MS = 30 * 60 * 1000;

const lower = (value: string | null | undefined) => (value || '').trim().toLowerCase();

/** Every email a payment could enrol: the payer plus any batch participants. */
function emailsForPayment(payment: any): string[] {
	const emails = [lower(payment.email)];
	const participants = payment.pending_data?.participants;
	if (Array.isArray(participants)) {
		for (const participant of participants) {
			const email = lower(participant?.email);
			if (email) emails.push(email);
		}
	}
	return emails.filter(Boolean);
}

export const load: PageServerLoad = async (event) => {
	const layoutData = await event.parent();
	const courseInfo = layoutData?.courseInfo;
	const courseFeatures = layoutData?.courseFeatures || {};

	if (!courseInfo) {
		throw error(404, 'Course not found');
	}

	if (courseFeatures.acceptPayments === false) {
		throw redirect(302, `/admin/courses/${event.params.slug}`);
	}

	const { data: rows } = await supabaseAdmin
		.from('courses_payments')
		.select(`
			id, created_at, paid_at, email, full_name, amount_cents, currency, status,
			discount_code, discount_amount_cents, stripe_invoice_url, stripe_payment_intent_id,
			superseded_by, cohort_id, pending_data,
			cohort:courses_cohorts!inner (
				name,
				module:courses_modules!inner (
					name,
					course:courses!inner ( slug )
				)
			)
		`)
		.eq('cohort.module.course.slug', event.params.slug)
		.order('created_at', { ascending: false })
		.limit(500);

	const payments = (rows || []) as any[];

	// Retries that a later payment absorbed. They stay in the data as an audit
	// trail but never get their own row — they hang off the payment that won.
	const attemptsByWinner = new Map<string, any[]>();
	const primary: any[] = [];
	for (const payment of payments) {
		if (payment.superseded_by) {
			const list = attemptsByWinner.get(payment.superseded_by) || [];
			list.push(payment);
			attemptsByWinner.set(payment.superseded_by, list);
		} else {
			primary.push(payment);
		}
	}
	const retriesAbsorbed = payments.length - primary.length;

	const now = Date.now();
	const isSessionStillOpen = (payment: any) =>
		payment.status === 'pending' &&
		now - new Date(payment.created_at).getTime() < CHECKOUT_WINDOW_MS;

	// Unresolved attempts by the same payer for the same cohort are one problem,
	// not several — collapse them so a person who tried three times appears once.
	const entries: any[] = [];
	const stalledGroups = new Map<string, any>();

	for (const payment of primary) {
		if (payment.status === 'completed') {
			const attempts = attemptsByWinner.get(payment.id) || [];
			entries.push({
				key: payment.id,
				outcome: 'paid',
				payment,
				attempts,
				attemptCount: attempts.length + 1,
				sortAt: payment.paid_at || payment.created_at
			});
			continue;
		}

		if (payment.status === 'failed' || payment.status === 'refunded') {
			entries.push({
				key: payment.id,
				outcome: payment.status,
				payment,
				attempts: [],
				attemptCount: 1,
				sortAt: payment.created_at
			});
			continue;
		}

		// pending / expired — group by payer + cohort.
		const key = `${payment.cohort_id}|${lower(payment.email)}`;
		const group = stalledGroups.get(key);
		if (group) {
			group.attempts.push(payment);
			group.attemptCount += 1;
			group.anyOpen = group.anyOpen || isSessionStillOpen(payment);
		} else {
			stalledGroups.set(key, {
				key,
				outcome: 'not_completed',
				payment, // most recent attempt (rows arrive newest-first)
				attempts: [],
				attemptCount: 1,
				anyOpen: isSessionStillOpen(payment),
				sortAt: payment.created_at
			});
		}
	}

	// Cross-check enrolment before filing anyone away as "not completed": they may
	// have been comped, imported, or added by hand after bailing out of checkout,
	// in which case there is nothing incomplete about them. Match on the batch
	// participants too — on a group registration the billing contact is often an
	// organiser who never attends.
	const stalled = [...stalledGroups.values()];
	const stalledCohortIds = [...new Set(stalled.map((g) => g.payment.cohort_id))];

	if (stalledCohortIds.length > 0) {
		const { data: enrollmentRows } = await supabaseAdmin
			.from('courses_enrollments')
			.select('cohort_id, email, user_profile:user_profiles ( email )')
			.in('cohort_id', stalledCohortIds);

		const enrolled = new Set<string>();
		for (const row of (enrollmentRows || []) as any[]) {
			for (const email of [lower(row.email), lower(row.user_profile?.email)]) {
				if (email) enrolled.add(`${row.cohort_id}|${email}`);
			}
		}

		for (const group of stalled) {
			const cohortId = group.payment.cohort_id;
			const candidates = [group.payment, ...group.attempts].flatMap(emailsForPayment);
			const isEnrolled = candidates.some((email) => enrolled.has(`${cohortId}|${email}`));

			if (group.anyOpen) group.outcome = 'in_progress';
			else if (isEnrolled) group.outcome = 'enrolled';
			else group.outcome = 'not_completed';
		}
	}

	// An open checkout is live billing activity, so it belongs in the ledger.
	// Someone who never paid but is enrolled anyway (comped, imported, added by
	// hand) is a settled case with nothing outstanding — they get no row at all.
	// What's left is the drawer: opened checkout, never finished.
	entries.push(...stalled.filter((g) => g.outcome === 'in_progress'));
	const notCompleted = stalled.filter((g) => g.outcome === 'not_completed');

	const byNewest = (a: any, b: any) =>
		new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime();
	entries.sort(byNewest);
	notCompleted.sort(byNewest);

	const paid = entries.filter((e) => e.outcome === 'paid');
	const summary = {
		currency: (payments[0]?.currency as string) || 'AUD',
		totalCents: paid.reduce((sum, e) => sum + (e.payment.amount_cents || 0), 0),
		paid: paid.length,
		inProgress: entries.filter((e) => e.outcome === 'in_progress').length,
		failed: entries.filter((e) => e.outcome === 'failed').length,
		notCompleted: notCompleted.length,
		retriesAbsorbed,
		attemptTotal: payments.length
	};

	return { entries, notCompleted, summary, truncated: payments.length >= 500 };
};

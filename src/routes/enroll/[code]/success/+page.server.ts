import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { getCheckoutSession } from '$lib/server/stripe';
import { CourseMutations } from '$lib/server/course-data';

/**
 * Build the smart-login URL used as a fallback when programmatic sign-in fails.
 */
function smartLoginUrl(origin: string, slug: string, email: string): string {
	return slug
		? `${origin}/login?course=${slug}&email=${encodeURIComponent(email)}&send=true`
		: `${origin}/login?email=${encodeURIComponent(email)}&send=true`;
}

export const load: PageServerLoad = async ({ params, url, locals }) => {
	const { code } = params;
	const sessionId = url.searchParams.get('session_id');
	const enrollmentId = url.searchParams.get('enrollment_id');
	const groupParam = parseInt(url.searchParams.get('group') || '', 10);

	// Get enrollment link info for branding
	const { data: link } = await supabaseAdmin
		.from('courses_enrollment_links')
		.select(
			`
			cohort:courses_cohorts(
				name,
				module:courses_modules(
					name,
					course:courses(
						name,
						slug,
						settings
					)
				)
			)
		`
		)
		.eq('code', code)
		.single();

	const course = link?.cohort?.module?.course;
	const module = link?.cohort?.module;
	const cohort = link?.cohort;

	if (!course) {
		throw error(404, 'Course not found');
	}

	const courseInfo = {
		name: course.name,
		slug: course.slug,
		settings: course.settings
	};

	const base = {
		course: courseInfo,
		module: { name: module?.name },
		cohort: { name: cohort?.name }
	};

	// Handle paid enrollment (from Stripe)
	if (sessionId) {
		// Verify the Stripe session
		const session = await getCheckoutSession(sessionId);

		if (session.payment_status !== 'paid') {
			throw redirect(302, `/enroll/${code}?error=payment_incomplete`);
		}

		// Get payment record with pending data from DB (not from URL)
		const { data: payment } = await supabaseAdmin
			.from('courses_payments')
			.select('id, pending_data, email, full_name, enrollment_id, stripe_invoice_url')
			.eq('stripe_checkout_session_id', sessionId)
			.single();

		if (!payment) {
			throw error(404, 'Payment record not found. Please contact support.');
		}

		// Capture the Stripe tax-invoice URL for the participant's billing list
		const invoice = session.invoice as { hosted_invoice_url?: string | null } | null;
		if (invoice?.hosted_invoice_url && !payment.stripe_invoice_url) {
			await supabaseAdmin
				.from('courses_payments')
				.update({ stripe_invoice_url: invoice.hosted_invoice_url })
				.eq('id', payment.id);
		}
		const invoiceUrl = payment.stripe_invoice_url || invoice?.hosted_invoice_url || null;

		const pendingData = payment.pending_data || {};

		// Multi-person (batch) checkout
		if (Array.isArray(pendingData.participants)) {
			const billing = pendingData.billingContact || {};
			const billingIsParticipant =
				billing.participantIndex !== null && billing.participantIndex !== undefined;
			const groupSize = pendingData.participants.length;

			// Non-attending organiser paid for the group: there's no attending payer
			// to sign in. Show a confirmation; invitees received smart-login emails.
			if (!billingIsParticipant) {
				return {
					...base,
					type: 'paid' as const,
					organizerConfirmation: true,
					orderComplete: false,
					invitedCount: groupSize,
					invoiceUrl,
					email: billing.email || payment.email
				};
			}

			// The billing contact attends: sign them in and show the order-complete page.
			const payer = pendingData.participants[billing.participantIndex] || {};
			const payerEmail = (payer.email || billing.email || payment.email || '').toLowerCase();
			const payerName = payer.fullName || payment.full_name || payerEmail.split('@')[0];

			return await completeForPayer({
				locals,
				origin: url.origin,
				base,
				slug: course.slug,
				email: payerEmail,
				name: payerName,
				type: 'paid',
				invitedCount: Math.max(groupSize - 1, 0),
				invoiceUrl
			});
		}

		// Single-person paid checkout
		const payerEmail = (pendingData.email || payment.email || '').toLowerCase();
		const payerName = pendingData.fullName || payment.full_name || payerEmail.split('@')[0];

		return await completeForPayer({
			locals,
			origin: url.origin,
			base,
			slug: course.slug,
			email: payerEmail,
			name: payerName,
			type: 'paid',
			invitedCount: 0,
			invoiceUrl
		});
	}

	// Handle invited / free enrollment (the billing participant of a free group)
	if (enrollmentId) {
		const { data: enrollment } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id, email, full_name, status')
			.eq('id', enrollmentId)
			.single();

		if (!enrollment) {
			throw error(404, 'Enrollment not found');
		}

		const payerEmail = (enrollment.email || '').toLowerCase();
		const payerName = enrollment.full_name || payerEmail.split('@')[0];
		const invitedCount = Number.isFinite(groupParam) && groupParam > 1 ? groupParam - 1 : 0;

		return await completeForPayer({
			locals,
			origin: url.origin,
			base,
			slug: course.slug,
			email: payerEmail,
			name: payerName,
			type: 'free',
			invitedCount,
			invoiceUrl: null
		});
	}

	throw error(400, 'Invalid success page access');
};

/**
 * Ensure the payer's account exists, then either show the order-complete page
 * (only if the visitor is ALREADY signed in as this email) or route them to the
 * smart-login / OTP flow to verify ownership of the email before granting access.
 * We never mint a session from an email alone here — see the SECURITY note below.
 */
async function completeForPayer(params: {
	locals: App.Locals;
	origin: string;
	base: { course: any; module: { name: any }; cohort: { name: any } };
	slug: string;
	email: string;
	name: string;
	type: 'paid' | 'free';
	invitedCount: number;
	invoiceUrl: string | null;
}) {
	const { locals, origin, base, slug, email, name, type, invitedCount, invoiceUrl } = params;

	if (!email) {
		throw error(400, 'Could not determine the participant for this enrollment.');
	}

	await CourseMutations.ensureParticipantAccount({ email, fullName: name });

	// SECURITY: never auto-sign-in by email on this public, unauthenticated page.
	// Doing so would let anyone who types another person's email take over that
	// account with no email verification. Only show the signed-in "order complete"
	// view if the CURRENT session already belongs to this email (ownership already
	// proven). Everyone else is routed to the smart-login / OTP flow to verify the
	// email before they get any account access.
	const session = await locals.safeGetSession?.();
	const alreadyThisUser =
		!!session?.user?.email && session.user.email.toLowerCase() === email;

	if (!alreadyThisUser) {
		throw redirect(303, smartLoginUrl(origin, slug, email));
	}

	return {
		...base,
		type,
		organizerConfirmation: false,
		orderComplete: true,
		email,
		courseSlug: slug,
		invitedCount,
		invoiceUrl
	};
}

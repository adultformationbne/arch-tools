import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { getCheckoutSession } from '$lib/server/stripe';
import { CourseMutations } from '$lib/server/course-data';
import { autoSignInByEmail } from '$lib/server/auto-signin';

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
			.select('id, pending_data, email, full_name, enrollment_id')
			.eq('stripe_checkout_session_id', sessionId)
			.single();

		if (!payment) {
			throw error(404, 'Payment record not found. Please contact support.');
		}

		// Capture the Stripe tax-invoice URL for the participant's billing list
		const invoice = session.invoice as { hosted_invoice_url?: string | null } | null;
		if (invoice?.hosted_invoice_url) {
			await supabaseAdmin
				.from('courses_payments')
				.update({ stripe_invoice_url: invoice.hosted_invoice_url })
				.eq('id', payment.id);
		}

		const pendingData = payment.pending_data || {};

		// Multi-person (batch) checkout
		if (Array.isArray(pendingData.participants)) {
			const billing = pendingData.billingContact || {};
			const billingIsParticipant =
				billing.participantIndex !== null && billing.participantIndex !== undefined;

			// Non-attending organiser paid for the group: there's no attending payer
			// to sign in. Show a confirmation; invitees received smart-login emails.
			if (!billingIsParticipant) {
				return {
					type: 'paid' as const,
					organizerConfirmation: true,
					participantCount: pendingData.participants.length,
					email: billing.email || payment.email,
					course: courseInfo,
					module: { name: module?.name },
					cohort: { name: cohort?.name }
				};
			}

			// The billing contact attends: sign them in and send them to their course.
			const payer = pendingData.participants[billing.participantIndex] || {};
			const payerEmail = (payer.email || billing.email || payment.email || '').toLowerCase();
			const payerName = payer.fullName || payment.full_name || payerEmail.split('@')[0];

			await signInPayerAndRedirect(locals, url.origin, course.slug, payerEmail, payerName);

			// Unreachable (signInPayerAndRedirect always throws a redirect), but keep a
			// graceful fallback object so the page can render an interstitial just in case.
			return {
				type: 'paid' as const,
				organizerConfirmation: false,
				email: payerEmail,
				course: courseInfo,
				module: { name: module?.name },
				cohort: { name: cohort?.name }
			};
		}

		// Single-person paid checkout
		const payerEmail = (pendingData.email || payment.email || '').toLowerCase();
		const payerName = pendingData.fullName || payment.full_name || payerEmail.split('@')[0];

		await signInPayerAndRedirect(locals, url.origin, course.slug, payerEmail, payerName);

		return {
			type: 'paid' as const,
			organizerConfirmation: false,
			email: payerEmail,
			course: courseInfo,
			module: { name: module?.name },
			cohort: { name: cohort?.name }
		};
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

		await signInPayerAndRedirect(locals, url.origin, course.slug, payerEmail, payerName);

		return {
			type: 'free' as const,
			organizerConfirmation: false,
			email: payerEmail,
			course: courseInfo,
			module: { name: module?.name },
			cohort: { name: cohort?.name }
		};
	}

	throw error(400, 'Invalid success page access');
};

/**
 * Ensure the payer's account exists, auto-sign them in, and redirect into their
 * course dashboard. Falls back to the smart-login URL if sign-in can't be
 * established. Always throws a redirect.
 */
async function signInPayerAndRedirect(
	locals: App.Locals,
	origin: string,
	courseSlug: string,
	email: string,
	fullName: string
): Promise<never> {
	if (!email) {
		throw error(400, 'Could not determine the participant for this enrollment.');
	}

	await CourseMutations.ensureParticipantAccount({ email, fullName });

	const signedIn = await autoSignInByEmail(locals.supabase, email);

	if (signedIn) {
		throw redirect(303, `/courses/${courseSlug}`);
	}

	// Fallback: route them through the normal smart-login flow.
	throw redirect(303, smartLoginUrl(origin, courseSlug, email));
}

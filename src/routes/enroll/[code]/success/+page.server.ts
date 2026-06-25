import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { getCheckoutSession } from '$lib/server/stripe';
import { CourseMutations } from '$lib/server/course-data';
import { PUBLIC_SITE_URL } from '$env/static/public';

export const load: PageServerLoad = async ({ params, url }) => {
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

		const courseInfo = {
			name: course.name,
			slug: course.slug,
			settings: course.settings
		};

		// Multi-person (batch) checkout
		if (Array.isArray(pendingData.participants)) {
			const billing = pendingData.billingContact || {};
			const billingIsParticipant =
				billing.participantIndex !== null && billing.participantIndex !== undefined;

			return {
				type: 'paid',
				isBatch: true,
				billingIsParticipant,
				// Organiser (non-attending payer) -> show a confirmation, not a password form
				organizerConfirmation: !billingIsParticipant,
				participantCount: pendingData.participants.length,
				sessionId,
				paymentId: payment.id,
				enrollmentId: payment.enrollment_id, // billing contact's enrollment (may lag webhook)
				email: billing.email || payment.email,
				course: courseInfo,
				module: { name: module?.name },
				cohort: { name: cohort?.name }
			};
		}

		return {
			type: 'paid',
			isBatch: false,
			billingIsParticipant: true,
			organizerConfirmation: false,
			sessionId,
			paymentId: payment.id,
			enrollmentId: payment.enrollment_id, // may already exist from webhook
			pendingData,
			email: pendingData.email || payment.email,
			course: courseInfo,
			module: {
				name: module?.name
			},
			cohort: {
				name: cohort?.name
			}
		};
	}

	// Handle invited / free enrollment (claim-link flow)
	if (enrollmentId) {
		const token = url.searchParams.get('token');
		const { data: enrollment } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id, email, full_name, status, claim_token')
			.eq('id', enrollmentId)
			.single();

		if (!enrollment) {
			throw error(404, 'Enrollment not found');
		}

		// If the enrollment is gated by a claim token, the link must carry the right one.
		if (enrollment.claim_token && enrollment.claim_token !== token) {
			throw error(403, 'This account-setup link is invalid or has expired.');
		}

		return {
			type: 'free',
			isBatch: false,
			billingIsParticipant: true,
			organizerConfirmation: false,
			enrollmentId,
			email: enrollment.email,
			fullName: enrollment.full_name,
			course: {
				name: course.name,
				slug: course.slug,
				settings: course.settings
			},
			module: {
				name: module?.name
			},
			cohort: {
				name: cohort?.name
			}
		};
	}

	throw error(400, 'Invalid success page access');
};

export const actions: Actions = {
	default: async ({ request, params, url, locals }) => {
		const formData = await request.formData();
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;
		const sessionId = url.searchParams.get('session_id');
		const enrollmentId = url.searchParams.get('enrollment_id');
		const token = url.searchParams.get('token');

		// Validate passwords
		if (!password || password.length < 8) {
			return { error: 'Password must be at least 8 characters' };
		}

		if (password !== confirmPassword) {
			return { error: 'Passwords do not match' };
		}

		let email: string;
		let fullName: string;
		let cohortId: string;
		let hubId: string | null = null;
		let paymentId: string | null = null;
		let phone: string | null = null;
		let parishId: string | null = null;
		let parishOther: string | null = null;
		let referralSource: string | null = null;
		let webhookCreatedEnrollmentId: string | null = null;

		// Get enrollment link
		const { data: link } = await supabaseAdmin
			.from('courses_enrollment_links')
			.select('id, hub_id, cohort_id')
			.eq('code', params.code)
			.single();

		if (!link) {
			return { error: 'Enrollment link not found' };
		}

		cohortId = link.cohort_id;

		if (sessionId) {
			// Paid enrollment - get data from payment record (not URL)
			const { data: payment } = await supabaseAdmin
				.from('courses_payments')
				.select('id, pending_data, email, full_name, enrollment_id, cohort_id, enrollment_link_id')
				.eq('stripe_checkout_session_id', sessionId)
				.single();

			if (!payment) {
				return { error: 'Payment not found. Please contact support.' };
			}

			const pd = payment.pending_data || {};

			if (Array.isArray(pd.participants)) {
				// Multi-person checkout: only the billing-contact participant sets a
				// password here. Non-attending organisers never see this form.
				const billing = pd.billingContact || {};
				if (billing.participantIndex === null || billing.participantIndex === undefined) {
					return { error: 'No password setup is required for this payment.' };
				}
				const payer = pd.participants[billing.participantIndex];
				if (!payer) {
					return { error: 'Billing participant not found. Please contact support.' };
				}
				email = (payer.email || billing.email || payment.email).toLowerCase();
				fullName = payer.fullName || payment.full_name || email.split('@')[0];
				phone = payer.phone || null;
				parishId = payer.parishId || null;
				parishOther = payer.parishOther || null;
				referralSource = payer.referralSource || null;
				hubId = pd.hubId || null;
			} else {
				email = pd.email || payment.email;
				fullName = pd.fullName || payment.full_name || email.split('@')[0];
				phone = pd.phone || null;
				parishId = pd.parishId || null;
				parishOther = pd.parishOther || null;
				referralSource = pd.referralSource || null;
				hubId = pd.hubId || null;
			}
			paymentId = payment.id;
			webhookCreatedEnrollmentId = payment.enrollment_id || null;
		} else if (enrollmentId) {
			// Invited / free enrollment - get data from enrollment record
			const { data: enrollment } = await supabaseAdmin
				.from('courses_enrollments')
				.select('email, full_name, hub_id, claim_token')
				.eq('id', enrollmentId)
				.single();

			if (!enrollment) {
				return { error: 'Enrollment not found' };
			}

			// Gate the claim by the token embedded in the emailed link.
			if (enrollment.claim_token && enrollment.claim_token !== token) {
				return { error: 'This account-setup link is invalid or has expired.' };
			}

			email = enrollment.email;
			fullName = enrollment.full_name;
			hubId = enrollment.hub_id;
		} else {
			return { error: 'Invalid request' };
		}

		try {
			// Check if user already exists
			const { data: existingUser } = await supabaseAdmin
				.from('user_profiles')
				.select('id')
				.eq('email', email)
				.single();

			let userId: string;

			if (existingUser) {
				// User exists - update their password
				userId = existingUser.id;
				const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
					password
				});

				if (updateError) {
					console.error('Failed to update password:', updateError);
					return { error: 'Failed to set password. Please try again.' };
				}
			} else {
				// Create new auth user
				const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
					email,
					password,
					email_confirm: true, // Skip email verification - payment = verification
					user_metadata: {
						full_name: fullName,
						password_setup_completed: true
					}
				});

				if (authError) {
					console.error('Failed to create auth user:', authError);
					return { error: 'Failed to create account. Please try again.' };
				}

				userId = authUser.user.id;

				// Create user profile
				await supabaseAdmin.from('user_profiles').insert({
					id: userId,
					email,
					full_name: fullName,
					phone,
					parish_id: parishId,
					parish_other: parishOther,
					referral_source: referralSource,
					modules: ['courses.participant'],
					status: 'active'
				});
			}

			// Handle enrollment creation/linking
			if (enrollmentId) {
				// Invited / free enrollment - link user, activate, and burn the claim token
				await supabaseAdmin
					.from('courses_enrollments')
					.update({
						user_profile_id: userId,
						status: 'active',
						claim_token: null
					})
					.eq('id', enrollmentId);
			} else if (webhookCreatedEnrollmentId) {
				// Paid enrollment where webhook already created the enrollment.
				// Link the user, activate it (batch rows start as 'invited'), burn the token.
				await supabaseAdmin
					.from('courses_enrollments')
					.update({
						user_profile_id: userId,
						status: 'active',
						claim_token: null
					})
					.eq('id', webhookCreatedEnrollmentId);
			} else {
				// Paid enrollment where webhook hasn't created enrollment yet
				// Use safe_create_enrollment for atomic capacity check
				const { data: result, error: rpcError } = await supabaseAdmin.rpc(
					'safe_create_enrollment',
					{
						p_cohort_id: cohortId,
						p_user_profile_id: userId,
						p_hub_id: hubId,
						p_enrollment_link_id: link.id,
						p_full_name: fullName,
						p_email: email,
						p_role: 'student',
						p_status: 'active',
						p_payment_status: 'paid',
						p_payment_id: paymentId
					}
				);

				// The webhook may create this enrollment concurrently. safe_create_enrollment
				// returns 'already_enrolled' if it lost the existence check, but a truly
				// simultaneous insert surfaces as a unique-violation (unique_cohort_email).
				// In every case the participant HAS paid and IS enrolled — recover by
				// linking the winning row, never show them a failure.
				let resolvedEnrollmentId: string | null = null;

				if (rpcError) {
					const { data: existing } = await supabaseAdmin
						.from('courses_enrollments')
						.select('id')
						.eq('email', email)
						.eq('cohort_id', cohortId)
						.neq('status', 'withdrawn')
						.single();
					if (!existing) {
						console.error('safe_create_enrollment failed and no enrollment found:', rpcError);
						return { error: 'Failed to complete enrollment. Please contact support.' };
					}
					console.warn('safe_create_enrollment race recovered via existing enrollment:', rpcError);
					resolvedEnrollmentId = existing.id;
				} else if (result?.error === 'already_enrolled') {
					// Enrollment was created between our check and now (race with webhook)
					resolvedEnrollmentId = result.enrollment_id;
				} else {
					resolvedEnrollmentId = result?.enrollment_id ?? null;
				}

				// Link the user profile to whichever enrollment won (idempotent for the
				// freshly-created row, which already carries this user_profile_id).
				if (resolvedEnrollmentId) {
					await supabaseAdmin
						.from('courses_enrollments')
						.update({ user_profile_id: userId })
						.eq('id', resolvedEnrollmentId);

					if (paymentId) {
						await supabaseAdmin
							.from('courses_payments')
							.update({ enrollment_id: resolvedEnrollmentId })
							.eq('id', paymentId);
					}
				}
			}

			// Get course slug for redirect
			const { data: cohort } = await supabaseAdmin
				.from('courses_cohorts')
				.select('module:courses_modules(course:courses(slug))')
				.eq('id', cohortId)
				.single();

			const courseSlug = cohort?.module?.course?.slug || '';

			// Find enrollment ID for welcome email
			let welcomeEmailEnrollmentId = enrollmentId || webhookCreatedEnrollmentId;
			if (!welcomeEmailEnrollmentId) {
				const { data: newEnrollment } = await supabaseAdmin
					.from('courses_enrollments')
					.select('id')
					.eq('user_profile_id', userId)
					.eq('cohort_id', cohortId)
					.single();
				welcomeEmailEnrollmentId = newEnrollment?.id;
			}

			// Send welcome email (async, don't block redirect)
			if (welcomeEmailEnrollmentId && courseSlug) {
				CourseMutations.sendSelfEnrollmentWelcome({
					enrollmentId: welcomeEmailEnrollmentId,
					courseSlug,
					siteUrl: PUBLIC_SITE_URL || url.origin
				}).catch((err) => {
					console.error('Failed to send welcome email:', err);
				});
			}

			// Sign the participant in so they land on the course already authenticated
			const { error: signInError } = await locals.supabase.auth.signInWithPassword({ email, password });
			if (signInError) {
				console.error('Auto sign-in after enrollment failed:', signInError);
			}

			// Return success with redirect URL
			return {
				success: true,
				redirectUrl: `/my-courses/${courseSlug}`,
				userId
			};
		} catch (err) {
			console.error('Error completing enrollment:', err);
			return { error: 'An error occurred. Please try again.' };
		}
	}
};

import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { getCheckoutSession } from '$lib/server/stripe';

export const load: PageServerLoad = async ({ params, url }) => {
	const { code } = params;
	const sessionId = url.searchParams.get('session_id');
	const enrollmentId = url.searchParams.get('enrollment_id');
	const pendingDataEncoded = url.searchParams.get('data');

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

		// Parse pending enrollment data
		let pendingData = null;
		if (pendingDataEncoded) {
			try {
				pendingData = JSON.parse(Buffer.from(pendingDataEncoded, 'base64url').toString());
			} catch {
				console.error('Failed to parse pending data');
			}
		}

		return {
			type: 'paid',
			sessionId,
			pendingData,
			email: session.customer_email || pendingData?.email,
			course: {
				name: course.name,
				slug: course.slug
			},
			module: {
				name: module?.name
			},
			cohort: {
				name: cohort?.name
			}
		};
	}

	// Handle free enrollment
	if (enrollmentId) {
		const { data: enrollment } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id, email, full_name, status')
			.eq('id', enrollmentId)
			.single();

		if (!enrollment) {
			throw error(404, 'Enrollment not found');
		}

		return {
			type: 'free',
			enrollmentId,
			email: enrollment.email,
			fullName: enrollment.full_name,
			course: {
				name: course.name,
				slug: course.slug
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
	default: async ({ request, params, url }) => {
		const formData = await request.formData();
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;
		const sessionId = url.searchParams.get('session_id');
		const enrollmentId = url.searchParams.get('enrollment_id');
		const pendingDataEncoded = url.searchParams.get('data');

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
			// Paid enrollment - get data from Stripe and pending data
			const session = await getCheckoutSession(sessionId);
			email = session.customer_email || '';

			if (pendingDataEncoded) {
				try {
					const pendingData = JSON.parse(Buffer.from(pendingDataEncoded, 'base64url').toString());
					fullName = pendingData.fullName;
					phone = pendingData.phone;
					parishId = pendingData.parishId;
					parishOther = pendingData.parishOther;
					referralSource = pendingData.referralSource;
					hubId = pendingData.hubId;
					paymentId = pendingData.paymentId;
				} catch {
					return { error: 'Invalid enrollment data' };
				}
			} else {
				fullName = session.metadata?.user_name || email.split('@')[0];
				hubId = session.metadata?.hub_id || null;
			}
		} else if (enrollmentId) {
			// Free enrollment - get data from enrollment record
			const { data: enrollment } = await supabaseAdmin
				.from('courses_enrollments')
				.select('email, full_name, hub_id')
				.eq('id', enrollmentId)
				.single();

			if (!enrollment) {
				return { error: 'Enrollment not found' };
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

			// Update or create enrollment
			if (enrollmentId) {
				// Update free enrollment
				await supabaseAdmin
					.from('courses_enrollments')
					.update({
						user_profile_id: userId,
						status: 'active'
					})
					.eq('id', enrollmentId);
			} else {
				// Create paid enrollment
				const { data: enrollment } = await supabaseAdmin
					.from('courses_enrollments')
					.insert({
						cohort_id: cohortId,
						user_profile_id: userId,
						hub_id: hubId,
						enrollment_link_id: link.id,
						full_name: fullName,
						email,
						role: 'student',
						status: 'active',
						payment_status: 'paid',
						payment_id: paymentId
					})
					.select('id')
					.single();

				// Update payment record with enrollment ID
				if (paymentId && enrollment) {
					await supabaseAdmin
						.from('courses_payments')
						.update({ enrollment_id: enrollment.id })
						.eq('id', paymentId);
				}
			}

			// Get course slug for redirect
			const { data: cohort } = await supabaseAdmin
				.from('courses_cohorts')
				.select('module:courses_modules(course:courses(slug))')
				.eq('id', cohortId)
				.single();

			const courseSlug = cohort?.module?.course?.slug || '';

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

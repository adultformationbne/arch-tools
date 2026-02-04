import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { isEnrollmentLinkValid, getEffectivePrice } from '$lib/utils/enrollment-links';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const { code } = params;
	const paymentCancelled = url.searchParams.get('cancelled') === 'true';

	// Fetch enrollment link with related data
	const { data: link, error: linkError } = await supabaseAdmin
		.from('courses_enrollment_links')
		.select(
			`
			id,
			code,
			is_active,
			expires_at,
			max_uses,
			uses_count,
			price_cents,
			name,
			hub_id,
			cohort_id,
			hub:courses_hubs(
				id,
				name,
				location,
				price_cents,
				currency
			),
			cohort:courses_cohorts(
				id,
				name,
				start_date,
				end_date,
				status,
				price_cents,
				currency,
				is_free,
				enrollment_type,
				enrollment_opens_at,
				enrollment_closes_at,
				max_enrollments,
				module:courses_modules(
					id,
					name,
					description,
					course:courses(
						id,
						name,
						slug,
						default_price_cents,
						default_currency,
						settings
					)
				)
			)
		`
		)
		.eq('code', code)
		.single();

	if (linkError || !link) {
		throw error(404, 'Enrollment link not found');
	}

	// Validate link is usable
	const linkValidation = isEnrollmentLinkValid(link);
	if (!linkValidation.valid) {
		throw error(400, linkValidation.reason || 'This enrollment link is not valid');
	}

	const cohort = link.cohort;
	const module = cohort?.module;
	const course = module?.course;

	if (!cohort || !module || !course) {
		throw error(404, 'Course information not found');
	}

	// Check enrollment window
	if (cohort.enrollment_opens_at && new Date(cohort.enrollment_opens_at) > new Date()) {
		throw error(
			400,
			`Enrollment opens on ${new Date(cohort.enrollment_opens_at).toLocaleDateString()}`
		);
	}

	if (cohort.enrollment_closes_at && new Date(cohort.enrollment_closes_at) < new Date()) {
		throw error(400, 'Enrollment for this cohort has closed');
	}

	// Check max enrollments
	if (cohort.max_enrollments) {
		const { count } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id', { count: 'exact', head: true })
			.eq('cohort_id', cohort.id)
			.neq('status', 'withdrawn');

		if (count && count >= cohort.max_enrollments) {
			throw error(400, 'This cohort is full');
		}
	}

	// Calculate effective price
	const pricing = getEffectivePrice({
		enrollmentLink: { price_cents: link.price_cents },
		hub: link.hub,
		cohort: {
			price_cents: cohort.price_cents,
			currency: cohort.currency,
			is_free: cohort.is_free || false
		},
		course: {
			default_price_cents: course.default_price_cents,
			default_currency: course.default_currency
		}
	});

	// Get parishes for dropdown
	const { data: parishes } = await supabaseAdmin
		.from('parishes')
		.select('id, name, location, diocese')
		.eq('is_active', true)
		.order('name');

	// Check if user is already logged in
	const session = await locals.safeGetSession?.();
	let existingUser = null;

	if (session?.user) {
		const { data: profile } = await supabaseAdmin
			.from('user_profiles')
			.select('id, full_name, email, phone, parish_id')
			.eq('id', session.user.id)
			.single();

		if (profile) {
			// Check if already enrolled in this cohort
			const { data: existingEnrollment } = await supabaseAdmin
				.from('courses_enrollments')
				.select('id, status')
				.eq('user_profile_id', profile.id)
				.eq('cohort_id', cohort.id)
				.neq('status', 'withdrawn')
				.single();

			if (existingEnrollment) {
				// Already enrolled - redirect to course
				throw redirect(302, `/my-courses/${course.slug}`);
			}

			existingUser = profile;
		}
	}

	// Referral source options
	const referralSources = [
		{ value: 'previous_course', label: 'Completed previous modules' },
		{ value: 'parish_priest', label: 'My Parish Priest invited me' },
		{ value: 'social_media', label: 'Social Media' },
		{ value: 'email', label: 'Email' },
		{ value: 'brochure', label: 'Brochure' },
		{ value: 'word_of_mouth', label: 'Word of mouth' },
		{ value: 'other', label: 'Other' }
	];

	return {
		enrollmentLink: {
			id: link.id,
			code: link.code,
			name: link.name,
			hubId: link.hub_id
		},
		hub: link.hub,
		cohort: {
			id: cohort.id,
			name: cohort.name,
			startDate: cohort.start_date,
			endDate: cohort.end_date,
			enrollmentType: cohort.enrollment_type
		},
		module: {
			id: module.id,
			name: module.name,
			description: module.description
		},
		course: {
			id: course.id,
			name: course.name,
			slug: course.slug,
			settings: course.settings
		},
		pricing,
		parishes: parishes || [],
		referralSources,
		existingUser,
		paymentCancelled
	};
};

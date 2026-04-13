import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { isEnrollmentLinkValid, getEffectivePrice } from '$lib/utils/enrollment-links';
import { getCourseSettings } from '$lib/types/course-settings';

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

	const cohort = Array.isArray(link.cohort) ? link.cohort[0] : link.cohort;
	const module = Array.isArray(cohort?.module) ? cohort?.module[0] : cohort?.module;
	const course = Array.isArray(module?.course) ? module?.course[0] : module?.course;

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


	// Check cohort max enrollments
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

	// Check course-wide max capacity
	const courseSettings = getCourseSettings(course.settings);
	if (courseSettings.features?.maxCapacity) {
		const { data: courseModules } = await supabaseAdmin
			.from('courses_modules')
			.select('id')
			.eq('course_id', course.id);
		const moduleIds = courseModules?.map(m => m.id) ?? [];
		const { data: courseCohorts } = await supabaseAdmin
			.from('courses_cohorts')
			.select('id')
			.in('module_id', moduleIds);
		const cohortIds = courseCohorts?.map(c => c.id) ?? [];
		const { count: courseCount } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id', { count: 'exact', head: true })
			.in('cohort_id', cohortIds)
			.neq('status', 'withdrawn');
		if (courseCount !== null && courseCount >= courseSettings.features.maxCapacity) {
			throw error(400, 'This course is currently full');
		}
	}

	// Calculate effective price
	const pricing = getEffectivePrice({
		enrollmentLink: { price_cents: link.price_cents },
		hub: Array.isArray(link.hub) ? link.hub[0] : link.hub,
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
	let existingUser: { id: string; full_name: string | null; email: string; phone: string | null; parish_id: string | null } | null = null;

	if (session?.user) {
		const { data: profile } = await supabaseAdmin
			.from('user_profiles')
			.select('id, full_name, email, phone, parish_id')
			.eq('id', session.user.id)
			.single();

		if (profile) {
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
		hub: Array.isArray(link.hub) ? link.hub[0] : link.hub,
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

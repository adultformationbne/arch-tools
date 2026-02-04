import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const courseId = parentData.courseInfo.id;

	// Get all cohorts for this course with their enrollment links
	const { data: cohorts } = await supabaseAdmin
		.from('courses_cohorts')
		.select(
			`
			id,
			name,
			status,
			start_date,
			price_cents,
			currency,
			is_free,
			enrollment_type,
			module:courses_modules!inner(
				id,
				name,
				course_id
			)
		`
		)
		.eq('module.course_id', courseId)
		.order('start_date', { ascending: false });

	// Get all enrollment links for cohorts in this course
	const cohortIds = cohorts?.map((c) => c.id) || [];

	const { data: enrollmentLinks } = await supabaseAdmin
		.from('courses_enrollment_links')
		.select(
			`
			id,
			code,
			name,
			is_active,
			expires_at,
			max_uses,
			uses_count,
			price_cents,
			cohort_id,
			hub_id,
			created_at,
			hub:courses_hubs(
				id,
				name
			)
		`
		)
		.in('cohort_id', cohortIds)
		.order('created_at', { ascending: false });

	// Get hubs for this course
	const { data: hubs } = await supabaseAdmin
		.from('courses_hubs')
		.select('id, name, location, price_cents')
		.eq('course_id', courseId)
		.order('name');

	return {
		cohorts: cohorts || [],
		enrollmentLinks: enrollmentLinks || [],
		hubs: hubs || []
	};
};

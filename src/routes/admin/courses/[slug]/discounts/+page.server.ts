import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async ({ parent }) => {
	const parentData = await parent();
	const courseId = parentData.courseInfo.id;

	// Get all discount codes for this course
	const { data: discountCodes } = await supabaseAdmin
		.from('courses_discount_codes')
		.select(
			`
			id,
			code,
			discount_type,
			discount_value,
			max_uses,
			uses_count,
			expires_at,
			is_active,
			cohort_id,
			stripe_coupon_id,
			stripe_promotion_code_id,
			created_at,
			cohort:courses_cohorts(
				id,
				name,
				module:courses_modules(name)
			)
		`
		)
		.eq('course_id', courseId)
		.order('created_at', { ascending: false });

	// Get cohorts for the dropdown
	const { data: cohorts } = await supabaseAdmin
		.from('courses_cohorts')
		.select(
			`
			id,
			name,
			module:courses_modules!inner(
				id,
				name,
				course_id
			)
		`
		)
		.eq('module.course_id', courseId)
		.order('start_date', { ascending: false });

	return {
		discountCodes: discountCodes || [],
		cohorts: cohorts || []
	};
};

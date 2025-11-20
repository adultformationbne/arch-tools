import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// ✅ OPTIMIZATION: Auth already done in layout - no need to check again!
	// Layout protects all nested admin routes

	try {
		// Get layout data (course, modules, cohorts already loaded)
		const layoutData = await event.parent();
		const courseInfo = layoutData?.courseInfo || {};
		const modules = layoutData?.modules || [];
		const cohorts = layoutData?.cohorts || [];

		const moduleIds = modules?.map(m => m.id) || [];
		const cohortIds = cohorts?.map(c => c.id) || [];

		if (cohortIds.length === 0) {
			return {
				course: courseInfo,
				users: [],
				hubs: []
			};
		}

		// Get all enrollments for this course's cohorts
		const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
			.from('courses_enrollments')
			.select(`
				*,
				user_profile:user_profile_id (
					id,
					email,
					full_name,
					modules
				),
				cohort:cohort_id (
					id,
					name,
					module:module_id (
						name
					)
				),
				hub:hub_id (
					id,
					name
				)
			`)
			.in('cohort_id', cohortIds)
			.order('created_at', { ascending: false });

		if (enrollmentsError) {
			console.error('Error fetching enrollments:', enrollmentsError);
			throw error(500, 'Failed to load users');
		}

		// Get hubs for THIS COURSE only
		const { data: hubs, error: hubsError } = await supabaseAdmin
			.from('courses_hubs')
			.select('*')
			.eq('course_id', courseInfo.id)
			.order('name');

		if (hubsError) {
			console.error('Error fetching hubs:', hubsError);
		}

		return {
			course: courseInfo,
			users: enrollments || [],
			hubs: hubs || []
		};

	} catch (err) {
		console.error('Error in users page load:', err);
		throw error(500, 'Failed to load users data');
	}
};

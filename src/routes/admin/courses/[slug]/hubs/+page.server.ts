import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// ✅ OPTIMIZATION: Auth already done in layout - no need to check again!

	try {
		// Get layout data (course, modules, cohorts already loaded)
		const layoutData = await event.parent();
		const courseInfo = layoutData?.courseInfo;
		const modules = layoutData?.modules || [];
		const cohorts = layoutData?.cohorts || [];

		if (!courseInfo) {
			throw error(404, 'Course not found');
		}

		const course = { id: courseInfo.id, name: courseInfo.name };

		// Get hubs for THIS COURSE only
		const { data: hubs, error: hubsError } = await supabaseAdmin
			.from('courses_hubs')
			.select(`
				*,
				coordinator:coordinator_id (
					id,
					full_name,
					email
				)
			`)
			.eq('course_id', course.id)
			.order('name');

		if (hubsError) {
			console.error('Error fetching hubs:', hubsError);
			throw error(500, 'Failed to load hubs');
		}

		// ✅ OPTIMIZATION: Use cached cohort IDs from layout
		const hubIds = hubs?.map(h => h.id) || [];
		const cohortIds = cohorts.map(c => c.id);
		let enrollmentCounts = {};

		if (hubIds.length > 0 && cohortIds.length > 0) {
			// Count enrollments per hub for this course
			const { data: enrollments } = await supabaseAdmin
				.from('courses_enrollments')
				.select('hub_id')
				.in('cohort_id', cohortIds)
				.in('hub_id', hubIds);

			// Build count map
			enrollments?.forEach(e => {
				if (e.hub_id) {
					enrollmentCounts[e.hub_id] = (enrollmentCounts[e.hub_id] || 0) + 1;
				}
			});
		}

		// Add enrollment counts to hubs
		const hubsWithCounts = hubs?.map(hub => ({
			...hub,
			enrollmentCount: enrollmentCounts[hub.id] || 0
		}));

		// Get all potential coordinators (users with relevant course modules)
		const { data: potentialCoordinators, error: coordinatorsError } = await supabaseAdmin
			.from('user_profiles')
			.select('id, full_name, email, modules')
			.order('full_name');

		if (coordinatorsError) {
			console.error('Error fetching potential coordinators:', coordinatorsError);
		}

		const filteredCoordinators =
			potentialCoordinators?.filter((user) => {
				const modules: string[] = Array.isArray(user.modules) ? user.modules : [];
				return (
					modules.includes('courses.participant') ||
					modules.includes('courses.manager') ||
					modules.includes('courses.admin') ||
					modules.includes('users')
				);
			}) ?? [];

		return {
			course,
			courseId: course.id,
			hubs: hubsWithCounts || [],
			potentialCoordinators: filteredCoordinators
		};

	} catch (err) {
		console.error('Error in hubs page load:', err);
		throw error(500, 'Failed to load hubs data');
	}
};

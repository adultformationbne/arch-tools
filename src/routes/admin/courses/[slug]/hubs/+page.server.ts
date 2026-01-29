import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// ✅ OPTIMIZATION: Auth already done in layout - no need to check again!

	try {
		// Get layout data (course, modules, cohorts already loaded)
		const layoutData = await event.parent();
		const courseInfo = layoutData?.courseInfo;
		const cohorts = layoutData?.cohorts || [];

		if (!courseInfo) {
			throw error(404, 'Course not found');
		}

		const course = { id: courseInfo.id, name: courseInfo.name, slug: courseInfo.slug };

		// Get hubs for THIS COURSE only
		const { data: hubs, error: hubsError } = await supabaseAdmin
			.from('courses_hubs')
			.select('id, name, location, course_id, created_at, updated_at')
			.eq('course_id', course.id)
			.order('name');

		if (hubsError) {
			console.error('Error fetching hubs:', hubsError);
			throw error(500, 'Failed to load hubs');
		}

		// ✅ OPTIMIZATION: Use cached cohort IDs from layout
		const hubIds = hubs?.map((h) => h.id) || [];
		const cohortIds = cohorts.map((c) => c.id);

		// Fetch coordinators for each hub
		let hubCoordinators: Record<string, any[]> = {};

		if (hubIds.length > 0 && cohortIds.length > 0) {
			const { data: coordinators } = await supabaseAdmin
				.from('courses_enrollments')
				.select(`
					id,
					hub_id,
					full_name,
					email,
					user_profile:user_profile_id (
						id,
						full_name,
						email
					)
				`)
				.in('cohort_id', cohortIds)
				.in('hub_id', hubIds)
				.eq('role', 'coordinator')
				.order('full_name');

			// Group by hub
			coordinators?.forEach((e) => {
				if (!e.hub_id) return;

				if (!hubCoordinators[e.hub_id]) {
					hubCoordinators[e.hub_id] = [];
				}

				hubCoordinators[e.hub_id].push({
					id: e.id,
					full_name: e.user_profile?.full_name || e.full_name,
					email: e.user_profile?.email || e.email
				});
			});
		}

		// Add coordinators to hubs
		const hubsWithMembers = hubs?.map((hub) => ({
			...hub,
			coordinators: hubCoordinators[hub.id] || []
		}));

		// Get all enrollments for this course (to allow assigning as coordinators)
		const { data: allEnrollments } = await supabaseAdmin
			.from('courses_enrollments')
			.select(`
				id,
				full_name,
				email,
				role,
				hub_id,
				user_profile:user_profile_id (
					id,
					full_name,
					email
				)
			`)
			.in('cohort_id', cohortIds)
			.in('status', ['active', 'accepted', 'invited'])
			.order('full_name');

		// Format enrollments for assignment dropdown
		const availableUsers = (allEnrollments || []).map(e => ({
			id: e.id,
			full_name: e.user_profile?.full_name || e.full_name,
			email: e.user_profile?.email || e.email,
			role: e.role,
			hub_id: e.hub_id
		}));

		return {
			course,
			courseId: course.id,
			hubs: hubsWithMembers || [],
			availableUsers
		};
	} catch (err) {
		console.error('Error in hubs page load:', err);
		throw error(500, 'Failed to load hubs data');
	}
};

import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Auth already done in layout

	try {
		// Get layout data (course, modules, cohorts, hubs already loaded and cached)
		const layoutData = await event.parent();
		const courseInfo = layoutData?.courseInfo;
		const cohorts = layoutData?.cohorts || [];
		const layoutHubs = layoutData?.hubs || [];

		if (!courseInfo) {
			throw error(404, 'Course not found');
		}

		const course = { id: courseInfo.id, name: courseInfo.name, slug: courseInfo.slug };
		const hubIds = layoutHubs.map((h) => h.id);
		const cohortIds = cohorts.map((c) => c.id);

		// Fetch coordinators and all enrollments in parallel
		let hubCoordinators: Record<string, any[]> = {};
		let availableUsers: any[] = [];

		if (hubIds.length > 0 && cohortIds.length > 0) {
			const [coordinatorsResult, allEnrollmentsResult] = await Promise.all([
				// Coordinators for each hub
				supabaseAdmin
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
					.order('full_name'),

				// All enrollments for assignment dropdown
				supabaseAdmin
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
					.order('full_name')
			]);

			// Group coordinators by hub
			coordinatorsResult.data?.forEach((e) => {
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

			// Format enrollments for assignment dropdown
			availableUsers = (allEnrollmentsResult.data || []).map(e => ({
				id: e.id,
				full_name: e.user_profile?.full_name || e.full_name,
				email: e.user_profile?.email || e.email,
				role: e.role,
				hub_id: e.hub_id
			}));
		} else if (cohortIds.length > 0) {
			// No hubs yet but we still need enrollments for assignment
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

			availableUsers = (allEnrollments || []).map(e => ({
				id: e.id,
				full_name: e.user_profile?.full_name || e.full_name,
				email: e.user_profile?.email || e.email,
				role: e.role,
				hub_id: e.hub_id
			}));
		}

		// Add coordinators to layout hubs
		const hubsWithMembers = layoutHubs.map((hub) => ({
			...hub,
			coordinators: hubCoordinators[hub.id] || []
		}));

		return {
			course,
			courseId: course.id,
			hubs: hubsWithMembers,
			availableUsers
		};
	} catch (err) {
		console.error('Error in hubs page load:', err);
		throw error(500, 'Failed to load hubs data');
	}
};

import { error, redirect } from '@sveltejs/kit';
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
		const courseFeatures = layoutData?.courseFeatures || {};

		if (courseFeatures.hubsEnabled === false) {
			throw redirect(302, `/admin/courses/${event.params.slug}`);
		}

		if (!courseInfo) {
			throw error(404, 'Course not found');
		}

		const course = { id: courseInfo.id, name: courseInfo.name, slug: courseInfo.slug };
		const hubIds = layoutHubs.map((h: any) => h.id);
		const allCohortIds = cohorts.map((c: any) => c.id);

		// Filter to selected cohort if one is active in the URL
		const selectedCohortId = event.url.searchParams.get('cohort');
		const effectiveCohortIds =
			selectedCohortId && allCohortIds.includes(selectedCohortId)
				? [selectedCohortId]
				: allCohortIds;

		// Fetch coordinators, participants, and available users in parallel
		let hubCoordinators: Record<string, any[]> = {};
		let hubParticipants: Record<string, any[]> = {};
		let availableUsers: any[] = [];

		if (hubIds.length > 0 && effectiveCohortIds.length > 0) {
			const [coordinatorsResult, participantsResult, allEnrollmentsResult] = await Promise.all([
				// Coordinators for each hub (in selected cohort)
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
					.in('cohort_id', effectiveCohortIds)
					.in('hub_id', hubIds)
					.in('role', ['coordinator', 'hub_coordinator'])
					.in('status', ['active', 'accepted', 'invited'])
					.order('full_name'),

				// Participants assigned to a hub (in selected cohort)
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
					.in('cohort_id', effectiveCohortIds)
					.in('hub_id', hubIds)
					.not('role', 'in', '(coordinator,hub_coordinator)')
					.in('status', ['active', 'accepted', 'invited'])
					.order('full_name'),

				// All enrollments for assignment dropdown (always uses all cohorts)
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
					.in('cohort_id', allCohortIds)
					.in('status', ['active', 'accepted', 'invited'])
					.order('full_name')
			]);

			// Group coordinators by hub
			coordinatorsResult.data?.forEach((e) => {
				if (!e.hub_id) return;
				if (!hubCoordinators[e.hub_id]) hubCoordinators[e.hub_id] = [];
				hubCoordinators[e.hub_id].push({
					id: e.id,
					full_name: e.user_profile?.full_name || e.full_name,
					email: e.user_profile?.email || e.email
				});
			});

			// Group participants by hub
			participantsResult.data?.forEach((e) => {
				if (!e.hub_id) return;
				if (!hubParticipants[e.hub_id]) hubParticipants[e.hub_id] = [];
				hubParticipants[e.hub_id].push({
					id: e.id,
					full_name: e.user_profile?.full_name || e.full_name,
					email: e.user_profile?.email || e.email
				});
			});

			// Format enrollments for assignment dropdown
			availableUsers = (allEnrollmentsResult.data || []).map((e) => ({
				id: e.id,
				full_name: e.user_profile?.full_name || e.full_name,
				email: e.user_profile?.email || e.email,
				role: e.role,
				hub_id: e.hub_id
			}));
		} else if (allCohortIds.length > 0) {
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
				.in('cohort_id', allCohortIds)
				.in('status', ['active', 'accepted', 'invited'])
				.order('full_name');

			availableUsers = (allEnrollments || []).map((e) => ({
				id: e.id,
				full_name: e.user_profile?.full_name || e.full_name,
				email: e.user_profile?.email || e.email,
				role: e.role,
				hub_id: e.hub_id
			}));
		}

		// Attach coordinators and participants to each hub
		const hubsWithMembers = layoutHubs.map((hub: any) => ({
			...hub,
			coordinators: hubCoordinators[hub.id] || [],
			participants: hubParticipants[hub.id] || []
		}));

		return {
			course,
			courseId: course.id,
			hubs: hubsWithMembers,
			availableUsers,
			selectedCohortId,
			cohorts
		};
	} catch (err) {
		console.error('Error in hubs page load:', err);
		throw error(500, 'Failed to load hubs data');
	}
};

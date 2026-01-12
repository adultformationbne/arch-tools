import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// ✅ OPTIMIZATION: Auth already done in layout - no need to check again!
	// Layout protects all nested admin routes
	const { user } = await event.locals.safeGetSession();

	try {
		// Get layout data (course, modules, cohorts already loaded)
		const layoutData = await event.parent();
		const courseInfo = layoutData?.courseInfo || {};
		const cohorts = layoutData?.cohorts || [];

		const cohortIds = cohorts?.map(c => c.id) || [];

		if (cohortIds.length === 0) {
			return {
				course: courseInfo,
				users: [],
				hubs: [],
				currentUserEmail: user?.email || ''
			};
		}

		// Get all enrollments for this course's cohorts
		// Using direct query since we need very specific enrollment data
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

		// Deduplicate by email - show each participant once with their most recent enrollment
		// but track all their cohorts
		const userMap = new Map();
		for (const enrollment of enrollments || []) {
			const email = enrollment.email?.toLowerCase();
			if (!email) continue;

			if (!userMap.has(email)) {
				// First enrollment for this user - use it as the base
				userMap.set(email, {
					...enrollment,
					all_cohorts: [enrollment.cohort]
				});
			} else {
				// User already exists - add this cohort to their list
				const existing = userMap.get(email);
				if (enrollment.cohort && !existing.all_cohorts.some(c => c?.id === enrollment.cohort?.id)) {
					existing.all_cohorts.push(enrollment.cohort);
				}
			}
		}

		const deduplicatedUsers = Array.from(userMap.values());

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
			users: deduplicatedUsers,
			hubs: hubs || [],
			currentUserEmail: user?.email || ''
		};

	} catch (err) {
		console.error('Error in users page load:', err);
		throw error(500, 'Failed to load users data');
	}
};

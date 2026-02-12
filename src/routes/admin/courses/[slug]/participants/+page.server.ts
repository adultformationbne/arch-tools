import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Auth already done in layout - no need to check again
	const { user } = await event.locals.safeGetSession();

	try {
		// Get layout data (course, modules, cohorts, hubs already loaded)
		const layoutData = await event.parent();
		const courseInfo = layoutData?.courseInfo || {};
		const cohorts = layoutData?.cohorts || [];
		const modules = layoutData?.modules || [];
		const hubs = layoutData?.hubs || [];

		const cohortIds = cohorts?.map(c => c.id) || [];

		if (cohortIds.length === 0) {
			return {
				course: courseInfo,
				users: [],
				hubs: [],
				cohorts: [],
				totalSessions: 8,
				currentUserEmail: user?.email || ''
			};
		}

		// Run ALL queries in parallel - including reflections using cohort IDs
		const [enrollmentsResult, attendanceResult, sessionsResult, reflectionsResult] = await Promise.all([
			// Enrollments with full profile data
			supabaseAdmin
				.from('courses_enrollments')
				.select(`
					*,
					user_profile:user_profile_id (
						id,
						email,
						full_name,
						first_name,
						last_name,
						phone,
						parish_community,
						parish_role,
						address
					),
					cohort:cohort_id (
						id,
						name,
						current_session,
						module:module_id (
							id,
							name
						)
					),
					hub:hub_id (
						id,
						name
					)
				`)
				.in('cohort_id', cohortIds)
				.order('created_at', { ascending: false }),

			// Attendance records for all cohorts
			supabaseAdmin
				.from('courses_attendance')
				.select('enrollment_id, session_number, present')
				.in('cohort_id', cohortIds),

			// Session count from first module
			modules.length > 0
				? supabaseAdmin
					.from('courses_sessions')
					.select('id', { count: 'exact', head: true })
					.eq('module_id', modules[0].id)
					.gt('session_number', 0)
				: Promise.resolve({ count: null }),

			// Reflection responses - query by cohort IDs so it can run in parallel
			supabaseAdmin
				.from('courses_reflection_responses')
				.select('enrollment_id, status')
				.in('cohort_id', cohortIds)
		]);

		const enrollments = enrollmentsResult.data;
		if (enrollmentsResult.error) {
			console.error('Error fetching enrollments:', enrollmentsResult.error);
			throw error(500, 'Failed to load users');
		}

		// Build attendance map: enrollment_id -> { attended: number, total: number }
		const attendanceMap = new Map();
		for (const record of attendanceResult.data || []) {
			if (!attendanceMap.has(record.enrollment_id)) {
				attendanceMap.set(record.enrollment_id, { attended: 0, total: 0 });
			}
			const stats = attendanceMap.get(record.enrollment_id);
			stats.total++;
			if (record.present) stats.attended++;
		}

		// Build reflection map: enrollment_id -> { submitted: number, passed: number }
		const reflectionMap = new Map();
		for (const response of reflectionsResult.data || []) {
			if (!reflectionMap.has(response.enrollment_id)) {
				reflectionMap.set(response.enrollment_id, { submitted: 0, passed: 0 });
			}
			const stats = reflectionMap.get(response.enrollment_id);
			stats.submitted++;
			if (response.status === 'passed') stats.passed++;
		}

		const totalSessions = sessionsResult.count || 8;

		// Deduplicate by email and attach progress data
		const userMap = new Map();
		for (const enrollment of enrollments || []) {
			const email = enrollment.email?.toLowerCase();
			if (!email) continue;

			// Attach progress data
			const attendance = attendanceMap.get(enrollment.id) || { attended: 0, total: 0 };
			const reflections = reflectionMap.get(enrollment.id) || { submitted: 0, passed: 0 };

			if (!userMap.has(email)) {
				userMap.set(email, {
					...enrollment,
					all_cohorts: [enrollment.cohort],
					progress: {
						attendance,
						reflections
					}
				});
			} else {
				const existing = userMap.get(email);
				if (enrollment.cohort && !existing.all_cohorts.some(c => c?.id === enrollment.cohort?.id)) {
					existing.all_cohorts.push(enrollment.cohort);
				}
				// Merge progress data
				existing.progress.attendance.attended += attendance.attended;
				existing.progress.attendance.total += attendance.total;
				existing.progress.reflections.submitted += reflections.submitted;
				existing.progress.reflections.passed += reflections.passed;
			}
		}

		const deduplicatedUsers = Array.from(userMap.values());

		return {
			course: courseInfo,
			users: deduplicatedUsers,
			hubs,
			cohorts,
			totalSessions,
			currentUserEmail: user?.email || ''
		};

	} catch (err) {
		console.error('Error in users page load:', err);
		throw error(500, 'Failed to load users data');
	}
};

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
		const modules = layoutData?.modules || [];

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

		// Get all enrollments for this course's cohorts with full profile data
		const { data: enrollments, error: enrollmentsError } = await supabaseAdmin
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
			.order('created_at', { ascending: false });

		if (enrollmentsError) {
			console.error('Error fetching enrollments:', enrollmentsError);
			throw error(500, 'Failed to load users');
		}

		// Get attendance records for all cohorts
		const { data: attendanceRecords } = await supabaseAdmin
			.from('courses_attendance')
			.select('enrollment_id, session_number, present')
			.in('cohort_id', cohortIds);

		// Build attendance map: enrollment_id -> { attended: number, total: number }
		const attendanceMap = new Map();
		for (const record of attendanceRecords || []) {
			if (!attendanceMap.has(record.enrollment_id)) {
				attendanceMap.set(record.enrollment_id, { attended: 0, total: 0 });
			}
			const stats = attendanceMap.get(record.enrollment_id);
			stats.total++;
			if (record.present) stats.attended++;
		}

		// Get reflection responses for all enrollments
		const enrollmentIds = (enrollments || []).map(e => e.id);
		const { data: reflectionResponses } = await supabaseAdmin
			.from('courses_reflection_responses')
			.select('enrollment_id, status')
			.in('enrollment_id', enrollmentIds);

		// Build reflection map: enrollment_id -> { submitted: number, passed: number }
		const reflectionMap = new Map();
		for (const response of reflectionResponses || []) {
			if (!reflectionMap.has(response.enrollment_id)) {
				reflectionMap.set(response.enrollment_id, { submitted: 0, passed: 0 });
			}
			const stats = reflectionMap.get(response.enrollment_id);
			stats.submitted++;
			if (response.status === 'passed') stats.passed++;
		}

		// Get total sessions from first module (for progress calculation)
		let totalSessions = 8;
		if (modules.length > 0) {
			const { data: sessions } = await supabaseAdmin
				.from('courses_sessions')
				.select('id')
				.eq('module_id', modules[0].id)
				.gt('session_number', 0); // Exclude session 0 (pre-start)
			totalSessions = sessions?.length || 8;
		}

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
			cohorts,
			totalSessions,
			currentUserEmail: user?.email || ''
		};

	} catch (err) {
		console.error('Error in users page load:', err);
		throw error(500, 'Failed to load users data');
	}
};

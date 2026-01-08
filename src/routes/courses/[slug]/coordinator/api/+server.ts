import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAccess } from '$lib/server/auth.js';
import { CourseQueries } from '$lib/server/course-data.js';
import type { RequestHandler } from './$types';

/**
 * GET: Fetch hub data for coordinator (students, attendance for ALL sessions)
 */
export const GET: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAccess(event, courseSlug);

	// Get course ID to read the active cohort cookie
	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const selectedCohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : undefined;

	// Get enrollment and verify coordinator role
	let enrollmentQuery = supabaseAdmin
		.from('courses_enrollments')
		.select(`
			id,
			role,
			hub_id,
			cohort_id,
			cohort:cohort_id (
				id,
				current_session,
				module:module_id (
					id
				)
			)
		`)
		.eq('user_profile_id', user.id)
		.eq('role', 'coordinator');

	if (selectedCohortId) {
		enrollmentQuery = enrollmentQuery.eq('cohort_id', selectedCohortId);
	}

	const { data: enrollmentArr } = await enrollmentQuery
		.order('created_at', { ascending: false })
		.limit(1);

	const enrollment = enrollmentArr?.[0] || null;

	if (!enrollment || enrollment.role !== 'coordinator' || !enrollment.hub_id) {
		throw error(403, 'Not authorized as hub coordinator');
	}

	const hubId = enrollment.hub_id;
	const cohortId = enrollment.cohort_id;
	const currentSession = enrollment.cohort?.current_session || 1;
	const moduleId = enrollment.cohort?.module?.id;

	// Get hub info
	const { data: hub } = await supabaseAdmin
		.from('courses_hubs')
		.select('id, name, location')
		.eq('id', hubId)
		.single();

	// Get total sessions for this module
	let totalSessions = 8; // Default fallback
	if (moduleId) {
		const { data: sessions } = await supabaseAdmin
			.from('courses_sessions')
			.select('session_number')
			.eq('module_id', moduleId)
			.gt('session_number', 0)
			.order('session_number', { ascending: false })
			.limit(1);

		if (sessions && sessions.length > 0) {
			totalSessions = sessions[0].session_number;
		}
	}

	// Get all members in this hub (students and coordinators, including self)
	const { data: hubMembers } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			id,
			full_name,
			email,
			current_session,
			role,
			user_profile:user_profile_id (
				full_name,
				email
			)
		`)
		.eq('hub_id', hubId)
		.eq('cohort_id', cohortId)
		.in('role', ['student', 'coordinator'])
		.order('full_name');

	// Get ALL attendance records for all hub members (all sessions)
	const memberIds = hubMembers?.map(s => s.id) || [];
	// Map: { enrollmentId: { sessionNumber: boolean } }
	let attendanceMap: Record<string, Record<number, boolean>> = {};

	if (memberIds.length > 0) {
		const { data: attendance } = await supabaseAdmin
			.from('courses_attendance')
			.select('enrollment_id, session_number, present')
			.in('enrollment_id', memberIds)
			.eq('cohort_id', cohortId);

		attendance?.forEach(a => {
			if (!attendanceMap[a.enrollment_id]) {
				attendanceMap[a.enrollment_id] = {};
			}
			attendanceMap[a.enrollment_id][a.session_number] = a.present;
		});
	}

	// Format hub member data with full attendance history
	const formattedMembers = (hubMembers || []).map(s => {
		const memberAttendance = attendanceMap[s.id] || {};

		// Calculate attendance percentage (sessions 1 through currentSession)
		let attendedCount = 0;
		let markedCount = 0;
		for (let i = 1; i <= currentSession; i++) {
			if (memberAttendance[i] !== undefined) {
				markedCount++;
				if (memberAttendance[i] === true) {
					attendedCount++;
				}
			}
		}

		return {
			id: s.id,
			name: s.user_profile?.full_name || s.full_name || s.email,
			email: s.user_profile?.email || s.email,
			currentSession: s.current_session,
			role: s.role,
			// Full attendance record: { 1: true, 2: false, 3: true, ... }
			attendance: memberAttendance,
			// Stats for quick display
			attendedCount,
			markedCount,
			attendancePercent: markedCount > 0 ? Math.round((attendedCount / markedCount) * 100) : null
		};
	});

	return json({
		hub: {
			id: hub?.id,
			name: hub?.name,
			location: hub?.location
		},
		currentSession,
		totalSessions,
		students: formattedMembers
	});
};

/**
 * POST: Mark attendance for a student in coordinator's hub
 */
export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAccess(event, courseSlug);

	const { action, studentId, present, sessionNumber } = await event.request.json();

	// Get course ID to read the active cohort cookie
	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const selectedCohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : undefined;

	// Get coordinator's enrollment
	let coordinatorQuery = supabaseAdmin
		.from('courses_enrollments')
		.select('id, role, hub_id, cohort_id')
		.eq('user_profile_id', user.id)
		.eq('role', 'coordinator');

	if (selectedCohortId) {
		coordinatorQuery = coordinatorQuery.eq('cohort_id', selectedCohortId);
	}

	const { data: coordinatorArr } = await coordinatorQuery
		.order('created_at', { ascending: false })
		.limit(1);

	const coordinator = coordinatorArr?.[0] || null;

	if (!coordinator || coordinator.role !== 'coordinator' || !coordinator.hub_id) {
		throw error(403, 'Not authorized as hub coordinator');
	}

	if (action === 'mark_attendance') {
		// Verify the student is in coordinator's hub
		const { data: student } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id, hub_id')
			.eq('id', studentId)
			.single();

		if (!student || student.hub_id !== coordinator.hub_id) {
			throw error(403, 'Student is not in your hub');
		}

		// Upsert attendance record
		const { error: upsertError } = await supabaseAdmin
			.from('courses_attendance')
			.upsert({
				enrollment_id: studentId,
				cohort_id: coordinator.cohort_id,
				session_number: sessionNumber,
				present,
				marked_by: user.id, // user.id is the user_profile_id
				attendance_type: 'hub'
			}, {
				onConflict: 'cohort_id,enrollment_id,session_number'
			});

		if (upsertError) {
			console.error('Error marking attendance:', upsertError);
			throw error(500, 'Failed to mark attendance');
		}

		// Log activity (batch attendance marking will create many logs, so only log individual marks)
		// Get student and coordinator names
		const { data: studentEnrollment } = await supabaseAdmin
			.from('courses_enrollments')
			.select('full_name, user_profile:user_profile_id(full_name)')
			.eq('id', studentId)
			.single();

		const { data: coordProfile } = await supabaseAdmin
			.from('user_profiles')
			.select('full_name')
			.eq('id', user.id)
			.single();

		const studentName = studentEnrollment?.user_profile?.full_name || studentEnrollment?.full_name || 'Student';

		await supabaseAdmin.from('courses_activity_log').insert({
			cohort_id: coordinator.cohort_id,
			enrollment_id: studentId,
			activity_type: 'attendance_marked',
			actor_name: coordProfile?.full_name || 'Coordinator',
			description: `Marked ${studentName} as ${present ? 'present' : 'absent'} for Session ${sessionNumber}`,
			metadata: {
				student_name: studentName,
				session_number: sessionNumber,
				present,
				marked_by_role: 'coordinator'
			}
		});

		return json({ success: true });
	}

	throw error(400, 'Invalid action');
};

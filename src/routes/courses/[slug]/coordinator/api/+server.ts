import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAccess } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

/**
 * GET: Fetch hub data for coordinator (students, attendance, reflections)
 */
export const GET: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAccess(event, courseSlug);

	// Get enrollment and verify coordinator role
	const { data: enrollment } = await supabaseAdmin
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
		.single();

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

	// Get students in this hub
	const { data: students } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			id,
			full_name,
			email,
			current_session,
			user_profile:user_profile_id (
				full_name,
				email
			)
		`)
		.eq('hub_id', hubId)
		.eq('cohort_id', cohortId)
		.eq('role', 'student')
		.order('full_name');

	// Get attendance for current session
	const studentIds = students?.map(s => s.id) || [];
	let attendanceMap: Record<string, boolean | null> = {};

	if (studentIds.length > 0) {
		const { data: attendance } = await supabaseAdmin
			.from('courses_attendance')
			.select('enrollment_id, present')
			.in('enrollment_id', studentIds)
			.eq('session_number', currentSession);

		attendance?.forEach(a => {
			attendanceMap[a.enrollment_id] = a.present;
		});
	}

	// Get reflection responses for current session
	let reflectionMap: Record<string, string> = {};

	if (studentIds.length > 0 && moduleId) {
		// First get the session ID for the current session
		const { data: session } = await supabaseAdmin
			.from('courses_sessions')
			.select('id')
			.eq('module_id', moduleId)
			.eq('session_number', currentSession)
			.single();

		if (session) {
			// Get the question for this session
			const { data: question } = await supabaseAdmin
				.from('courses_reflection_questions')
				.select('id')
				.eq('session_id', session.id)
				.single();

			if (question) {
				// Get responses for this question from hub students
				const { data: responses } = await supabaseAdmin
					.from('courses_reflection_responses')
					.select('enrollment_id, status')
					.eq('question_id', question.id)
					.in('enrollment_id', studentIds);

				responses?.forEach(r => {
					reflectionMap[r.enrollment_id] = r.status || 'submitted';
				});
			}
		}
	}

	// Format student data
	const formattedStudents = (students || []).map(s => ({
		id: s.id,
		name: s.user_profile?.full_name || s.full_name || s.email,
		email: s.user_profile?.email || s.email,
		currentSession: s.current_session,
		attendanceStatus: attendanceMap[s.id] === true ? 'present' : attendanceMap[s.id] === false ? 'absent' : null,
		reflectionStatus: reflectionMap[s.id] || 'not_started'
	}));

	return json({
		hub: {
			id: hub?.id,
			name: hub?.name,
			location: hub?.location
		},
		currentSession,
		students: formattedStudents
	});
};

/**
 * POST: Mark attendance for a student in coordinator's hub
 */
export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAccess(event, courseSlug);

	const { action, studentId, present, sessionNumber } = await event.request.json();

	// Get coordinator's enrollment
	const { data: coordinator } = await supabaseAdmin
		.from('courses_enrollments')
		.select('id, role, hub_id, cohort_id')
		.eq('user_profile_id', user.id)
		.single();

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
				marked_by: coordinator.id,
				attendance_type: 'hub'
			}, {
				onConflict: 'enrollment_id,session_number'
			});

		if (upsertError) {
			console.error('Error marking attendance:', upsertError);
			throw error(500, 'Failed to mark attendance');
		}

		return json({ success: true });
	}

	throw error(400, 'Invalid action');
};

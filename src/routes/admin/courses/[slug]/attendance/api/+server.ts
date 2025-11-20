import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CourseAggregates, CourseMutations } from '$lib/server/course-data.js';
import { requireCourseAdmin } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	// Require admin authentication
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const cohortId = event.url.searchParams.get('cohortId');

	if (!cohortId) {
		return json({ error: 'Cohort ID required' }, { status: 400 });
	}

	// Get attendance grid data using repository aggregate
	const result = await CourseAggregates.getAttendanceGrid(cohortId);

	if (result.error || !result.data) {
		console.error('Error fetching attendance:', result.error);
		return json({ error: 'Database error' }, { status: 500 });
	}

	const { enrollments, attendanceMap, hubs } = result.data;

	// Create hub lookup for hub names
	const hubLookup = new Map(hubs.map(h => [h.id, h.name]));

	// Transform enrollments to match expected format (split by hub/non-hub)
	const nonHubStudents = enrollments
		.filter(e => !e.hub_id)
		.map(student => ({
			id: student.id,
			email: student.email,
			full_name: student.full_name,
			attendance: Object.entries(attendanceMap[student.id] || {}).map(([sessionNum, present]) => ({
				enrollment_id: student.id,
				session_number: parseInt(sessionNum),
				present,
				marked_by: null, // Not included in attendanceMap
				attendance_type: 'flagship'
			}))
		}));

	const hubStudents = enrollments
		.filter(e => e.hub_id)
		.map(student => ({
			id: student.id,
			email: student.email,
			full_name: student.full_name,
			hub_id: student.hub_id,
			hub_name: hubLookup.get(student.hub_id) || 'Unknown Hub',
			attendance: Object.entries(attendanceMap[student.id] || {}).map(([sessionNum, present]) => ({
				enrollment_id: student.id,
				session_number: parseInt(sessionNum),
				present,
				marked_by: null,
				attendance_type: 'flagship'
			}))
		}));

	return json({
		nonHubStudents,
		hubStudents
	});
};

export const POST: RequestHandler = async (event) => {
	// Require admin authentication
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	const { userId, cohortId, sessionNumber, present } = await event.request.json();

	if (!userId || !cohortId || sessionNumber === undefined || present === undefined) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	// Use repository mutation for attendance marking
	const result = await CourseMutations.markAttendance({
		enrollmentId: userId,
		cohortId: cohortId,
		sessionNumber: sessionNumber,
		present,
		markedBy: user.id
	});

	if (result.error) {
		console.error('Error marking attendance:', result.error);
		return json({ error: 'Failed to mark attendance' }, { status: 500 });
	}

	return json({ success: true });
};

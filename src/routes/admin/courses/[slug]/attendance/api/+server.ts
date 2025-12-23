import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CourseAggregates, CourseMutations } from '$lib/server/course-data.js';
import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';

export const GET: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	// Get cohortId from URL params
	const cohortId = event.url.searchParams.get('cohortId');

	if (!cohortId) {
		return json({ nonHubStudents: [], hubStudents: [] });
	}

	// Get attendance grid data
	const result = await CourseAggregates.getAttendanceGrid(cohortId);

	if (result.error || !result.data) {
		console.error('Error fetching attendance:', result.error);
		return json({ error: 'Database error' }, { status: 500 });
	}

	const { enrollments, attendanceMap, hubs } = result.data;

	// Build hub lookup map
	const hubMap = new Map(hubs.map(h => [h.id, h.name]));

	// Split students into hub and non-hub groups
	const nonHubStudents: any[] = [];
	const hubStudents: any[] = [];

	for (const student of enrollments) {
		const studentData = {
			id: student.id,
			email: student.email,
			full_name: student.full_name,
			hub_id: student.hub_id,
			hub_name: student.hub_id ? hubMap.get(student.hub_id) : null,
			attendance: Object.entries(attendanceMap[student.id] || {}).map(([sessionNum, present]) => ({
				session_number: parseInt(sessionNum),
				present
			}))
		};

		if (student.hub_id) {
			hubStudents.push(studentData);
		} else {
			nonHubStudents.push(studentData);
		}
	}

	return json({ nonHubStudents, hubStudents, cohortId });
};

export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	const { userId, sessionNumber, present } = await event.request.json();

	if (!userId || sessionNumber === undefined || present === undefined) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	// Get enrollment to find cohort
	const { data: enrollment } = await supabaseAdmin
		.from('courses_enrollments')
		.select('cohort_id')
		.eq('id', userId)
		.single();

	if (!enrollment) {
		return json({ error: 'Enrollment not found' }, { status: 404 });
	}

	const result = await CourseMutations.markAttendance({
		enrollmentId: userId,
		cohortId: enrollment.cohort_id,
		sessionNumber,
		present,
		markedBy: user.id
	});

	if (result.error) {
		console.error('Error marking attendance:', result.error);
		return json({ error: 'Failed to mark attendance' }, { status: 500 });
	}

	return json({ success: true });
};

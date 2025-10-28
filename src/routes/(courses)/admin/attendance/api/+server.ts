import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { requireAdmin } from '$lib/server/auth';

export const GET: RequestHandler = async (event) => {
	// Require admin authentication
	await requireAdmin(event);

	const cohortId = event.url.searchParams.get('cohortId');

	if (!cohortId) {
		return json({ error: 'Cohort ID required' }, { status: 400 });
	}

	// Get non-hub students with their attendance
	const { data: nonHubStudents, error: nonHubError } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			id,
			email,
			full_name
		`)
		.eq('cohort_id', cohortId)
		.is('hub_id', null);

	if (nonHubError) {
		console.error('Error fetching non-hub students:', nonHubError);
		return json({ error: 'Database error' }, { status: 500 });
	}

	// Get hub students with their hub info
	const { data: hubStudents, error: hubError } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			id,
			email,
			full_name,
			hub_id,
			hubs!inner (
				id,
				name
			)
		`)
		.eq('cohort_id', cohortId)
		.not('hub_id', 'is', null);

	if (hubError) {
		console.error('Error fetching hub students:', hubError);
		return json({ error: 'Database error' }, { status: 500 });
	}

	// Get all attendance records for this cohort using courses_enrollments.id
	const allUserIds = [
		...(nonHubStudents || []).map(s => s.id),
		...(hubStudents || []).map(s => s.id)
	];

	const { data: attendanceRecords, error: attendanceError } = await supabaseAdmin
		.from('courses_attendance')
		.select('accf_user_id, session_number, present, marked_by, attendance_type')
		.eq('cohort_id', cohortId)
		.in('accf_user_id', allUserIds);

	if (attendanceError) {
		console.error('Error fetching attendance:', attendanceError);
	}

	// Map attendance to students using accf_user_id
	const attendanceMap = (attendanceRecords || []).reduce((acc, record) => {
		if (!acc[record.accf_user_id]) acc[record.accf_user_id] = [];
		acc[record.accf_user_id].push(record);
		return acc;
	}, {});

	// Transform the data to include attendance
	const transformedNonHub = (nonHubStudents || []).map(student => ({
		id: student.id,
		email: student.email,
		full_name: student.full_name,
		attendance: attendanceMap[student.id] || []
	}));

	const transformedHub = (hubStudents || []).map(student => ({
		id: student.id,
		email: student.email,
		full_name: student.full_name,
		hub_id: student.hub_id,
		hub_name: student.hubs.name,
		attendance: attendanceMap[student.id] || []
	}));

	return json({
		nonHubStudents: transformedNonHub,
		hubStudents: transformedHub
	});
};

export const POST: RequestHandler = async (event) => {
	// Require admin authentication
	const { user } = await requireAdmin(event);

	const { userId, cohortId, sessionNumber, present } = await event.request.json();

	if (!userId || !cohortId || sessionNumber === undefined || present === undefined) {
		return json({ error: 'Missing required fields' }, { status: 400 });
	}

	// Check if attendance record exists
	const { data: existing } = await supabaseAdmin
		.from('courses_attendance')
		.select('id')
		.eq('accf_user_id', userId)
		.eq('cohort_id', cohortId)
		.eq('session_number', sessionNumber)
		.single();

	if (existing) {
		// Update existing record
		const { error: updateError } = await supabaseAdmin
			.from('courses_attendance')
			.update({
				present,
				marked_by: user.id,
				attendance_type: 'flagship',
				updated_at: new Date().toISOString()
			})
			.eq('id', existing.id);

		if (updateError) {
			console.error('Error updating attendance:', updateError);
			return json({ error: 'Failed to update attendance' }, { status: 500 });
		}
	} else {
		// Create new record
		const { error: insertError } = await supabaseAdmin
			.from('courses_attendance')
			.insert({
				accf_user_id: userId,
				cohort_id: cohortId,
				session_number: sessionNumber,
				present,
				marked_by: user.id,
				attendance_type: 'flagship'
			});

		if (insertError) {
			console.error('Error creating attendance:', insertError);
			return json({ error: 'Failed to create attendance' }, { status: 500 });
		}
	}

	return json({ success: true });
};
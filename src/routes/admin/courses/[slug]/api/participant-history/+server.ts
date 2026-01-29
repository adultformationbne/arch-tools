import { error, json } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

/**
 * GET handler for fetching participant history (attendance and reflections)
 */
export const GET: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;

	// Require admin authentication
	await requireCourseAdmin(event, courseSlug);

	const { url } = event;
	const type = url.searchParams.get('type');
	const cohortId = url.searchParams.get('cohort_id');

	if (!type || !cohortId) {
		throw error(400, 'type and cohort_id are required');
	}

	try {
		if (type === 'attendance') {
			const enrollmentId = url.searchParams.get('enrollment_id');
			if (!enrollmentId) {
				throw error(400, 'enrollment_id is required for attendance');
			}

			// Get attendance records with who marked them
			const { data, error: dbError } = await supabaseAdmin
				.from('courses_attendance')
				.select(`
					id,
					session_number,
					present,
					created_at,
					updated_at,
					marked_by
				`)
				.eq('enrollment_id', enrollmentId)
				.eq('cohort_id', cohortId)
				.order('session_number', { ascending: true });

			if (dbError) {
				throw error(500, dbError.message);
			}

			// Get names for marked_by users
			const markedByIds = [...new Set((data || []).map(r => r.marked_by).filter(Boolean))];
			let markedByNames: Record<string, string> = {};

			if (markedByIds.length > 0) {
				const { data: profiles } = await supabaseAdmin
					.from('user_profiles')
					.select('id, full_name')
					.in('id', markedByIds);

				if (profiles) {
					markedByNames = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
				}
			}

			// Add marked_by_name to records
			const enrichedData = (data || []).map(record => ({
				...record,
				marked_by_name: record.marked_by ? markedByNames[record.marked_by] || 'Unknown' : null
			}));

			return json({ success: true, data: enrichedData });
		}

		if (type === 'reflections') {
			const enrollmentId = url.searchParams.get('enrollment_id');
			if (!enrollmentId) {
				throw error(400, 'enrollment_id is required for reflections');
			}

			// Get reflection responses with session info
			const { data, error: dbError } = await supabaseAdmin
				.from('courses_reflection_responses')
				.select(`
					id,
					status,
					response_text,
					created_at,
					updated_at,
					marked_by,
					marked_at,
					question:question_id (
						session:session_id (
							session_number
						)
					)
				`)
				.eq('enrollment_id', enrollmentId)
				.eq('cohort_id', cohortId)
				.order('created_at', { ascending: true });

			if (dbError) {
				throw error(500, dbError.message);
			}

			// Get names for marked_by users
			const markedByIds = [...new Set((data || []).map(r => r.marked_by).filter(Boolean))];
			let markedByNames: Record<string, string> = {};

			if (markedByIds.length > 0) {
				const { data: profiles } = await supabaseAdmin
					.from('user_profiles')
					.select('id, full_name')
					.in('id', markedByIds);

				if (profiles) {
					markedByNames = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
				}
			}

			// Flatten and enrich the data - compute word count from response_text
			const enrichedData = (data || []).map(record => ({
				id: record.id,
				status: record.status,
				word_count: record.response_text ? record.response_text.trim().split(/\s+/).filter(Boolean).length : 0,
				submitted_at: record.created_at,
				created_at: record.created_at,
				updated_at: record.updated_at,
				graded_at: record.marked_at,
				graded_by_name: record.marked_by ? markedByNames[record.marked_by] || 'Unknown' : null,
				session_number: record.question?.session?.session_number || null
			}));

			// Sort by session number
			enrichedData.sort((a, b) => (a.session_number || 0) - (b.session_number || 0));

			return json({ success: true, data: enrichedData });
		}

		throw error(400, 'Invalid type. Must be "attendance" or "reflections"');
	} catch (err: any) {
		console.error('Participant history API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

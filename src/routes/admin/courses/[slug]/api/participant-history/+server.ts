import { error, json } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;

	await requireCourseAdmin(event, courseSlug);

	const { url } = event;
	const type = url.searchParams.get('type');
	const cohortId = url.searchParams.get('cohort_id');

	if (!type) {
		throw error(400, 'type is required');
	}

	if (type !== 'other_courses' && !cohortId) {
		throw error(400, 'cohort_id is required');
	}

	try {
		if (type === 'attendance') {
			const enrollmentId = url.searchParams.get('enrollment_id');
			if (!enrollmentId) {
				throw error(400, 'enrollment_id is required for attendance');
			}

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

			enrichedData.sort((a, b) => (a.session_number || 0) - (b.session_number || 0));

			return json({ success: true, data: enrichedData });
		}

		if (type === 'other_courses') {
			const userProfileId = url.searchParams.get('user_profile_id');
			const enrollmentId = url.searchParams.get('enrollment_id');

			if (!userProfileId) {
				throw error(400, 'user_profile_id is required for other_courses');
			}

			let query = supabaseAdmin
				.from('courses_enrollments')
				.select(`
					id,
					status,
					current_session,
					last_login_at,
					login_count,
					welcome_email_sent_at,
					created_at,
					cohort:cohort_id (
						name,
						module:module_id (
							name,
							course:course_id (
								name,
								slug
							)
						)
					)
				`)
				.eq('user_profile_id', userProfileId)
				.order('created_at', { ascending: false });

			if (enrollmentId) {
				query = query.neq('id', enrollmentId);
			}

			const { data, error: dbError } = await query;

			if (dbError) {
				throw error(500, dbError.message);
			}

			const enrichedData = (data || []).map(record => ({
				course_name: (record.cohort as any)?.module?.course?.name || 'Unknown Course',
				course_slug: (record.cohort as any)?.module?.course?.slug || '',
				module_name: (record.cohort as any)?.module?.name || '',
				cohort_name: (record.cohort as any)?.name || '',
				status: record.status,
				current_session: record.current_session,
				last_login_at: record.last_login_at,
				login_count: record.login_count || 0,
				welcome_email_sent_at: record.welcome_email_sent_at,
				enrolled_at: record.created_at
			}));

			return json({ success: true, data: enrichedData });
		}

		throw error(400, 'Invalid type. Must be "attendance", "reflections", or "other_courses"');
	} catch (err: any) {
		console.error('Participant history API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

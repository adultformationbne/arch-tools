import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth';
import { CourseMutations } from '$lib/server/course-data';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	// Require admin authentication
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const { url } = event;
	const enrollmentRole = url.searchParams.get('role'); // e.g., 'admin', 'student', 'coordinator'
	const status = url.searchParams.get('status'); // e.g., 'active', 'pending', 'invited'

	try {
		// Look up cohort IDs for this course
		const { data: cohorts, error: cohortsError } = await supabaseAdmin
			.from('courses_cohorts')
			.select(`
				id,
				module:module_id!inner (
					course:course_id!inner (
						slug
					)
				)
			`)
			.eq('module.course.slug', courseSlug);

		if (cohortsError) {
			console.error('Error fetching cohorts:', cohortsError);
			throw error(500, 'Failed to fetch cohorts');
		}

		if (!cohorts || cohorts.length === 0) {
			return json({
				success: true,
				data: []
			});
		}

		const cohortIds = cohorts.map(c => c.id);

		// Build query for enrollments
		let query = supabaseAdmin
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
			.in('cohort_id', cohortIds);

		// Apply filters if provided
		if (enrollmentRole) {
			query = query.eq('role', enrollmentRole);
		}

		if (status) {
			query = query.eq('status', status);
		}

		const { data: enrollments, error: enrollmentsError } = await query
			.order('created_at', { ascending: false });

		if (enrollmentsError) {
			console.error('Error fetching enrollments:', enrollmentsError);
			throw error(500, 'Failed to fetch enrollments');
		}

		return json({
			success: true,
			data: enrollments || []
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const body = await event.request.json();
	const { action, enrollmentId } = body;

	if (action === 'enroll_in_cohort') {
		const { cohortId } = body;
		if (!enrollmentId || !cohortId) throw error(400, 'Missing enrollmentId or cohortId');

		const { data: source, error: srcErr } = await supabaseAdmin
			.from('courses_enrollments')
			.select('user_profile_id, email, full_name, hub_id')
			.eq('id', enrollmentId)
			.single();

		if (srcErr || !source) throw error(404, 'Enrollment not found');

		const { data: existing } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id')
			.eq('cohort_id', cohortId)
			.eq('email', source.email)
			.neq('status', 'withdrawn')
			.maybeSingle();

		if (existing) return json({ success: false, message: 'Already enrolled in that cohort' });

		const { error: insertErr } = await supabaseAdmin
			.from('courses_enrollments')
			.insert({
				user_profile_id: source.user_profile_id,
				email: source.email,
				full_name: source.full_name,
				hub_id: source.hub_id,
				cohort_id: cohortId,
				role: 'student',
				status: 'invited',
				imported_by: (await event.locals.safeGetSession()).user?.id ?? null,
				login_count: 0
			});

		if (insertErr) {
			console.error('Failed to enrol in cohort:', insertErr);
			throw error(500, 'Failed to enrol');
		}

		return json({ success: true });
	}

	if (!enrollmentId) {
		throw error(400, 'Missing enrollmentId');
	}

	// Verify enrollment belongs to this course
	const { data: enrollment, error: enrollmentError } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			id,
			email,
			full_name,
			status,
			hub_id,
			cohort:cohort_id (
				id,
				name,
				module:module_id (
					name,
					course:course_id (
						id,
						name,
						slug
					)
				)
			)
		`)
		.eq('id', enrollmentId)
		.single();

	if (enrollmentError || !enrollment) {
		throw error(404, 'Enrollment not found');
	}

	const cohort = Array.isArray(enrollment.cohort) ? enrollment.cohort[0] : enrollment.cohort;
	const module = Array.isArray(cohort?.module) ? cohort?.module[0] : cohort?.module;
	const course = Array.isArray(module?.course) ? module?.course[0] : module?.course;

	if (course?.slug !== courseSlug) {
		throw error(403, 'Enrollment does not belong to this course');
	}

	if (enrollment.status !== 'pending') {
		throw error(400, 'Enrollment is not in pending status');
	}

	if (action === 'approve') {
		const { error: updateError } = await supabaseAdmin
			.from('courses_enrollments')
			.update({ status: 'invited', updated_at: new Date().toISOString() })
			.eq('id', enrollmentId);

		if (updateError) {
			console.error('Failed to approve enrollment:', updateError);
			throw error(500, 'Failed to approve enrollment');
		}

		// Approval *is* the invite - same account provisioning + email every other
		// enrolment path uses, so there's no separate step an admin has to remember.
		try {
			await CourseMutations.ensureParticipantAccount({
				email: enrollment.email,
				fullName: enrollment.full_name
			});
			await CourseMutations.sendBatchEnrollmentInvitation({
				enrollmentId,
				siteUrl: event.url.origin
			});
			if (enrollment.hub_id) {
				await CourseMutations.notifyHubCoordinatorsOfEnrollment({
					enrollmentId,
					siteUrl: event.url.origin
				});
			}
		} catch (emailError) {
			console.error('Failed to send invite email after approval:', emailError);
			// Don't fail the approval if email fails - the enrollment is still approved
		}

		return json({ success: true, message: 'Enrollment approved' });
	}

	if (action === 'reject') {
		const { error: updateError } = await supabaseAdmin
			.from('courses_enrollments')
			.update({ status: 'withdrawn', updated_at: new Date().toISOString() })
			.eq('id', enrollmentId);

		if (updateError) {
			console.error('Failed to reject enrollment:', updateError);
			throw error(500, 'Failed to reject enrollment');
		}

		return json({ success: true, message: 'Enrollment rejected' });
	}

	throw error(400, 'Invalid action. Use "approve" or "reject".');
};

/**
 * Admin Reflections API
 *
 * Endpoints:
 * - POST: Claim a reflection for review (prevents concurrent marking)
 * - PUT: Mark a reflection as passed/needs_revision
 * - DELETE: Release a claim on a reflection
 *
 * Claim System:
 * - When opening modal, POST to claim the reflection
 * - Claims expire after 5 minutes of inactivity
 * - On submit (PUT), claim is automatically released
 * - On cancel, DELETE to release the claim
 */

import { error, json } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth.js';
import { CourseMutations } from '$lib/server/course-data.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import {
	getEmailTemplate,
	renderTemplate,
	buildVariableContext,
	sendCourseEmail,
	wasEmailSentToday,
	createEmailButton
} from '$lib/utils/email-service.js';
import { RESEND_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

// Claim expiry time in minutes
const CLAIM_EXPIRY_MINUTES = 5;

/**
 * Validate that a reflection belongs to the specified course
 * Returns the reflection if valid, null if not found or doesn't belong to course
 */
async function validateReflectionBelongsToCourse(reflectionId: string, courseSlug: string) {
	const { data } = await supabaseAdmin
		.from('courses_reflection_responses')
		.select(`
			id,
			reviewing_by,
			reviewing_started_at,
			status,
			marked_by,
			cohort:cohort_id!inner (
				module:module_id!inner (
					course:course_id!inner (
						slug
					)
				)
			)
		`)
		.eq('id', reflectionId)
		.eq('cohort.module.course.slug', courseSlug)
		.single();

	return data;
}

/**
 * Send reflection marked notification email
 * Only sends if student hasn't received this email type today (prevents flooding)
 */
async function sendReflectionMarkedEmail({
	enrollmentId,
	cohortId,
	sessionNumber,
	courseSlug,
	siteUrl
}: {
	enrollmentId: string;
	cohortId: string;
	sessionNumber: string | number;
	courseSlug: string;
	siteUrl: string;
}) {
	try {
		// Get enrollment with email
		const { data: enrollment } = await supabaseAdmin
			.from('courses_enrollments')
			.select(`
				id,
				email,
				full_name,
				hub:hub_id (name)
			`)
			.eq('id', enrollmentId)
			.single();

		if (!enrollment?.email) {
			console.log('No email found for enrollment:', enrollmentId);
			return;
		}

		// Check if we already sent a reflection_marked email to this student today
		const alreadySentToday = await wasEmailSentToday(
			supabaseAdmin,
			enrollment.email,
			'reflection_marked'
		);

		if (alreadySentToday) {
			console.log(`Skipping reflection_marked email - already sent today to ${enrollment.email}`);
			return;
		}

		// Get cohort with course info
		const { data: cohort } = await supabaseAdmin
			.from('courses_cohorts')
			.select(`
				id,
				name,
				start_date,
				current_session,
				module:module_id (
					course:course_id (
						id,
						name,
						slug,
						settings
					)
				)
			`)
			.eq('id', cohortId)
			.single();

		const course = cohort?.module?.course;
		if (!course) {
			console.error('Course not found for cohort:', cohortId);
			return;
		}

		// Get the email template
		const template = await getEmailTemplate(supabaseAdmin, 'reflection_marked', 'course');
		if (!template) {
			console.error('reflection_marked email template not found');
			return;
		}

		// Build variable context
		const variables = buildVariableContext({
			enrollment: {
				full_name: enrollment.full_name,
				email: enrollment.email,
				hub_name: enrollment.hub?.name || null
			},
			course: {
				name: course.name,
				slug: course.slug
			},
			cohort: {
				name: cohort.name,
				start_date: cohort.start_date,
				current_session: cohort.current_session
			},
			session: { session_number: sessionNumber },
			siteUrl
		});

		// Add session number explicitly (buildVariableContext may not set it from session object)
		variables.sessionNumber = String(sessionNumber);

		// Create login button
		const courseSettings = course.settings || {};
		const accentDark = courseSettings.accentDark || '#334642';
		variables.loginButton = createEmailButton('View Your Feedback', variables.loginLink, accentDark);

		// Render template
		const renderedSubject = renderTemplate(template.subject, variables);
		const renderedBody = renderTemplate(template.body, variables);

		// Send email with course branding
		const result = await sendCourseEmail({
			to: enrollment.email,
			subject: renderedSubject,
			bodyHtml: renderedBody,
			emailType: 'reflection_marked',
			course,
			cohortId,
			enrollmentId,
			resendApiKey: RESEND_API_KEY,
			supabase: supabaseAdmin
		});

		if (result.success) {
			console.log(`Sent reflection_marked email to ${enrollment.email}`);
		} else {
			console.error(`Failed to send reflection_marked email:`, result.error);
		}
	} catch (err) {
		// Don't fail the marking operation if email fails
		console.error('Error sending reflection marked email:', err);
	}
}

/**
 * POST: Claim a reflection for review
 * Prevents multiple people from marking the same reflection simultaneously
 */
export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user, profile } = await requireCourseAdmin(event, courseSlug);

	try {
		const body = await event.request.json();
		const { reflection_id } = body;

		if (!reflection_id) {
			throw error(400, 'Reflection ID is required');
		}

		// Check if reflection exists, belongs to this course, and get current claim status
		const reflection = await validateReflectionBelongsToCourse(reflection_id, courseSlug);

		if (!reflection) {
			throw error(404, 'Reflection not found or does not belong to this course');
		}

		// Check if already marked
		if (reflection.status === 'passed' || reflection.status === 'needs_revision') {
			// Allow original marker to edit their own marking
			if (reflection.marked_by === user.id) {
				// Skip claim process for editing own marking - just open modal
				return json({
					success: true,
					isEdit: true,
					message: 'Opening for edit'
				});
			}
			// Block others from editing
			return json({
				success: false,
				alreadyMarked: true,
				message: 'This reflection has already been marked'
			});
		}

		// Check if someone else has an active claim
		const fiveMinutesAgo = new Date(Date.now() - CLAIM_EXPIRY_MINUTES * 60 * 1000);

		if (reflection.reviewing_by && reflection.reviewing_by !== user.id) {
			const claimTime = reflection.reviewing_started_at
				? new Date(reflection.reviewing_started_at)
				: new Date(0);

			// If claim is still fresh (not expired)
			if (claimTime > fiveMinutesAgo) {
				// Get reviewer name
				const { data: reviewer } = await supabaseAdmin
					.from('user_profiles')
					.select('full_name')
					.eq('id', reflection.reviewing_by)
					.single();

				return json({
					success: false,
					claimed: true,
					claimedBy: reviewer?.full_name || 'Another user',
					claimedAt: reflection.reviewing_started_at,
					message: `This reflection is being reviewed by ${reviewer?.full_name || 'another user'}`
				});
			}
		}

		// Claim the reflection
		const { error: claimError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.update({
				reviewing_by: user.id,
				reviewing_started_at: new Date().toISOString()
			})
			.eq('id', reflection_id);

		if (claimError) {
			console.error('Error claiming reflection:', claimError);
			throw error(500, 'Failed to claim reflection');
		}

		return json({
			success: true,
			message: 'Reflection claimed for review'
		});
	} catch (err: any) {
		console.error('Claim error:', err);
		if (err?.status) throw err;
		throw error(500, 'Internal server error');
	}
};

/**
 * PUT: Mark a reflection as passed/needs_revision
 */
export const PUT: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	try {
		const body = await event.request.json();
		const { reflection_id, feedback, grade } = body;

		if (!reflection_id) {
			throw error(400, 'Reflection ID is required');
		}

		if (!grade || !['pass', 'fail'].includes(grade)) {
			throw error(400, 'Valid grade (pass/fail) is required');
		}

		// Validate reflection belongs to this course and check if already marked
		const current = await validateReflectionBelongsToCourse(reflection_id, courseSlug);

		if (!current) {
			throw error(404, 'Reflection not found or does not belong to this course');
		}

		if (current.status === 'passed' || current.status === 'needs_revision') {
			// Already marked - check if by same user (allowing re-edit)
			if (current.marked_by !== user.id) {
				const { data: marker } = await supabaseAdmin
					.from('user_profiles')
					.select('full_name')
					.eq('id', current.marked_by)
					.single();

				return json({
					success: false,
					alreadyMarked: true,
					markedBy: marker?.full_name || 'Another user',
					message: `This reflection was already marked by ${marker?.full_name || 'another user'}`
				});
			}
		}

		// Get reflection details for activity log before marking
		const { data: reflectionDetails } = await supabaseAdmin
			.from('courses_reflection_responses')
			.select(`
				cohort_id,
				enrollment_id,
				question:question_id (
					session:session_id (
						session_number
					)
				),
				enrollment:enrollment_id (
					full_name,
					user_profile:user_profile_id (
						full_name
					)
				)
			`)
			.eq('id', reflection_id)
			.single();

		// Mark reflection using repository mutation
		const result = await CourseMutations.markReflection(
			reflection_id,
			grade,
			feedback?.trim() || '',
			user.id
		);

		if (result.error) {
			console.error('Error marking reflection:', result.error);
			throw error(500, 'Failed to mark reflection');
		}

		// Clear the review claim
		await supabaseAdmin
			.from('courses_reflection_responses')
			.update({
				reviewing_by: null,
				reviewing_started_at: null
			})
			.eq('id', reflection_id);

		// Log activity
		if (reflectionDetails) {
			const { data: adminProfile } = await supabaseAdmin
				.from('user_profiles')
				.select('full_name')
				.eq('id', user.id)
				.single();

			const studentName = reflectionDetails.enrollment?.user_profile?.full_name
				|| reflectionDetails.enrollment?.full_name
				|| 'Student';
			const sessionNum = reflectionDetails.question?.session?.session_number || '?';

			await supabaseAdmin.from('courses_activity_log').insert({
				cohort_id: reflectionDetails.cohort_id,
				enrollment_id: reflectionDetails.enrollment_id,
				activity_type: grade === 'pass' ? 'reflection_passed' : 'reflection_needs_revision',
				actor_name: adminProfile?.full_name || 'Admin',
				description: `Marked ${studentName}'s Session ${sessionNum} reflection as ${grade === 'pass' ? 'passed' : 'needs revision'}`,
				metadata: {
					student_name: studentName,
					session_number: sessionNum,
					grade,
					has_feedback: !!feedback?.trim()
				}
			});

			// Send notification email (max 1 per day per student)
			await sendReflectionMarkedEmail({
				enrollmentId: reflectionDetails.enrollment_id,
				cohortId: reflectionDetails.cohort_id,
				sessionNumber: sessionNum,
				courseSlug,
				siteUrl: event.url.origin
			});
		}

		return json({
			success: true,
			data: result.data,
			message: grade === 'pass' ? 'Reflection marked as passed' : 'Reflection marked as needs revision'
		});
	} catch (err: any) {
		console.error('API error:', err);
		if (err?.status) throw err;
		throw error(500, 'Internal server error');
	}
};

/**
 * DELETE: Release a claim on a reflection (when closing modal without marking)
 */
export const DELETE: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	try {
		const reflection_id = event.url.searchParams.get('reflection_id');

		if (!reflection_id) {
			throw error(400, 'Reflection ID is required');
		}

		// Validate reflection belongs to this course
		const reflection = await validateReflectionBelongsToCourse(reflection_id, courseSlug);

		if (!reflection) {
			throw error(404, 'Reflection not found or does not belong to this course');
		}

		// Only release if current user owns the claim
		const { error: updateError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.update({
				reviewing_by: null,
				reviewing_started_at: null
			})
			.eq('id', reflection_id)
			.eq('reviewing_by', user.id); // Only clear own claims

		if (updateError) {
			console.error('Error releasing claim:', updateError);
			throw error(500, 'Failed to release claim');
		}

		return json({
			success: true,
			message: 'Claim released'
		});
	} catch (err: any) {
		console.error('Release claim error:', err);
		if (err?.status) throw err;
		throw error(500, 'Internal server error');
	}
};

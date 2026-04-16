/**
 * Admin Quiz Attempt Marking API (Qualitative quizzes)
 *
 * GET    ?quiz_id=...         — list all attempts for a quiz
 * POST   { attempt_id }       — claim attempt for review (set status → reviewing)
 * PUT    { attempt_id, ... }  — submit marking (set status → passed|failed, send notification)
 * DELETE { attempt_id }       — release claim (set status back → pending_review)
 */

import { json, error } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import {
	getCourseEmailTemplate,
	renderTemplate,
	buildVariableContext,
	sendCourseEmail,
	wasEmailSentToday,
	createEmailButton
} from '$lib/utils/email-service.js';
import { RESEND_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const CLAIM_EXPIRY_MINUTES = 5;

async function sendQuizMarkedEmail({
	enrollmentId,
	cohortId,
	quizTitle,
	sessionNumber,
	courseSlug,
	result,
	overallFeedback,
	siteUrl
}: {
	enrollmentId: string;
	cohortId: string;
	quizTitle: string | null;
	sessionNumber: number;
	courseSlug: string;
	result: 'passed' | 'failed';
	overallFeedback: string | null;
	siteUrl: string;
}) {
	try {
		const { data: enrollment } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id, email, full_name, hub:hub_id (name)')
			.eq('id', enrollmentId)
			.single();

		if (!enrollment?.email) return;

		const alreadySent = await wasEmailSentToday(supabaseAdmin, enrollment.email, 'quiz_marked');
		if (alreadySent) return;

		const { data: cohort } = await supabaseAdmin
			.from('courses_cohorts')
			.select(`
				id, name, start_date, current_session,
				module:module_id (
					course:course_id (
						id, name, slug, settings, email_branding_config
					)
				)
			`)
			.eq('id', cohortId)
			.single();

		const course = cohort?.module?.course;
		if (!course) return;

		const template = await getCourseEmailTemplate(supabaseAdmin, course.id, 'quiz_marked');
		if (!template) {
			// Fall back to reflection_marked template if quiz_marked not created yet
			return;
		}

		const variables = buildVariableContext({
			enrollment: {
				full_name: enrollment.full_name,
				email: enrollment.email,
				hub_name: enrollment.hub?.name || null
			},
			course: {
				name: course.name,
				slug: course.slug,
				settings: course.settings,
				email_branding_config: course.email_branding_config
			},
			cohort: {
				name: cohort.name,
				start_date: cohort.start_date,
				current_session: cohort.current_session
			},
			session: { session_number: sessionNumber },
			siteUrl
		});

		variables.quizTitle = quizTitle || `Session ${sessionNumber} Quiz`;
		variables.sessionNumber = String(sessionNumber);
		variables.result = result === 'passed' ? 'Passed' : 'Failed';
		variables.overallFeedback = overallFeedback || '';

		const accentDark = course.settings?.theme?.accentDark || '#334642';
		variables.courseButton = createEmailButton('View Your Feedback', variables.loginLink, accentDark);

		const renderedSubject = renderTemplate(template.subject_template, variables);
		const renderedBody = renderTemplate(template.body_template, variables);

		await sendCourseEmail({
			to: enrollment.email,
			subject: renderedSubject,
			bodyHtml: renderedBody,
			emailType: 'quiz_marked',
			course,
			cohortId,
			enrollmentId,
			resendApiKey: RESEND_API_KEY,
			supabase: supabaseAdmin
		});
	} catch (err) {
		console.error('Error sending quiz marked email:', err);
	}
}

export const GET: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const quizId = event.url.searchParams.get('quiz_id');
	if (!quizId) throw error(400, 'quiz_id is required');

	const { data: attempts, error: attemptsError } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.select(`
			id, attempt_number, status, score, points_earned, points_possible,
			overall_feedback, submitted_at, marked_at, reviewing_by, reviewing_started_at,
			enrollment:enrollment_id (
				id, full_name, email,
				hub:hub_id (name)
			),
			responses:courses_quiz_responses (
				id, question_id, selected_option_id, response_text,
				is_correct, points_awarded, feedback
			)
		`)
		.eq('quiz_id', quizId)
		.order('submitted_at', { ascending: false });

	if (attemptsError) {
		console.error('Error fetching attempts:', attemptsError);
		throw error(500, 'Failed to fetch attempts');
	}

	// Enrich each attempt with previous attempts from the same enrollment
	const byEnrollment = new Map<string, any[]>();
	for (const a of attempts ?? []) {
		const eid = (a.enrollment as any)?.id;
		if (!eid) continue;
		if (!byEnrollment.has(eid)) byEnrollment.set(eid, []);
		byEnrollment.get(eid)!.push(a);
	}

	const enriched = (attempts ?? []).map(a => {
		const eid = (a.enrollment as any)?.id;
		const all = byEnrollment.get(eid) ?? [];
		return {
			...a,
			previous_attempts: all
				.filter(p => p.attempt_number < a.attempt_number)
				.sort((x, y) => x.attempt_number - y.attempt_number)
		};
	});

	return json({ attempts: enriched });
};

export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	const body = await event.request.json();
	const { attempt_id, force } = body;
	if (!attempt_id) throw error(400, 'attempt_id is required');

	// Fetch attempt
	const { data: attempt } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.select('id, status, reviewing_by, reviewing_started_at')
		.eq('id', attempt_id)
		.single();

	if (!attempt) throw error(404, 'Attempt not found');

	const isMarked = attempt.status === 'passed' || attempt.status === 'failed';

	// Allow admins to force-reopen a marked attempt (e.g. to correct a mistake)
	if (isMarked && !force) {
		return json({ already_marked: true, status: attempt.status });
	}

	if (!isMarked && attempt.status !== 'pending_review' && attempt.status !== 'reviewing') {
		throw error(409, 'Attempt is not available for review');
	}

	// Check if claimed by someone else and claim is still active
	if (!force && attempt.reviewing_by && attempt.reviewing_by !== user.id && attempt.reviewing_started_at) {
		const claimAge = (Date.now() - new Date(attempt.reviewing_started_at).getTime()) / 1000 / 60;
		if (claimAge < CLAIM_EXPIRY_MINUTES) {
			return json({ claimed_by_other: true, claim_expires_in_minutes: CLAIM_EXPIRY_MINUTES - claimAge });
		}
	}

	const now = new Date().toISOString();

	// Atomic claim: only update if unclaimed, expired, already ours, or force-reopening.
	// Using a conditional filter prevents two markers claiming simultaneously.
	const expiryTime = new Date(Date.now() - CLAIM_EXPIRY_MINUTES * 60 * 1000).toISOString();
	let claimQuery = supabaseAdmin
		.from('courses_quiz_attempts')
		.update({
			status: 'reviewing',
			reviewing_by: user.id,
			reviewing_started_at: now,
			updated_at: now
		})
		.eq('id', attempt_id);

	if (!force) {
		// Only claim if: unclaimed OR our own claim OR claim has expired
		claimQuery = claimQuery.or(
			`reviewing_by.is.null,reviewing_by.eq.${user.id},reviewing_started_at.lt.${expiryTime}`
		);
	}

	const { data: updated } = await claimQuery.select().single();

	if (!updated) {
		// Another marker won the race — fetch their info and return claimed_by_other
		const { data: current } = await supabaseAdmin
			.from('courses_quiz_attempts')
			.select('reviewing_by, reviewing_started_at')
			.eq('id', attempt_id)
			.single();
		const claimAge = current?.reviewing_started_at
			? (Date.now() - new Date(current.reviewing_started_at).getTime()) / 1000 / 60
			: 0;
		return json({ claimed_by_other: true, claim_expires_in_minutes: Math.max(0, CLAIM_EXPIRY_MINUTES - claimAge) });
	}

	return json({ attempt: updated });
};

export const PUT: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	const body = await event.request.json();
	const { attempt_id, result, overall_feedback, response_markings, draft } = body;

	if (!attempt_id) throw error(400, 'attempt_id is required');

	if (!draft && !result) throw error(400, 'result (passed|failed) is required when not saving draft');
	if (result && result !== 'passed' && result !== 'failed') {
		throw error(400, 'result must be "passed" or "failed"');
	}

	const now = new Date().toISOString();

	// Update per-response markings if provided
	if (Array.isArray(response_markings) && response_markings.length > 0) {
		const updates = response_markings.map((rm: any) =>
			supabaseAdmin
				.from('courses_quiz_responses')
				.update({
					feedback: rm.feedback ?? null,
					is_correct: rm.is_correct ?? null,
					points_awarded: rm.points_awarded ?? null,
					marked_by: user.id,
					marked_at: now,
					updated_at: now
				})
				.eq('id', rm.response_id)
		);
		await Promise.all(updates);
	}

	if (draft) {
		// Save draft — keep status as 'reviewing'
		const { data: updated } = await supabaseAdmin
			.from('courses_quiz_attempts')
			.update({
				overall_feedback: overall_feedback ?? null,
				reviewing_by: user.id,
				reviewing_started_at: now,
				updated_at: now
			})
			.eq('id', attempt_id)
			.select()
			.single();

		return json({ attempt: updated });
	}

	// Final submission
	const { data: updated, error: updateError } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.update({
			status: result,
			overall_feedback: overall_feedback ?? null,
			marked_by: user.id,
			marked_at: now,
			reviewing_by: null,
			reviewing_started_at: null,
			updated_at: now
		})
		.eq('id', attempt_id)
		.select(`
			id, enrollment_id, cohort_id, quiz_id, status, overall_feedback
		`)
		.single();

	if (updateError) {
		console.error('Error marking attempt:', updateError);
		throw error(500, 'Failed to mark attempt');
	}

	// Fetch session number for email
	const { data: quiz } = await supabaseAdmin
		.from('courses_quizzes')
		.select(`
			title,
			session:session_id (
				session_number
			)
		`)
		.eq('id', updated.quiz_id)
		.single();

	const siteUrl = event.url.origin;
	await sendQuizMarkedEmail({
		enrollmentId: updated.enrollment_id,
		cohortId: updated.cohort_id,
		quizTitle: quiz?.title ?? null,
		sessionNumber: (quiz?.session as any)?.session_number ?? 0,
		courseSlug,
		result: result as 'passed' | 'failed',
		overallFeedback: overall_feedback ?? null,
		siteUrl
	});

	return json({ attempt: updated });
};

export const DELETE: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	const body = await event.request.json();
	const { attempt_id } = body;
	if (!attempt_id) throw error(400, 'attempt_id is required');

	const now = new Date().toISOString();
	const { data: updated } = await supabaseAdmin
		.from('courses_quiz_attempts')
		.update({
			status: 'pending_review',
			reviewing_by: null,
			reviewing_started_at: null,
			updated_at: now
		})
		.eq('id', attempt_id)
		.eq('reviewing_by', user.id)
		.select()
		.single();

	return json({ attempt: updated });
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';
import {
	buildVariableContext,
	renderTemplateForRecipient,
	sendBulkEmails,
	getCourseEmailTemplate
} from '$lib/utils/email-service.js';
import { generateEmailFromMjml } from '$lib/email/compiler.js';
import { RESEND_API_KEY } from '$env/static/private';

// POST /api/courses/[slug]/send-email - Send email to recipients
export const POST: RequestHandler = async (event) => {
	try {
		const { slug } = event.params;

		// Auth check - require course admin
		const { user } = await requireCourseAdmin(event, slug);

		// Parse request body
		const body = await event.request.json();
		const {
			recipients, // Array of enrollment IDs or full recipient objects
			template_id, // Optional: use existing template
			subject, // Required if no template_id
			body_html, // Required if no template_id (raw HTML)
			email_type, // Type: 'session_advance', 'welcome_enrolled', 'custom', etc.
			cohort_id, // Optional: cohort context
			metadata // Optional: additional data to log
		} = body;

		// Validation
		if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
			return json({ error: 'Missing or invalid recipients array' }, { status: 400 });
		}

		if (!template_id && (!subject || !body_html)) {
			return json(
				{
					error: 'Either template_id or both subject and body_html must be provided'
				},
				{ status: 400 }
			);
		}

		// Get course with settings
		const { data: course, error: courseError } = await supabaseAdmin
			.from('courses')
			.select('id, name, slug, settings, email_branding_config')
			.eq('slug', slug)
			.single();

		if (courseError || !course) {
			return json({ error: 'Course not found' }, { status: 404 });
		}

		// Get cohort if provided - validate it belongs to this course
		let cohort = null;
		if (cohort_id) {
			const { data: cohortData } = await supabaseAdmin
				.from('courses_cohorts')
				.select(`
					id, name, start_date, end_date, current_session,
					module:module_id!inner (
						course:course_id!inner (slug)
					)
				`)
				.eq('id', cohort_id)
				.eq('module.course.slug', slug)
				.single();

			if (!cohortData) {
				return json({ error: 'Cohort not found or does not belong to this course' }, { status: 403 });
			}

			cohort = cohortData;
		}

		// Get template if template_id provided
		let template = null;
		if (template_id) {
			template = await getCourseEmailTemplate(supabaseAdmin, course.id, null, template_id);

			if (!template) {
				return json({ error: 'Template not found' }, { status: 404 });
			}
		}

		// Process recipients - fetch full enrollment data if just IDs provided
		let enrollments = recipients;

		// If recipients are just strings (enrollment IDs), fetch full data and validate they belong to this course
		if (typeof recipients[0] === 'string') {
			const { data: enrollmentData, error: enrollmentError } = await supabaseAdmin
				.from('courses_enrollments')
				.select(
					`
					id,
					email,
					full_name,
					role,
					current_session,
					courses_hubs (
						id,
						name
					),
					cohort:cohort_id!inner (
						module:module_id!inner (
							course:course_id!inner (slug)
						)
					)
				`
				)
				.in('id', recipients)
				.eq('cohort.module.course.slug', slug);

			if (enrollmentError || !enrollmentData) {
				return json({ error: 'Failed to fetch enrollment data' }, { status: 500 });
			}

			// Verify all requested recipients were found (all belong to this course)
			if (enrollmentData.length !== recipients.length) {
				return json({ error: 'Some recipients do not belong to this course' }, { status: 403 });
			}

			enrollments = enrollmentData;
		}

		// Get course branding for MJML compilation
		const courseSettings = course.settings || {};
		const themeSettings = courseSettings.theme || {};
		const brandingSettings = courseSettings.branding || {};
		const courseColors = {
			accentDark: themeSettings.accentDark || '#334642',
			accentLight: themeSettings.accentLight || '#eae2d9',
			accentDarkest: themeSettings.accentDarkest || '#1e2322'
		};
		const courseLogoUrl = brandingSettings.logoUrl || null;

		// Build all emails with personalized content
		const emailsToSend: Array<{
			to: string;
			subject: string;
			html: string;
			metadata: Record<string, unknown>;
			referenceId: string;
		}> = [];

		for (const enrollment of enrollments) {
			try {
				// Build variable context for this recipient
				const variables = buildVariableContext({
					enrollment: {
						full_name: enrollment.full_name,
						email: enrollment.email,
						hub_name: enrollment.courses_hubs?.name || null,
						current_session: enrollment.current_session
					},
					course: {
						name: course.name,
						slug: course.slug
					},
					cohort: cohort
						? {
								name: cohort.name,
								start_date: cohort.start_date,
								current_session: cohort.current_session
							}
						: null,
					session: null,
					siteUrl: event.url.origin
				});

				// Determine subject and body
				let emailSubject = subject;
				let emailBody = body_html;

				// If using template, render it
				if (template) {
					const rendered = renderTemplateForRecipient({
						subjectTemplate: template.subject_template,
						bodyTemplate: template.body_template,
						variables
					});
					emailSubject = rendered.subject;
					emailBody = rendered.body;
				} else if (subject && body_html) {
					// Quick email - also do variable substitution
					const rendered = renderTemplateForRecipient({
						subjectTemplate: subject,
						bodyTemplate: body_html,
						variables
					});
					emailSubject = rendered.subject;
					emailBody = rendered.body;
				}

				// Compile with MJML for proper email rendering
				const compiledHtml = generateEmailFromMjml({
					bodyContent: emailBody,
					courseName: course.name,
					logoUrl: courseLogoUrl,
					colors: courseColors
				});

				emailsToSend.push({
					to: enrollment.email,
					subject: emailSubject,
					html: compiledHtml,
					referenceId: enrollment.id,
					metadata: {
						context: 'course',
						course_id: course.id,
						cohort_id: cohort?.id || null,
						enrollment_id: enrollment.id,
						template_id: template?.id || null
					}
				});
			} catch (error) {
				console.error(`Failed to prepare email for ${enrollment.email}:`, error);
			}
		}

		// Send all emails using batch API (up to 100 per request)
		// Use course-specific reply-to if set
		const courseReplyTo = course.email_branding_config?.reply_to_email || null;
		console.log('[send-email] course.email_branding_config:', course.email_branding_config);
		console.log('[send-email] courseReplyTo:', courseReplyTo);

		const results = await sendBulkEmails({
			emails: emailsToSend,
			emailType: email_type || 'custom',
			resendApiKey: RESEND_API_KEY,
			supabase: supabaseAdmin,
			options: {
				replyTo: courseReplyTo,
				commonMetadata: {
					sentBy: user.id,
					sentAt: new Date().toISOString(),
					...metadata
				}
			}
		});

		// If this is a welcome email and we sent successfully, update enrollment tracking
		if (email_type === 'welcome_enrolled' && results.sent > 0) {
			const sentEnrollmentIds = emailsToSend.map((e) => e.referenceId);
			const now = new Date().toISOString();

			const { error: updateError } = await supabaseAdmin
				.from('courses_enrollments')
				.update({
					welcome_email_sent_at: now,
					welcome_email_sent_by: user.id
				})
				.in('id', sentEnrollmentIds);

			if (updateError) {
				console.error('Failed to update welcome_email_sent_at:', updateError);
				// Don't fail the request - emails were still sent
			}
		}

		// Return results
		return json({
			success: results.failed === 0,
			sent: results.sent,
			failed: results.failed,
			total: enrollments.length,
			errors: results.errors,
			quotaWarning: results.quotaWarning || null
		});
	} catch (error) {
		console.error('POST /api/courses/[slug]/send-email error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

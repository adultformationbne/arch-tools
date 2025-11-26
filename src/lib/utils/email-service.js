/**
 * Centralized Email Service
 * Handles all email sending and logging for the platform
 * Uses Resend API with automatic logging to email_log table
 *
 * Features:
 * - Template rendering with {{variable}} substitution
 * - Automatic email logging to database
 * - Bulk email sending with rate limiting
 * - Template fetching from database
 *
 * @module email-service
 */

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { getPlatformSettings } from '$lib/server/supabase.js';
import { generateEmailFromMjml } from '$lib/email/compiler.js';

/**
 * Render email template by replacing {{variables}} with actual values
 * @param {string} template Template string with {{variables}}
 * @param {Object} variables Key-value pairs to substitute
 * @returns {string} Rendered template
 * @example
 * renderTemplate('Hi {{name}}', { name: 'John' }) // 'Hi John'
 */
export function renderTemplate(template, variables = {}) {
	if (!template) return '';

	let rendered = template;

	// Replace all {{variable}} instances
	Object.entries(variables).forEach(([key, value]) => {
		const regex = new RegExp(`{{${key}}}`, 'g');
		rendered = rendered.replace(regex, value ?? '');
	});

	// Remove any remaining unreplaced variables (show empty string)
	rendered = rendered.replace(/{{[^}]+}}/g, '');

	return rendered;
}

/**
 * Convert plain text to basic HTML email format
 * Preserves line breaks and adds basic styling
 * @param {string} text Plain text content
 * @param {string} organization Organization name for footer
 * @returns {string} HTML formatted email
 */
export function textToHtml(text, organization = 'Archdiocesan Ministries') {
	if (!text) return '';

	// Escape HTML and convert line breaks
	const escaped = text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/\n/g, '<br>');

	return `
<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
	<table role="presentation" style="width: 100%; border-collapse: collapse;">
		<tr>
			<td align="center" style="padding: 40px 20px;">
				<table role="presentation" style="max-width: 600px; width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);">
					<tr>
						<td style="padding: 40px 30px;">
							<div style="font-size: 16px; line-height: 1.6; color: #334642;">
								${escaped}
							</div>
						</td>
					</tr>
					<tr>
						<td style="background-color: #f9f9f9; padding: 20px 30px; text-align: center; border-radius: 0 0 8px 8px;">
							<p style="margin: 0; font-size: 13px; color: #999999;">
								Sent from ${organization}
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
	`.trim();
}

/**
 * Get email template from database
 * @param {Object} supabase Supabase client
 * @param {string} templateKey Template key (e.g., 'session_advance')
 * @returns {Promise<{subject: string, body: string, variables: string[]} | null>}
 */
export async function getEmailTemplate(supabase, templateKey) {
	const { data, error } = await supabase
		.from('platform_email_templates')
		.select('subject_template, body_template, available_variables')
		.eq('template_key', templateKey)
		.eq('is_active', true)
		.single();

	if (error) {
		console.error('Error fetching email template:', error);
		return null;
	}

	return {
		subject: data.subject_template,
		body: data.body_template,
		variables: data.available_variables || []
	};
}

/**
 * Send an email and log it to the database
 * @param {Object} options Email options
 * @param {string} options.to Recipient email address
 * @param {string} options.subject Email subject
 * @param {string} options.html HTML email body
 * @param {string} options.emailType Type of email (for logging/filtering)
 * @param {string} [options.referenceId] Optional reference ID (e.g., schedule_id, course_id)
 * @param {Object} [options.metadata] Optional metadata to store with the email
 * @param {string} [options.resendApiKey] Resend API key (from env)
 * @param {Object} [options.supabase] Supabase client (for logging)
 * @returns {Promise<{success: boolean, emailId?: string, error?: string}>}
 */
export async function sendEmail({
	to,
	subject,
	html,
	emailType,
	referenceId = null,
	metadata = {},
	resendApiKey,
	supabase
}) {
	if (!resendApiKey) {
		console.error('RESEND_API_KEY not provided');
		return { success: false, error: 'Email service not configured' };
	}

	if (!supabase) {
		console.error('Supabase client not provided');
		return { success: false, error: 'Database connection not available' };
	}

	const resend = new Resend(resendApiKey);

	// Load platform settings for from email
	const platformSettings = await getPlatformSettings();

	try {
		// Send email via Resend
		const { data, error } = await resend.emails.send({
			from: platformSettings.fromEmail,
			to: [to],
			subject,
			html
		});

		if (error) {
			console.error('Resend error:', error);

			// Log failed email to database
			await supabase.from('platform_email_log').insert({
				recipient_email: to,
				email_type: emailType,
				subject,
				body: html,
				status: 'failed',
				error_message: error.message || 'Unknown error',
				reference_id: referenceId,
				metadata
			});

			return { success: false, error: error.message };
		}

		// Log successful email to database
		await supabase.from('platform_email_log').insert({
			recipient_email: to,
			email_type: emailType,
			subject,
			body: html,
			status: 'sent',
			sent_at: new Date().toISOString(),
			resend_id: data?.id,
			reference_id: referenceId,
			metadata
		});

		return { success: true, emailId: data?.id };
	} catch (err) {
		console.error('Email service error:', err);

		// Log error to database
		try {
			await supabase.from('platform_email_log').insert({
				recipient_email: to,
				email_type: emailType,
				subject,
				body: html,
				status: 'failed',
				error_message: err.message || 'Unknown error',
				reference_id: referenceId,
				metadata
			});
		} catch (logError) {
			console.error('Failed to log email error:', logError);
		}

		return { success: false, error: err.message };
	}
}

/**
 * Send bulk emails (use sparingly - consider rate limits)
 * @param {Array<{to: string, subject: string, html: string}>} emails Array of email objects
 * @param {string} emailType Type of email for logging
 * @param {string} resendApiKey Resend API key
 * @param {Object} supabase Supabase client
 * @returns {Promise<{sent: number, failed: number, errors: Array}>}
 */
export async function sendBulkEmails({ emails, emailType, resendApiKey, supabase }) {
	const results = {
		sent: 0,
		failed: 0,
		errors: []
	};

	for (const email of emails) {
		const result = await sendEmail({
			...email,
			emailType,
			resendApiKey,
			supabase
		});

		if (result.success) {
			results.sent++;
		} else {
			results.failed++;
			results.errors.push({
				to: email.to,
				error: result.error
			});
		}

		// Small delay to respect rate limits (adjust as needed)
		await new Promise((resolve) => setTimeout(resolve, 100));
	}

	return results;
}

/**
 * Get email logs with optional filtering
 * @param {Object} supabase Supabase client
 * @param {Object} filters Optional filters
 * @param {string} [filters.emailType] Filter by email type
 * @param {string} [filters.status] Filter by status
 * @param {string} [filters.referenceId] Filter by reference ID
 * @param {number} [filters.limit] Limit results (default 100)
 * @returns {Promise<Array>}
 */
export async function getEmailLogs(supabase, filters = {}) {
	const { emailType, status, referenceId, limit = 100 } = filters;

	let query = supabase
		.from('platform_email_log')
		.select('*')
		.order('created_at', { ascending: false })
		.limit(limit);

	if (emailType) query = query.eq('email_type', emailType);
	if (status) query = query.eq('status', status);
	if (referenceId) query = query.eq('reference_id', referenceId);

	const { data, error } = await query;

	if (error) {
		console.error('Error fetching email logs:', error);
		return [];
	}

	return data || [];
}

// =====================================================
// COURSE EMAIL TEMPLATE SYSTEM
// =====================================================

/**
 * Create course-branded email HTML with dynamic colors
 * @param {Object} options Email branding options
 * @param {string} options.content Rendered HTML content (from Tiptap or plain text)
 * @param {string} options.courseName Course name for header
 * @param {string} options.accentDark Course accent dark color (hex)
 * @param {string} options.accentLight Course accent light color (hex)
 * @param {string} options.accentDarkest Course accent darkest color (hex)
 * @param {string} [options.logoUrl] Optional course logo URL
 * @param {string} [options.siteUrl] Site URL for footer
 * @returns {string} Complete HTML email with branding
 */
export function createBrandedEmailHtml({
	content,
	courseName,
	accentDark = '#334642',
	accentLight = '#eae2d9',
	accentDarkest = '#1e2322',
	logoUrl = null,
	siteUrl = 'https://archdiocesanministries.org.au'
}) {
	if (!content) return '';

	// REFACTORED: Use MJML compiler for automatic Outlook compatibility
	// and responsive design
	return generateEmailFromMjml({
		bodyContent: content,
		courseName,
		logoUrl,
		colors: {
			accentDark,
			accentLight,
			accentDarkest
		},
		previewText: `Email from ${courseName}`
	});
}

/**
 * Create styled button link for emails using course colors
 * @param {string} text Button text
 * @param {string} url Button link URL
 * @param {string} accentDark Button background color (hex)
 * @returns {string} HTML for email-safe button
 */
export function createEmailButton(text, url, accentDark = '#334642') {
	return `
<table role="presentation" cellspacing="0" cellpadding="0" style="margin: 24px 0;">
	<tr>
		<td style="border-radius: 6px; background-color: ${accentDark};">
			<a href="${url}"
			   style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 6px; text-align: center;">
				${text}
			</a>
		</td>
	</tr>
</table>
	`.trim();
}

/**
 * Get course email template from database
 * @param {Object} supabase Supabase client
 * @param {string} courseId Course UUID
 * @param {string|null} templateKey Template key (e.g., 'welcome_enrolled')
 * @param {string|null} templateId Template UUID (alternative to templateKey)
 * @returns {Promise<Object|null>} Template data or null
 */
export async function getCourseEmailTemplate(supabase, courseId, templateKey, templateId = null) {
	let query = supabase
		.from('courses_email_templates')
		.select('*')
		.eq('course_id', courseId)
		.eq('is_active', true);

	// Fetch by ID or by key
	if (templateId) {
		query = query.eq('id', templateId);
	} else if (templateKey) {
		query = query.eq('template_key', templateKey);
	} else {
		console.error('Either templateKey or templateId must be provided');
		return null;
	}

	const { data, error } = await query.single();

	if (error) {
		console.error('Error fetching course email template:', error);
		return null;
	}

	return data;
}

/**
 * Build variable context from course, cohort, and enrollment data
 * @param {Object} options Context data
 * @param {Object} options.enrollment Enrollment record with user data
 * @param {Object} options.course Course record
 * @param {Object} options.cohort Cohort record
 * @param {Object} [options.session] Optional session data
 * @param {string} options.siteUrl Site base URL
 * @returns {Object} Variable context for template rendering
 */
export function buildVariableContext({
	enrollment,
	course,
	cohort,
	session = null,
	siteUrl
}) {
	// Parse name into first/last
	const fullName = enrollment.full_name || '';
	const nameParts = fullName.split(' ');
	const firstName = nameParts[0] || '';
	const lastName = nameParts.slice(1).join(' ') || '';

	// Build base variables
	const variables = {
		// Student variables
		firstName,
		lastName,
		fullName,
		email: enrollment.email || '',

		// Course variables
		courseName: course?.name || '',
		courseSlug: course?.slug || '',
		cohortName: cohort?.name || '',
		startDate: cohort?.start_date
			? new Date(cohort.start_date).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})
			: '',
		endDate: cohort?.end_date
			? new Date(cohort.end_date).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})
			: '',

		// Session variables
		sessionNumber: session?.session_number || cohort?.current_session || '',
		sessionTitle: session?.title || '',
		currentSession: cohort?.current_session || '',

		// Link variables
		loginLink: `${siteUrl}/courses/${course?.slug || ''}`,
		dashboardLink: `${siteUrl}/courses/${course?.slug || ''}/dashboard`,
		materialsLink: `${siteUrl}/courses/${course?.slug || ''}/materials`,
		reflectionLink: `${siteUrl}/courses/${course?.slug || ''}/reflections`,

		// System variables
		supportEmail: 'support@archdiocesanministries.org.au',
		hubName: enrollment.hub_name || 'N/A'
	};

	return variables;
}

/**
 * Render email template with recipient-specific variables
 * @param {Object} options Rendering options
 * @param {string} options.subjectTemplate Subject template with {{variables}}
 * @param {string} options.bodyTemplate Body template with {{variables}}
 * @param {Object} options.variables Variable context (from buildVariableContext)
 * @returns {Object} {subject: string, body: string}
 */
export function renderTemplateForRecipient({ subjectTemplate, bodyTemplate, variables }) {
	return {
		subject: renderTemplate(subjectTemplate, variables),
		body: renderTemplate(bodyTemplate, variables)
	};
}

/**
 * Send course email with template rendering and branding
 * @param {Object} options Email options
 * @param {string} options.to Recipient email
 * @param {string} options.subject Rendered subject
 * @param {string} options.bodyHtml Rendered body HTML (can include variables already rendered)
 * @param {string} options.emailType Email type for logging
 * @param {Object} options.course Course record
 * @param {string} [options.cohortId] Cohort UUID
 * @param {string} [options.enrollmentId] Enrollment UUID
 * @param {string} [options.templateId] Template UUID
 * @param {Object} [options.metadata] Additional metadata
 * @param {string} options.resendApiKey Resend API key
 * @param {Object} options.supabase Supabase client
 * @returns {Promise<{success: boolean, emailId?: string, error?: string}>}
 */
export async function sendCourseEmail({
	to,
	subject,
	bodyHtml,
	emailType,
	course,
	cohortId = null,
	enrollmentId = null,
	templateId = null,
	metadata = {},
	resendApiKey,
	supabase
}) {
	// Get course branding
	const accentDark = course.settings?.theme?.accentDark || course.accent_dark || '#334642';
	const accentLight = course.settings?.theme?.accentLight || course.accent_light || '#eae2d9';
	const accentDarkest =
		course.settings?.theme?.accentDarkest || course.accent_darkest || '#1e2322';
	const logoUrl = course.settings?.branding?.logoUrl || null;

	// Wrap body in branded HTML
	const html = createBrandedEmailHtml({
		content: bodyHtml,
		courseName: course.name,
		accentDark,
		accentLight,
		accentDarkest,
		logoUrl,
		siteUrl: metadata.siteUrl || 'https://archdiocesanministries.org.au'
	});

	// Send email with course context logging
	const result = await sendEmail({
		to,
		subject,
		html,
		emailType,
		referenceId: cohortId,
		metadata: {
			...metadata,
			course_id: course.id,
			cohort_id: cohortId,
			enrollment_id: enrollmentId,
			template_id: templateId
		},
		resendApiKey,
		supabase
	});

	// If successful, also update the new course context columns
	if (result.success) {
		// Get the most recent email log entry for this send
		const { data: logEntry } = await supabase
			.from('platform_email_log')
			.select('id')
			.eq('recipient_email', to)
			.eq('resend_id', result.emailId)
			.single();

		if (logEntry) {
			// Update with course context
			await supabase
				.from('platform_email_log')
				.update({
					course_id: course.id,
					cohort_id: cohortId,
					enrollment_id: enrollmentId,
					template_id: templateId
				})
				.eq('id', logEntry.id);
		}
	}

	return result;
}

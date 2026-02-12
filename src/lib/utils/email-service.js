/**
 * Centralized Email Service
 * Handles all email sending and logging for the platform
 */

import { Resend } from 'resend';
import { buildCourseVariablesFromEnrollment } from '$lib/email/context-config';

/** Build email log entry with consistent column structure */
function buildLogEntry({ to, emailType, subject, body, status, resendId = null, errorMessage = null, referenceId = null, metadata = {} }) {
	return {
		recipient_email: to,
		email_type: emailType,
		subject,
		body,
		status,
		sent_at: status === 'sent' ? new Date().toISOString() : null,
		error_message: errorMessage,
		resend_id: resendId,
		reference_id: referenceId,
		metadata,
		course_id: metadata?.course_id || null,
		cohort_id: metadata?.cohort_id || null,
		enrollment_id: metadata?.enrollment_id || null,
		template_id: metadata?.template_id || null
	};
}
import { getPlatformSettings, supabaseAdmin } from '$lib/server/supabase.js';
import { generateEmailFromMjml } from '$lib/email/compiler.js';

/**
 * Extract email image URLs from HTML and mark them as used
 * Only marks images from our email-images storage bucket
 * @param {string} html Email HTML content
 */
async function markEmailImagesAsUsed(html) {
	if (!html) return;

	try {
		// Match image URLs from our Supabase storage bucket
		// Pattern: supabase.co/storage/v1/object/public/email-images/...
		const imageUrlPattern = /https:\/\/[^"'\s]+\/storage\/v1\/object\/public\/email-images\/[^"'\s]+/g;
		const matches = html.match(imageUrlPattern);

		if (!matches || matches.length === 0) return;

		// Get unique URLs
		const uniqueUrls = [...new Set(matches)];

		// Update used_at for all matching images
		const { error } = await supabaseAdmin
			.from('email_images')
			.update({ used_at: new Date().toISOString() })
			.in('public_url', uniqueUrls)
			.is('used_at', null); // Only update if not already marked

		if (error) {
			console.error('Failed to mark email images as used:', error);
		}
	} catch (err) {
		// Don't fail the email send if image tracking fails
		console.error('Error marking email images as used:', err);
	}
}

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
 * @param {string} [context='platform'] Template context ('platform', 'dgr', or 'course')
 * @returns {Promise<{subject: string, body: string, variables: string[]} | null>}
 */
export async function getEmailTemplate(supabase, templateKey, context = 'platform') {
	const { data, error } = await supabase
		.from('email_templates')
		.select('subject_template, body_template, available_variables')
		.eq('template_key', templateKey)
		.eq('context', context)
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
 * @param {string} [options.replyTo] Optional reply-to email (overrides platform default)
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
	replyTo = null,
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
		// Determine reply-to: use provided value, or fall back to platform default
		const effectiveReplyTo = replyTo || platformSettings.replyToEmail;

		// Build email payload
		const emailPayload = {
			from: platformSettings.fromEmail,
			to: [to],
			subject,
			html
		};

		// Only add replyTo if we have one (Resend SDK uses camelCase)
		if (effectiveReplyTo) {
			emailPayload.replyTo = effectiveReplyTo;
		}

		// Send email via Resend
		const { data, error } = await resend.emails.send(emailPayload);

		if (error) {
			console.error('Resend error:', error);
			await supabase.from('platform_email_log').insert(
				buildLogEntry({ to, emailType, subject, body: html, status: 'failed', errorMessage: error.message || 'Unknown error', referenceId, metadata })
			);
			return { success: false, error: error.message };
		}

		await supabase.from('platform_email_log').insert(
			buildLogEntry({ to, emailType, subject, body: html, status: 'sent', resendId: data?.id, referenceId, metadata })
		);

		// Mark any email images as used (async, don't block)
		markEmailImagesAsUsed(html);

		return { success: true, emailId: data?.id };
	} catch (err) {
		console.error('Email service error:', err);
		try {
			await supabase.from('platform_email_log').insert(
				buildLogEntry({ to, emailType, subject, body: html, status: 'failed', errorMessage: err.message || 'Unknown error', referenceId, metadata })
			);
		} catch (logError) {
			console.error('Failed to log email error:', logError);
		}
		return { success: false, error: err.message };
	}
}

/**
 * Send bulk emails using Resend Batch API (up to 100 emails per request)
 * Automatically detects and handles Resend quota/rate limit errors.
 * @param {Array<{to: string, subject: string, html: string, metadata?: Object}>} emails Array of email objects
 * @param {string} emailType Type of email for logging
 * @param {string} resendApiKey Resend API key
 * @param {Object} supabase Supabase client
 * @param {Object} [options] Additional options
 * @param {Object} [options.commonMetadata] Metadata to merge into all emails
 * @param {string} [options.replyTo] Reply-to email (overrides platform default)
 * @returns {Promise<{sent: number, failed: number, errors: Array, quotaWarning?: string}>}
 */
export async function sendBulkEmails({ emails, emailType, resendApiKey, supabase, options = {} }) {
	if (!resendApiKey) {
		console.error('RESEND_API_KEY not provided');
		return { sent: 0, failed: emails.length, errors: [{ error: 'Email service not configured' }] };
	}

	const resend = new Resend(resendApiKey);
	const platformSettings = await getPlatformSettings();

	const results = {
		sent: 0,
		failed: 0,
		errors: [],
		quotaWarning: null
	};

	// Note: No pre-flight quota check - we rely on Resend's error responses
	// to detect quota limits. This allows the limits to be managed by Resend
	// based on whatever plan is active.

	// Determine reply-to: use provided value, or fall back to platform default
	const effectiveReplyTo = options.replyTo || platformSettings.replyToEmail;

	// Resend batch API supports up to 100 emails per request
	const BATCH_SIZE = 100;

	for (let i = 0; i < emails.length; i += BATCH_SIZE) {
		const batch = emails.slice(i, i + BATCH_SIZE);

		// Format emails for Resend batch API
		const batchPayload = batch.map((email) => {
			const payload = {
				from: platformSettings.fromEmail,
				to: [email.to],
				subject: email.subject,
				html: email.html
			};
			if (effectiveReplyTo) {
				// Resend SDK uses camelCase replyTo
				payload.replyTo = effectiveReplyTo;
			}
			return payload;
		});

		try {
			// Send batch via Resend
			const { data, error } = await resend.batch.send(batchPayload);

			if (error) {
				const parsedError = parseResendError(error);
				console.error('Resend batch error:', error);

				// All emails in batch failed
				results.failed += batch.length;

				// Add detailed error info
				const errorType = parsedError.isQuotaExceeded
					? 'QUOTA_EXCEEDED'
					: parsedError.isRateLimit
						? 'RATE_LIMIT'
						: 'SEND_ERROR';

				for (const email of batch) {
					results.errors.push({ to: email.to, error: parsedError.message, type: errorType });
				}

				// Set quota warning if it's a quota issue
				if (parsedError.isQuotaExceeded && !results.quotaWarning) {
					results.quotaWarning = `Resend daily limit exceeded. Upgrade your plan at resend.com/pricing or wait until tomorrow.`;
				}

				// Log all as failed
				await logBatchEmails(supabase, batch, emailType, 'failed', parsedError.message, options.commonMetadata);

				// If quota exceeded, don't bother trying remaining batches
				if (parsedError.isQuotaExceeded) {
					const remainingEmails = emails.slice(i + BATCH_SIZE);
					if (remainingEmails.length > 0) {
						results.failed += remainingEmails.length;
						for (const email of remainingEmails) {
							results.errors.push({ to: email.to, error: 'Skipped due to quota limit', type: 'QUOTA_EXCEEDED' });
						}
					}
					break; // Exit the batch loop
				}
			} else {
				// Process batch results - data.data is array of {id} for each email
				const emailResults = data?.data || [];

				for (let j = 0; j < batch.length; j++) {
					const email = batch[j];
					const emailResult = emailResults[j];

					if (emailResult?.id) {
						results.sent++;
					} else {
						results.failed++;
						results.errors.push({ to: email.to, error: 'No response ID' });
					}
				}

				// Log all emails from this batch
				await logBatchEmails(supabase, batch, emailType, 'sent', null, options.commonMetadata, emailResults);

				// Mark any email images as used (collect all HTML from batch)
				for (const email of batch) {
					markEmailImagesAsUsed(email.html);
				}
			}
		} catch (err) {
			const parsedError = parseResendError(err);
			console.error('Batch send error:', err);

			results.failed += batch.length;

			const errorType = parsedError.isQuotaExceeded
				? 'QUOTA_EXCEEDED'
				: parsedError.isRateLimit
					? 'RATE_LIMIT'
					: 'SEND_ERROR';

			for (const email of batch) {
				results.errors.push({ to: email.to, error: parsedError.message, type: errorType });
			}

			if (parsedError.isQuotaExceeded && !results.quotaWarning) {
				results.quotaWarning = `Resend daily limit exceeded. Upgrade your plan at resend.com/pricing or wait until tomorrow.`;
			}

			// Log all as failed
			await logBatchEmails(supabase, batch, emailType, 'failed', parsedError.message, options.commonMetadata);

			// If quota exceeded, skip remaining batches
			if (parsedError.isQuotaExceeded) {
				const remainingEmails = emails.slice(i + BATCH_SIZE);
				if (remainingEmails.length > 0) {
					results.failed += remainingEmails.length;
					for (const email of remainingEmails) {
						results.errors.push({ to: email.to, error: 'Skipped due to quota limit', type: 'QUOTA_EXCEEDED' });
					}
				}
				break;
			}
		}

		// Small delay between batches (not between individual emails)
		if (i + BATCH_SIZE < emails.length) {
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	return results;
}

/** Log batch of emails to database */
async function logBatchEmails(supabase, emails, emailType, status, errorMessage = null, commonMetadata = {}, results = []) {
	if (!supabase) return;

	try {
		const logs = emails.map((email, idx) => {
			const mergedMetadata = { ...commonMetadata, ...email.metadata };
			return buildLogEntry({
				to: email.to,
				emailType,
				subject: email.subject,
				body: email.html,
				status,
				resendId: results[idx]?.id || null,
				errorMessage,
				referenceId: email.referenceId || null,
				metadata: mergedMetadata
			});
		});
		await supabase.from('platform_email_log').insert(logs);
	} catch (logError) {
		console.error('Failed to log batch emails:', logError);
	}
}

// =====================================================
// EMAIL USAGE TRACKING (Informational)
// =====================================================

/**
 * Get the count of emails sent today (for reporting/monitoring)
 * @param {Object} supabase Supabase client
 * @returns {Promise<number>} Number of emails sent today
 */
export async function getDailyEmailCount(supabase) {
	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	const { count, error } = await supabase
		.from('platform_email_log')
		.select('id', { count: 'exact', head: true })
		.eq('status', 'sent')
		.gte('sent_at', today.toISOString());

	if (error) {
		console.error('Error checking daily email count:', error);
		return 0;
	}

	return count || 0;
}

/**
 * Check if Resend error is a rate limit or quota error
 * @param {Object} error Error object from Resend
 * @returns {{isRateLimit: boolean, isQuotaExceeded: boolean, message: string}}
 */
function parseResendError(error) {
	const message = error?.message || error?.toString() || 'Unknown error';
	const statusCode = error?.statusCode || error?.status;

	// Rate limit: 429 Too Many Requests
	const isRateLimit = statusCode === 429 || message.toLowerCase().includes('rate limit');

	// Quota exceeded: usually 429 or specific message about daily/monthly limit
	const isQuotaExceeded =
		message.toLowerCase().includes('daily') ||
		message.toLowerCase().includes('quota') ||
		message.toLowerCase().includes('limit exceeded') ||
		message.toLowerCase().includes('sending limit');

	return { isRateLimit, isQuotaExceeded, message };
}

/**
 * Check if an email of a specific type was sent to a recipient today
 * Used to prevent email flooding (e.g., max 1 "reflection_marked" email per day)
 * @param {Object} supabase Supabase client
 * @param {string} recipientEmail Recipient's email address
 * @param {string} emailType The type of email to check for
 * @returns {Promise<boolean>} True if email was already sent today
 */
export async function wasEmailSentToday(supabase, recipientEmail, emailType) {
	// Get start of today in UTC
	const today = new Date();
	today.setUTCHours(0, 0, 0, 0);

	const { count, error } = await supabase
		.from('platform_email_log')
		.select('id', { count: 'exact', head: true })
		.eq('recipient_email', recipientEmail)
		.eq('email_type', emailType)
		.eq('status', 'sent')
		.gte('sent_at', today.toISOString());

	if (error) {
		console.error('Error checking email log:', error);
		return false; // On error, allow sending (fail open)
	}

	return (count || 0) > 0;
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
 * Create bulletproof styled button link for emails
 * Uses VML for Outlook compatibility + standard HTML/CSS for other clients
 * @param {string} text Button text
 * @param {string} url Button link URL
 * @param {string} backgroundColor Button background color (hex)
 * @param {Object} options Additional options
 * @param {boolean} options.centered Center the button (default: true)
 * @param {number} options.width Button width in pixels (default: 220)
 * @param {number} options.height Button height in pixels (default: 50)
 * @param {number} options.borderRadius Border radius in pixels (default: 6)
 * @returns {string} HTML for bulletproof email button
 * @see https://buttons.cm/ - Campaign Monitor's bulletproof button generator
 */
export function createEmailButton(text, url, backgroundColor = '#334642', options = {}) {
	const {
		centered = true,
		width = 220,
		height = 50,
		borderRadius = 6
	} = options;

	const arcSize = Math.round((borderRadius / Math.min(width, height)) * 100);

	const button = `
<!--[if mso]>
<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${url}" style="height:${height}px;v-text-anchor:middle;width:${width}px;" arcsize="${arcSize}%" stroke="f" fillcolor="${backgroundColor}">
<w:anchorlock/>
<center>
<![endif]-->
<a href="${url}" style="background-color:${backgroundColor};border-radius:${borderRadius}px;color:#ffffff;display:inline-block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:16px;font-weight:600;line-height:${height}px;text-align:center;text-decoration:none;width:${width}px;-webkit-text-size-adjust:none;">
${text}
</a>
<!--[if mso]>
</center>
</v:roundrect>
<![endif]-->
`.trim();

	if (centered) {
		return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:24px auto;">
<tr>
<td align="center">
${button}
</td>
</tr>
</table>
`.trim();
	}

	return button;
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
		.from('email_templates')
		.select('*')
		.eq('context', 'course')
		.eq('context_id', courseId)
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
	// Build enrollment-like object for shared function
	const enrollmentLike = {
		full_name: enrollment.full_name,
		email: enrollment.email,
		current_session: enrollment.current_session,
		courses_hubs: { name: enrollment.hub_name || '' },
		...(cohort ? { courses_cohorts: cohort } : {})
	};

	const variables = buildCourseVariablesFromEnrollment(enrollmentLike, course, null, siteUrl);

	// Override loginLink with smart login (includes email pre-fill for auto-OTP)
	variables.loginLink = course?.slug
		? `${siteUrl}/login?course=${course.slug}&email=${encodeURIComponent(enrollment.email || '')}&send=true`
		: `${siteUrl}/login?email=${encodeURIComponent(enrollment.email || '')}&send=true`;

	// Session-specific overrides
	if (session) {
		variables.sessionNumber = String(session.session_number || variables.sessionNumber);
		variables.sessionTitle = session.title || variables.sessionTitle;
	}

	// Hub name fallback for sent emails
	if (!variables.hubName) variables.hubName = 'N/A';

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
 * Send branded email for any context (platform, dgr, course)
 * Unified function for all email sending with consistent branding
 * @param {Object} options Email options
 * @param {string} options.to Recipient email
 * @param {string} options.subject Rendered subject
 * @param {string} options.bodyHtml Rendered body HTML
 * @param {string} options.emailType Email type for logging (e.g., 'course_welcome', 'dgr_reminder')
 * @param {Object} options.branding Branding configuration
 * @param {string} options.branding.name Brand/organization name for header
 * @param {string} [options.branding.logoUrl] Logo URL
 * @param {string} [options.branding.accentDark] Dark accent color (default: #334642)
 * @param {string} [options.branding.accentLight] Light accent color (default: #eae2d9)
 * @param {string} [options.branding.accentDarkest] Darkest accent color (default: #1e2322)
 * @param {string} [options.context] Context type ('platform', 'dgr', 'course')
 * @param {string} [options.contextId] Context ID (e.g., course_id)
 * @param {string} [options.templateId] Template UUID for logging
 * @param {Object} [options.metadata] Additional metadata
 * @param {string} options.resendApiKey Resend API key
 * @param {Object} options.supabase Supabase client
 * @returns {Promise<{success: boolean, emailId?: string, error?: string}>}
 */
export async function sendBrandedEmail({
	to,
	subject,
	bodyHtml,
	emailType,
	branding = {},
	context = 'platform',
	contextId = null,
	templateId = null,
	metadata = {},
	resendApiKey,
	supabase
}) {
	// Set branding defaults
	const brandName = branding.name || 'Archdiocesan Ministries';
	const accentDark = branding.accentDark || '#334642';
	const accentLight = branding.accentLight || '#eae2d9';
	const accentDarkest = branding.accentDarkest || '#1e2322';
	const logoUrl = branding.logoUrl || null;

	// Wrap body in branded HTML
	const html = createBrandedEmailHtml({
		content: bodyHtml,
		courseName: brandName, // reusing courseName param for backwards compat
		accentDark,
		accentLight,
		accentDarkest,
		logoUrl,
		siteUrl: metadata.siteUrl || 'https://archdiocesanministries.org.au'
	});

	// Send email
	const result = await sendEmail({
		to,
		subject,
		html,
		emailType,
		referenceId: contextId,
		metadata: {
			...metadata,
			context,
			context_id: contextId,
			template_id: templateId
		},
		resendApiKey,
		supabase
	});

	return result;
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

	// Get course-specific reply-to email (if set, overrides platform default)
	const courseReplyTo = course.email_branding_config?.reply_to_email || null;

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
	// Note: course_id, cohort_id, etc. are now set directly on insert via sendEmail
	const result = await sendEmail({
		to,
		subject,
		html,
		emailType,
		referenceId: cohortId,
		replyTo: courseReplyTo,
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

	return result;
}

// =====================================================
// DGR EMAIL HELPERS
// =====================================================

/**
 * Get DGR email template from database
 * @param {Object} supabase Supabase client
 * @param {string} templateKey Template key (e.g., 'welcome', 'reminder')
 * @returns {Promise<Object|null>} Template data or null
 */
export async function getDgrEmailTemplate(supabase, templateKey) {
	const { data, error } = await supabase
		.from('email_templates')
		.select('*')
		.eq('context', 'dgr')
		.eq('template_key', templateKey)
		.eq('is_active', true)
		.single();

	if (error) {
		console.error('Error fetching DGR email template:', error);
		return null;
	}

	return data;
}

/**
 * Default DGR branding configuration
 */
export const DGR_BRANDING = {
	name: 'Daily Gospel Reflections',
	accentDark: '#009199', // DGR teal
	accentLight: '#e0f2f1',
	accentDarkest: '#00695c',
	logoUrl: null // Could be configured per project
};

/**
 * Send DGR email with template rendering and branding
 * @param {Object} options Email options
 * @param {string} options.to Recipient email
 * @param {string} options.subject Rendered subject
 * @param {string} options.bodyHtml Rendered body HTML
 * @param {string} options.emailType Email type for logging (e.g., 'dgr_welcome', 'dgr_reminder')
 * @param {string} [options.contributorId] Contributor UUID
 * @param {string} [options.templateId] Template UUID for logging
 * @param {Object} [options.metadata] Additional metadata
 * @param {string} options.resendApiKey Resend API key
 * @param {Object} options.supabase Supabase client
 * @returns {Promise<{success: boolean, emailId?: string, error?: string}>}
 */
export async function sendDgrEmail({
	to,
	subject,
	bodyHtml,
	emailType,
	contributorId = null,
	templateId = null,
	metadata = {},
	resendApiKey,
	supabase
}) {
	return sendBrandedEmail({
		to,
		subject,
		bodyHtml,
		emailType,
		branding: DGR_BRANDING,
		context: 'dgr',
		contextId: contributorId,
		templateId,
		metadata,
		resendApiKey,
		supabase
	});
}

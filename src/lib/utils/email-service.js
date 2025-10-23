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

const FROM_EMAIL = 'ACCF Platform <noreply@app.archdiocesanministries.org.au>';

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
 * @returns {string} HTML formatted email
 */
export function textToHtml(text) {
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
								Sent from ACCF Platform
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
		.from('email_templates')
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

	try {
		// Send email via Resend
		const { data, error } = await resend.emails.send({
			from: FROM_EMAIL,
			to: [to],
			subject,
			html
		});

		if (error) {
			console.error('Resend error:', error);

			// Log failed email to database
			await supabase.from('email_log').insert({
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
		await supabase.from('email_log').insert({
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
			await supabase.from('email_log').insert({
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
		.from('email_log')
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

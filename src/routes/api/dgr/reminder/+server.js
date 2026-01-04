import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { RESEND_API_KEY } from '$env/static/private';
import {
	getDgrEmailTemplate,
	sendDgrEmail,
	sendBulkEmails,
	createEmailButton,
	renderTemplate
} from '$lib/utils/email-service.js';
import { generateEmailFromMjml } from '$lib/email/compiler.js';

// DGR branding colors
const DGR_COLORS = {
	accentDark: '#009199',
	accentLight: '#e6f4f5',
	accentDarkest: '#006b70'
};

/**
 * POST /api/dgr/reminder
 * Send reminder email(s) to DGR contributor(s)
 * Supports both single send: { contributorId, date }
 * And bulk send: { reminders: [{contributorId, date, scheduleId?}, ...] }
 */
export async function POST({ request, locals }) {
	// Check authentication
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();

		// Check for bulk mode
		if (body.reminders && Array.isArray(body.reminders)) {
			return handleBulkReminders(body.reminders, user);
		}

		// Single mode - original behavior
		const { scheduleId, contributorId, date } = body;

		if (!contributorId || !date) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Get reminder email template
		const template = await getDgrEmailTemplate(supabaseAdmin, 'reminder');
		if (!template) {
			throw new Error('Reminder email template not found or inactive');
		}

		// Get contributor details
		const { data: contributor, error: contributorError } = await supabaseAdmin
			.from('dgr_contributors')
			.select('name, title, email, access_token')
			.eq('id', contributorId)
			.single();

		if (contributorError || !contributor) {
			throw new Error('Contributor not found');
		}

		// Get or create schedule entry
		let scheduleEntry = null;
		let scheduleEntryId = scheduleId;

		if (scheduleId) {
			// Fetch existing entry
			const { data } = await supabaseAdmin
				.from('dgr_schedule')
				.select('id, date, liturgical_date, gospel_reference, readings_data, reminder_history')
				.eq('id', scheduleId)
				.single();

			scheduleEntry = data;
		} else {
			// No scheduleId - check if entry exists for this date/contributor
			const { data: existing } = await supabaseAdmin
				.from('dgr_schedule')
				.select('id, date, liturgical_date, gospel_reference, readings_data, reminder_history')
				.eq('date', date)
				.eq('contributor_id', contributorId)
				.maybeSingle();

			if (existing) {
				scheduleEntry = existing;
				scheduleEntryId = existing.id;
			} else {
				// Create new schedule entry for this reminder
				// Generate submission token
				const { data: token } = await supabaseAdmin.rpc('generate_submission_token');

				// Fetch readings from database
				const { data: readings } = await supabaseAdmin.rpc('get_readings_for_date', {
					target_date: date
				});

				const reading = readings && readings.length > 0 ? readings[0] : null;

				// Build readings_data JSONB structure
				let readingsData = null;
				if (reading) {
					readingsData = {
						combined_sources: [
							reading.first_reading,
							reading.psalm,
							reading.second_reading,
							reading.gospel_reading
						]
							.filter(Boolean)
							.join('; '),
						first_reading: reading.first_reading
							? { source: reading.first_reading, text: '', heading: '' }
							: null,
						psalm: reading.psalm ? { source: reading.psalm, text: '' } : null,
						second_reading: reading.second_reading
							? { source: reading.second_reading, text: '', heading: '' }
							: null,
						gospel: reading.gospel_reading
							? { source: reading.gospel_reading, text: '', heading: '' }
							: null
					};
				}

				// Create new schedule entry
				const { data: newEntry, error: createError } = await supabaseAdmin
					.from('dgr_schedule')
					.insert({
						date,
						contributor_id: contributorId,
						contributor_email: contributor.email,
						submission_token: token,
						status: 'pending',
						liturgical_date: reading?.liturgical_day || null,
						gospel_reference: reading?.gospel_reading || null,
						readings_data: readingsData,
						reminder_history: []
					})
					.select('id, date, liturgical_date, gospel_reference, readings_data, reminder_history')
					.single();

				if (createError) {
					throw new Error('Failed to create schedule entry: ' + createError.message);
				}

				scheduleEntry = newEntry;
				scheduleEntryId = newEntry.id;
			}
		}

		// Calculate days until due
		const dueDate = new Date(date + 'T00:00:00');
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

		// Format the due date message
		let dueDateText = '';
		if (diffDays === 0) {
			dueDateText = 'today';
		} else if (diffDays === 1) {
			dueDateText = 'tomorrow';
		} else if (diffDays > 1) {
			dueDateText = `in ${diffDays} days`;
		} else {
			dueDateText = `${Math.abs(diffDays)} days ago (overdue!)`;
		}

		// Format date for email
		const formattedDate = dueDate.toLocaleDateString('en-AU', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		// Build submission URL
		const submissionUrl = `${process.env.ORIGIN || 'https://app.archdiocesanministries.org.au'}/dgr/write/${contributor.access_token}`;

		// Generate bulletproof button HTML
		const buttonHtml = createEmailButton(
			'Submit Your Reflection',
			submissionUrl,
			'#009199',
			{ width: 280, height: 50, borderRadius: 8 }
		);

		// Parse name into first/last, with title support
		const fullName = contributor.name || '';
		const nameParts = fullName.trim().split(/\s+/);
		const firstName = nameParts[0] || '';
		const title = contributor.title || '';

		// Build addressed name: "Fr Michael" or just "Michael" if no title
		const addressedFirstName = title ? `${title} ${firstName}` : firstName;

		// Build template variables
		const variables = {
			contributor_name: fullName,
			contributor_first_name: addressedFirstName,
			contributor_title: title,
			contributor_email: contributor.email,
			write_url: submissionUrl,
			write_url_button: buttonHtml,
			due_date: formattedDate,
			due_date_text: dueDateText,
			liturgical_date: scheduleEntry?.liturgical_date || '',
			gospel_reference: scheduleEntry?.gospel_reference || ''
		};

		// Render template with variables
		const subject = renderTemplate(template.subject_template, variables);
		const htmlBody = renderTemplate(template.body_template, variables);

		// Send email with DGR branding
		const emailTo = contributor.email;

		const result = await sendDgrEmail({
			to: emailTo,
			subject,
			bodyHtml: htmlBody,
			emailType: 'dgr_reminder',
			contributorId,
			templateId: template.id,
			metadata: {
				contributorEmail: contributor.email,
				date,
				daysUntil: diffDays,
				submissionUrl
			},
			resendApiKey: RESEND_API_KEY,
			supabase: supabaseAdmin
		});

		if (!result.success) {
			throw new Error(result.error || 'Failed to send email');
		}

		// Log reminder in reminder_history
		const reminderHistory = scheduleEntry?.reminder_history || [];
		reminderHistory.push({
			sent_at: new Date().toISOString(),
			sent_by: user.id,
			days_until_due: diffDays,
			email_id: result.emailId,
			recipient: emailTo
		});

		// Update schedule entry with reminder history
		await supabaseAdmin
			.from('dgr_schedule')
			.update({ reminder_history: reminderHistory })
			.eq('id', scheduleEntryId);

		// Format name with title for display
		const displayName = title ? `${title} ${contributor.name}` : contributor.name;

		return json({
			success: true,
			message: `Reminder sent to ${displayName}`,
			emailId: result.emailId,
			scheduleId: scheduleEntryId,
			reminderCount: reminderHistory.length
		});

	} catch (error) {
		console.error('DGR reminder error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

/**
 * Handle bulk reminder sends using Resend Batch API
 * @param {Array<{contributorId: string, date: string, scheduleId?: string}>} reminders
 * @param {Object} user
 */
async function handleBulkReminders(reminders, user) {
	// Get reminder email template
	const template = await getDgrEmailTemplate(supabaseAdmin, 'reminder');
	if (!template) {
		return json({ error: 'Reminder email template not found' }, { status: 500 });
	}

	// Get unique contributor IDs
	const contributorIds = [...new Set(reminders.map((r) => r.contributorId))];

	// Fetch all contributors at once
	const { data: contributors, error: contributorError } = await supabaseAdmin
		.from('dgr_contributors')
		.select('id, name, title, email, access_token')
		.in('id', contributorIds);

	if (contributorError || !contributors) {
		return json({ error: 'Failed to fetch contributors' }, { status: 500 });
	}

	const contributorMap = new Map(contributors.map((c) => [c.id, c]));

	const results = {
		sent: 0,
		skipped: 0,
		failed: 0,
		details: []
	};

	const emailsToSend = [];
	const emailMetaMap = new Map(); // Map email -> {contributor, date, scheduleId}

	for (const reminder of reminders) {
		const contributor = contributorMap.get(reminder.contributorId);
		if (!contributor) {
			results.skipped++;
			results.details.push({
				contributorId: reminder.contributorId,
				date: reminder.date,
				status: 'skipped',
				reason: 'Contributor not found'
			});
			continue;
		}

		if (!contributor.access_token) {
			results.skipped++;
			results.details.push({
				contributorId: reminder.contributorId,
				name: contributor.name,
				date: reminder.date,
				status: 'skipped',
				reason: 'No access token'
			});
			continue;
		}

		// Calculate days until due
		const dueDate = new Date(reminder.date + 'T00:00:00');
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

		// Format the due date message
		let dueDateText = '';
		if (diffDays === 0) {
			dueDateText = 'today';
		} else if (diffDays === 1) {
			dueDateText = 'tomorrow';
		} else if (diffDays > 1) {
			dueDateText = `in ${diffDays} days`;
		} else {
			dueDateText = `${Math.abs(diffDays)} days ago (overdue!)`;
		}

		// Format date for email
		const formattedDate = dueDate.toLocaleDateString('en-AU', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});

		// Build submission URL
		const submissionUrl = `${process.env.ORIGIN || 'https://app.archdiocesanministries.org.au'}/dgr/write/${contributor.access_token}`;

		// Generate button HTML
		const buttonHtml = createEmailButton('Submit Your Reflection', submissionUrl, '#009199', {
			width: 280,
			height: 50,
			borderRadius: 8
		});

		// Parse name
		const fullName = contributor.name || '';
		const nameParts = fullName.trim().split(/\s+/);
		const firstName = nameParts[0] || '';
		const title = contributor.title || '';
		const addressedFirstName = title ? `${title} ${firstName}` : firstName;

		// Build template variables
		const variables = {
			contributor_name: fullName,
			contributor_first_name: addressedFirstName,
			contributor_title: title,
			contributor_email: contributor.email,
			write_url: submissionUrl,
			write_url_button: buttonHtml,
			due_date: formattedDate,
			due_date_text: dueDateText
		};

		// Render template
		const subject = renderTemplate(template.subject_template, variables);
		const htmlBody = renderTemplate(template.body_template, variables);

		// Compile with MJML
		const compiledHtml = generateEmailFromMjml({
			bodyContent: htmlBody,
			courseName: 'Daily Gospel Reflection',
			logoUrl: null,
			colors: DGR_COLORS
		});

		const emailTo = contributor.email;

		emailsToSend.push({
			to: emailTo,
			subject,
			html: compiledHtml,
			referenceId: reminder.scheduleId || null,
			metadata: {
				context: 'dgr',
				contributorId: contributor.id,
				contributorEmail: contributor.email,
				templateId: template.id,
				date: reminder.date,
				daysUntil: diffDays
			}
		});

		emailMetaMap.set(emailTo, {
			contributor,
			date: reminder.date,
			scheduleId: reminder.scheduleId,
			daysUntil: diffDays
		});
	}

	// Send all emails using batch API
	if (emailsToSend.length > 0) {
		const batchResults = await sendBulkEmails({
			emails: emailsToSend,
			emailType: 'dgr_reminder',
			resendApiKey: RESEND_API_KEY,
			supabase: supabaseAdmin
		});

		results.sent = batchResults.sent;
		results.failed = batchResults.failed;

		// Update schedule entries for successful sends
		const successfulEmails = emailsToSend.filter(
			(email) => !batchResults.errors.find((e) => e.to === email.to)
		);

		for (const email of successfulEmails) {
			const meta = emailMetaMap.get(email.to);
			if (meta && meta.scheduleId) {
				// Update reminder history in schedule entry
				const { data: scheduleEntry } = await supabaseAdmin
					.from('dgr_schedule')
					.select('reminder_history')
					.eq('id', meta.scheduleId)
					.single();

				const reminderHistory = scheduleEntry?.reminder_history || [];
				reminderHistory.push({
					sent_at: new Date().toISOString(),
					sent_by: user.id,
					days_until_due: meta.daysUntil,
					recipient: email.to,
					bulk_send: true
				});

				await supabaseAdmin
					.from('dgr_schedule')
					.update({ reminder_history: reminderHistory })
					.eq('id', meta.scheduleId);
			}

			results.details.push({
				contributorId: meta.contributor.id,
				name: meta.contributor.name,
				date: meta.date,
				status: 'sent'
			});
		}

		// Record failures
		for (const error of batchResults.errors) {
			const meta = emailMetaMap.get(error.to);
			if (meta) {
				results.details.push({
					contributorId: meta.contributor.id,
					name: meta.contributor.name,
					date: meta.date,
					status: 'failed',
					reason: error.error
				});
			}
		}
	}

	return json({
		success: true,
		message: `Sent ${results.sent} reminder(s)`,
		results
	});
}

import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } from '$env/static/private';
import { sendEmail, textToHtml } from '$lib/utils/email-service.js';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

/**
 * POST /api/dgr/reminder
 * Send a reminder email to a DGR contributor
 */
export async function POST({ request, locals }) {
	// Check authentication
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { scheduleId, contributorId, date } = await request.json();

		if (!contributorId || !date) {
			return json({ error: 'Missing required fields' }, { status: 400 });
		}

		// Get contributor details
		const { data: contributor, error: contributorError } = await supabase
			.from('dgr_contributors')
			.select('name, email, access_token')
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
			const { data } = await supabase
				.from('dgr_schedule')
				.select('id, date, liturgical_date, gospel_reference, readings_data, reminder_history')
				.eq('id', scheduleId)
				.single();

			scheduleEntry = data;
		} else {
			// No scheduleId - check if entry exists for this date/contributor
			const { data: existing } = await supabase
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
				const { data: token } = await supabase.rpc('generate_submission_token');

				// Fetch readings from database
				const { data: readings } = await supabase.rpc('get_readings_for_date', {
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
				const { data: newEntry, error: createError } = await supabase
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

		// Compose reminder email
		const subject = `DGR Reminder: Reflection due ${dueDateText}`;

		const message = `Hi ${contributor.name},

This is a reminder that your Daily Gospel Reflection is due ${dueDateText}.

Date: ${formattedDate}
${scheduleEntry?.liturgical_date ? `Liturgical Day: ${scheduleEntry.liturgical_date}` : ''}
${scheduleEntry?.gospel_reference ? `Gospel: ${scheduleEntry.gospel_reference}` : ''}

You can submit your reflection here:
${submissionUrl}

If you've already submitted your reflection, please disregard this reminder.

Thank you for your contribution to the Daily Gospel Reflections!

Best regards,
ACCF Team`;

		// Send email using email service
		// TODO: Remove this override once testing is complete
		const emailTo = process.env.NODE_ENV === 'development' ? 'me@liamdesic.co' : contributor.email;

		const result = await sendEmail({
			to: emailTo,
			subject,
			html: textToHtml(message),
			emailType: 'dgr_reminder',
			referenceId: scheduleId,
			metadata: {
				contributorId,
				contributorEmail: contributor.email, // Store real email in metadata for reference
				date,
				daysUntil: diffDays,
				submissionUrl
			},
			resendApiKey: RESEND_API_KEY,
			supabase
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
		await supabase
			.from('dgr_schedule')
			.update({ reminder_history: reminderHistory })
			.eq('id', scheduleEntryId);

		return json({
			success: true,
			message: `Reminder sent to ${contributor.name}`,
			emailId: result.emailId,
			scheduleId: scheduleEntryId,
			reminderCount: reminderHistory.length
		});

	} catch (error) {
		console.error('DGR reminder error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

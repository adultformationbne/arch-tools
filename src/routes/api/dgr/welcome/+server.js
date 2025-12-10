import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { RESEND_API_KEY } from '$env/static/private';
import { sendEmail, createEmailButton } from '$lib/utils/email-service.js';

/**
 * Process a template string, replacing {{variable}} with values
 * @param {string} template - Template string with {{variables}}
 * @param {object} variables - Object with variable values
 * @returns {string} - Processed template
 */
function processTemplate(template, variables) {
	if (!template) return '';

	return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
		const trimmedKey = key.trim();

		// Handle conditional blocks like {{#if variable}}...{{/if}}
		// For now, just replace simple variables
		if (trimmedKey.startsWith('#if ') || trimmedKey.startsWith('/if')) {
			return match; // Keep conditional syntax for now (could expand later)
		}

		return variables[trimmedKey] !== undefined ? variables[trimmedKey] : match;
	});
}

/**
 * POST /api/dgr/welcome
 * Send welcome email(s) to DGR contributor(s)
 * Supports both single and bulk sends
 */
export async function POST({ request, locals }) {
	// Check authentication
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { contributorIds } = await request.json();

		if (!contributorIds || !Array.isArray(contributorIds) || contributorIds.length === 0) {
			return json({ error: 'contributorIds array is required' }, { status: 400 });
		}

		// Get welcome email template from database
		const { data: template, error: templateError } = await supabaseAdmin
			.from('dgr_email_templates')
			.select('*')
			.eq('template_key', 'welcome')
			.eq('is_active', true)
			.single();

		if (templateError || !template) {
			throw new Error('Welcome email template not found or inactive');
		}

		// Get contributors
		const { data: contributors, error: fetchError } = await supabaseAdmin
			.from('dgr_contributors')
			.select('id, name, email, access_token, welcome_email_sent_at')
			.in('id', contributorIds);

		if (fetchError) {
			throw new Error('Failed to fetch contributors: ' + fetchError.message);
		}

		if (!contributors || contributors.length === 0) {
			return json({ error: 'No contributors found' }, { status: 404 });
		}

		const results = {
			sent: 0,
			skipped: 0,
			failed: 0,
			details: []
		};

		for (const contributor of contributors) {
			// Skip if no access token
			if (!contributor.access_token) {
				results.skipped++;
				results.details.push({
					id: contributor.id,
					name: contributor.name,
					status: 'skipped',
					reason: 'No access token'
				});
				continue;
			}

			// Build the contributor's personal link
			const writeUrl = `${process.env.ORIGIN || 'https://app.archdiocesanministries.org.au'}/dgr/write/${contributor.access_token}`;

			// Generate bulletproof button HTML (works in Outlook + all other clients)
			const buttonHtml = createEmailButton(
				'Access Your Writing Portal',
				writeUrl,
				'#009199',
				{ width: 280, height: 50, borderRadius: 8 }
			);

			// Parse name into first/last
			const fullName = contributor.name || '';
			const nameParts = fullName.trim().split(/\s+/);
			const firstName = nameParts[0] || '';
			const lastName = nameParts.slice(1).join(' ') || '';

			// Build template variables
			const variables = {
				contributor_name: fullName,
				contributor_first_name: firstName,
				contributor_last_name: lastName,
				contributor_email: contributor.email,
				write_url: writeUrl,
				write_url_button: buttonHtml
			};

			// Process template
			const subject = processTemplate(template.subject_template, variables);
			const htmlBody = processTemplate(template.body_template, variables);

			try {
				// Send email
				const emailTo =
					process.env.NODE_ENV === 'development' ? 'me@liamdesic.co' : contributor.email;

				const result = await sendEmail({
					to: emailTo,
					subject,
					html: htmlBody,
					emailType: 'dgr_welcome',
					referenceId: contributor.id,
					metadata: {
						contributorId: contributor.id,
						contributorEmail: contributor.email,
						writeUrl,
						templateId: template.id
					},
					resendApiKey: RESEND_API_KEY,
					supabase: supabaseAdmin
				});

				if (!result.success) {
					throw new Error(result.error || 'Failed to send email');
				}

				// Update contributor with welcome email timestamp
				await supabaseAdmin
					.from('dgr_contributors')
					.update({
						welcome_email_sent_at: new Date().toISOString(),
						welcome_email_sent_by: user.id
					})
					.eq('id', contributor.id);

				results.sent++;
				results.details.push({
					id: contributor.id,
					name: contributor.name,
					email: contributor.email,
					status: 'sent',
					emailId: result.emailId
				});
			} catch (emailError) {
				console.error(`Failed to send welcome email to ${contributor.email}:`, emailError);
				results.failed++;
				results.details.push({
					id: contributor.id,
					name: contributor.name,
					status: 'failed',
					reason: emailError.message
				});
			}
		}

		return json({
			success: true,
			message: `Sent ${results.sent} welcome email(s)`,
			results
		});
	} catch (error) {
		console.error('DGR welcome email error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { RESEND_API_KEY } from '$env/static/private';
import {
	getDgrEmailTemplate,
	sendDgrEmail,
	createEmailButton,
	renderTemplate
} from '$lib/utils/email-service.js';

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

		// Get welcome email template using unified helper
		const template = await getDgrEmailTemplate(supabaseAdmin, 'welcome');
		if (!template) {
			throw new Error('Welcome email template not found or inactive');
		}

		// Get contributors
		const { data: contributors, error: fetchError } = await supabaseAdmin
			.from('dgr_contributors')
			.select('id, name, title, email, access_token, welcome_email_sent_at')
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

			// Parse name into first/last, with title support
			const fullName = contributor.name || '';
			const nameParts = fullName.trim().split(/\s+/);
			const firstName = nameParts[0] || '';
			const lastName = nameParts.slice(1).join(' ') || '';
			const title = contributor.title || '';

			// Build addressed name: "Fr Michael" or just "Michael" if no title
			const addressedFirstName = title ? `${title} ${firstName}` : firstName;

			// Build template variables
			const variables = {
				contributor_name: fullName,
				contributor_first_name: addressedFirstName,
				contributor_last_name: lastName,
				contributor_title: title,
				contributor_email: contributor.email,
				write_url: writeUrl,
				write_url_button: buttonHtml
			};

			// Render template with variables
			const subject = renderTemplate(template.subject_template, variables);
			const htmlBody = renderTemplate(template.body_template, variables);

			try {
				// Send email with DGR branding using unified helper
				const emailTo =
					process.env.NODE_ENV === 'development' ? 'me@liamdesic.co' : contributor.email;

				const result = await sendDgrEmail({
					to: emailTo,
					subject,
					bodyHtml: htmlBody,
					emailType: 'dgr_welcome',
					contributorId: contributor.id,
					templateId: template.id,
					metadata: {
						contributorEmail: contributor.email,
						writeUrl
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

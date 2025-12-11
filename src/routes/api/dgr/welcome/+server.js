import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { RESEND_API_KEY } from '$env/static/private';
import {
	getDgrEmailTemplate,
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

		// Build all emails first
		const emailsToSend = [];
		const contributorMap = new Map(); // Map email -> contributor for post-send updates

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

			// Compile with MJML for proper email rendering
			const compiledHtml = generateEmailFromMjml({
				bodyContent: htmlBody,
				courseName: 'Daily Gospel Reflection',
				logoUrl: null,
				colors: DGR_COLORS
			});

			const emailTo =
				process.env.NODE_ENV === 'development' ? 'me@liamdesic.co' : contributor.email;

			emailsToSend.push({
				to: emailTo,
				subject,
				html: compiledHtml,
				referenceId: contributor.id,
				metadata: {
					context: 'dgr',
					contributorId: contributor.id,
					contributorEmail: contributor.email,
					templateId: template.id,
					writeUrl
				}
			});

			contributorMap.set(emailTo, contributor);
		}

		// Send all emails using batch API
		if (emailsToSend.length > 0) {
			const batchResults = await sendBulkEmails({
				emails: emailsToSend,
				emailType: 'dgr_welcome',
				resendApiKey: RESEND_API_KEY,
				supabase: supabaseAdmin
			});

			results.sent = batchResults.sent;
			results.failed = batchResults.failed;

			// Update contributors that were successfully sent
			const successfulEmails = emailsToSend.filter(
				(email) => !batchResults.errors.find((e) => e.to === email.to)
			);

			for (const email of successfulEmails) {
				const contributor = contributorMap.get(email.to);
				if (contributor) {
					await supabaseAdmin
						.from('dgr_contributors')
						.update({
							welcome_email_sent_at: new Date().toISOString(),
							welcome_email_sent_by: user.id
						})
						.eq('id', contributor.id);

					results.details.push({
						id: contributor.id,
						name: contributor.name,
						email: contributor.email,
						status: 'sent'
					});
				}
			}

			// Record failures
			for (const error of batchResults.errors) {
				const contributor = contributorMap.get(error.to);
				if (contributor) {
					results.details.push({
						id: contributor.id,
						name: contributor.name,
						status: 'failed',
						reason: error.error
					});
				}
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

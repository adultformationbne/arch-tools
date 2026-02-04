import { json, type RequestEvent } from '@sveltejs/kit';
import { RESEND_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { Resend } from 'resend';
import { getReadingsForEntries } from '$lib/server/dgr-readings.js';
import { publishDGRToWordPress, type PublishResult } from '$lib/server/dgr-publisher.js';
import { findGospelReference, cleanGospelText } from '$lib/utils/dgr-common.js';

const TASK_TYPE = 'dgr_digest';

interface PublishAttempt {
	date: string;
	title: string;
	success: boolean;
	link?: string;
	error?: string;
	warning?: string;
}

export async function GET({ request, url }: RequestEvent) {
	// Verify cron secret
	const cronSecret = env.CRON_SECRET;
	if (cronSecret) {
		const authHeader = request.headers.get('authorization');
		if (authHeader !== `Bearer ${cronSecret}`) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}
	}

	try {
		// Get task config from database
		const { data: task } = await supabaseAdmin
			.from('scheduled_tasks')
			.select('*')
			.eq('task_type', TASK_TYPE)
			.eq('enabled', true)
			.single();

		if (!task) {
			return json({ success: true, message: 'Task not found or disabled', skipped: true });
		}

		// Check if we should run today (weekday check)
		const now = new Date();
		const brisbaneTime = new Date(now.toLocaleString('en-US', { timeZone: 'Australia/Brisbane' }));
		const dayOfWeek = brisbaneTime.getDay(); // 0 = Sunday, 6 = Saturday
		const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

		if (isWeekend && !task.run_on_weekends) {
			await updateTaskStatus(task.id, 'skipped', 'Weekend - task configured for weekdays only');
			return json({ success: true, message: 'Skipped - weekend', skipped: true });
		}

		if (!isWeekend && !task.run_on_weekdays) {
			await updateTaskStatus(task.id, 'skipped', 'Weekday - task configured for weekends only');
			return json({ success: true, message: 'Skipped - weekday', skipped: true });
		}

		// Get recipients from task config (or fall back to all DGR admins)
		let recipients = task.config?.recipients || [];

		if (recipients.length === 0) {
			// Fallback: get all DGR admins
			const { data: dgrAdmins } = await supabaseAdmin
				.from('user_profiles')
				.select('id, email, full_name')
				.contains('modules', ['dgr']);
			recipients = (dgrAdmins || []).map(a => ({ id: a.id, email: a.email, name: a.full_name }));
		}

		if (recipients.length === 0) {
			await updateTaskStatus(task.id, 'skipped', 'No recipients configured');
			return json({ success: true, message: 'No recipients to notify', skipped: true });
		}

		// Calculate today's date in Brisbane timezone
		const today = brisbaneTime.toISOString().split('T')[0];

		// ==========================================
		// STEP 1: AUTO-PUBLISH APPROVED REFLECTIONS
		// ==========================================
		const publishResults = await autoPublishApprovedReflections(task.config, brisbaneTime, url.origin);

		// ==========================================
		// STEP 2: BUILD AND SEND DIGEST EMAIL
		// ==========================================

		// Get date range (today + next 7 days)
		const nextWeek = new Date(brisbaneTime);
		nextWeek.setDate(nextWeek.getDate() + 7);
		const nextWeekStr = nextWeek.toISOString().split('T')[0];

		// Get all schedule entries for next 7 days
		const { data: upcomingEntries } = await supabaseAdmin
			.from('dgr_schedule')
			.select(`
				id, date, status, reflection_title, digest_notified_at, readings_data,
				contributor:dgr_contributors(name, title)
			`)
			.gte('date', today)
			.lte('date', nextWeekStr)
			.order('date', { ascending: true });

		// SSOT pattern: Get readings for all entries (pending = fresh from lectionary, non-pending = snapshot)
		const readingsMap = await getReadingsForEntries(upcomingEntries || []);

		// Attach correct readings to each entry
		const upcomingWithReadings = (upcomingEntries || []).map(entry => ({
			...entry,
			readings_data: readingsMap.get(entry.id)?.readingsData || entry.readings_data
		}));

		// Get NEW pending items (submitted but never in a digest)
		const { data: newPendingItems } = await supabaseAdmin
			.from('dgr_schedule')
			.select(`
				id, date, status, reflection_title, submitted_at,
				contributor:dgr_contributors(name, title)
			`)
			.eq('status', 'submitted')
			.is('digest_notified_at', null)
			.order('submitted_at', { ascending: true });

		// Get existing pending items (submitted and already notified before)
		const { data: existingPendingItems } = await supabaseAdmin
			.from('dgr_schedule')
			.select(`
				id, date, status, reflection_title, submitted_at, digest_notified_at,
				contributor:dgr_contributors(name, title)
			`)
			.eq('status', 'submitted')
			.not('digest_notified_at', 'is', null)
			.order('submitted_at', { ascending: true });

		// Build email content
		const emailHtml = buildDigestEmail({
			publishResults,
			upcomingEntries: upcomingWithReadings,
			newPendingItems: newPendingItems || [],
			existingPendingItems: existingPendingItems || [],
			today
		});

		// Check if there's anything to report
		const hasPublishResults = publishResults.length > 0;
		const hasNewItems = (newPendingItems?.length || 0) > 0;
		const hasExistingPending = (existingPendingItems?.length || 0) > 0;
		const hasUpcoming = upcomingWithReadings.length > 0;

		if (!hasPublishResults && !hasNewItems && !hasExistingPending && !hasUpcoming) {
			await updateTaskStatus(task.id, 'skipped', 'No items to report');
			return json({ success: true, message: 'Nothing to report', skipped: true });
		}

		// Send email to configured recipients
		const resend = new Resend(RESEND_API_KEY);
		const adminEmails = recipients.map((r: any) => r.email).filter(Boolean);

		const newCount = newPendingItems?.length || 0;
		const publishedCount = publishResults.filter(r => r.success && !r.warning).length;
		const warningCount = publishResults.filter(r => r.success && r.warning).length;
		const failedCount = publishResults.filter(r => !r.success).length;

		let subject = 'DGR Digest: Daily summary';
		if (failedCount > 0) {
			subject = `DGR Digest: ${failedCount} publish failure${failedCount !== 1 ? 's' : ''} - action required`;
		} else if (warningCount > 0) {
			subject = `DGR Digest: ${warningCount} published with warnings - gospel text missing`;
		} else if (publishedCount > 0) {
			subject = `DGR Digest: ${publishedCount} auto-published`;
		} else if (newCount > 0) {
			subject = `DGR Digest: ${newCount} NEW reflection${newCount !== 1 ? 's' : ''} awaiting review`;
		}

		await resend.emails.send({
			from: 'DGR System <noreply@app.archdiocesanministries.org.au>',
			to: adminEmails,
			subject,
			html: emailHtml
		});

		// Mark new items as notified
		if (newPendingItems && newPendingItems.length > 0) {
			const newItemIds = newPendingItems.map(item => item.id);
			await supabaseAdmin
				.from('dgr_schedule')
				.update({ digest_notified_at: new Date().toISOString() })
				.in('id', newItemIds);
		}

		const statusMessage = [
			`Sent to ${adminEmails.length} admin(s)`,
			publishedCount > 0 ? `${publishedCount} auto-published` : null,
			warningCount > 0 ? `${warningCount} with warnings` : null,
			failedCount > 0 ? `${failedCount} failed` : null
		].filter(Boolean).join(', ');

		const taskStatus = failedCount > 0 ? 'error' : warningCount > 0 ? 'warning' : 'success';
		await updateTaskStatus(task.id, taskStatus, statusMessage);

		return json({
			success: true,
			message: 'Digest sent',
			recipients: adminEmails.length,
			stats: {
				autoPublished: publishedCount,
				publishedWithWarnings: warningCount,
				publishFailed: failedCount,
				newPending: newPendingItems?.length || 0,
				existingPending: existingPendingItems?.length || 0,
				upcoming: upcomingEntries?.length || 0
			}
		});

	} catch (error) {
		console.error('DGR daily digest error:', error);
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		// Try to update task status on error
		try {
			const { data: task } = await supabaseAdmin
				.from('scheduled_tasks')
				.select('id')
				.eq('task_type', TASK_TYPE)
				.single();
			if (task) {
				await updateTaskStatus(task.id, 'error', errorMessage);
			}
		} catch {}

		return json({ error: errorMessage }, { status: 500 });
	}
}

/**
 * Auto-publish approved reflections that are within the publish window.
 * On Fridays, publishes further ahead to cover the weekend.
 */
async function autoPublishApprovedReflections(
	config: any,
	brisbaneTime: Date,
	origin: string
): Promise<PublishAttempt[]> {
	const results: PublishAttempt[] = [];

	// Get config value for days ahead (default: 3)
	const basePublishAheadDays = config?.auto_publish_days_ahead ?? 3;

	// On Friday, publish further ahead to cover weekend (Sat, Sun, Mon, Tue)
	const dayOfWeek = brisbaneTime.getDay(); // 0=Sun, 5=Fri, 6=Sat
	const isFriday = dayOfWeek === 5;
	const publishAheadDays = isFriday ? Math.max(basePublishAheadDays, 4) : basePublishAheadDays;

	// Calculate date range: today through publishAheadDays
	// This catches both scheduled auto-publish AND late approvals
	const today = brisbaneTime.toISOString().split('T')[0];
	const publishEndDate = new Date(brisbaneTime);
	publishEndDate.setDate(publishEndDate.getDate() + publishAheadDays);
	const publishEndStr = publishEndDate.toISOString().split('T')[0];

	// Query approved entries within the publish window
	const { data: approvedEntries, error } = await supabaseAdmin
		.from('dgr_schedule')
		.select(`
			id, date, status, reflection_title, reflection_content, gospel_quote,
			liturgical_date, gospel_reference, readings_data,
			contributor:dgr_contributors(name, title, email)
		`)
		.eq('status', 'approved')
		.gte('date', today)
		.lte('date', publishEndStr)
		.order('date', { ascending: true });

	if (error) {
		console.error('Failed to fetch approved entries for auto-publish:', error);
		return results;
	}

	if (!approvedEntries || approvedEntries.length === 0) {
		return results;
	}

	// Process each approved entry
	for (const entry of approvedEntries) {
		// Validate required fields
		if (!entry.reflection_title || !entry.gospel_quote || !entry.reflection_content) {
			results.push({
				date: entry.date,
				title: entry.reflection_title || '(No title)',
				success: false,
				error: 'Missing required fields: title, gospel quote, or content'
			});
			continue;
		}

		try {
			// Get gospel reference from readings_data (checks gospel, second_reading, combined_sources)
			const gospelReference = findGospelReference(entry.readings_data, entry.gospel_reference);

			// Track if gospel text fetch fails
			let gospelFullText = '';
			let gospelWarning: string | undefined;

			if (gospelReference) {
				try {
					const scriptureResponse = await fetch(
						`${origin}/api/scripture?passage=${encodeURIComponent(gospelReference)}&version=NRSVAE`
					);
					if (scriptureResponse.ok) {
						const scriptureData = await scriptureResponse.json();
						if (scriptureData.success && scriptureData.content) {
							gospelFullText = cleanGospelText(scriptureData.content);
							if (!gospelFullText || gospelFullText.trim().length === 0) {
								gospelWarning = `Gospel text empty after parsing (${gospelReference})`;
							}
						} else {
							gospelWarning = `Scripture API returned no content for ${gospelReference}`;
						}
					} else {
						gospelWarning = `Scripture API error ${scriptureResponse.status} for ${gospelReference}`;
					}
				} catch (err) {
					const errMsg = err instanceof Error ? err.message : 'Unknown error';
					gospelWarning = `Failed to fetch gospel text: ${errMsg}`;
					console.warn('Could not fetch gospel text for auto-publish:', err);
				}
			} else {
				gospelWarning = 'No gospel reference found in readings data';
			}

			// Format author name
			const contributor = entry.contributor as { name?: string; title?: string } | null;
			const authorName = contributor?.title
				? `${contributor.title} ${contributor.name}`
				: (contributor?.name || 'Unknown');

			// Build readings array from individual sources (each = one pill)
			const readingsArray = [
				entry.readings_data?.first_reading?.source,
				entry.readings_data?.psalm?.source,
				entry.readings_data?.second_reading?.source,
				entry.readings_data?.gospel?.source
			].filter(Boolean) as string[];

			// Call the publisher
			const publishResult = await publishDGRToWordPress({
				date: entry.date,
				liturgicalDate: entry.liturgical_date || '',
				readings: entry.readings_data?.combined_sources || '',
				readingsArray,
				title: entry.reflection_title,
				gospelQuote: entry.gospel_quote,
				reflectionText: entry.reflection_content,
				authorName,
				gospelFullText,
				gospelReference,
				templateKey: 'default'
			});

			if (publishResult.success) {
				// Update schedule status to published
				await supabaseAdmin
					.from('dgr_schedule')
					.update({
						status: 'published',
						published_at: new Date().toISOString()
					})
					.eq('id', entry.id);

				results.push({
					date: entry.date,
					title: entry.reflection_title,
					success: true,
					link: publishResult.link,
					warning: gospelWarning
				});
			} else {
				results.push({
					date: entry.date,
					title: entry.reflection_title,
					success: false,
					error: publishResult.error
				});
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Unknown error';
			results.push({
				date: entry.date,
				title: entry.reflection_title || '(No title)',
				success: false,
				error: errorMessage
			});
		}
	}

	return results;
}

async function updateTaskStatus(taskId: string, status: string, message: string) {
	await supabaseAdmin
		.from('scheduled_tasks')
		.update({
			last_run_at: new Date().toISOString(),
			last_run_status: status,
			last_run_message: message,
			updated_at: new Date().toISOString()
		})
		.eq('id', taskId);
}

function buildDigestEmail({
	publishResults,
	upcomingEntries,
	newPendingItems,
	existingPendingItems,
	today
}: {
	publishResults: PublishAttempt[];
	upcomingEntries: any[];
	newPendingItems: any[];
	existingPendingItems: any[];
	today: string;
}) {
	const formatDate = (dateStr: string) => {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
	};

	const formatContributor = (contributor: any) => {
		if (!contributor) return 'Unassigned';
		return contributor.title
			? `${contributor.title} ${contributor.name}`
			: contributor.name;
	};

	const statusBadge = (status: string) => {
		const colors: Record<string, string> = {
			pending: '#f59e0b',
			submitted: '#3b82f6',
			approved: '#22c55e',
			published: '#8b5cf6'
		};
		const labels: Record<string, string> = {
			pending: 'Pending',
			submitted: 'Needs Review',
			approved: 'Approved',
			published: 'Published'
		};
		return `<span style="background-color: ${colors[status] || '#6b7280'}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px;">${labels[status] || status}</span>`;
	};

	// Format readings from readings_data (single source of truth)
	const formatReadings = (readingsData: any) => {
		if (!readingsData) return '';
		const parts = [];
		if (readingsData.first_reading?.source) parts.push(readingsData.first_reading.source);
		if (readingsData.psalm?.source) parts.push(`Ps ${readingsData.psalm.source}`);
		if (readingsData.gospel?.source) parts.push(readingsData.gospel.source);
		if (parts.length === 0) return '';
		return `<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${parts.join(' · ')}</div>`;
	};

	let html = `
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
			<h2 style="color: #009199; margin-bottom: 24px;">DGR Daily Digest</h2>
	`;

	// AUTO-PUBLISH RESULTS (show at top if any)
	const publishSuccesses = publishResults.filter(r => r.success && !r.warning);
	const publishWarnings = publishResults.filter(r => r.success && r.warning);
	const publishFailures = publishResults.filter(r => !r.success);

	if (publishSuccesses.length > 0) {
		html += `
			<div style="background-color: #ecfdf5; border-left: 4px solid #10b981; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
				<h3 style="color: #065f46; margin: 0 0 12px 0;">Auto-Published Today (${publishSuccesses.length})</h3>
				<table style="width: 100%; border-collapse: collapse;">
		`;
		for (const item of publishSuccesses) {
			html += `
				<tr>
					<td style="padding: 8px 0; border-bottom: 1px solid #d1fae5;">
						<strong>${formatDate(item.date)}</strong> - ${item.title}
						${item.link ? `<br><a href="${item.link}" style="color: #059669; font-size: 12px;">View on website</a>` : ''}
					</td>
				</tr>
			`;
		}
		html += `</table></div>`;
	}

	if (publishWarnings.length > 0) {
		html += `
			<div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
				<h3 style="color: #92400e; margin: 0 0 12px 0;">Published with Warnings (${publishWarnings.length})</h3>
				<p style="color: #78350f; font-size: 13px; margin-bottom: 12px;">These reflections were published but are missing gospel text:</p>
				<table style="width: 100%; border-collapse: collapse;">
		`;
		for (const item of publishWarnings) {
			html += `
				<tr>
					<td style="padding: 8px 0; border-bottom: 1px solid #fde68a;">
						<strong>${formatDate(item.date)}</strong> - ${item.title}
						${item.link ? `<br><a href="${item.link}" style="color: #d97706; font-size: 12px;">View on website</a>` : ''}
						<br><span style="color: #b45309; font-size: 11px;">${item.warning}</span>
					</td>
				</tr>
			`;
		}
		html += `</table></div>`;
	}

	if (publishFailures.length > 0) {
		html += `
			<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
				<h3 style="color: #991b1b; margin: 0 0 12px 0;">Failed to Auto-Publish (${publishFailures.length})</h3>
				<p style="color: #7f1d1d; font-size: 13px; margin-bottom: 12px;">These reflections need manual attention:</p>
				<table style="width: 100%; border-collapse: collapse;">
		`;
		for (const item of publishFailures) {
			html += `
				<tr>
					<td style="padding: 8px 0; border-bottom: 1px solid #fecaca;">
						<strong>${formatDate(item.date)}</strong> - ${item.title}
						<br><span style="color: #dc2626; font-size: 12px;">${item.error}</span>
					</td>
				</tr>
			`;
		}
		html += `</table></div>`;
	}

	// NEW items section (highlighted)
	if (newPendingItems.length > 0) {
		html += `
			<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
				<h3 style="color: #92400e; margin: 0 0 12px 0;">NEW - Awaiting Review (${newPendingItems.length})</h3>
				<table style="width: 100%; border-collapse: collapse;">
		`;
		for (const item of newPendingItems) {
			html += `
				<tr>
					<td style="padding: 8px 0; border-bottom: 1px solid #fde68a;">
						<strong>${formatDate(item.date)}</strong><br>
						<span style="color: #666;">${formatContributor(item.contributor)}</span>
						${item.reflection_title ? `<br><em>"${item.reflection_title}"</em>` : ''}
					</td>
				</tr>
			`;
		}
		html += `</table></div>`;
	}

	// Existing pending items
	if (existingPendingItems.length > 0) {
		html += `
			<div style="background-color: #f3f4f6; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
				<h3 style="color: #374151; margin: 0 0 12px 0;">Still Awaiting Review (${existingPendingItems.length})</h3>
				<table style="width: 100%; border-collapse: collapse;">
		`;
		for (const item of existingPendingItems) {
			html += `
				<tr>
					<td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
						<strong>${formatDate(item.date)}</strong> - ${formatContributor(item.contributor)}
						${item.reflection_title ? ` - <em>"${item.reflection_title}"</em>` : ''}
					</td>
				</tr>
			`;
		}
		html += `</table></div>`;
	}

	// Upcoming 7 days
	if (upcomingEntries.length > 0) {
		html += `
			<div style="margin-bottom: 24px;">
				<h3 style="color: #374151; margin: 0 0 12px 0;">Next 7 Days</h3>
				<table style="width: 100%; border-collapse: collapse;">
		`;
		for (const entry of upcomingEntries) {
			const isToday = entry.date === today;
			html += `
				<tr style="${isToday ? 'background-color: #ecfdf5;' : ''}">
					<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; width: 100px; vertical-align: top;">
						<strong>${formatDate(entry.date)}</strong>
						${isToday ? '<br><span style="color: #059669; font-size: 11px;">TODAY</span>' : ''}
					</td>
					<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
						${formatContributor(entry.contributor)}
						${formatReadings(entry.readings_data)}
					</td>
					<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right; vertical-align: top;">
						${statusBadge(entry.status || 'pending')}
					</td>
				</tr>
			`;
		}
		html += `</table></div>`;
	}

	// Footer with link
	html += `
			<div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
				<a href="https://app.archdiocesanministries.org.au/dgr"
				   style="display: inline-block; background-color: #009199; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
					View DGR Dashboard
				</a>
			</div>
		</div>
	`;

	return html;
}

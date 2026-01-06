import { json } from '@sveltejs/kit';
import { RESEND_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { Resend } from 'resend';

const TASK_TYPE = 'dgr_digest';

export async function GET({ request }) {
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

		// Get date range (today + next 7 days)
		const today = brisbaneTime.toISOString().split('T')[0];
		const nextWeek = new Date(brisbaneTime);
		nextWeek.setDate(nextWeek.getDate() + 7);
		const nextWeekStr = nextWeek.toISOString().split('T')[0];

		// Get all schedule entries for next 7 days
		const { data: upcomingEntries } = await supabaseAdmin
			.from('dgr_schedule')
			.select(`
				id, date, status, reflection_title, digest_notified_at,
				contributor:dgr_contributors(name, title)
			`)
			.gte('date', today)
			.lte('date', nextWeekStr)
			.order('date', { ascending: true });

		// Get scripture readings for the date range
		const { data: readings } = await supabaseAdmin
			.from('ordo_lectionary_mapping')
			.select(`
				calendar_date,
				lectionary:lectionary_readings(first_reading, psalm, gospel_reading, liturgical_day)
			`)
			.gte('calendar_date', today)
			.lte('calendar_date', nextWeekStr);

		// Create a map of date -> readings for easy lookup
		const readingsMap = new Map();
		for (const r of readings || []) {
			if (r.lectionary) {
				readingsMap.set(r.calendar_date, r.lectionary);
			}
		}

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
			upcomingEntries: upcomingEntries || [],
			newPendingItems: newPendingItems || [],
			existingPendingItems: existingPendingItems || [],
			readingsMap,
			today
		});

		// Check if there's anything to report
		const hasNewItems = (newPendingItems?.length || 0) > 0;
		const hasExistingPending = (existingPendingItems?.length || 0) > 0;
		const hasUpcoming = (upcomingEntries?.length || 0) > 0;

		if (!hasNewItems && !hasExistingPending && !hasUpcoming) {
			await updateTaskStatus(task.id, 'skipped', 'No items to report');
			return json({ success: true, message: 'Nothing to report', skipped: true });
		}

		// Send email to configured recipients
		const resend = new Resend(RESEND_API_KEY);
		const adminEmails = recipients.map((r: any) => r.email).filter(Boolean);

		const newCount = newPendingItems?.length || 0;
		const subject = newCount > 0
			? `DGR Digest: ${newCount} NEW reflection${newCount !== 1 ? 's' : ''} awaiting review`
			: `DGR Digest: Daily summary`;

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

		await updateTaskStatus(task.id, 'success', `Sent to ${adminEmails.length} admin(s)`);

		return json({
			success: true,
			message: 'Digest sent',
			recipients: adminEmails.length,
			stats: {
				newPending: newPendingItems?.length || 0,
				existingPending: existingPendingItems?.length || 0,
				upcoming: upcomingEntries?.length || 0
			}
		});

	} catch (error) {
		console.error('DGR daily digest error:', error);

		// Try to update task status on error
		try {
			const { data: task } = await supabaseAdmin
				.from('scheduled_tasks')
				.select('id')
				.eq('task_type', TASK_TYPE)
				.single();
			if (task) {
				await updateTaskStatus(task.id, 'error', error.message);
			}
		} catch {}

		return json({ error: error.message }, { status: 500 });
	}
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
	upcomingEntries,
	newPendingItems,
	existingPendingItems,
	readingsMap,
	today
}: {
	upcomingEntries: any[];
	newPendingItems: any[];
	existingPendingItems: any[];
	readingsMap: Map<string, any>;
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

	const formatReadings = (readings: any) => {
		if (!readings) return '';
		const parts = [];
		if (readings.first_reading) parts.push(readings.first_reading);
		if (readings.psalm) parts.push(`Ps ${readings.psalm}`);
		if (readings.gospel_reading) parts.push(readings.gospel_reading);
		if (parts.length === 0) return '';
		return `<div style="font-size: 11px; color: #6b7280; margin-top: 4px;">${parts.join(' · ')}</div>`;
	};

	let html = `
		<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
			<h2 style="color: #009199; margin-bottom: 24px;">DGR Daily Digest</h2>
	`;

	// NEW items section (highlighted)
	if (newPendingItems.length > 0) {
		html += `
			<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; margin-bottom: 24px; border-radius: 4px;">
				<h3 style="color: #92400e; margin: 0 0 12px 0;">🆕 NEW - Awaiting Review (${newPendingItems.length})</h3>
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
			const readings = readingsMap.get(entry.date);
			html += `
				<tr style="${isToday ? 'background-color: #ecfdf5;' : ''}">
					<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; width: 100px; vertical-align: top;">
						<strong>${formatDate(entry.date)}</strong>
						${isToday ? '<br><span style="color: #059669; font-size: 11px;">TODAY</span>' : ''}
					</td>
					<td style="padding: 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top;">
						${formatContributor(entry.contributor)}
						${formatReadings(readings)}
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

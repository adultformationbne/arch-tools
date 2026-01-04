import { json } from '@sveltejs/kit';
import { CRON_SECRET, RESEND_API_KEY } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { Resend } from 'resend';

export async function GET({ request }) {
	// Verify cron secret (Vercel sends this header)
	const authHeader = request.headers.get('authorization');
	if (authHeader !== `Bearer ${CRON_SECRET}`) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		// Count pending reflections (status = 'submitted')
		const { count: pendingCount } = await supabaseAdmin
			.from('dgr_schedule')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'submitted');

		// Count approved but not published
		const { count: approvedCount } = await supabaseAdmin
			.from('dgr_schedule')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'approved');

		// Get entries due in next 7 days that are still pending
		const today = new Date().toISOString().split('T')[0];
		const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

		const { count: dueSoonCount } = await supabaseAdmin
			.from('dgr_schedule')
			.select('*', { count: 'exact', head: true })
			.eq('status', 'pending')
			.gte('date', today)
			.lte('date', nextWeek);

		// Only send email if there's something to report
		const hasItems = (pendingCount || 0) > 0 || (approvedCount || 0) > 0 || (dueSoonCount || 0) > 0;

		if (!hasItems) {
			return json({ success: true, message: 'No items to report, skipping email' });
		}

		// Send digest email
		const resend = new Resend(RESEND_API_KEY);

		const emailHtml = `
			<h2>DGR Daily Digest</h2>
			<p>Here's your daily summary:</p>
			<ul>
				<li><strong>${pendingCount || 0}</strong> reflections awaiting review</li>
				<li><strong>${approvedCount || 0}</strong> approved reflections ready to publish</li>
				<li><strong>${dueSoonCount || 0}</strong> pending reflections due in the next 7 days</li>
			</ul>
			<p><a href="https://app.archdiocesanministries.org.au/dgr">View DGR Dashboard</a></p>
		`;

		await resend.emails.send({
			from: 'DGR System <notifications@archdiocesanministries.org.au>',
			to: 'me@liamdesic.co',
			subject: `DGR Daily Digest: ${pendingCount || 0} pending reviews`,
			html: emailHtml
		});

		return json({
			success: true,
			message: 'Digest sent',
			stats: { pendingCount, approvedCount, dueSoonCount }
		});

	} catch (error) {
		console.error('DGR daily digest error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

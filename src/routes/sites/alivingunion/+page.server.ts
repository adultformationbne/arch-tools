import { fail } from '@sveltejs/kit';
import { RESEND_API_KEY } from '$env/static/private';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { sendEmail } from '$lib/utils/email-service.js';
import { escapeHtml } from '$lib/utils/dgr-common.js';
import { SITE } from './site';
import type { Actions } from './$types';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Best-effort per-instance throttle; the honeypot does most of the spam work
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function throttled(ip: string): boolean {
	const now = Date.now();
	const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
	hits.push(now);
	recent.set(ip, hits);
	return hits.length > MAX_PER_WINDOW;
}

const field = (data: FormData, key: string, max: number) =>
	String(data.get(key) ?? '').trim().slice(0, max);

export const actions: Actions = {
	interest: async (event) => {
		const data = await event.request.formData();

		// Honeypot: bots fill every field; people never see this one
		if (field(data, 'website', 200)) return { success: true };

		const name = field(data, 'name', 120);
		const email = field(data, 'email', 200).toLowerCase();
		const parish = field(data, 'parish', 160);
		const message = field(data, 'message', 2000);
		const values = { name, email, parish, message };

		if (!name) return fail(400, { values, error: 'Please tell us your name.' });
		if (!EMAIL_RE.test(email)) return fail(400, { values, error: 'Please enter a valid email address.' });

		let ip = 'unknown';
		try {
			ip = event.getClientAddress();
		} catch {
			// not available in some adapters/dev setups
		}
		if (throttled(ip)) {
			return fail(429, { values, error: 'Thanks — we have already received your details.' });
		}

		const rows = [
			['Name', name],
			['Email', email],
			['Parish', parish || '—'],
			['Message', message || '—']
		]
			.map(
				([label, value]) =>
					`<tr><td style="padding:6px 16px 6px 0;color:#6b6456;vertical-align:top">${label}</td><td style="padding:6px 0;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`
			)
			.join('');

		const html = `<div style="font-family:Georgia,serif;color:#3a342b;font-size:15px">
<p>Someone has registered interest in <strong>${SITE.name}</strong> on alivingunion.com.</p>
<table style="border-collapse:collapse">${rows}</table>
<p style="color:#6b6456;font-size:13px">Reply to this email to respond to them directly.</p>
</div>`;

		const result = await sendEmail({
			to: SITE.interestEmail,
			subject: `${SITE.name} — interest from ${name}`,
			html,
			emailType: 'alu_interest',
			replyTo: email,
			metadata: { source: 'alivingunion.com', name, email, parish },
			resendApiKey: RESEND_API_KEY,
			supabase: supabaseAdmin
		});

		if (!result.success) {
			console.error('ALU interest email failed:', result.error);
			return fail(500, {
				values,
				error: `Sorry, something went wrong. Please email us at ${SITE.contactEmail}.`
			});
		}

		return { success: true };
	}
};

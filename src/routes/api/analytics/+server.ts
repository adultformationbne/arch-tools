import type { RequestHandler } from './$types';
import { checkRateLimit } from '$lib/server/rate-limit';
import { isBot, recordBatch } from '$lib/server/analytics';

/**
 * Collects page views and video watching from $lib/analytics/tracker.ts.
 *
 * Public: anyone viewing the site sends here, signed in or not. The body is JSON sent
 * as text/plain (navigator.sendBeacon), and the response is always 204 so a tracker
 * never retries or surfaces an error. Also served on course marketing domains (see
 * hooks.server.ts) so their beacons stay same-origin.
 */

const MAX_BODY_BYTES = 64 * 1024;

export const POST: RequestHandler = async (event) => {
	const { request, getClientAddress, locals, url } = event;
	const done = () => new Response(null, { status: 204 });

	const userAgent = request.headers.get('user-agent') ?? '';
	if (isBot(userAgent)) return done();

	// Heartbeats come every 15s per playing video; this is well above a real viewer
	let ip = 'unknown';
	try {
		ip = getClientAddress();
	} catch {
		// not available in some adapters / tests
	}
	if (!checkRateLimit(`analytics:${ip}`, 120, 60_000)) return done();

	let events: unknown[];
	try {
		const raw = await request.text();
		if (raw.length > MAX_BODY_BYTES) return done();
		const body = JSON.parse(raw);
		events = Array.isArray(body?.events) ? body.events : [];
	} catch {
		return done();
	}
	if (events.length === 0) return done();

	let userId: string | null = null;
	try {
		userId = (await locals.safeGetSession()).user?.id ?? null;
	} catch {
		// anonymous
	}

	try {
		await recordBatch(events, {
			host: url.host,
			userAgent,
			country: request.headers.get('x-vercel-ip-country'),
			userId
		});
	} catch (err) {
		console.error('[analytics] failed to record batch:', err instanceof Error ? err.message : err);
	}
	return done();
};

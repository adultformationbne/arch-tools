import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireModule } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Site-wide analytics for Settings > Analytics (platform admins only).
 * GET ?days=7|30|90|365 — whole Brisbane days, ending today, plus the same span before
 * it for comparison. All figures come from the analytics_overview() database function.
 */

const RANGES = new Set([7, 30, 90, 365]);
const DAY_MS = 86_400_000;
// Brisbane has no daylight saving, so a fixed offset gives exact day boundaries
const BRISBANE_OFFSET_MS = 10 * 3_600_000;

export const GET: RequestHandler = async (event) => {
	await requireModule(event, 'platform.admin');

	const requested = Number(event.url.searchParams.get('days'));
	const days = RANGES.has(requested) ? requested : 30;

	const now = Date.now();
	const startOfToday = Math.floor((now + BRISBANE_OFFSET_MS) / DAY_MS) * DAY_MS - BRISBANE_OFFSET_MS;
	const from = new Date(startOfToday - (days - 1) * DAY_MS);
	const to = new Date(startOfToday + DAY_MS);

	const { data, error } = await supabaseAdmin.rpc('analytics_overview', {
		p_from: from.toISOString(),
		p_to: to.toISOString()
	});

	if (error) {
		console.error('Error loading analytics overview:', error);
		return json({ error: 'Failed to load analytics' }, { status: 500 });
	}

	return json({ days, from: from.toISOString(), to: to.toISOString(), ...(data as object) });
};

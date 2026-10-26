/**
 * First-party analytics, server side: validates the batches the browser tracker
 * ($lib/analytics/tracker.ts) sends to /api/analytics and stores them.
 *
 * The endpoint is public, so everything from the browser is untrusted: ids must be
 * UUIDs, strings are clipped, numbers are clamped, and a row can only be updated by
 * the visitor id that created it. No IP address or user agent string is stored.
 */
import { supabaseAdmin } from '$lib/server/supabase.js';
import { courseDomainForHost } from '$lib/config/course-domains';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor|curl|wget|python|axios|node-fetch/i;

/** Longest video we will believe (12 hours) */
const MAX_SECONDS = 12 * 3600;
export const MAX_EVENTS_PER_BATCH = 50;

export interface RequestContext {
	host: string;
	userAgent: string;
	country: string | null;
	userId: string | null;
}

const uuidOrNull = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null);
const text = (v: unknown, max = 500) => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null);
const seconds = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? Math.min(Math.max(n, 0), MAX_SECONDS) : 0;
};
const count = (v: unknown) => {
	const n = typeof v === 'number' ? v : Number(v);
	return Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 0), 100_000) : 0;
};

export function isBot(userAgent: string): boolean {
	return !userAgent || BOT.test(userAgent);
}

export function deviceFrom(userAgent: string): 'mobile' | 'tablet' | 'desktop' {
	if (/ipad|tablet|kindle|silk|(android(?!.*mobile))/i.test(userAgent)) return 'tablet';
	if (/mobi|iphone|ipod|android/i.test(userAgent)) return 'mobile';
	return 'desktop';
}

/** Course a page belongs to: from the route, or the marketing domain it was served on. */
function courseSlugFor(host: string, routeId: string | null, sent: string | null): string | null {
	if (sent) return sent;
	if (routeId?.startsWith('/sites/')) return courseDomainForHost(host)?.slug ?? null;
	return null;
}

export function parsePageView(e: Record<string, unknown>, ctx: RequestContext) {
	const id = uuidOrNull(e.id);
	const visitorId = uuidOrNull(e.visitorId);
	const sessionId = uuidOrNull(e.sessionId);
	const path = text(e.path, 1000);
	if (!id || !visitorId || !sessionId || !path) return null;
	const routeId = text(e.routeId, 300);
	return {
		id,
		visitor_id: visitorId,
		session_id: sessionId,
		user_id: ctx.userId,
		host: ctx.host,
		path,
		route_id: routeId,
		course_slug: courseSlugFor(ctx.host, routeId, text(e.courseSlug, 200)),
		referrer_host: text(e.referrerHost, 255),
		utm_source: text(e.utmSource, 200),
		utm_medium: text(e.utmMedium, 200),
		utm_campaign: text(e.utmCampaign, 200),
		device: deviceFrom(ctx.userAgent),
		country: ctx.country
	};
}

export function parsePageEnd(e: Record<string, unknown>) {
	const id = uuidOrNull(e.id);
	const visitorId = uuidOrNull(e.visitorId);
	if (!id || !visitorId) return null;
	// A page left open for days is not days of reading
	return { id, visitorId, engagedSeconds: Math.min(count(e.engagedSeconds), 6 * 3600) };
}

export function parseVideo(e: Record<string, unknown>, ctx: RequestContext) {
	const id = uuidOrNull(e.id);
	const visitorId = uuidOrNull(e.visitorId);
	const sessionId = uuidOrNull(e.sessionId);
	const playbackId = text(e.playbackId, 200);
	const path = text(e.path, 1000);
	if (!id || !visitorId || !sessionId || !playbackId || !path) return null;

	const duration = e.duration == null ? null : seconds(e.duration) || null;
	const cap = (n: number) => (duration ? Math.min(n, duration) : n);

	const ranges = Array.isArray(e.ranges)
		? e.ranges
				.slice(0, 200)
				.filter((r): r is [number, number] => Array.isArray(r) && r.length === 2)
				.map(([s, end]) => [cap(seconds(s)), cap(seconds(end))])
				.filter(([s, end]) => end > s)
		: [];

	return {
		id,
		visitor_id: visitorId,
		session_id: sessionId,
		user_id: ctx.userId,
		page_view_id: uuidOrNull(e.pageViewId),
		material_id: uuidOrNull(e.materialId),
		playback_id: playbackId,
		host: ctx.host,
		path,
		route_id: text(e.routeId, 300),
		device: deviceFrom(ctx.userAgent),
		country: ctx.country,
		duration_seconds: duration,
		watched_seconds: cap(seconds(e.watchedSeconds)),
		// Rewatching can exceed the length, but not without limit
		play_seconds: duration ? Math.min(seconds(e.playSeconds), duration * 20) : seconds(e.playSeconds),
		max_position_seconds: cap(seconds(e.maxPosition)),
		watched_ranges: ranges,
		plays: count(e.plays),
		seeks: count(e.seeks),
		completed: e.completed === true
	};
}

// Material + course for a video: by the material id the page sent (YouTube embeds), else
// by Mux playback id. Materials rarely change, so cache per instance.
const materialCache = new Map<string, { materialId: string | null; courseSlug: string | null; at: number }>();
const MATERIAL_TTL_MS = 10 * 60_000;

async function materialFor(playbackId: string, materialId: string | null) {
	const key = materialId ?? playbackId;
	const hit = materialCache.get(key);
	if (hit && Date.now() - hit.at < MATERIAL_TTL_MS) return hit;

	const query = supabaseAdmin
		.from('courses_materials')
		.select(
			`id, session:courses_sessions!session_id ( module:courses_modules!module_id ( course:courses!course_id ( slug ) ) )`
		);
	const { data } = await (materialId ? query.eq('id', materialId) : query.eq('mux_playback_id', playbackId))
		.limit(1)
		.maybeSingle();

	const one = <T>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v);
	const course = one(one(one((data as any)?.session)?.module)?.course) as { slug?: string } | undefined;
	const entry = { materialId: (data?.id as string) ?? null, courseSlug: course?.slug ?? null, at: Date.now() };
	if (materialCache.size > 1000) materialCache.clear();
	materialCache.set(key, entry);
	return entry;
}

/** Store one batch. Bad events are dropped; a database error is logged, never thrown. */
export async function recordBatch(events: unknown[], ctx: RequestContext) {
	const pageViews: NonNullable<ReturnType<typeof parsePageView>>[] = [];
	const pageEnds: NonNullable<ReturnType<typeof parsePageEnd>>[] = [];
	const videos: NonNullable<ReturnType<typeof parseVideo>>[] = [];

	for (const raw of events.slice(0, MAX_EVENTS_PER_BATCH)) {
		if (!raw || typeof raw !== 'object') continue;
		const e = raw as Record<string, unknown>;
		if (e.type === 'pageview') {
			const row = parsePageView(e, ctx);
			if (row) pageViews.push(row);
		} else if (e.type === 'pageend') {
			const row = parsePageEnd(e);
			if (row) pageEnds.push(row);
		} else if (e.type === 'video') {
			const row = parseVideo(e, ctx);
			if (row) videos.push(row);
		}
	}

	// Page views first: a pageend in the same batch may be for one of them
	if (pageViews.length) {
		const { error } = await supabaseAdmin
			.from('analytics_page_views')
			.upsert(pageViews, { onConflict: 'id', ignoreDuplicates: true });
		if (error) console.error('[analytics] page views:', error.message);
	}

	await Promise.all([
		...pageEnds.map(async ({ id, visitorId, engagedSeconds }) => {
			const { error } = await supabaseAdmin
				.from('analytics_page_views')
				.update({ engaged_seconds: engagedSeconds, updated_at: new Date().toISOString() })
				.eq('id', id)
				.eq('visitor_id', visitorId)
				.lt('engaged_seconds', engagedSeconds);
			if (error) console.error('[analytics] page end:', error.message);
		}),
		...videos.map(async (row) => {
			const material = await materialFor(row.playback_id, row.material_id);
			const { error } = await supabaseAdmin.rpc('analytics_record_video_view', {
				p: { ...row, material_id: material.materialId, course_slug: material.courseSlug }
			});
			if (error) console.error('[analytics] video:', error.message);
		})
	]);
}

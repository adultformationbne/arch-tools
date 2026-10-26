/**
 * First-party analytics, browser side. Records page views (and how long each page was
 * looked at) and video watching, and sends them to /api/analytics, which stores them in
 * analytics_page_views / analytics_video_views.
 *
 * Visitors are an anonymous random id in localStorage; a session ends after 30 minutes
 * without activity. Events are batched and sent with sendBeacon so they survive the tab
 * closing. Nothing here may ever throw into the page: analytics failing is silent.
 */
import { WatchProgress } from './watch-progress';

const ENDPOINT = '/api/analytics';
const VISITOR_KEY = 'af_vid';
const SESSION_KEY = 'af_sid';
const SESSION_IDLE_MS = 30 * 60_000;
/** How often a playing video reports its progress */
const VIDEO_HEARTBEAT_MS = 15_000;

type AnalyticsEvent = Record<string, unknown> & { type: 'pageview' | 'pageend' | 'video' };

const browser = typeof window !== 'undefined';

function uuid(): string {
	if (browser && crypto?.randomUUID) return crypto.randomUUID();
	// Older browsers / insecure contexts
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
	});
}

function stored(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}
function store(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Private mode / blocked storage: ids just last for this page load
	}
}

let memoryVisitor: string | null = null;
function visitorId(): string {
	const existing = stored(VISITOR_KEY) ?? memoryVisitor;
	if (existing) return existing;
	memoryVisitor = uuid();
	store(VISITOR_KEY, memoryVisitor);
	return memoryVisitor;
}

let memorySession: { id: string; at: number } | null = null;
function sessionId(): string {
	const now = Date.now();
	let current = memorySession;
	try {
		const raw = stored(SESSION_KEY);
		if (raw) current = JSON.parse(raw);
	} catch {
		// fall through to a new session
	}
	if (!current?.id || now - current.at > SESSION_IDLE_MS) current = { id: uuid(), at: now };
	current.at = now;
	memorySession = current;
	store(SESSION_KEY, JSON.stringify(current));
	return current.id;
}

// ---- Sending ----------------------------------------------------------------

let queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function enqueue(event: AnalyticsEvent, now = false) {
	if (!browser) return;
	queue.push(event);
	if (now) flush();
	else if (!flushTimer) flushTimer = setTimeout(flush, 1000);
}

function flush() {
	if (flushTimer) clearTimeout(flushTimer);
	flushTimer = null;
	if (queue.length === 0) return;
	const body = JSON.stringify({ events: queue });
	queue = [];
	try {
		// text/plain keeps it a "simple" request; the endpoint parses it as JSON
		const blob = new Blob([body], { type: 'text/plain' });
		if (navigator.sendBeacon?.(ENDPOINT, blob)) return;
		fetch(ENDPOINT, { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
	} catch {
		// ignore
	}
}

// ---- Page views -------------------------------------------------------------

interface CurrentPage {
	id: string;
	routeId: string | null;
	visibleSince: number | null;
	engagedMs: number;
}
let page: CurrentPage | null = null;

function engagedSeconds(p: CurrentPage) {
	const live = p.visibleSince !== null ? Date.now() - p.visibleSince : 0;
	return Math.round((p.engagedMs + live) / 1000);
}

function endPage(now: boolean) {
	if (!page) return;
	enqueue({ type: 'pageend', id: page.id, visitorId: visitorId(), engagedSeconds: engagedSeconds(page) }, now);
}

let listening = false;
function listen() {
	if (listening || !browser) return;
	listening = true;
	document.addEventListener('visibilitychange', () => {
		if (!page) return;
		if (document.visibilityState === 'hidden') {
			if (page.visibleSince !== null) page.engagedMs += Date.now() - page.visibleSince;
			page.visibleSince = null;
			// The tab may never come back; report what we have now
			endPage(false);
			flush();
		} else {
			page.visibleSince = Date.now();
			sessionId();
		}
	});
	window.addEventListener('pagehide', flush);
}

export interface PageInfo {
	url: URL;
	routeId: string | null;
	params: Record<string, string>;
}

/** Record a page view. Call after every navigation, including the first load. */
export function trackPageView({ url, routeId, params }: PageInfo) {
	if (!browser) return;
	try {
		listen();
		endPage(false);

		page = { id: uuid(), routeId, visibleSince: document.visibilityState === 'visible' ? Date.now() : null, engagedMs: 0 };

		const courseSlug =
			params.course_slug ?? (routeId?.startsWith('/courses/[slug]') ? params.slug : undefined) ?? null;

		let referrerHost: string | null = null;
		try {
			const ref = document.referrer ? new URL(document.referrer) : null;
			if (ref && ref.host !== location.host) referrerHost = ref.host;
		} catch {
			// unparseable referrer
		}

		enqueue({
			type: 'pageview',
			id: page.id,
			visitorId: visitorId(),
			sessionId: sessionId(),
			path: url.pathname,
			routeId,
			courseSlug,
			referrerHost,
			utmSource: url.searchParams.get('utm_source'),
			utmMedium: url.searchParams.get('utm_medium'),
			utmCampaign: url.searchParams.get('utm_campaign')
		});
	} catch {
		// never break the page
	}
}

// ---- Video ------------------------------------------------------------------

/**
 * Track how much of a video is watched. `el` is a <mux-player>, or anything shaped like a
 * media element (see youtube.ts). `materialId` is the courses_materials row when the
 * caller knows it; otherwise the server finds it from the Mux playback id.
 * Nothing is recorded until the viewer first presses play. Returns a cleanup function.
 */
export function trackVideo(
	el: HTMLMediaElement,
	{ playbackId, materialId = null }: { playbackId: string; materialId?: string | null }
): () => void {
	if (!browser || !el) return () => {};

	const id = uuid();
	const pageViewId = page?.id ?? null;
	const routeId = page?.routeId ?? null;
	const path = location.pathname;
	const progress = new WatchProgress();
	let started = false;
	let lastSent = '';
	let heartbeat: ReturnType<typeof setInterval> | null = null;

	const report = (now = false) => {
		if (!started) return;
		if (Number.isFinite(el.duration) && el.duration > 0) progress.duration = el.duration;
		const snap = progress.snapshot();
		const key = JSON.stringify(snap);
		if (key === lastSent) return;
		lastSent = key;
		enqueue(
			{ type: 'video', id, visitorId: visitorId(), sessionId: sessionId(), pageViewId, playbackId, materialId, path, routeId, ...snap },
			now
		);
	};

	const onPlay = () => {
		started = true;
		progress.play(el.currentTime);
		if (!heartbeat) heartbeat = setInterval(() => report(), VIDEO_HEARTBEAT_MS);
		report(true);
	};
	const onTime = () => {
		if (!el.paused) progress.tick(el.currentTime);
	};
	const stopBeat = () => {
		if (heartbeat) clearInterval(heartbeat);
		heartbeat = null;
	};
	const onPause = () => {
		progress.tick(el.currentTime);
		progress.stop();
		stopBeat();
		report(true);
	};
	// After a seek the next tick just picks up from the new position
	const onSeeking = () => {
		if (started) progress.seek();
	};
	const onEnded = () => {
		progress.tick(el.currentTime);
		progress.finish();
		stopBeat();
		report(true);
	};
	const onHidden = () => {
		if (document.visibilityState === 'hidden') report(true);
	};

	el.addEventListener('play', onPlay);
	el.addEventListener('timeupdate', onTime);
	el.addEventListener('pause', onPause);
	el.addEventListener('seeking', onSeeking);
	el.addEventListener('ended', onEnded);
	document.addEventListener('visibilitychange', onHidden);

	return () => {
		stopBeat();
		if (!el.paused) progress.tick(el.currentTime);
		report(true);
		el.removeEventListener('play', onPlay);
		el.removeEventListener('timeupdate', onTime);
		el.removeEventListener('pause', onPause);
		el.removeEventListener('seeking', onSeeking);
		el.removeEventListener('ended', onEnded);
		document.removeEventListener('visibilitychange', onHidden);
	};
}

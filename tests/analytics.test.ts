import { describe, it, expect, vi } from 'vitest';
import { WatchProgress, mergeRanges } from '$lib/analytics/watch-progress';

vi.mock('$lib/server/supabase.js', () => ({ supabaseAdmin: {} }));
const { parseVideo, parsePageView, parsePageEnd, isBot, deviceFrom } = await import('$lib/server/analytics');

/** Plays from `from` to `to` in quarter-second ticks, like timeupdate does. */
function play(p: WatchProgress, from: number, to: number) {
	p.play(from);
	for (let t = from + 0.25; t <= to + 1e-9; t += 0.25) p.tick(t);
	p.stop();
}

describe('WatchProgress', () => {
	it('counts seconds played', () => {
		const p = new WatchProgress();
		play(p, 0, 60);
		expect(p.watchedSeconds).toBeCloseTo(60);
		expect(p.playSeconds).toBeCloseTo(60);
		expect(p.maxPosition).toBeCloseTo(60);
		expect(p.plays).toBe(1);
	});

	it('does not count a rewatch twice in watched seconds, but does in play time', () => {
		const p = new WatchProgress();
		play(p, 0, 60);
		play(p, 30, 60);
		expect(p.watchedSeconds).toBeCloseTo(60);
		expect(p.playSeconds).toBeCloseTo(90);
		expect(p.plays).toBe(2);
	});

	it('does not count the gap when the viewer scrubs ahead', () => {
		const p = new WatchProgress();
		p.play(0);
		for (let t = 0.25; t <= 10; t += 0.25) p.tick(t);
		p.seek();
		for (let t = 100; t <= 110; t += 0.25) p.tick(t);
		expect(p.watchedSeconds).toBeCloseTo(20);
		expect(p.seeks).toBe(1);
		expect(p.snapshot().ranges).toEqual([
			[0, 10],
			[100, 110]
		]);
	});

	it('ignores a jump between ticks even without a seek event', () => {
		const p = new WatchProgress();
		p.play(0);
		p.tick(1);
		p.tick(50);
		p.tick(51);
		expect(p.watchedSeconds).toBeCloseTo(2);
	});

	it('is complete at 90% watched, not by scrubbing to the end', () => {
		const p = new WatchProgress();
		p.duration = 100;
		play(p, 0, 10);
		p.seek();
		p.finish();
		expect(p.completed).toBe(false);

		play(p, 10, 90);
		expect(p.completed).toBe(true);
	});

	it('merges overlapping and touching spans', () => {
		expect(
			mergeRanges([
				[10, 20],
				[0, 5],
				[19, 30],
				[5.2, 8]
			])
		).toEqual([
			[0, 8],
			[10, 30]
		]);
	});
});

const ctx = { host: 'app.example.org', userAgent: 'Mozilla/5.0 (iPhone)', country: 'AU', userId: null };
const ids = {
	id: '11111111-1111-4111-8111-111111111111',
	visitorId: '22222222-2222-4222-8222-222222222222',
	sessionId: '33333333-3333-4333-8333-333333333333'
};

describe('analytics input', () => {
	it('rejects events without valid ids', () => {
		expect(parsePageView({ ...ids, id: 'nope', path: '/' }, ctx)).toBeNull();
		expect(parseVideo({ ...ids, playbackId: 'abc' }, ctx)).toBeNull();
		expect(parsePageEnd({ id: ids.id })).toBeNull();
	});

	it('clamps video totals to the video length', () => {
		const row = parseVideo(
			{
				...ids,
				playbackId: 'abc',
				path: '/p/watch/x',
				duration: 100,
				watchedSeconds: 5000,
				maxPosition: 500,
				playSeconds: 1e9,
				ranges: [[0, 500], 'junk', [80, 20]],
				completed: 'yes'
			},
			ctx
		)!;
		expect(row.watched_seconds).toBe(100);
		expect(row.max_position_seconds).toBe(100);
		expect(row.play_seconds).toBe(2000);
		expect(row.watched_ranges).toEqual([[0, 100]]);
		expect(row.completed).toBe(false);
		expect(row.device).toBe('mobile');
	});

	it('takes the course from a marketing site route', () => {
		const row = parsePageView({ ...ids, path: '/', routeId: '/sites/alivingunion' }, { ...ctx, host: 'alivingunion.com' })!;
		expect(row.course_slug).toBe('alivingunion');
	});

	it('spots bots and devices', () => {
		expect(isBot('Googlebot/2.1')).toBe(true);
		expect(isBot('')).toBe(true);
		expect(isBot('Mozilla/5.0 (Macintosh)')).toBe(false);
		expect(deviceFrom('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet');
		expect(deviceFrom('Mozilla/5.0 (Macintosh)')).toBe('desktop');
	});
});

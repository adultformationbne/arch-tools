import { describe, it, expect } from 'vitest';
import {
	PausePointTracker,
	normalizePausePoints,
	formatTimestamp,
	parseTimestamp,
	MAX_PAUSE_POINTS
} from '$lib/utils/pause-points';

const points = [
	{ id: 'a', time: 30 },
	{ id: 'b', time: 90 }
];

/** Plays from `from` to `to` in quarter-second steps, like timeupdate / rAF would. */
function play(tracker: PausePointTracker, from: number, to: number) {
	const fired: string[] = [];
	for (let t = from + 0.25; t <= to + 1e-9; t += 0.25) {
		const hit = tracker.advance(t);
		if (hit) fired.push(hit.id);
	}
	return fired;
}

describe('PausePointTracker', () => {
	it('fires a point once when playback reaches it', () => {
		const tracker = new PausePointTracker(points);
		expect(play(tracker, 0, 60)).toEqual(['a']);
		expect(play(tracker, 60, 120)).toEqual(['b']);
	});

	it('does not fire again when resuming from the point it paused on', () => {
		const tracker = new PausePointTracker(points);
		play(tracker, 0, 30);
		tracker.seek(30); // the player snaps to the point, which raises `seeked`
		expect(play(tracker, 30, 60)).toEqual([]);
	});

	it('never fires on a seek, and treats skipped points as passed', () => {
		const tracker = new PausePointTracker(points);
		tracker.seek(100);
		expect(tracker.hasPassed('a')).toBe(true);
		expect(tracker.hasPassed('b')).toBe(true);
		expect(play(tracker, 100, 140)).toEqual([]);
	});

	it('treats a large forward jump as a seek even without a seeked event', () => {
		const tracker = new PausePointTracker(points);
		expect(tracker.advance(45)).toBeNull();
		expect(tracker.hasPassed('a')).toBe(true);
	});

	it('fires again after seeking back before a point', () => {
		const tracker = new PausePointTracker(points);
		play(tracker, 0, 100);
		tracker.seek(10);
		expect(play(tracker, 10, 100)).toEqual(['a', 'b']);
	});

	it('does not fire for points already behind a mid-video start', () => {
		const tracker = new PausePointTracker(points, 50);
		expect(play(tracker, 50, 120)).toEqual(['b']);
	});

	it('keeps the passed state when the list is edited', () => {
		const tracker = new PausePointTracker(points);
		play(tracker, 0, 40);
		tracker.setPoints([...points, { id: 'c', time: 35 }, { id: 'd', time: 50 }], 40);
		expect(play(tracker, 40, 100)).toEqual(['d', 'b']);
	});
});

describe('normalizePausePoints', () => {
	it('sorts by time and rounds to hundredths', () => {
		const out = normalizePausePoints([
			{ id: 'b', time: 20.456 },
			{ id: 'a', time: 5 }
		]);
		expect(out.map((p) => p.id)).toEqual(['a', 'b']);
		expect(out[1].time).toBe(20.46);
	});

	it('drops invalid, duplicate and out-of-range entries without rejecting the rest', () => {
		const out = normalizePausePoints(
			[
				{ id: 'ok', time: 10 },
				{ id: 'ok', time: 11 },
				{ id: '', time: 12 },
				{ id: 'neg', time: -1 },
				{ id: 'nan', time: Number.NaN },
				{ id: 'str', time: '12' },
				{ id: 'late', time: 500 },
				null,
				'junk'
			],
			300
		);
		expect(out.map((p) => p.id)).toEqual(['ok']);
	});

	it('returns an empty list for anything that is not an array, and caps the count', () => {
		expect(normalizePausePoints(null)).toEqual([]);
		expect(normalizePausePoints({})).toEqual([]);
		const many = Array.from({ length: MAX_PAUSE_POINTS + 10 }, (_, i) => ({ id: `p${i}`, time: i }));
		expect(normalizePausePoints(many)).toHaveLength(MAX_PAUSE_POINTS);
	});
});

describe('timestamps', () => {
	it('formats seconds', () => {
		expect(formatTimestamp(0)).toBe('0:00');
		expect(formatTimestamp(75)).toBe('1:15');
		expect(formatTimestamp(3725)).toBe('1:02:05');
	});

	it('parses what an admin would type', () => {
		expect(parseTimestamp('75')).toBe(75);
		expect(parseTimestamp('1:15')).toBe(75);
		expect(parseTimestamp(' 1:02:05 ')).toBe(3725);
		expect(parseTimestamp('1:15.5')).toBe(75.5);
		expect(parseTimestamp('abc')).toBeNull();
		expect(parseTimestamp('1:xx')).toBeNull();
		expect(parseTimestamp('')).toBeNull();
		expect(parseTimestamp('1:2:3:4')).toBeNull();
	});
});

/**
 * Watch progress for one video playback: which parts of the video were actually
 * played, and for how long. Fed with the player's position as it plays; a jump
 * bigger than a normal tick (a seek) starts a new span instead of counting the gap.
 *
 * Pure and DOM-free so it can be unit tested; the player wiring is in tracker.ts.
 */

/** Ticks further apart than this are a seek or a stall, not playback */
const MAX_TICK_SECONDS = 2;
/** Watching this share of a video counts as finishing it */
export const COMPLETE_SHARE = 0.9;
/** Cap on stored spans, so a viewer who scrubs constantly cannot grow a row forever */
export const MAX_RANGES = 200;

export type Range = [number, number];

/** Sorts and merges overlapping or touching spans. */
export function mergeRanges(ranges: Range[]): Range[] {
	const sorted = ranges.filter(([s, e]) => e > s).sort((a, b) => a[0] - b[0]);
	const out: Range[] = [];
	for (const [s, e] of sorted) {
		const last = out[out.length - 1];
		if (last && s <= last[1] + 0.5) last[1] = Math.max(last[1], e);
		else out.push([s, e]);
	}
	return out;
}

export function totalSeconds(ranges: Range[]): number {
	return ranges.reduce((sum, [s, e]) => sum + (e - s), 0);
}

const round = (n: number) => Math.round(n * 100) / 100;

export class WatchProgress {
	ranges: Range[] = [];
	playSeconds = 0;
	maxPosition = 0;
	plays = 0;
	seeks = 0;
	ended = false;
	duration: number | null = null;

	private last: number | null = null;

	/** Playback started or resumed at `position`. */
	play(position: number) {
		this.plays++;
		this.last = position;
	}

	/** Playback stopped (pause, end, tab hidden). The next tick will not count the gap. */
	stop() {
		this.last = null;
	}

	/** The viewer scrubbed. */
	seek() {
		this.seeks++;
		this.last = null;
	}

	/** The player is at `position` while playing. */
	tick(position: number) {
		if (this.last !== null) {
			const delta = position - this.last;
			if (delta > 0 && delta <= MAX_TICK_SECONDS) {
				this.playSeconds += delta;
				this.ranges.push([this.last, position]);
				this.maxPosition = Math.max(this.maxPosition, position);
				// Merge as we go so the list stays short
				if (this.ranges.length > 32) this.ranges = mergeRanges(this.ranges);
			}
		}
		this.last = position;
	}

	finish() {
		this.ended = true;
		this.stop();
	}

	get watchedSeconds(): number {
		return totalSeconds(mergeRanges(this.ranges));
	}

	get completed(): boolean {
		// Scrubbing to the end fires `ended` too, so with a known length go by what was seen
		if (!this.duration) return this.ended;
		return this.watchedSeconds >= this.duration * COMPLETE_SHARE;
	}

	/** Running totals, ready to send. */
	snapshot() {
		const ranges = mergeRanges(this.ranges).slice(0, MAX_RANGES);
		this.ranges = ranges.map(([s, e]) => [s, e] as Range);
		return {
			duration: this.duration ? round(this.duration) : null,
			watchedSeconds: round(totalSeconds(ranges)),
			playSeconds: round(this.playSeconds),
			maxPosition: round(this.maxPosition),
			ranges: ranges.map(([s, e]) => [round(s), round(e)] as Range),
			plays: this.plays,
			seeks: this.seeks,
			completed: this.completed
		};
	}
}

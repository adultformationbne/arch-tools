/**
 * Pause points: moments in a course video where the player stops by itself and waits
 * for the viewer to press play. The video carries the on-screen questions; nothing is
 * drawn over it.
 * Everything is skippable — scrubbing past a point never blocks the viewer.
 *
 * Only hub-leader courses use these (see course-settings.ts). The points live on
 * courses_materials.pause_points; Mux has no concept of them.
 */

export interface PausePoint {
	/** Stable across edits so the "already shown" state survives reordering */
	id: string;
	/** Seconds into the video */
	time: number;
}

export const MAX_PAUSE_POINTS = 50;

/**
 * Clean untrusted input (an API body or a jsonb column) into a sorted, valid list.
 * Invalid entries are dropped rather than rejected, so one bad row never hides the rest.
 */
export function normalizePausePoints(raw: unknown, duration?: number): PausePoint[] {
	if (!Array.isArray(raw)) return [];

	const seen = new Set<string>();
	const points: PausePoint[] = [];

	for (const item of raw.slice(0, MAX_PAUSE_POINTS)) {
		if (!item || typeof item !== 'object') continue;
		const { id, time } = item as Record<string, unknown>;

		if (typeof id !== 'string' || id.length === 0 || id.length > 64 || seen.has(id)) continue;
		if (typeof time !== 'number' || !Number.isFinite(time) || time < 0) continue;
		if (duration !== undefined && Number.isFinite(duration) && time > duration) continue;

		seen.add(id);
		points.push({ id, time: Math.round(time * 100) / 100 });
	}

	return points.sort((a, b) => a.time - b.time);
}

/** "75" -> "1:15", "3725" -> "1:02:05" */
export function formatTimestamp(seconds: number): string {
	const total = Math.max(0, Math.floor(seconds));
	const h = Math.floor(total / 3600);
	const m = Math.floor((total % 3600) / 60);
	const s = total % 60;
	const ss = String(s).padStart(2, '0');
	return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** "1:15", "75", "1:02:05" or "1:15.5" -> seconds; null when it isn't a time. */
export function parseTimestamp(input: string): number | null {
	const parts = input.trim().split(':');
	if (parts.length === 0 || parts.length > 3) return null;
	let total = 0;
	for (const part of parts) {
		if (!/^\d+(\.\d+)?$/.test(part)) return null;
		total = total * 60 + Number(part);
	}
	return Number.isFinite(total) ? total : null;
}

/**
 * Decides when a pause point fires. It holds no DOM and no timers, so the rules
 * can be tested on their own; the player feeds it the playhead.
 *
 * A point fires when the playhead moves forward across it during normal playback.
 * Seeking never fires one: scrubbing past a point just marks it as passed, and
 * seeking back before it makes it fire again on the next watch-through.
 */
export class PausePointTracker {
	private points: PausePoint[] = [];
	private passed = new Set<string>();
	private last = 0;

	/** A forward jump bigger than this is a seek, not playback (covers a stalled frame or a throttled tab). */
	private static readonly MAX_PLAYBACK_STEP = 1.5;

	constructor(points: PausePoint[] = [], startAt = 0) {
		this.setPoints(points, startAt);
	}

	setPoints(points: PausePoint[], currentTime = this.last) {
		this.points = [...points].sort((a, b) => a.time - b.time);
		this.last = currentTime;
		this.syncTo(currentTime);
	}

	/** Call on `seeked`: everything behind the playhead counts as seen, everything ahead is armed. */
	seek(currentTime: number) {
		this.last = currentTime;
		this.syncTo(currentTime);
	}

	/** Call as the playhead advances. Returns the point to pause on, if the playhead just reached one. */
	advance(currentTime: number): PausePoint | null {
		const previous = this.last;
		this.last = currentTime;

		const step = currentTime - previous;
		if (step < 0) {
			this.syncTo(currentTime);
			return null;
		}
		if (step > PausePointTracker.MAX_PLAYBACK_STEP) {
			this.syncTo(currentTime);
			return null;
		}

		for (const point of this.points) {
			if (this.passed.has(point.id)) continue;
			if (point.time > previous && point.time <= currentTime) {
				this.passed.add(point.id);
				return point;
			}
		}
		return null;
	}

	/** Points the viewer scrubbed past without seeing — for markers on the timeline, if wanted. */
	hasPassed(id: string): boolean {
		return this.passed.has(id);
	}

	private syncTo(currentTime: number) {
		this.passed = new Set(this.points.filter((p) => p.time <= currentTime).map((p) => p.id));
	}
}

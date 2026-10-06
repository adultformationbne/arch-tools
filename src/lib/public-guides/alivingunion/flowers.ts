import { ARTWORK, type GuideArtworkFile } from './artwork';

/** The flower on the landing page and PDF cover. */
export const COVER_FLOWER = 'common-tansy';

/**
 * Which flower goes with which session. Sessions not listed here are given one
 * from the rest of the set, in name order, so a new illustration shows up without
 * any further wiring.
 */
const SESSION_FLOWERS: Record<number, string> = {
	0: 'snowdrop',
	1: 'cowslip',
	2: 'saffron-crocus',
	3: 'snakes-head',
	4: 'field-scabious',
	5: 'fern',
	6: 'self-heal',
	7: 'common-hop',
	8: 'miscellaneous-bunch'
};

export function getFlower(key: string): GuideArtworkFile | null {
	return ARTWORK[key] ?? null;
}

export function flowerForSession(sessionNumber: number): GuideArtworkFile | null {
	const chosen = SESSION_FLOWERS[sessionNumber];
	if (chosen && ARTWORK[chosen]) return ARTWORK[chosen];

	const taken = new Set([COVER_FLOWER, ...Object.values(SESSION_FLOWERS)]);
	const pool = Object.keys(ARTWORK).filter((key) => !taken.has(key)).sort();
	if (pool.length === 0) return ARTWORK[COVER_FLOWER] ?? null;
	return ARTWORK[pool[sessionNumber % pool.length]];
}

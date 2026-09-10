import { describe, it, expect } from 'vitest';
import {
	isTileActiveOn,
	tilesForDate,
	renderPromoTilesBlock,
	findPromoBlock,
	replacePromoBlock,
	PROMO_BLOCK_ATTR
} from '$lib/utils/dgr-promo-tiles.js';
import { minifyHTML } from '$lib/utils/wordpress-safe-html.js';

const tile = (over: Record<string, unknown> = {}) => ({
	position: 1,
	image_url: 'https://example.org/a.png',
	title: 'Retreat',
	link_url: 'https://example.org/go',
	active: true,
	starts_at: null,
	expires_at: null,
	...over
});

// Shape of a post published before the marker attribute existed
const LEGACY_POST =
	'<article><p>Body with an <div>inner</div> div.</p>' +
	'<div style="background:#f8f9fa; border:1px solid #e9ecef; border-radius:16px; padding:24px; margin:40px 0;">' +
	'<h3 style="font-size:16px;">Upcoming Events</h3>' +
	'<div style="display:flex;"><a href="https://old" target="_blank"><img src="https://old.png" alt="Event"><div>Old title</div></a></div>' +
	'</div></article><div>share</div>';

describe('promo tile date window', () => {
	it('shows a tile only within its start/expiry window (inclusive)', () => {
		const t = tile({ starts_at: '2026-09-12', expires_at: '2026-09-20' });
		expect(isTileActiveOn(t, '2026-09-11')).toBe(false);
		expect(isTileActiveOn(t, '2026-09-12')).toBe(true);
		expect(isTileActiveOn(t, '2026-09-20')).toBe(true);
		expect(isTileActiveOn(t, '2026-09-21')).toBe(false);
	});

	it('treats missing dates as open-ended and respects active/image', () => {
		expect(isTileActiveOn(tile(), '1999-01-01')).toBe(true);
		expect(isTileActiveOn(tile({ active: false }), '2026-09-12')).toBe(false);
		expect(isTileActiveOn(tile({ image_url: ' ' }), '2026-09-12')).toBe(false);
	});

	it('orders by position', () => {
		const out = tilesForDate([tile({ position: 2, title: 'b' }), tile({ position: 1, title: 'a' })], '2026-09-12');
		expect(out.map((t) => t.title)).toEqual(['a', 'b']);
	});
});

describe('promo block rendering', () => {
	it('always emits a marked wrapper, even with no tiles', () => {
		expect(renderPromoTilesBlock([], '2026-09-12')).toBe(`<div ${PROMO_BLOCK_ATTR}="1"></div>`);
		expect(renderPromoTilesBlock([tile()], '2026-09-12')).toContain(`${PROMO_BLOCK_ATTR}="1"`);
	});

	it('escapes attribute values', () => {
		const html = renderPromoTilesBlock([tile({ image_url: 'a"b', title: '<t>' })], '2026-09-12');
		expect(html).toContain('src="a&quot;b"');
		expect(html).toContain('alt="&lt;t&gt;"');
	});
});

describe('findPromoBlock / replacePromoBlock', () => {
	it('finds a legacy block by heading and matches nested divs', () => {
		const loc = findPromoBlock(LEGACY_POST);
		expect(loc).not.toBeNull();
		const block = LEGACY_POST.slice(loc!.start, loc!.end);
		expect(block.startsWith('<div style="background:#f8f9fa')).toBe(true);
		expect(block.endsWith('</a></div></div>')).toBe(true);
	});

	it('replaces only the block and leaves the rest byte-identical', () => {
		const newBlock = minifyHTML(renderPromoTilesBlock([tile()], '2026-09-12'));
		const { html, changed } = replacePromoBlock(LEGACY_POST, newBlock);
		expect(changed).toBe(true);
		expect(html.startsWith('<article><p>Body with an <div>inner</div> div.</p>')).toBe(true);
		expect(html.endsWith('</article><div>share</div>')).toBe(true);
		expect(html).not.toContain('https://old');
		expect(html).toContain('https://example.org/a.png');
	});

	it('is idempotent and detects no-change after the marker is present', () => {
		const newBlock = minifyHTML(renderPromoTilesBlock([tile()], '2026-09-12'));
		const first = replacePromoBlock(LEGACY_POST, newBlock);
		const second = replacePromoBlock(first.html, newBlock);
		expect(second.changed).toBe(false);
		expect(second.html).toBe(first.html);
	});

	it('can remove all tiles and add them back into the same anchor', () => {
		const withTiles = replacePromoBlock(LEGACY_POST, minifyHTML(renderPromoTilesBlock([tile()], '2026-09-12'))).html;
		const removed = replacePromoBlock(withTiles, minifyHTML(renderPromoTilesBlock([], '2026-09-12')));
		expect(removed.changed).toBe(true);
		expect(removed.html).toContain(`<div ${PROMO_BLOCK_ATTR}="1"></div></article>`);
		const back = replacePromoBlock(removed.html, minifyHTML(renderPromoTilesBlock([tile()], '2026-09-12')));
		expect(back.changed).toBe(true);
		expect(back.html).toBe(withTiles);
	});

	it('inserts before </article> when a post has no block, and errors when it cannot', () => {
		const ins = replacePromoBlock('<article><p>x</p></article>', `<div ${PROMO_BLOCK_ATTR}="1"></div>`);
		expect(ins.changed).toBe(true);
		expect(ins.html).toBe(`<article><p>x</p><div ${PROMO_BLOCK_ATTR}="1"></div></article>`);

		const none = replacePromoBlock('<p>no article here</p>', `<div ${PROMO_BLOCK_ATTR}="1"></div>`);
		expect(none.changed).toBe(false);
		expect(none.error).toBeTruthy();
	});
});

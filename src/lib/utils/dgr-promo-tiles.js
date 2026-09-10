/**
 * DGR Promo Tiles — date logic and block rendering.
 *
 * Shared between the browser (previews, admin page) and the server (publisher,
 * WordPress sync). Keep this file free of server-only imports.
 *
 * A tile is shown on a DGR post dated D when:
 *   active AND image_url present
 *   AND (starts_at is null OR starts_at <= D)
 *   AND (expires_at is null OR expires_at >= D)
 *
 * Dates are plain YYYY-MM-DD strings compared lexically. DGR posts are dated in
 * Brisbane time, so "today" is always the Brisbane calendar date.
 */

/** Marker attribute on the rendered promo block so it can be found and swapped in a published post. */
export const PROMO_BLOCK_ATTR = 'data-dgr-promo';

/** Today's date (YYYY-MM-DD) in Brisbane, matching how DGR posts are dated. */
export function brisbaneToday() {
	return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Brisbane' });
}

/** Whether a tile should appear on a post dated `date` (YYYY-MM-DD). */
export function isTileActiveOn(tile, date) {
	if (!tile || tile.active === false) return false;
	if (!tile.image_url || !String(tile.image_url).trim()) return false;
	if (tile.starts_at && tile.starts_at > date) return false;
	if (tile.expires_at && tile.expires_at < date) return false;
	return true;
}

/** Tiles that appear on a post dated `date`, in position order. */
export function tilesForDate(tiles, date) {
	return (tiles || [])
		.filter((t) => isTileActiveOn(t, date))
		.sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

/**
 * Human-readable status of a tile relative to today.
 * Returns one of: empty | expired | scheduled | expiring_soon | active | no_expiry
 */
export function getTileStatus(tile, today = brisbaneToday()) {
	if (!tile?.image_url) return 'empty';
	if (tile.expires_at && tile.expires_at < today) return 'expired';
	if (tile.starts_at && tile.starts_at > today) return 'scheduled';
	if (!tile.expires_at) return 'no_expiry';
	const ms = new Date(tile.expires_at).getTime() - new Date(today).getTime();
	const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
	if (days <= 7) return 'expiring_soon';
	return 'active';
}

function escapeAttr(value) {
	return String(value ?? '')
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

/**
 * Render the "Upcoming Events" promo block for a post dated `date`.
 *
 * Always returns a wrapper element carrying PROMO_BLOCK_ATTR, even when there
 * are no tiles (an empty, invisible div). That keeps a stable anchor in every
 * published post so tiles can later be added, changed or removed in place.
 */
export function renderPromoTilesBlock(tiles, date) {
	const activeTiles = tilesForDate(tiles, date);

	if (activeTiles.length === 0) {
		return `<div ${PROMO_BLOCK_ATTR}="1"></div>`;
	}

	// Adjust tile size based on count - bigger when fewer tiles
	const tileMaxWidth =
		activeTiles.length === 1 ? '300px' : activeTiles.length === 2 ? '250px' : activeTiles.length === 3 ? '200px' : '180px';

	return `
    <div ${PROMO_BLOCK_ATTR}="1" style="background:#f8f9fa; border:1px solid #e9ecef; border-radius:16px; padding:24px; margin:40px 0;">
      <h3 style="font-size:16px; color:#495057; margin:0 0 20px 0; font-weight:600; text-align:center;">Upcoming Events</h3>
      <div style="display:flex; flex-wrap:wrap; gap:20px; justify-content:center;">
        ${activeTiles
					.map(
						(tile) => `
          <a href="${escapeAttr(tile.link_url)}" target="_blank" style="text-decoration:none; display:block; max-width:${tileMaxWidth};">
            <img src="${escapeAttr(tile.image_url)}" alt="${escapeAttr(tile.title || 'Event')}" style="width:100%; height:auto; border-radius:8px; box-shadow:0 2px 8px rgba(0,0,0,0.1); transition:transform 0.2s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
            ${tile.title ? `<div style="text-align:center; margin-top:8px; font-size:13px; color:#666; font-weight:500;">${escapeAttr(tile.title)}</div>` : ''}
          </a>
        `
					)
					.join('')}
      </div>
    </div>`;
}

/**
 * Locate the promo block inside published post HTML.
 *
 * Finds either the marked wrapper (PROMO_BLOCK_ATTR) or, for posts published
 * before the marker existed, the legacy block identified by its
 * "Upcoming Events" heading. Returns { start, end } indexes of the whole
 * outer <div>…</div>, or null if the post has no block.
 */
export function findPromoBlock(html) {
	let start = -1;

	const markerIdx = html.indexOf(PROMO_BLOCK_ATTR);
	if (markerIdx !== -1) {
		start = html.lastIndexOf('<div', markerIdx);
	} else {
		const headingIdx = html.indexOf('>Upcoming Events</h3>');
		if (headingIdx === -1) return null;
		// The heading's <h3> is the first child of the wrapper div
		const h3Idx = html.lastIndexOf('<h3', headingIdx);
		start = html.lastIndexOf('<div', h3Idx);
	}
	if (start === -1) return null;

	// Walk forward matching <div … </div> pairs to find the wrapper's close
	const tagRe = /<div\b|<\/div\s*>/g;
	tagRe.lastIndex = start;
	let depth = 0;
	let m;
	while ((m = tagRe.exec(html)) !== null) {
		if (m[0].startsWith('</')) {
			depth -= 1;
			if (depth === 0) return { start, end: m.index + m[0].length };
		} else {
			depth += 1;
		}
	}
	return null;
}

/**
 * Replace (or insert) the promo block in published post HTML.
 * Inserts before </article> when the post has no block at all.
 * Returns { html, changed } — `changed` is false when the block is already identical.
 */
export function replacePromoBlock(html, newBlock) {
	const loc = findPromoBlock(html);
	if (loc) {
		const current = html.slice(loc.start, loc.end);
		if (normaliseBlock(current) === normaliseBlock(newBlock)) return { html, changed: false };
		return { html: html.slice(0, loc.start) + newBlock + html.slice(loc.end), changed: true };
	}
	const articleClose = html.indexOf('</article>');
	if (articleClose === -1) return { html, changed: false, error: 'No promo block or </article> found' };
	return { html: html.slice(0, articleClose) + newBlock + html.slice(articleClose), changed: true };
}

/** Ignore the marker attribute so legacy blocks compare equal to freshly rendered ones. */
function normaliseBlock(block) {
	return block.replace(new RegExp(`\\s*${PROMO_BLOCK_ATTR}="1"`), '');
}

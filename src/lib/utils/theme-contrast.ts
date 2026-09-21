/**
 * Picks readable text colours for user-chosen course theme colours.
 *
 * Course admins can set any accent colour, so anything drawn ON an accent
 * (button labels, icons in a filled circle) can't assume white or dark text.
 * Layouts that inject the theme also inject the matching "on" colour:
 *
 *   --course-on-accent-light   text/icon colour for a --course-accent-light fill
 *   --course-on-accent-dark    text/icon colour for a --course-accent-dark fill
 *
 * Importable from both client and server code.
 */

export const TEXT_ON_LIGHT = '#1e2322';
export const TEXT_ON_DARK = '#ffffff';

function parseHex(hex: string): [number, number, number] | null {
	const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec((hex || '').trim());
	if (!m) return null;
	const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
	return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** WCAG relative luminance, 0 (black) to 1 (white). Null if the colour isn't a hex value. */
export function relativeLuminance(hex: string): number | null {
	const rgb = parseHex(hex);
	if (!rgb) return null;
	const [r, g, b] = rgb.map((v) => {
		const c = v / 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two luminances (1 to 21). */
function contrast(a: number, b: number): number {
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * Dark or white text, whichever has the higher contrast against `background`.
 * Falls back to `fallback` when the colour can't be parsed (e.g. a CSS keyword).
 */
export function readableTextOn(background: string, fallback: string = TEXT_ON_LIGHT): string {
	const bg = relativeLuminance(background);
	if (bg === null) return fallback;
	const onDark = contrast(bg, 1);
	const onLight = contrast(bg, relativeLuminance(TEXT_ON_LIGHT) as number);
	return onLight >= onDark ? TEXT_ON_LIGHT : TEXT_ON_DARK;
}

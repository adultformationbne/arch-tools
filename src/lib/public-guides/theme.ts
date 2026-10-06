/**
 * The look of the public guide pages (/p/<course>) and their PDFs.
 *
 * A theme is a set of CSS custom properties plus the font stylesheets that
 * provide the faces it names. The pages and the block renderer read every
 * colour and font through these properties and fall back to the default look,
 * so a theme only lists what it changes. Course themes live in their own folder
 * under $lib/public-guides — see the README there.
 */

export interface PublicPageTheme {
	/** Stylesheets that load the theme's fonts */
	fontStylesheets: string[];
	/** --pp-* custom properties; anything left out keeps the default */
	vars: Record<string, string>;
	/** Overrides for the print version and PDFs, which stay on white paper */
	printVars?: Record<string, string>;
}

export const DEFAULT_THEME: PublicPageTheme = {
	fontStylesheets: [
		'https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&display=swap'
	],
	vars: {}
};

// Property reference (defaults in brackets):
//   --pp-bg page background [#faf8f5]      --pp-card cards and nav [white]
//   --pp-surface hover/pill fill [#f5f5f4] --pp-border [#e7e5e4]
//   --pp-ink headings [#1c1917]            --pp-body body text [#44403c]
//   --pp-muted secondary text [#78716c]    --pp-accent small labels [#7c6a52]
//   --pp-highlight rules and borders       --pp-highlight-text numbers, bullets [#c9a96e]
//   --pp-summary-bg teaching summary box   --pp-body-weight [400]
//   --pp-font-heading page titles, --pp-font-body [Lora], --pp-font-ui [Inter]
//   --pp-radius corner radius of cards and buttons [6–12px]
//   --pp-font-display key-theme headings [ui font], with --pp-display-size, --pp-display-weight

/** Inline style that applies a theme to a page wrapper. */
export function publicPageThemeStyle(theme: PublicPageTheme, { print = false } = {}): string {
	const vars = print ? { ...theme.vars, ...theme.printVars } : theme.vars;
	return Object.entries(vars)
		.map(([name, value]) => `${name}: ${value}`)
		.join('; ');
}

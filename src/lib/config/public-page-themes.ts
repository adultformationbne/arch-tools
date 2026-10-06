/**
 * Per-course look for the public guide pages (/p/<course>) and their PDFs.
 *
 * A theme is a set of CSS custom properties plus the font stylesheets that
 * provide the faces it names. The pages and the block renderer read every
 * colour and font through these properties and fall back to the default look,
 * so a theme only lists what it changes. A course without an entry here gets
 * the default.
 *
 * Like the marketing sites in course-domains.ts, the map is in code on purpose:
 * a theme usually needs assets (a wordmark, licensed fonts) added alongside it.
 */

export interface PublicPageTheme {
	/** Stylesheets that load the theme's fonts */
	fontStylesheets: string[];
	/** --pp-* custom properties; anything left out keeps the default */
	vars: Record<string, string>;
	/** Overrides for the print version and PDFs, which stay on white paper */
	printVars?: Record<string, string>;
	/** Image shown in place of the guide's title on its landing page and PDF cover */
	wordmark?: { src: string; width: number; height: number };
}

const DEFAULT_THEME: PublicPageTheme = {
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
//   --pp-font-display key-theme headings [ui font], with --pp-display-size, --pp-display-weight
const THEMES: Record<string, PublicPageTheme> = {
	// Matches alivingunion.com (src/routes/sites/alivingunion): poster paper, ink and lime
	alivingunion: {
		// Adobe Fonts kit: Tiffin Latin (titles and text, set Light) and Ode, which is
		// kept to the key-theme headings. Labels and navigation stay in Inter.
		fontStylesheets: [
			'https://use.typekit.net/qnj5ast.css',
			'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap'
		],
		vars: {
			'--pp-bg': '#ece6d4',
			'--pp-card': '#f7f3e8',
			'--pp-surface': '#e2dbc6',
			'--pp-border': '#d6ceb8',
			'--pp-ink': '#3a342b',
			'--pp-body': '#3a342b',
			'--pp-muted': '#5d564a',
			'--pp-accent': '#5d564a',
			'--pp-highlight': '#c4d15a',
			'--pp-highlight-text': '#636d18',
			'--pp-summary-bg': '#d6e173',
			'--pp-body-weight': '300',
			'--pp-font-heading': '"tiffin-latin-variable", Georgia, serif',
			'--pp-font-body': '"tiffin-latin-variable", Georgia, serif',
			'--pp-font-display': '"ode", Georgia, serif',
			'--pp-display-size': '1.2rem',
			'--pp-display-weight': '400'
		},
		printVars: {
			'--pp-bg': '#ffffff',
			'--pp-card': '#ffffff',
			'--pp-surface': '#f4f1e6',
			'--pp-border': '#ddd6c2'
		},
		wordmark: { src: '/sites/alivingunion/wordmark.webp', width: 1096, height: 538 }
	}
};

export function getPublicPageTheme(courseSlug: string): PublicPageTheme {
	return THEMES[courseSlug] ?? DEFAULT_THEME;
}

/** Inline style that applies a theme to a page wrapper. */
export function publicPageThemeStyle(theme: PublicPageTheme, { print = false } = {}): string {
	const vars = print ? { ...theme.vars, ...theme.printVars } : theme.vars;
	return Object.entries(vars)
		.map(([name, value]) => `${name}: ${value}`)
		.join('; ');
}

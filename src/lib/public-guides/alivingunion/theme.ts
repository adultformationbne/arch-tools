import type { PublicPageTheme } from '../theme';

// Matches alivingunion.com (src/routes/sites/alivingunion): poster paper, ink and lime
export const theme: PublicPageTheme = {
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
		'--pp-radius': '2px',
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
	}
};

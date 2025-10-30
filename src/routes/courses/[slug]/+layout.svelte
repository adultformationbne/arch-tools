<script>
	// This layout applies course-specific theming from the database settings
	let { data, children } = $props();

	// Extract theme settings from the parent layout
	const theme = data.courseTheme || {};
	const branding = data.courseBranding || {};

	// Build CSS custom property string for inline styles
	function buildThemeStyles(themeSettings) {
		const styles = [];

		// Extract theme colors (new simplified structure)
		const accentDark = themeSettings.accentDark || '#334642';
		const accentLight = themeSettings.accentLight || '#c59a6b';
		const fontFamily = themeSettings.fontFamily || 'Inter';

		// Map to all the CSS custom properties used throughout the app
		styles.push(`--course-accent-darkest: ${accentDark}`);
		styles.push(`--course-accent-dark: ${accentDark}`);
		styles.push(`--course-accent-light: ${accentLight}`);
		styles.push(`--course-surface: ${accentLight}`);
		styles.push(`--course-lightest: #ffffff`);
		styles.push(`--course-text-on-dark: #ffffff`);
		styles.push(`--course-text-on-light: ${accentDark}`);
		styles.push(`--course-border-muted: rgba(234, 226, 217, 0.3)`);
		styles.push(`--course-font-family: '${fontFamily}', system-ui, -apple-system, sans-serif`);
		styles.push(`--course-nav-bg: ${accentDark}dd`); // with opacity

		return styles.join('; ');
	}

	// Derive the theme styles reactively
	let themeStyles = $derived(buildThemeStyles(theme));
</script>

<!-- Apply course theme as CSS custom properties to all child routes -->
<div style={themeStyles} class="course-themed-container">
	{@render children()}
</div>

<style>
	.course-themed-container {
		/* Ensure theme variables propagate to all descendants */
		min-height: 100vh;
		background-color: var(--course-accent-dark);
		color: var(--course-text-on-dark);
		font-family: var(--course-font-family);
	}
</style>

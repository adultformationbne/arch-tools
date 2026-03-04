<script>
	import CourseNavigation from './CourseNavigation.svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	// This layout applies course-specific theming from the database settings
	let { data, children } = $props();

	// Extract theme settings from the parent layout (use $derived for reactivity)
	const theme = $derived(data.courseTheme || {});
	const branding = $derived(data.courseBranding || {});
	const courseSlug = $derived(data.courseSlug || '');
	const userName = $derived(data.userName || 'User');
	const userRole = $derived(data.userRole || 'student');

	// Chat unread tracking
	let hasUnreadChat = $state(data.hasUnreadChat || false);
	const cohortId = $derived(data.cohortId);
	const isOnChatPage = $derived($page.url.pathname.endsWith('/chat'));

	// Reset unread when navigating to chat page
	$effect(() => {
		if (isOnChatPage) {
			hasUnreadChat = false;
		}
	});

	// Update from server data on navigation
	$effect(() => {
		if (data.hasUnreadChat !== undefined) {
			hasUnreadChat = data.hasUnreadChat;
		}
	});

	// Realtime subscription for unread dot
	onMount(() => {
		if (!data.supabase || !cohortId || (userRole !== 'coordinator' && userRole !== 'admin')) {
			return;
		}

		const channel = data.supabase
			.channel(`chat-unread:${cohortId}`)
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'courses_chat_messages',
					filter: `cohort_id=eq.${cohortId}`
				},
				(payload) => {
					// If not on chat page and message is from someone else, show unread dot
					if (!$page.url.pathname.endsWith('/chat') && payload.new.sender_id !== data.userId) {
						hasUnreadChat = true;
					}
				}
			)
			.subscribe();

		return () => {
			data.supabase?.removeChannel(channel);
		};
	});

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
	<!-- Course Navigation -->
	<CourseNavigation
		{courseSlug}
		{userName}
		{userRole}
		courseBranding={branding}
		{hasUnreadChat}
	/>

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

<script>
	import CourseNavigation from './CourseNavigation.svelte';
	import ChatRoom from '$lib/components/ChatRoom.svelte';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { apiGet, apiPost } from '$lib/utils/api-handler.js';

	// This layout applies course-specific theming from the database settings
	let { data, children } = $props();

	// Extract theme settings from the parent layout (use $derived for reactivity)
	const theme = $derived(data.courseTheme || {});
	const branding = $derived(data.courseBranding || {});
	const courseSlug = $derived(data.courseSlug || '');
	const userName = $derived(data.userName || 'User');
	const userRole = $derived(data.userRole || 'student');

	// Chat sidebar state
	const canChat = $derived(userRole === 'coordinator' && data.cohortId);
	let chatOpen = $state(false);
	let chatMessages = $state(null);
	let chatUserMeta = $state(null);
	let chatLoading = $state(false);

	// Chat unread tracking
	let hasUnreadChat = $state(data.hasUnreadChat || false);
	const cohortId = $derived(data.cohortId);

	// Reset unread when chat sidebar opens; force reload if there were unread messages
	$effect(() => {
		if (chatOpen) {
			if (hasUnreadChat) {
				chatMessages = null;
			}
			hasUnreadChat = false;
		}
	});

	// Lazy-load chat messages on first open
	$effect(() => {
		if (chatOpen && chatMessages === null && !chatLoading) {
			loadChat();
		}
	});

	async function loadChat() {
		chatLoading = true;
		try {
			const result = await apiGet(
				`/api/courses/${courseSlug}/chat?cohort_id=${cohortId}&limit=50`,
				{ showToast: false }
			);
			chatMessages = result?.data || [];
			chatUserMeta = {
				userId: data.userId,
				userName: data.userName,
				userRole: data.userRole,
				hubName: data.hubName || null
			};
			// Mark as read
			await apiPost(`/api/courses/${courseSlug}/chat/read-status`, {
				cohort_id: cohortId
			}, { showToast: false });
		} catch {
			chatMessages = [];
			chatUserMeta = {
				userId: data.userId,
				userName: data.userName,
				userRole: data.userRole,
				hubName: data.hubName || null
			};
		} finally {
			chatLoading = false;
		}
	}

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
					// If chat sidebar is closed and message is from someone else, show unread dot
					if (!chatOpen && payload.new.sender_id !== data.userId) {
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
		featureSettings={data.courseFeatures}
		{hasUnreadChat}
		onChatToggle={canChat ? () => chatOpen = !chatOpen : null}
	/>

	<div class="course-content-area">
		<main class="course-main">
			{@render children()}
		</main>

		<!-- Chat Sidebar -->
		{#if canChat && chatOpen}
			<aside class="chat-sidebar">
				{#if chatUserMeta && chatMessages}
					<ChatRoom
						messages={chatMessages}
						cohortId={data.cohortId}
						userMeta={chatUserMeta}
						courseSlug={data.courseSlug}
						supabase={data.supabase}
						chatEnabled={data.chatEnabled !== false}
						onClose={() => chatOpen = false}
					/>
				{:else}
					<div class="chat-loading">
						<div class="chat-loading-spinner"></div>
					</div>
				{/if}
			</aside>
		{/if}
	</div>
</div>

<style>
	.course-themed-container {
		/* Ensure theme variables propagate to all descendants */
		min-height: 100vh;
		background-color: var(--course-accent-dark);
		color: var(--course-text-on-dark);
		font-family: var(--course-font-family);
	}

	.course-content-area {
		display: flex;
		height: calc(100vh - 44px);
		overflow: hidden;
	}

	.course-main {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
	}

	.chat-sidebar {
		width: 400px;
		flex-shrink: 0;
		border-left: 1px solid rgba(255, 255, 255, 0.1);
		background-color: var(--course-accent-dark, #334642);
		animation: slideIn 0.25s cubic-bezier(0.4, 0, 0.2, 1);
	}

	.chat-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
	}

	.chat-loading-spinner {
		width: 28px;
		height: 28px;
		border: 3px solid rgba(255, 255, 255, 0.1);
		border-top-color: var(--course-accent-light, #c59a6b);
		border-radius: 50%;
		animation: spin 0.7s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@keyframes slideIn {
		from {
			margin-right: -400px;
		}
		to {
			margin-right: 0;
		}
	}

	@media (max-width: 768px) {
		.chat-sidebar {
			position: fixed;
			top: 0;
			right: 0;
			bottom: 0;
			width: 100vw;
			z-index: 51;
			border-left: none;
		}

		@keyframes slideIn {
			from {
				transform: translateX(100%);
			}
			to {
				transform: translateX(0);
			}
		}
	}
</style>

<script>
	import { MessageCircle, Send, Users, Trash2, X, Edit2, Check, MoreVertical } from '$lib/icons';
	import { apiGet, apiPost, apiPatch, apiDelete } from '$lib/utils/api-handler.js';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { onMount } from 'svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let {
		messages: initialMessages = [],
		cohortId,
		userMeta,
		courseSlug,
		supabase,
		onClose = null,
		chatEnabled = true
	} = $props();

	let messages = $state([...initialMessages]);
	let messageInput = $state('');
	let inputEl = $state(null);
	let sending = $state(false);
	let loadingMore = $state(false);
	let hasMore = $state(initialMessages.length >= 50);
	let messagesContainer = $state(null);
	let onlineUsers = $state([]);
	let showOnlineList = $state(false);
	let userScrolledUp = $state(false);
	let channel = $state(null);
	let realtimeConnected = $state(false);

	// Admin controls
	let showClearConfirm = $state(false);
	let clearing = $state(false);

	// Message edit/delete
	let editingMessageId = $state(null);
	let editContent = $state('');
	let activeMenuId = $state(null);

	const isAdmin = $derived(userMeta.userRole === 'admin');

	// Track whether we should auto-scroll
	function checkIfScrolledUp() {
		if (!messagesContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
		userScrolledUp = scrollHeight - scrollTop - clientHeight > 100;
	}

	function scrollToBottom(smooth = true) {
		if (!messagesContainer) return;
		requestAnimationFrame(() => {
			messagesContainer.scrollTo({
				top: messagesContainer.scrollHeight,
				behavior: smooth ? 'smooth' : 'instant'
			});
		});
	}

	// Send message
	async function handleSend() {
		const content = messageInput.trim();
		if (!content || sending || !chatEnabled) return;

		// Optimistic insert
		const optimisticId = `optimistic-${Date.now()}`;
		const optimisticMsg = {
			id: optimisticId,
			cohort_id: cohortId,
			sender_id: userMeta.userId,
			sender_name: userMeta.userName,
			sender_role: userMeta.userRole,
			hub_name: userMeta.hubName,
			content,
			created_at: new Date().toISOString(),
			_optimistic: true
		};

		messages = [...messages, optimisticMsg];
		messageInput = '';
		if (inputEl) inputEl.style.height = 'auto';
		scrollToBottom();

		sending = true;
		try {
			await apiPost(`/api/courses/${courseSlug}/chat`, {
				content,
				cohort_id: cohortId
			}, { showToast: false });
			// Real message will arrive via Realtime and replace the optimistic one
		} catch (err) {
			// Remove optimistic message on failure
			messages = messages.filter((m) => m.id !== optimisticId);
			if (err?.status === 403 || err?.message?.includes('paused')) {
				chatEnabled = false;
				toastError('Chat has been paused');
			} else {
				toastError('Failed to send message');
			}
		} finally {
			sending = false;
		}
	}

	// Handle Enter key
	function handleKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			handleSend();
		}
	}

	// Load older messages
	async function loadOlderMessages() {
		if (loadingMore || !hasMore || messages.length === 0) return;

		loadingMore = true;
		const oldestTimestamp = messages[0]?.created_at;
		const prevScrollHeight = messagesContainer?.scrollHeight || 0;

		try {
			const result = await apiGet(
				`/api/courses/${courseSlug}/chat?cohort_id=${cohortId}&limit=50&before=${encodeURIComponent(oldestTimestamp)}`
			);
			if (result?.data?.length) {
				messages = [...result.data, ...messages];
				hasMore = result.hasMore;

				// Maintain scroll position
				requestAnimationFrame(() => {
					if (messagesContainer) {
						const newScrollHeight = messagesContainer.scrollHeight;
						messagesContainer.scrollTop = newScrollHeight - prevScrollHeight;
					}
				});
			} else {
				hasMore = false;
			}
		} catch (err) {
			toastError('Failed to load messages');
		} finally {
			loadingMore = false;
		}
	}

	// Handle scroll — detect scroll-to-top for pagination
	function handleScroll() {
		checkIfScrolledUp();
		if (messagesContainer && messagesContainer.scrollTop < 50 && hasMore && !loadingMore) {
			loadOlderMessages();
		}
	}

	// Mark as read
	async function markAsRead() {
		try {
			await apiPost(`/api/courses/${courseSlug}/chat/read-status`, {
				cohort_id: cohortId
			}, { showToast: false });
		} catch {
			// Silent fail for read status
		}
	}

	// Delete a single message (own message or admin)
	async function deleteMessage(messageId) {
		try {
			await apiDelete(`/api/courses/${courseSlug}/chat`, {
				message_id: messageId,
				cohort_id: cohortId
			}, { showToast: false });
			messages = messages.filter((m) => m.id !== messageId);
			activeMenuId = null;
		} catch {
			toastError('Failed to delete message');
		}
	}

	// Edit a message
	function startEdit(msg) {
		editingMessageId = msg.id;
		editContent = msg.content;
		activeMenuId = null;
	}

	function cancelEdit() {
		editingMessageId = null;
		editContent = '';
	}

	async function saveEdit() {
		const trimmed = editContent.trim();
		if (!trimmed || !editingMessageId) return;

		try {
			await apiPatch(`/api/courses/${courseSlug}/chat`, {
				message_id: editingMessageId,
				cohort_id: cohortId,
				content: trimmed
			}, { showToast: false });
			// Update locally
			messages = messages.map((m) =>
				m.id === editingMessageId ? { ...m, content: trimmed, edited: true } : m
			);
			cancelEdit();
		} catch {
			toastError('Failed to edit message');
		}
	}

	function handleEditKeydown(e) {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			saveEdit();
		}
		if (e.key === 'Escape') {
			cancelEdit();
		}
	}

	// Clear all messages (admin only)
	async function clearAllMessages() {
		clearing = true;
		try {
			await apiDelete(`/api/courses/${courseSlug}/chat`, {
				cohort_id: cohortId,
				clear_all: true
			}, { showToast: false });
			messages = [];
			toastSuccess('Chat cleared');
		} catch {
			toastError('Failed to clear messages');
		} finally {
			clearing = false;
			showClearConfirm = false;
		}
	}

	// Toggle message action menu
	function toggleMenu(msgId) {
		activeMenuId = activeMenuId === msgId ? null : msgId;
	}

	// Can this user act on this message?
	function canEditMessage(msg) {
		return msg.sender_id === userMeta.userId && !msg._optimistic;
	}

	function canDeleteMessage(msg) {
		return (msg.sender_id === userMeta.userId || isAdmin) && !msg._optimistic;
	}

	// Format time for display
	function formatTime(dateStr) {
		const d = new Date(dateStr);
		return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
	}

	function formatDate(dateStr) {
		const d = new Date(dateStr);
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		if (d.toDateString() === today.toDateString()) return 'Today';
		if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
		return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
	}

	// Check if we should show a date separator
	function shouldShowDate(msg, index) {
		if (index === 0) return true;
		const prev = messages[index - 1];
		return new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
	}

	// Show a time separator when there's a gap of 5+ minutes between messages
	function shouldShowTimeGap(msg, index) {
		if (index === 0) return true;
		const prev = messages[index - 1];
		const gap = new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime();
		return gap > 5 * 60 * 1000;
	}

	// Full hover tooltip: "Wed, Mar 4 at 2:35 PM"
	function formatFullTime(dateStr) {
		const d = new Date(dateStr);
		const day = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
		const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
		return `${day} at ${time}`;
	}

	// Is message from current user?
	function isOwnMessage(msg) {
		return msg.sender_id === userMeta.userId;
	}

	onMount(() => {
		// Scroll to bottom on mount
		scrollToBottom(false);

		// Mark as read on mount
		markAsRead();

		// Set up Realtime channel
		if (supabase && cohortId) {
			const chan = supabase
				.channel(`chat:${cohortId}`)
				.on(
					'postgres_changes',
					{
						event: '*',
						schema: 'public',
						table: 'courses_chat_messages',
						filter: `cohort_id=eq.${cohortId}`
					},
					(payload) => {
							if (payload.eventType === 'INSERT') {
							const newMsg = payload.new;
							if (!messages.find((m) => m.id === newMsg.id)) {
								if (newMsg.sender_id === userMeta.userId) {
									const optimisticIdx = messages.findIndex((m) => m._optimistic && m.sender_id === newMsg.sender_id);
									if (optimisticIdx !== -1) {
										messages = [...messages.slice(0, optimisticIdx), ...messages.slice(optimisticIdx + 1), newMsg];
									} else {
										messages = [...messages, newMsg];
									}
								} else {
									messages = [...messages, newMsg];
								}
								if (!userScrolledUp) {
									scrollToBottom();
								}
								markAsRead();
							}
						} else if (payload.eventType === 'UPDATE') {
							const updated = payload.new;
							if (updated.deleted_at) {
								// Soft-deleted — remove from view
								messages = messages.filter((m) => m.id !== updated.id);
							} else {
								// Edited — update content
								messages = messages.map((m) =>
									m.id === updated.id ? { ...m, content: updated.content, edited: true } : m
								);
							}
						}
					}
				)
				.on('presence', { event: 'sync' }, () => {
					const state = chan.presenceState();
					const seen = new Set();
					const users = [];
					for (const key in state) {
						const presences = state[key];
						if (presences?.length) {
							const uid = presences[0].user_id;
							if (!seen.has(uid)) {
								seen.add(uid);
								users.push(presences[0]);
							}
						}
					}
					onlineUsers = users;
				})
				.subscribe(async (status) => {
					realtimeConnected = status === 'SUBSCRIBED';
					if (status === 'SUBSCRIBED') {
						await chan.track({
							user_id: userMeta.userId,
							user_name: userMeta.userName,
							user_role: userMeta.userRole,
							hub_name: userMeta.hubName || null
						});
					}
				});

			channel = chan;
		}

		return () => {
			if (channel) {
				supabase?.removeChannel(channel);
			}
		};
	});
</script>

<div class="chat-container">
	<!-- Header -->
	<div class="chat-header">
		<div class="flex items-center gap-2">
			<MessageCircle size="18" class="text-white/80" />
			<h2 class="text-sm font-semibold text-white">Chat</h2>
		</div>
		<div class="flex items-center gap-2">
			{#if onClose}
				<button
					class="close-btn flex items-center justify-center w-7 h-7 rounded-full"
					onclick={onClose}
					title="Close chat"
				>
					<X size="16" class="text-white/70" />
				</button>
			{/if}
			{#if isAdmin && messages.length > 0}
				<button
					class="clear-btn"
					onclick={() => (showClearConfirm = true)}
					title="Clear all messages"
				>
					<Trash2 size="13" />
					<span>Clear</span>
				</button>
			{/if}
			<button
				class="online-indicator"
				onclick={() => (showOnlineList = !showOnlineList)}
				title={realtimeConnected ? `${onlineUsers.length} online` : 'Reconnecting...'}
			>
				<span class={realtimeConnected ? 'online-dot' : 'online-dot disconnected'}></span>
				<Users size="14" class="text-white/70" />
				<span class="text-xs text-white/70">{onlineUsers.length}</span>
			</button>
		</div>
	</div>

	<!-- Online users dropdown -->
	{#if showOnlineList && onlineUsers.length > 0}
		<div class="online-list">
			{#each onlineUsers as u}
				<div class="online-user">
					<span class="online-dot-small"></span>
					<span class="text-xs text-white/80">{u.user_name}</span>
					<span class="text-xs text-white/40">
						{#if u.hub_name}
							{u.hub_name} &middot; Coordinator
						{:else}
							{u.user_role === 'admin' ? 'Admin' : 'Coordinator'}
						{/if}
					</span>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Messages -->
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="messages-area"
		bind:this={messagesContainer}
		onscroll={handleScroll}
		onclick={() => (activeMenuId = null)}
	>
		{#if loadingMore}
			<div class="loading-more">
				<span class="text-xs text-white/50">Loading older messages...</span>
			</div>
		{/if}

		{#if messages.length === 0}
			<div class="empty-state">
				<MessageCircle size="32" class="text-white/20" />
				<p class="text-sm text-white/40 mt-2">No messages yet</p>
				<p class="text-xs text-white/30">Start the conversation!</p>
			</div>
		{:else}
			{#each messages as msg, i}
				{#if shouldShowDate(msg, i)}
					<div class="date-separator">
						<span>{formatDate(msg.created_at)}</span>
					</div>
				{:else if shouldShowTimeGap(msg, i)}
					<div class="time-separator">
						<span>{formatTime(msg.created_at)}</span>
					</div>
				{/if}

				<div class="message-row" class:own={isOwnMessage(msg)}>
					<div class="message-bubble" class:own-bubble={isOwnMessage(msg)} title={formatFullTime(msg.created_at)}>
						{#if !isOwnMessage(msg)}
							<div class="message-meta">
								<span class="sender-name">{msg.sender_name}</span>
								{#if msg.hub_name}
									<span class="sender-detail">{msg.hub_name}</span>
								{:else}
									<span class="sender-detail">{msg.sender_role === 'admin' ? 'Admin' : 'Coordinator'}</span>
								{/if}
							</div>
						{/if}


						{#if editingMessageId === msg.id}
							<div class="edit-area">
								<textarea
									class="edit-input"
									bind:value={editContent}
									onkeydown={handleEditKeydown}
									rows="2"
									maxlength="2000"
								></textarea>
								<div class="edit-actions">
									<button class="edit-action-btn save" onclick={saveEdit} title="Save">
										<Check size="14" />
									</button>
									<button class="edit-action-btn cancel" onclick={cancelEdit} title="Cancel">
										<X size="14" />
									</button>
								</div>
							</div>
						{:else}
							<p class="message-content">{msg.content}</p>
							{#if msg.edited}
								<span class="edited-label">(edited)</span>
							{/if}
						{/if}

					</div>
					{#if (canEditMessage(msg) || canDeleteMessage(msg)) && editingMessageId !== msg.id}
						<div class="message-actions">
							<button class="action-toggle" onclick={(e) => { e.stopPropagation(); toggleMenu(msg.id); }} title="Actions">
								<MoreVertical size="12" />
							</button>
							{#if activeMenuId === msg.id}
								<div class="action-menu">
									{#if canEditMessage(msg)}
										<button class="action-menu-item" onclick={(e) => { e.stopPropagation(); startEdit(msg); }}>
											<Edit2 size="12" />
											<span>Edit</span>
										</button>
									{/if}
									{#if canDeleteMessage(msg)}
										<button class="action-menu-item danger" onclick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }}>
											<Trash2 size="12" />
											<span>Delete</span>
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</div>

	<!-- Input -->
	{#if chatEnabled}
		<div class="chat-input-area">
			<textarea
				class="chat-input"
				placeholder="Type a message..."
				bind:this={inputEl}
				bind:value={messageInput}
				onkeydown={handleKeydown}
				oninput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
				rows="1"
				maxlength="2000"
				disabled={sending}
			></textarea>
			<button
				class="send-btn"
				onclick={handleSend}
				disabled={!messageInput.trim() || sending}
				title="Send message"
			>
				<Send size="16" />
			</button>
		</div>
	{:else}
		<div class="chat-paused">
			<span>Chat is currently paused</span>
		</div>
	{/if}
</div>

<ConfirmationModal
	show={showClearConfirm}
	onConfirm={clearAllMessages}
	onCancel={() => (showClearConfirm = false)}
	loading={clearing}
>
	<p class="text-sm">Are you sure you want to clear all messages in this chat? This cannot be undone.</p>
</ConfirmationModal>

<style>
	.chat-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		max-height: 100%;
		background: rgba(0, 0, 0, 0.15);
		border-radius: 12px;
		overflow: hidden;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.2);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
	}

	.online-indicator {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px 10px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.online-indicator:hover {
		background: rgba(255, 255, 255, 0.12);
	}

	.online-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #22c55e;
		box-shadow: 0 0 4px #22c55e;
		transition: background 0.3s ease, box-shadow 0.3s ease;
	}

	.online-dot.disconnected {
		background: #eab308;
		box-shadow: 0 0 4px #eab308;
		animation: pulse-dot 1.5s ease-in-out infinite;
	}

	@keyframes pulse-dot {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	.online-list {
		padding: 8px 16px;
		background: rgba(0, 0, 0, 0.25);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
		display: flex;
		flex-direction: column;
		gap: 6px;
		flex-shrink: 0;
	}

	.online-user {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	.online-dot-small {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: #22c55e;
	}

	.messages-area {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.messages-area::-webkit-scrollbar {
		width: 6px;
	}

	.messages-area::-webkit-scrollbar-track {
		background: transparent;
	}

	.messages-area::-webkit-scrollbar-thumb {
		background: rgba(255, 255, 255, 0.15);
		border-radius: 3px;
	}

	.loading-more {
		text-align: center;
		padding: 8px;
	}

	.empty-state {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.date-separator {
		text-align: center;
		margin: 12px 0 8px;
	}

	.date-separator span {
		font-size: 0.6875rem;
		color: rgba(255, 255, 255, 0.4);
		background: rgba(0, 0, 0, 0.2);
		padding: 2px 12px;
		border-radius: 10px;
	}

	.time-separator {
		text-align: center;
		margin: 8px 0 4px;
	}

	.time-separator span {
		font-size: 0.625rem;
		color: rgba(255, 255, 255, 0.3);
	}

	.message-row {
		display: flex;
		align-items: center;
		gap: 4px;
		justify-content: flex-start;
		margin-bottom: 4px;
	}

	.message-row.own {
		justify-content: flex-end;
	}

	.message-bubble {
		max-width: 80%;
		padding: 8px 12px;
		border-radius: 12px 12px 12px 4px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}

	.own-bubble {
		background: rgba(197, 154, 107, 0.2);
		border-color: rgba(197, 154, 107, 0.3);
		border-radius: 12px 12px 4px 12px;
	}

	.message-meta {
		display: flex;
		align-items: baseline;
		gap: 4px;
		margin-bottom: 2px;
		flex-wrap: wrap;
	}

	.sender-name {
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--course-accent-light, #c59a6b);
	}

	.sender-detail {
		font-size: 0.625rem;
		color: rgba(255, 255, 255, 0.4);
	}

	.message-content {
		font-size: 0.875rem;
		color: rgba(255, 255, 255, 0.9);
		line-height: 1.4;
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.edited-label {
		font-size: 0.6rem;
		color: rgba(255, 255, 255, 0.25);
		font-style: italic;
	}

	/* Action menu */
	.message-actions {
		position: relative;
		flex-shrink: 0;
	}

	.action-toggle {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		border-radius: 4px;
		background: transparent;
		border: none;
		color: rgba(255, 255, 255, 0.25);
		cursor: pointer;
		transition: all 0.15s ease;
		opacity: 0;
	}

	.message-row:hover .action-toggle {
		opacity: 1;
	}

	.action-toggle:hover {
		background: rgba(255, 255, 255, 0.1);
		color: rgba(255, 255, 255, 0.6);
	}

	.action-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		background: rgba(30, 35, 34, 0.95);
		border: 1px solid rgba(255, 255, 255, 0.15);
		border-radius: 8px;
		padding: 4px;
		min-width: 100px;
		z-index: 10;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.action-menu-item {
		display: flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		padding: 6px 8px;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: rgba(255, 255, 255, 0.7);
		font-size: 0.75rem;
		cursor: pointer;
		transition: background 0.1s ease;
		font-family: inherit;
	}

	.action-menu-item:hover {
		background: rgba(255, 255, 255, 0.1);
		color: white;
	}

	.action-menu-item.danger:hover {
		background: rgba(239, 68, 68, 0.2);
		color: #ef4444;
	}

	/* Edit mode */
	.edit-area {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.edit-input {
		width: 100%;
		padding: 6px 10px;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.1);
		border: 1px solid rgba(197, 154, 107, 0.4);
		color: white;
		font-size: 0.875rem;
		font-family: inherit;
		resize: none;
		outline: none;
	}

	.edit-input:focus {
		border-color: rgba(197, 154, 107, 0.6);
	}

	.edit-actions {
		display: flex;
		gap: 4px;
		justify-content: flex-end;
	}

	.edit-action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.edit-action-btn.save {
		background: rgba(34, 197, 94, 0.2);
		color: #22c55e;
	}

	.edit-action-btn.save:hover {
		background: rgba(34, 197, 94, 0.3);
	}

	.edit-action-btn.cancel {
		background: rgba(255, 255, 255, 0.08);
		color: rgba(255, 255, 255, 0.5);
	}

	.edit-action-btn.cancel:hover {
		background: rgba(255, 255, 255, 0.12);
		color: white;
	}

	/* Clear button in header */
	.clear-btn {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 10px;
		border-radius: 6px;
		background: rgba(239, 68, 68, 0.15);
		border: 1px solid rgba(239, 68, 68, 0.25);
		color: rgba(239, 68, 68, 0.8);
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s ease;
		font-family: inherit;
	}

	.clear-btn:hover {
		background: rgba(239, 68, 68, 0.25);
		border-color: rgba(239, 68, 68, 0.4);
		color: #ef4444;
	}

	.chat-input-area {
		display: flex;
		align-items: flex-end;
		gap: 8px;
		padding: 12px 16px;
		background: rgba(0, 0, 0, 0.2);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
	}

	.chat-input {
		flex: 1;
		padding: 10px 14px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.15);
		color: white;
		font-size: 0.875rem;
		font-family: inherit;
		resize: none;
		outline: none;
		max-height: 120px;
		transition: border-color 0.15s ease;
	}

	.chat-input::placeholder {
		color: rgba(255, 255, 255, 0.35);
	}

	.chat-input:focus {
		border-color: rgba(197, 154, 107, 0.5);
	}

	.send-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: var(--course-accent-light, #c59a6b);
		color: var(--course-accent-darkest, #1a2320);
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
		flex-shrink: 0;
	}

	.send-btn:hover:not(:disabled) {
		transform: scale(1.05);
		box-shadow: 0 2px 8px rgba(197, 154, 107, 0.3);
	}

	.send-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.chat-paused {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 14px 16px;
		background: rgba(0, 0, 0, 0.2);
		border-top: 1px solid rgba(255, 255, 255, 0.1);
		flex-shrink: 0;
		color: rgba(255, 255, 255, 0.4);
		font-size: 0.8125rem;
		font-style: italic;
	}

	.close-btn {
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.close-btn:hover {
		background: rgba(255, 255, 255, 0.15);
	}

	@media (max-width: 768px) {
		.chat-container {
			border-radius: 0;
			border: none;
		}

		.message-bubble {
			max-width: 90%;
		}
	}
</style>

<script>
	import ChatRoom from '$lib/components/ChatRoom.svelte';
	import { MessageCircle } from '$lib/icons';
	import { page } from '$app/stores';
	import { apiPost } from '$lib/utils/api-handler.js';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';

	let { data } = $props();

	const supabase = $derived(data.supabase);
	const courseSlug = $derived($page.params.slug);

	let chatEnabled = $state(data.chatEnabled !== false);
	let toggling = $state(false);

	// Sync when server data changes (e.g. navigation between cohorts)
	$effect(() => {
		chatEnabled = data.chatEnabled !== false;
	});

	async function toggleChat() {
		toggling = true;
		const newValue = !chatEnabled;
		try {
			await apiPost(`/admin/courses/${courseSlug}/settings/api`, {
				action: 'update_settings',
				settings: {
					name: data.course?.name,
					short_name: data.course?.short_name,
					description: data.course?.description,
					duration_weeks: data.course?.duration_weeks,
					settings: {
						...data.course?.settings,
						features: {
							...data.course?.settings?.features,
							chatEnabled: newValue
						}
					}
				}
			}, { showToast: false });
			chatEnabled = newValue;
			toastSuccess(newValue ? 'Chat enabled' : 'Chat paused');
		} catch {
			toastError('Failed to update chat setting');
		} finally {
			toggling = false;
		}
	}
</script>

<div class="chat-toggle-bar">
	<label class="toggle-label">
		<span class="text-sm text-white/70">{chatEnabled ? 'Chat enabled' : 'Chat paused'}</span>
		<button
			class="toggle-switch"
			class:active={chatEnabled}
			onclick={toggleChat}
			disabled={toggling}
			aria-label="Toggle chat"
		>
			<span class="toggle-knob"></span>
		</button>
	</label>
</div>

{#if data.noCohortSelected}
	<div class="empty-state">
		<MessageCircle size="40" class="text-white/20" />
		<p class="text-white/50 mt-3 text-sm">Select a cohort to view chat</p>
		<p class="text-white/30 text-xs mt-1">Use the sidebar to choose a cohort</p>
	</div>
{:else if data.cohortId && data.userMeta}
	{#key data.cohortId}
		<div class="chat-page">
			<ChatRoom
				messages={data.messages}
				cohortId={data.cohortId}
				userMeta={data.userMeta}
				{chatEnabled}
				{courseSlug}
				{supabase}
			/>
		</div>
	{/key}
{/if}

<style>
	.chat-toggle-bar {
		display: flex;
		justify-content: flex-end;
		padding: 8px 16px;
		max-width: 900px;
		margin: 0 auto;
	}

	.toggle-label {
		display: flex;
		align-items: center;
		gap: 8px;
		cursor: pointer;
	}

	.toggle-switch {
		position: relative;
		width: 40px;
		height: 22px;
		border-radius: 11px;
		background: rgba(255, 255, 255, 0.15);
		border: 1px solid rgba(255, 255, 255, 0.2);
		cursor: pointer;
		transition: all 0.2s ease;
		padding: 0;
	}

	.toggle-switch.active {
		background: rgba(34, 197, 94, 0.4);
		border-color: rgba(34, 197, 94, 0.6);
	}

	.toggle-switch:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.toggle-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.7);
		transition: transform 0.2s ease;
	}

	.toggle-switch.active .toggle-knob {
		transform: translateX(18px);
		background: #22c55e;
	}

	.chat-page {
		max-width: 900px;
		margin: 0 auto;
		padding: 0 16px 16px;
		height: calc(100vh - 54px);
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 60vh;
	}

	@media (max-width: 1024px) {
		.chat-page {
			padding: 0;
			height: calc(100vh - 90px);
		}
	}
</style>

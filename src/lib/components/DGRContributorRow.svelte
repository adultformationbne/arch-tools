<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import { Copy, ExternalLink, RefreshCw, Mail, MailCheck, Eye, AlertCircle, Loader2, Pencil, Trash2, MoreVertical } from '$lib/icons';
	import { getPatternDescription, formatDate, formatRelativeTime, needsFollowUp, getContributorLink, formatContributorName } from '$lib/utils/dgr-helpers';

	let {
		contributor,
		isSendingThis = false,
		isSendingAny = false,
		menuOpen = false,
		onToggleMenu = () => {},
		onCloseMenu = () => {},
		onSendWelcome = () => {},
		onResendWelcome = () => {},
		onEdit = () => {},
		onDelete = () => {}
	} = $props();

	let followUp = $derived(needsFollowUp(contributor));

	function copyLink() {
		const link = getContributorLink(contributor);
		if (link) {
			navigator.clipboard.writeText(link).then(() => {
				toast.success({
					title: 'Link Copied!',
					message: 'Contributor link copied to clipboard',
					duration: 2000
				});
			});
		}
	}
</script>

<tr class="{!contributor.active ? 'bg-gray-50 opacity-60' : ''} {followUp ? 'bg-amber-50/50' : ''}">
	<td class="px-4 py-3 whitespace-nowrap">
		<div class="flex items-center gap-2">
			<div class="text-sm font-medium text-gray-900">
				{formatContributorName(contributor)}
			</div>
			{#if !contributor.active}
				<span class="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
					Inactive
				</span>
			{/if}
			{#if followUp}
				<span class="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700" title="Welcomed but never visited - may need follow-up">
					<AlertCircle class="h-2.5 w-2.5" />
					Follow up
				</span>
			{/if}
		</div>
	</td>
	<td class="px-4 py-3 whitespace-nowrap">
		<div class="text-sm text-gray-500">{contributor.email}</div>
	</td>
	<td class="px-4 py-3">
		<div class="text-xs text-gray-600">
			{getPatternDescription(contributor.schedule_pattern)}
		</div>
	</td>
	<td class="px-4 py-3 whitespace-nowrap">
		{#if isSendingThis}
			<div class="flex items-center gap-1.5 text-purple-600">
				<Loader2 class="h-4 w-4 animate-spin" />
				<span class="text-xs">Sending...</span>
			</div>
		{:else if contributor.welcome_email_sent_at}
			<div class="group flex items-center gap-1.5">
				<div class="flex items-center gap-1.5 text-green-600" title={`Sent ${formatDate(contributor.welcome_email_sent_at)}`}>
					<MailCheck class="h-4 w-4" />
					<span class="text-xs">{formatRelativeTime(contributor.welcome_email_sent_at)}</span>
				</div>
				<button
					onclick={() => onResendWelcome(contributor)}
					class="ml-1 rounded p-0.5 text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
					title="Resend welcome email"
				>
					<RefreshCw class="h-3 w-3" />
				</button>
			</div>
		{:else if contributor.access_token}
			<button
				onclick={() => onSendWelcome(contributor)}
				disabled={isSendingAny}
				class="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
			>
				<Mail class="h-3 w-3" />
				Send
			</button>
		{:else}
			<span class="text-xs text-gray-400">No token</span>
		{/if}
	</td>
	<td class="px-4 py-3 whitespace-nowrap">
		{#if contributor.last_visited_at}
			<div class="flex items-center gap-1.5 text-blue-600" title={`Last visit: ${formatDate(contributor.last_visited_at)}`}>
				<Eye class="h-4 w-4" />
				<div>
					<div class="text-xs">{formatRelativeTime(contributor.last_visited_at)}</div>
					{#if contributor.visit_count > 1}
						<div class="text-[10px] text-gray-500">{contributor.visit_count} visits</div>
					{/if}
				</div>
			</div>
		{:else}
			<span class="text-xs text-gray-400">Never</span>
		{/if}
	</td>
	<td class="px-4 py-3 whitespace-nowrap">
		<div class="flex items-center gap-1">
			{#if contributor.access_token}
				<button
					onclick={copyLink}
					class="inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
					title="Copy contributor link"
				>
					<Copy class="h-3 w-3" />
				</button>
				<a
					href={getContributorLink(contributor)}
					target="_blank"
					class="inline-flex items-center rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
					title="Open link"
				>
					<ExternalLink class="h-3 w-3" />
				</a>
			{/if}
			<!-- Kebab menu for edit/delete -->
			<div class="relative">
				<button
					onclick={() => onToggleMenu(contributor.id)}
					class="inline-flex items-center rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
					title="More actions"
				>
					<MoreVertical class="h-4 w-4" />
				</button>
				{#if menuOpen}
					<div
						class="absolute right-0 z-10 mt-1 w-36 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5"
						role="menu"
					>
						<button
							onclick={() => { onEdit(contributor); onCloseMenu(); }}
							class="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
							role="menuitem"
						>
							<Pencil class="h-4 w-4" />
							Edit
						</button>
						<button
							onclick={() => { onDelete(contributor); onCloseMenu(); }}
							class="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
							role="menuitem"
						>
							<Trash2 class="h-4 w-4" />
							Delete
						</button>
					</div>
				{/if}
			</div>
		</div>
	</td>
</tr>

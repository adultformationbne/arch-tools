<script>
	import { Plus, Upload, Send, Settings, Loader2 } from 'lucide-svelte';

	let {
		isSending = false,
		unwelcomedCount = 0,
		onToggleForm = () => {},
		onShowImport = () => {},
		onBulkWelcome = () => {}
	} = $props();
</script>

<div class="flex gap-3 flex-wrap">
	<button
		onclick={onToggleForm}
		class="flex flex-1 min-w-[200px] items-center gap-3 rounded-lg bg-white p-4 shadow-sm hover:bg-gray-50 transition-colors"
	>
		<div class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
			<Plus class="h-5 w-5 text-green-600" />
		</div>
		<div class="text-left">
			<h2 class="font-semibold text-gray-900">Add Single</h2>
			<p class="text-sm text-gray-500">Add one contributor</p>
		</div>
	</button>

	<button
		onclick={onShowImport}
		class="flex flex-1 min-w-[200px] items-center gap-3 rounded-lg bg-white p-4 shadow-sm hover:bg-gray-50 transition-colors"
	>
		<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
			<Upload class="h-5 w-5 text-blue-600" />
		</div>
		<div class="text-left">
			<h2 class="font-semibold text-gray-900">Bulk Import</h2>
			<p class="text-sm text-gray-500">Import from CSV</p>
		</div>
	</button>

	<button
		onclick={onBulkWelcome}
		disabled={isSending || unwelcomedCount === 0}
		class="flex flex-1 min-w-[200px] items-center gap-3 rounded-lg bg-white p-4 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
	>
		<div class="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
			{#if isSending}
				<Loader2 class="h-5 w-5 text-purple-600 animate-spin" />
			{:else}
				<Send class="h-5 w-5 text-purple-600" />
			{/if}
		</div>
		<div class="text-left">
			<h2 class="font-semibold text-gray-900">Send Welcome Emails</h2>
			<p class="text-sm text-gray-500">
				{#if isSending}
					Sending...
				{:else if unwelcomedCount > 0}
					{unwelcomedCount} pending
				{:else}
					All sent
				{/if}
			</p>
		</div>
	</button>

	<a
		href="/dgr/emails"
		class="flex flex-1 min-w-[200px] items-center gap-3 rounded-lg bg-white p-4 shadow-sm hover:bg-gray-50 transition-colors"
	>
		<div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
			<Settings class="h-5 w-5 text-gray-600" />
		</div>
		<div class="text-left">
			<h2 class="font-semibold text-gray-900">Email Templates</h2>
			<p class="text-sm text-gray-500">Edit welcome & reminder emails</p>
		</div>
	</a>
</div>

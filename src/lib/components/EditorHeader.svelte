<script>
	import { RotateCcw, Check, AlertCircle, Plus, Home } from 'lucide-svelte';
	import Button from '$lib/design-system/Button.svelte';
	import Card from '$lib/design-system/Card.svelte';

	let {
		documentTitle = $bindable(''),
		saveStatus = 'saved',
		lastSaveTime = null,
		errorMessage = ''
	} = $props();

	function formatTime(isoString) {
		if (!isoString) return '';
		const date = new Date(isoString);
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			second: '2-digit'
		});
	}
</script>

<Card>
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold text-gray-800">Document Editor</h1>
			<p class="mt-1 text-gray-600">Manage, edit, and organize your content blocks</p>
		</div>

		<div class="flex items-center gap-4">
			<!-- Save Status -->
			<div class="flex items-center gap-2 text-sm">
				{#if saveStatus === 'saving'}
					<RotateCcw class="h-4 w-4 animate-spin text-blue-600" />
					<span class="text-blue-600">Saving...</span>
				{:else if saveStatus === 'saved'}
					<Check class="h-4 w-4 text-green-600" />
					<span class="text-green-600"
						>Saved {lastSaveTime ? `at ${formatTime(lastSaveTime)}` : ''}</span
					>
				{:else if saveStatus === 'error'}
					<AlertCircle class="h-4 w-4 text-red-600" />
					<span class="text-red-600">{errorMessage || 'Save error'}</span>
				{/if}
			</div>

			<!-- Add Content functionality can be added here later -->

			<a href="/">
				<Button variant="secondary" icon={Home}>Back to Home</Button>
			</a>
		</div>
	</div>

	<!-- Document Title -->
	<div class="mt-6 border-t border-gray-100 pt-6">
		<label class="mb-2 block text-sm font-medium text-gray-700">Document Title</label>
		<input
			type="text"
			bind:value={documentTitle}
			class="w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2 text-xl font-semibold text-gray-800 focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
			placeholder="Enter document title..."
		/>
	</div>
</Card>

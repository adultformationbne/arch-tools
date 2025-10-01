<script>
	import { FileText, Video, Link, BookOpen, Upload } from 'lucide-svelte';

	let {
		weekNumber = 1,
		sessionOverview = '',
		materials = [],
		maxPreviewItems = 3
	} = $props();

	const getMaterialIcon = (type) => {
		switch (type) {
			case 'video': return Video;
			case 'document': return FileText;
			case 'link': return Link;
			case 'native': return BookOpen;
			case 'upload': return Upload;
			default: return FileText;
		}
	};
</script>

<div class="bg-gray-50 rounded-2xl p-6">
	<h3 class="font-bold text-gray-800 mb-4">Student Preview</h3>
	<div class="bg-white rounded-lg p-4 border">
		<h4 class="font-bold text-lg mb-2" style="color: #c59a6b;">Week {weekNumber}</h4>
		<p class="text-sm text-gray-600 mb-4">{sessionOverview || 'No overview set'}</p>
		<div class="space-y-2">
			{#each materials.slice(0, maxPreviewItems) as material}
				<div class="flex items-center gap-2 text-sm">
					<svelte:component this={getMaterialIcon(material.type)} size="16" class="text-gray-500" />
					<span class="truncate">{material.title}</span>
				</div>
			{/each}
			{#if materials.length > maxPreviewItems}
				<p class="text-xs text-gray-500">+{materials.length - maxPreviewItems} more materials</p>
			{/if}
			{#if materials.length === 0}
				<p class="text-xs text-gray-500 italic">No materials added yet</p>
			{/if}
		</div>
	</div>
</div>
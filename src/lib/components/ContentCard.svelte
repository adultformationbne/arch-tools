<script>
	let { block, showUUID = false, showMetadata = false } = $props();

	let isExpanded = $state(false);

	const contentTypeClass = $derived(getContentTypeClass(block.type));
	const shouldTruncate = $derived(block.content.length > 200);
	const displayContent = $derived(
		isExpanded || !shouldTruncate ? block.content : truncateContent(block.content, 200)
	);

	function toggleExpanded() {
		isExpanded = !isExpanded;
	}

	function getContentTypeClass(type) {
		switch (type) {
			case 'paragraph':
				return 'border-gray-200 bg-white';
			case 'callout_text':
				return 'border-blue-200 bg-blue-50';
			case 'callout_header':
				return 'border-orange-200 bg-orange-50 font-semibold';
			case 'header':
				return 'border-purple-200 bg-purple-50 font-bold text-purple-900';
			case 'special_text':
				return 'border-green-200 bg-green-50';
			default:
				return 'border-gray-200 bg-white';
		}
	}

	function getBadgeClass(type) {
		switch (type) {
			case 'paragraph':
				return 'bg-gray-100 text-gray-700';
			case 'callout_text':
				return 'bg-blue-100 text-blue-700';
			case 'callout_header':
				return 'bg-orange-100 text-orange-700';
			case 'header':
				return 'bg-purple-100 text-purple-700';
			case 'special_text':
				return 'bg-green-100 text-green-700';
			default:
				return 'bg-gray-100 text-gray-700';
		}
	}

	function truncateContent(content, maxLength) {
		if (content.length <= maxLength) return content;
		return content.substring(0, maxLength) + '...';
	}

	function getTypeLabel(type) {
		switch (type) {
			case 'paragraph':
				return 'Paragraph';
			case 'callout_text':
				return 'Callout';
			case 'callout_header':
				return 'Callout Header';
			case 'header':
				return 'Header';
			case 'special_text':
				return 'Special';
			default:
				return type;
		}
	}
</script>

<div
	class="mb-3 rounded-lg border p-4 transition-all duration-200 hover:border-gray-300 hover:shadow-md {contentTypeClass}"
>
	<div class="mb-2 flex items-center justify-between">
		<span
			class="inline-block rounded-full px-2 py-1 text-xs font-medium tracking-wide uppercase {getBadgeClass(
				block.type
			)}"
		>
			{getTypeLabel(block.type)}
		</span>
		{#if showUUID}
			<code class="rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-500">{block.id}</code>
		{/if}
	</div>

	<div class="card-content">
		{#if block.type === 'header'}
			<h3 class="text-lg leading-tight font-bold text-purple-900">{displayContent}</h3>
		{:else}
			<p class="text-sm leading-relaxed whitespace-pre-wrap">{displayContent}</p>
		{/if}
		{#if shouldTruncate}
			<button
				onclick={toggleExpanded}
				class="mt-2 text-xs font-medium text-blue-600 hover:text-blue-800 focus:outline-none"
			>
				{isExpanded ? 'Show less' : 'Show more'}
			</button>
		{/if}
	</div>

	{#if showMetadata && block.originalClass}
		<div class="card-metadata">
			<small class="text-xs text-gray-400">Original: {block.originalClass}</small>
			{#if block.metadata && Object.keys(block.metadata).length > 0}
				<div class="metadata-details mt-1 text-xs text-gray-400">
					{#each Object.entries(block.metadata) as [key, value]}
						<span class="mr-2 inline-block">{key}: {value}</span>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

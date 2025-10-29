<script>
	import { decodeHtmlEntities } from '$lib/utils/html.js';

	let { content = '', class: className = '' } = $props();

	// Convert content to properly decoded HTML
	function getDisplayContent() {
		if (!content) return '';

		// Decode HTML entities and handle line breaks
		let decoded = decodeHtmlEntities(content).replace(/\n/g, '<br>');

		return decoded;
	}
</script>

<div class="rich-text-display {className}">
	{@html getDisplayContent()}
</div>

<style>
	@reference "../../app.css";
	/* Rich text formatting styles */
	:global(.rich-text-display [data-format='scripture']) {
		@apply rounded bg-teal-50 px-1 font-medium text-teal-700;
	}

	:global(.rich-text-display [data-format='quote']) {
		@apply rounded bg-blue-50 px-1 text-blue-700 italic;
	}

	:global(.rich-text-display strong),
	:global(.rich-text-display b) {
		@apply font-bold;
	}

	:global(.rich-text-display em),
	:global(.rich-text-display i) {
		@apply italic;
	}

	:global(.rich-text-display) {
		line-height: 1.6;
	}
</style>

<script>
	let { content = '', class: className = '' } = $props();
	
	// Convert plain text to HTML if needed
	function getDisplayContent() {
		if (!content) return '';
		
		// If content already contains HTML tags, return as-is
		if (content.includes('<') && content.includes('>')) {
			return content;
		}
		
		// Otherwise, treat as plain text and escape HTML
		return content.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;')
			.replace(/\n/g, '<br>');
	}
</script>

<div 
	class="rich-text-display {className}"
>
	{@html getDisplayContent()}
</div>

<style>
	/* Rich text formatting styles */
	:global(.rich-text-display [data-format="scripture"]) {
		@apply text-teal-700 font-medium bg-teal-50 px-1 rounded;
	}
	
	:global(.rich-text-display [data-format="quote"]) {
		@apply text-blue-700 italic bg-blue-50 px-1 rounded;
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
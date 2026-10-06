<script>
	// The course wordmark stands in for a typeset title
	let { module } = $props();
</script>

<div class="eyebrow">Companion Guide</div>
<h1 class="wordmark">
	<img src="/sites/alivingunion/wordmark.webp" alt={module.name} width="1096" height="538" />
</h1>

<style>
	.eyebrow { font-family: var(--pp-font-ui); font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.12em; color: var(--pp-accent); margin-bottom: 0.5rem; }
	.wordmark { margin: 0.75rem 0 2rem; }
	.wordmark img { display: block; width: min(100%, 22rem); height: auto; }
</style>

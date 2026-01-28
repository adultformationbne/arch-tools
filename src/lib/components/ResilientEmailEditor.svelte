<script>
	import { onMount } from 'svelte';
	import FallbackTextEditor from './FallbackTextEditor.svelte';

	/**
	 * Resilient email editor that tries TipTap first, falls back to basic editor if it fails.
	 * Drop-in replacement for TipTapEmailEditor with graceful degradation.
	 */
	let {
		value = '',
		onchange = (html) => {},
		placeholder = 'Write your email content...',
		availableVariables = [],
		hideVariablePicker = false,
		showFixedToolbar = false,
		verticalToolbar = false,
		accentColor = '#334642',
		context = 'course', // 'course', 'dgr', 'platform' - for image uploads
		contextId = null, // course ID if context is 'course'
		editor = $bindable(),
		hasSelection = $bindable(false)
	} = $props();

	let TipTapEditor = $state(null);
	let loadError = $state(null);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			// Dynamically import TipTap editor
			const module = await import('./TipTapEmailEditor.svelte');
			TipTapEditor = module.default;
			isLoading = false;
		} catch (err) {
			console.warn('TipTap editor failed to load, using fallback:', err.message);
			loadError = err;
			isLoading = false;
		}
	});

	// For fallback editor, provide minimal editor-like interface
	let fallbackRef = $state(null);
</script>

{#if isLoading}
	<div class="editor-loading">
		<div class="loading-spinner"></div>
		<span>Loading editor...</span>
	</div>
{:else if TipTapEditor && !loadError}
	<svelte:component
		this={TipTapEditor}
		bind:editor
		bind:hasSelection
		{value}
		{onchange}
		{placeholder}
		{availableVariables}
		{hideVariablePicker}
		{showFixedToolbar}
		{verticalToolbar}
		{accentColor}
		{context}
		{contextId}
	/>
{:else}
	<FallbackTextEditor
		bind:this={fallbackRef}
		{value}
		{onchange}
		{placeholder}
	/>
{/if}

<style>
	.editor-loading {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 40px;
		background: #f9fafb;
		border: 1px solid #e5e7eb;
		border-radius: 8px;
		color: #6b7280;
		font-size: 14px;
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid #e5e7eb;
		border-top-color: #6366f1;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>

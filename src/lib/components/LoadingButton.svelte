<script>
	import Button from '$lib/design-system/Button.svelte';

	let {
		loading = false,
		loadingText = 'Loading...',
		disabled = false,
		children,
		...buttonProps
	} = $props();

	// Auto-disable when loading
	const isDisabled = disabled || loading;
</script>

<Button {loading} disabled={isDisabled} {...buttonProps}>
	{#if loading && loadingText}
		{loadingText}
	{:else}
		{@render children?.()}
	{/if}
</Button>
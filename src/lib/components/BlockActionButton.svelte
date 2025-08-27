<script>
	import Button from '$lib/design-system/Button.svelte';

	let {
		icon,
		label,
		title = label,
		variant = 'ghost',
		size = 'md',
		compact = false,
		onclick,
		disabled = false,
		class: customClass = '',
		...props
	} = $props();

	const compactClass = compact ? 'p-2 min-w-0' : 'flex-col h-16 text-xs min-w-20';
</script>

<Button
	{variant}
	{size}
	{icon}
	{onclick}
	{disabled}
	{title}
	class="{compactClass} {customClass}"
	{...props}
>
	{#if !compact}
		{label}
	{/if}
</Button>

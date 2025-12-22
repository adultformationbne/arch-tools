<script>
	import { icons } from 'lucide';

	let { name, size = 24, class: className = '', strokeWidth = 2, ...rest } = $props();

	// Lucide uses PascalCase keys directly
	let iconData = $derived(icons[name] || []);
</script>

<svg
	xmlns="http://www.w3.org/2000/svg"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
	class={className}
	{...rest}
>
	{#each iconData as [tag, attrs]}
		{#if tag === 'path'}
			<path {...attrs} />
		{:else if tag === 'circle'}
			<circle {...attrs} />
		{:else if tag === 'rect'}
			<rect {...attrs} />
		{:else if tag === 'line'}
			<line {...attrs} />
		{:else if tag === 'polyline'}
			<polyline {...attrs} />
		{:else if tag === 'polygon'}
			<polygon {...attrs} />
		{:else if tag === 'ellipse'}
			<ellipse {...attrs} />
		{/if}
	{/each}
</svg>

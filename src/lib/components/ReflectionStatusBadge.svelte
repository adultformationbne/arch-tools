<script>
	/**
	 * ReflectionStatusBadge - Consistent status badge for reflections
	 */
	import { getStatusIcon, getStatusBadge, getStatusLabel } from '$lib/utils/reflection-status';

	/** @type {{ status?: string | null, size?: 'small' | 'default' | 'large', showIcon?: boolean, class?: string }} */
	let { status = 'submitted', size = 'default', showIcon = true, class: className = '' } = $props();

	const Icon = $derived(getStatusIcon(status));
	const badgeClasses = $derived(getStatusBadge(status));
	const label = $derived(getStatusLabel(status));

	const sizeClasses = $derived({
		small: 'px-2 py-0.5 text-xs gap-1',
		default: 'px-2.5 py-1 text-xs gap-1.5',
		large: 'px-3 py-1.5 text-sm gap-2'
	}[size]);

	const iconSize = $derived({
		small: 10,
		default: 12,
		large: 14
	}[size]);
</script>

<span class="inline-flex items-center rounded-full font-medium {sizeClasses} {badgeClasses} {className}">
	{#if showIcon}
		<svelte:component this={Icon} size={iconSize} />
	{/if}
	{label}
</span>

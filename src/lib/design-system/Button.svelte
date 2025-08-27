<script>
	import { twMerge } from 'tailwind-merge';

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		icon = null,
		iconPosition = 'left',
		children,
		class: customClass = '',
		onclick,
		...props
	} = $props();

	const baseClasses =
		'inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

	const variants = {
		primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
		secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500',
		success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
		danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
		warning: 'bg-amber-600 text-white hover:bg-amber-700 focus:ring-amber-500',
		ghost: 'text-gray-700 hover:bg-gray-100 focus:ring-gray-500',
		outline: 'border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-gray-500'
	};

	const sizes = {
		xs: 'px-2 py-1 text-xs rounded-md gap-1',
		sm: 'px-3 py-1.5 text-sm rounded-md gap-1.5',
		md: 'px-4 py-2 text-sm rounded-lg gap-2',
		lg: 'px-6 py-3 text-base rounded-lg gap-2',
		xl: 'px-8 py-4 text-lg rounded-xl gap-3'
	};

	const classes = twMerge(baseClasses, variants[variant], sizes[size], customClass);
</script>

<button {disabled} class={classes} {onclick} {...props}>
	{#if loading}
		<svg class="h-4 w-4 animate-spin" viewBox="0 0 24 24">
			<circle
				class="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				stroke-width="4"
				fill="none"
			/>
			<path
				class="opacity-75"
				fill="currentColor"
				d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			/>
		</svg>
	{:else if icon && iconPosition === 'left'}
		<svelte:component this={icon} class="h-4 w-4" />
	{/if}

	{@render children?.()}

	{#if icon && iconPosition === 'right'}
		<svelte:component this={icon} class="h-4 w-4" />
	{/if}
</button>

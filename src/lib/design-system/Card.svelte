<script>
	import { twMerge } from 'tailwind-merge';

	let {
		padding = 'md',
		shadow = 'md',
		rounded = 'lg',
		border = true,
		children,
		class: customClass = '',
		...props
	} = $props();

	const baseClasses = 'bg-white';

	const paddings = {
		none: '',
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-8',
		xl: 'p-10'
	};

	const shadows = {
		none: '',
		sm: 'shadow-sm',
		md: 'shadow-lg',
		lg: 'shadow-xl',
		xl: 'shadow-2xl'
	};

	const roundeds = {
		none: '',
		sm: 'rounded-md',
		md: 'rounded-lg',
		lg: 'rounded-xl',
		xl: 'rounded-2xl'
	};

	const borderClass = border ? 'border border-gray-200' : '';

	const classes = twMerge(
		baseClasses,
		paddings[padding],
		shadows[shadow],
		roundeds[rounded],
		borderClass,
		customClass
	);
</script>

<div class={classes} {...props}>
	{@render children?.()}
</div>

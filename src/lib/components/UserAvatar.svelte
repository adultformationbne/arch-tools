<script>
	import { getUserInitials, getColorForUser } from '$lib/utils/avatar.js';

	let {
		user, // { id, full_name, email }
		size = 'md', // 'xs' | 'sm' | 'md' | 'lg' | 'xl'
		showTooltip = false,
		class: className = ''
	} = $props();

	const initials = $derived(getUserInitials(user?.full_name, user?.email));
	const colors = $derived(getColorForUser(user?.id || user?.email || 'default'));

	const sizeClasses = {
		xs: 'h-6 w-6 text-xs',
		sm: 'h-8 w-8 text-sm',
		md: 'h-10 w-10 text-base',
		lg: 'h-12 w-12 text-lg',
		xl: 'h-16 w-16 text-xl'
	};
</script>

<div
	role="img"
	aria-label="Avatar for {user?.full_name || user?.email}"
	class="flex flex-shrink-0 items-center justify-center rounded-full font-semibold {sizeClasses[
		size
	]} {className}"
	style="background-color: {colors.bg}; color: {colors.text};"
	title={showTooltip ? user?.full_name || user?.email : ''}
>
	{initials}
</div>

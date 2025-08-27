<script>
	import { toast as toastStore } from '$lib/stores/toast.svelte.js';
	import Toast from './Toast.svelte';
</script>

<div class="pointer-events-none fixed z-50">
	<!-- Top right position by default -->
	<div class="pointer-events-auto fixed top-4 right-4 w-full max-w-sm space-y-2">
		{#each toastStore.toasts as toast (toast.id)}
			<Toast {toast} />
		{/each}
	</div>
</div>

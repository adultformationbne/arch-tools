<script>
  import { toast as toastStore } from '$lib/stores/toast.js';
  import Toast from './Toast.svelte';
</script>

<div class="fixed z-50 pointer-events-none">
  <!-- Top right position by default -->
  <div class="fixed top-4 right-4 space-y-2 pointer-events-auto max-w-sm w-full">
    {#each toastStore.toasts as toast (toast.id)}
      <Toast {toast} />
    {/each}
  </div>
</div>
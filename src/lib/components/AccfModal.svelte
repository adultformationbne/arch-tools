<script>
	export let isOpen = false;
	export let title = '';
	export let message = '';
	export let confirmText = 'Confirm';
	export let cancelText = 'Cancel';
	export let confirmAction = () => {};
	export let cancelAction = () => {};
</script>

{#if isOpen}
	<!-- Modal Overlay -->
	<div class="fixed inset-0 bg-accf-darkest bg-opacity-50 flex items-center justify-center p-4 z-50">
		<!-- Modal Content -->
		<div class="bg-accf-lightest rounded-lg max-w-md w-full p-6 shadow-xl">
			{#if title}
				<h3 class="accf-heading text-lg mb-4">{title}</h3>
			{/if}

			{#if message}
				<p class="accf-text mb-6">{message}</p>
			{/if}

			<slot />

			<!-- Action Buttons -->
			<div class="flex space-x-3 justify-end mt-6">
				<button
					class="accf-button-secondary"
					on:click={() => {
						cancelAction();
						isOpen = false;
					}}
				>
					{cancelText}
				</button>
				<button
					class="accf-button-primary"
					on:click={() => {
						confirmAction();
						isOpen = false;
					}}
				>
					{confirmText}
				</button>
			</div>
		</div>
	</div>
{/if}
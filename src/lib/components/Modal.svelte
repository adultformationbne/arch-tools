<script>
	import { X } from 'lucide-svelte';

	let {
		isOpen = false,
		title = '',
		onClose = () => {},
		size = 'md',
		showCloseButton = true,
		closeOnBackdrop = true,
		closeOnEscape = true,
		children,
		footer
	} = $props();

	let modalElement = $state(null);

	// Size configurations
	const sizeClasses = {
		sm: 'max-w-md',
		md: 'max-w-2xl',
		lg: 'max-w-4xl',
		xl: 'max-w-6xl'
	};

	// Handle escape key
	function handleKeydown(event) {
		if (closeOnEscape && event.key === 'Escape') {
			onClose();
		}
	}

	// Handle backdrop click
	function handleBackdropClick() {
		if (closeOnBackdrop) {
			onClose();
		}
	}

	// Focus management
	$effect(() => {
		if (isOpen && modalElement) {
			modalElement.focus();

			// Prevent body scroll
			document.body.style.overflow = 'hidden';

			return () => {
				document.body.style.overflow = '';
			};
		}
	});
</script>

{#if isOpen}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
		onclick={handleBackdropClick}
		onkeydown={(e) => e.key === 'Enter' && handleBackdropClick()}
		role="presentation"
	>
		<!-- Modal Content -->
		<div
			bind:this={modalElement}
			class="max-h-[95vh] w-full overflow-auto rounded-xl bg-white shadow-xl {sizeClasses[size]}"
			onclick={(e) => e.stopPropagation()}
			onkeydown={handleKeydown}
			role="dialog"
			aria-modal="true"
			aria-labelledby={title ? "modal-title" : undefined}
			tabindex="-1"
		>
			{#if title || showCloseButton}
				<!-- Modal Header -->
				<div class="flex items-center justify-between border-b border-gray-200 p-6">
					{#if title}
						<h2 id="modal-title" class="text-xl font-semibold text-gray-900">
							{title}
						</h2>
					{:else}
						<div></div>
					{/if}

					{#if showCloseButton}
						<button
							onclick={onClose}
							class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
							aria-label="Close modal"
						>
							<X class="h-5 w-5" />
						</button>
					{/if}
				</div>
			{/if}

			<!-- Modal Body -->
			<div class="p-6">
				{@render children?.()}
			</div>

			{#if footer}
				<!-- Modal Footer -->
				<div class="border-t border-gray-200 bg-gray-50 px-6 py-4">
					{@render footer?.()}
				</div>
			{/if}
		</div>
	</div>
{/if}
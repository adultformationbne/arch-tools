<script>
	import { X, Mail } from '$lib/icons';
	import SendEmailView from './SendEmailView.svelte';

	let {
		show = false,
		courseSlug = '',
		course = null,
		recipients = [],
		cohortId = null,
		currentUserEmail = '',
		initialTemplateSlug = '',
		onClose = () => {},
		onSent = () => {}
	} = $props();

	const courseColors = $derived({
		accentDark: course?.accent_dark || '#334642',
		accentLight: course?.accent_light || '#eae2d9',
		accentDarkest: course?.accent_darkest || '#1e2322'
	});

	function handleClose() {
		onClose();
	}
</script>

{#if show}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
	>
		<div
			class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
			tabindex="-1"
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b" style="border-color: {courseColors.accentLight};">
				<div class="flex items-center gap-3">
					<div class="p-2 rounded-lg" style="background-color: color-mix(in srgb, {courseColors.accentLight} 30%, white);">
						<Mail size={20} style="color: {courseColors.accentDark};" />
					</div>
					<div>
						<h2 class="text-lg font-bold" style="color: {courseColors.accentDarkest};">Send Email</h2>
						<p class="text-sm text-gray-600">
							{recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
						</p>
					</div>
				</div>
				<button onclick={handleClose} class="p-2 hover:bg-gray-100 rounded-lg transition-colors">
					<X size={20} class="text-gray-500" />
				</button>
			</div>

			<!-- Content: delegates to SendEmailView -->
			<div class="flex-1 overflow-y-auto">
				<SendEmailView
					{course}
					{courseSlug}
					{currentUserEmail}
					{cohortId}
					preselectedRecipients={recipients}
					{initialTemplateSlug}
					variant="embedded"
					onSent={() => { onSent(); onClose(); }}
					onClose={handleClose}
				/>
			</div>
		</div>
	</div>
{/if}

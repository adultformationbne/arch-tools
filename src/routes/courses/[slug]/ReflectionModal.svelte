<script>
	import { X, ChevronLeft, ChevronRight, Star, HelpCircle, MessageSquare, Clock } from '$lib/icons';
	import { needsReview, isComplete } from '$lib/utils/reflection-status.js';

	let {
		reflection = null,
		isVisible = $bindable(false),
		onClose = () => {},
		onNavigate = () => {}
	} = $props();

	const handleClose = () => {
		isVisible = false;
		onClose();
	};

	const handleNavigate = (direction) => {
		onNavigate(reflection.session, direction);
	};

	const getStatusLabel = (status) => {
		if (isComplete(status)) return 'Passed';
		if (status === 'needs_revision') return 'Needs Revision';
		return 'Waiting for Feedback';
	};

	const getStatusColor = (status) => {
		if (isComplete(status)) return 'text-green-600';
		if (status === 'needs_revision') return 'text-orange-600';
		return 'text-gray-500';
	};
</script>

{#if isVisible && reflection}
	<!-- Modal Backdrop -->
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50"
		onclick={handleClose}
		role="button"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		aria-label="Close modal"
	>
		<!-- Modal Content -->
		<div
			class="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Modal Header -->
			<div class="flex items-center justify-between px-8 py-6 border-b border-gray-100">
				<div class="flex items-center gap-4">
					<div class="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-xl text-white" style="background-color: var(--course-accent-dark, #334642);">
						{reflection.session}
					</div>
					<div>
						<div class="flex items-center gap-3">
							<h2 class="text-xl font-bold text-gray-900">Session {reflection.session}</h2>
							<span class="text-sm font-medium {getStatusColor(reflection.status)}">
								{getStatusLabel(reflection.status)}
							</span>
						</div>
						<p class="text-sm text-gray-500">Submitted {reflection.submittedDate}</p>
					</div>
				</div>

				<!-- Navigation and Close -->
				<div class="flex items-center gap-1">
					<button
						onclick={() => handleNavigate('prev')}
						class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
						title="Previous Session"
					>
						<ChevronLeft size="20" class="text-gray-400" />
					</button>
					<button
						onclick={() => handleNavigate('next')}
						class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
						title="Next Session"
					>
						<ChevronRight size="20" class="text-gray-400" />
					</button>
					<button
						onclick={handleClose}
						class="p-2 rounded-lg hover:bg-gray-100 transition-colors ml-2"
					>
						<X size="20" class="text-gray-400" />
					</button>
				</div>
			</div>

			<!-- Modal Body -->
			<div class="flex-1 overflow-y-auto p-8 space-y-6">
				<!-- Question -->
				<div>
					<div class="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
						<HelpCircle size="16" />
						Question
					</div>
					<p class="text-xl font-semibold text-gray-900 leading-relaxed">
						{reflection.question}
					</p>
				</div>

				<div class="border-t border-gray-100"></div>

				<!-- Student Response -->
				<div>
					<div class="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
						<MessageSquare size="16" />
						Your Response
					</div>
					<div class="prose prose-lg max-w-none text-gray-700 leading-relaxed">
						{@html reflection.response}
					</div>
				</div>

				<!-- Instructor Feedback -->
				{#if reflection.feedback}
					<div class="border-t border-gray-100 pt-6">
						<div class="rounded-xl p-5 border-l-4" style="background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 25%, white); border-left-color: var(--course-accent-dark, #334642);">
							<div class="flex items-center gap-2 text-base font-bold mb-3" style="color: var(--course-accent-dark, #334642);">
								<Star size="18" class="fill-current" />
								Instructor Feedback
							</div>
							<p class="text-gray-800 leading-relaxed text-base">{reflection.feedback}</p>
							{#if reflection.instructor}
								<p class="text-sm font-medium mt-4" style="color: var(--course-accent-dark, #334642);">— {reflection.instructor}</p>
							{/if}
						</div>
					</div>
				{:else if needsReview(reflection.status)}
					<div class="border-t border-gray-100 pt-6">
						<div class="flex items-center gap-2 text-sm font-medium text-gray-400 mb-3">
							<Clock size="16" />
							Status
						</div>
						<div class="bg-gray-50 rounded-xl p-5">
							<p class="text-gray-600">Your reflection is awaiting review. Feedback will be available soon.</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="flex items-center justify-end px-8 py-5 border-t border-gray-100">
				<div class="flex items-center gap-2">
					<button
						onclick={() => handleNavigate('prev')}
						class="flex items-center gap-1 px-4 py-2 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
					>
						<ChevronLeft size="16" />
						Previous
					</button>
					<button
						onclick={() => handleNavigate('next')}
						class="flex items-center gap-1 px-4 py-2 text-white font-medium rounded-lg transition-colors hover:opacity-90"
						style="background-color: var(--course-accent-dark, #334642);"
					>
						Next
						<ChevronRight size="16" />
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
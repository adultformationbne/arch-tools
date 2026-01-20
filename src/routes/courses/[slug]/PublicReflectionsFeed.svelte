<script>
	import { Globe, ArrowRight, X, HelpCircle, MessageSquare } from '$lib/icons';

	let {
		reflections = []
	} = $props();

	// Use real reflections data
	const publicReflections = reflections || [];

	// Modal state
	let showModal = $state(false);
	let selectedReflection = $state(null);

	const openModal = (reflection) => {
		selectedReflection = reflection;
		showModal = true;
	};

	const closeModal = () => {
		showModal = false;
		selectedReflection = null;
	};
</script>

<div>
	<!-- Section Header -->
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 sm:mb-8">
		<div class="flex flex-wrap items-center gap-3 sm:gap-4">
			<h2 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Community Reflections</h2>
			<div class="flex items-center gap-2 px-3 py-1 rounded-full" style="background-color: rgba(197, 154, 107, 0.2);">
				<Globe size="16" style="color: #c59a6b;" />
				<span class="text-sm font-medium" style="color: #c59a6b;">Public Feed</span>
			</div>
		</div>
		<span class="text-white/70 text-lg">
			{publicReflections.length} reflection{publicReflections.length !== 1 ? 's' : ''} shared
		</span>
	</div>

	<!-- Public Reflections Grid -->
	{#if publicReflections.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
			{#each publicReflections as reflection}
				<button
					onclick={() => openModal(reflection)}
					class="bg-white rounded-2xl p-5 text-left transition-all duration-200 hover:shadow-lg cursor-pointer group flex flex-col h-full"
				>
					<!-- Header: Student & Session -->
					<div class="flex items-center justify-between mb-4">
						<div class="flex items-center gap-3">
							<div
								class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold"
								style="background-color: var(--course-accent-dark, #334642);"
							>
								{reflection.studentInitials}
							</div>
							<div>
								<h3 class="font-semibold text-gray-900 text-sm">{reflection.studentName}</h3>
								<span class="text-xs text-gray-500">Session {reflection.sessionNumber}</span>
							</div>
						</div>
					</div>

					<!-- Question -->
					<div class="mb-3">
						<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
							<HelpCircle size="12" />
							Question
						</div>
						<p class="font-semibold text-gray-900 leading-snug line-clamp-2">
							{reflection.question}
						</p>
					</div>

					<!-- Divider -->
					<div class="border-t border-gray-100 my-3"></div>

					<!-- Response -->
					<div class="flex-1">
						<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
							<MessageSquare size="12" />
							Response
						</div>
						<p class="text-sm text-gray-600 leading-relaxed line-clamp-3">
							{reflection.reflectionExcerpt}
						</p>
					</div>

					<!-- Footer -->
					<div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
						<span class="text-xs text-gray-400">{reflection.submittedAt}</span>
						<span class="text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style="color: var(--course-accent-dark);">
							Read <ArrowRight size="14" />
						</span>
					</div>
				</button>
			{/each}
		</div>
	{:else}
		<!-- Empty state -->
		<div class="text-center py-16">
			<div class="mb-4">
				<Globe size="48" class="mx-auto opacity-50" style="color: #eae2d9;" />
			</div>
			<h3 class="text-xl font-semibold text-white mb-2">No public reflections yet</h3>
			<p class="text-white opacity-75 max-w-md mx-auto">
				When students choose to make their reflections public, they'll appear here for the whole community to read and be inspired by.
			</p>
		</div>
	{/if}
</div>

<!-- Read Modal -->
{#if showModal && selectedReflection}
	<div
		class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50"
		onmousedown={(e) => e.target === e.currentTarget && closeModal()}
		role="button"
		tabindex="0"
		onkeydown={(e) => e.key === 'Escape' && closeModal()}
		aria-label="Close modal"
	>
		<div
			class="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
			onclick={(e) => e.stopPropagation()}
			role="dialog"
			aria-modal="true"
		>
			<!-- Modal Header -->
			<div class="flex items-center justify-between px-4 sm:px-6 lg:px-8 py-4 sm:py-6 border-b border-gray-100">
				<div class="flex items-center gap-4">
					<div
						class="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
						style="background-color: var(--course-accent-dark, #334642);"
					>
						{selectedReflection.studentInitials}
					</div>
					<div>
						<h2 class="text-xl font-bold text-gray-900">{selectedReflection.studentName}</h2>
						<p class="text-sm text-gray-500">Session {selectedReflection.sessionNumber} • {selectedReflection.submittedAt}</p>
					</div>
				</div>
				<button
					onclick={closeModal}
					class="p-2 rounded-lg hover:bg-gray-100 transition-colors"
				>
					<X size="20" class="text-gray-400" />
				</button>
			</div>

			<!-- Modal Body -->
			<div class="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
				<!-- Question -->
				<div>
					<div class="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
						<HelpCircle size="16" />
						Question
					</div>
					<p class="text-xl font-semibold text-gray-900 leading-relaxed">
						{selectedReflection.question}
					</p>
				</div>

				<div class="border-t border-gray-100"></div>

				<!-- Response -->
				<div>
					<div class="flex items-center gap-2 text-sm font-medium text-gray-400 mb-2">
						<MessageSquare size="16" />
						Response
					</div>
					<div class="prose prose-lg max-w-none text-gray-700 leading-relaxed">
						{@html selectedReflection.response}
					</div>
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="flex items-center justify-end px-4 sm:px-6 lg:px-8 py-4 sm:py-5 border-t border-gray-100">
				<button
					onclick={closeModal}
					class="px-5 py-2.5 font-semibold rounded-lg transition-colors hover:opacity-90 text-white"
					style="background-color: var(--course-accent-dark, #334642);"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.line-clamp-2 {
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}
	.line-clamp-3 {
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
	}
</style>
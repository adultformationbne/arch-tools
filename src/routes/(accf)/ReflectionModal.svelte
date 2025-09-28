<script>
	import { X, Download, Share, ChevronLeft, ChevronRight, Star, User } from 'lucide-svelte';

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
		onNavigate(reflection.week, direction);
	};

	const getGradeColor = (grade) => {
		if (!grade) return '';
		if (grade.startsWith('A')) return 'text-green-700 bg-green-100 border-green-200';
		if (grade.startsWith('B')) return 'text-blue-700 bg-blue-100 border-blue-200';
		if (grade.startsWith('C')) return 'text-orange-700 bg-orange-100 border-orange-200';
		return 'text-gray-700 bg-gray-100 border-gray-200';
	};

	const formatDate = (dateStr) => {
		// In real app, this would format actual dates
		return dateStr;
	};
</script>

{#if isVisible && reflection}
	<!-- Modal Backdrop -->
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50" on:click={handleClose}>
		<!-- Modal Content -->
		<div
			class="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
			on:click|stopPropagation
		>
			<!-- Modal Header -->
			<div class="flex items-center justify-between p-8 border-b border-gray-200 bg-gray-50">
				<div class="flex items-center gap-4">
					<div class="w-12 h-12 rounded-full flex items-center justify-center font-bold text-xl text-white" style="background-color: #c59a6b;">
						{reflection.week}
					</div>
					<div>
						<h2 class="text-2xl font-bold text-gray-800">Week {reflection.week}: {reflection.title}</h2>
						<p class="text-gray-600">Submitted {reflection.submittedDate}</p>
					</div>
				</div>

				<!-- Navigation and Close -->
				<div class="flex items-center gap-2">
					<button
						on:click={() => handleNavigate('prev')}
						class="p-2 rounded-xl hover:bg-gray-100 transition-colors"
						title="Previous Week"
					>
						<ChevronLeft size="20" class="text-gray-600" />
					</button>
					<button
						on:click={() => handleNavigate('next')}
						class="p-2 rounded-xl hover:bg-gray-100 transition-colors"
						title="Next Week"
					>
						<ChevronRight size="20" class="text-gray-600" />
					</button>
					<button
						on:click={handleClose}
						class="p-2 rounded-xl hover:bg-gray-100 transition-colors ml-2"
					>
						<X size="20" class="text-gray-600" />
					</button>
				</div>
			</div>

			<!-- Modal Body -->
			<div class="flex-1 overflow-y-auto p-8 space-y-8">
				<!-- Question -->
				<div>
					<h3 class="text-lg font-semibold text-gray-800 mb-3">Reflection Question</h3>
					<div class="bg-gray-50 rounded-2xl p-6">
						<p class="text-gray-700 text-lg leading-relaxed italic">"{reflection.question}"</p>
					</div>
				</div>

				<!-- Student Response -->
				<div>
					<h3 class="text-lg font-semibold text-gray-800 mb-3">Your Response</h3>
					<div class="bg-blue-50 rounded-2xl p-6 border border-blue-100">
						<div class="prose prose-lg max-w-none">
							<p class="text-gray-800 leading-relaxed whitespace-pre-line">{reflection.response}</p>
						</div>
					</div>
				</div>

				<!-- Instructor Feedback -->
				{#if reflection.feedback}
					<div>
						<div class="flex items-center gap-3 mb-4">
							<Star size="20" style="color: #c59a6b;" />
							<h3 class="text-lg font-semibold text-gray-800">Instructor Feedback</h3>
							{#if reflection.grade}
								<div class="px-4 py-2 rounded-xl font-bold border {getGradeColor(reflection.grade)}">
									Grade: {reflection.grade}
								</div>
							{/if}
						</div>

						<div class="bg-gradient-to-r from-green-50 to-green-100 rounded-2xl p-6 border border-green-200 shadow-sm">
							<div class="flex items-start gap-4">
								<div class="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
									<User size="16" class="text-green-700" />
								</div>
								<div class="flex-1">
									<div class="prose prose-lg max-w-none">
										<p class="text-green-800 leading-relaxed mb-4">{reflection.feedback}</p>
									</div>
									{#if reflection.instructor}
										<div class="flex items-center justify-between">
											<p class="text-sm font-medium text-green-700">— {reflection.instructor}</p>
											<p class="text-sm text-green-600">{formatDate(reflection.submittedDate)}</p>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>
				{:else if reflection.status === 'in_review'}
					<div>
						<h3 class="text-lg font-semibold text-gray-800 mb-3">Status</h3>
						<div class="bg-orange-50 rounded-2xl p-6 border border-orange-200">
							<div class="flex items-center gap-3">
								<div class="w-8 h-8 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></div>
								<div>
									<p class="text-orange-800 font-medium">Your reflection is currently being reviewed</p>
									<p class="text-orange-600 text-sm mt-1">Feedback will be available within 2-3 business days</p>
								</div>
							</div>
						</div>
					</div>
				{:else}
					<div>
						<h3 class="text-lg font-semibold text-gray-800 mb-3">Status</h3>
						<div class="bg-blue-50 rounded-2xl p-6 border border-blue-200">
							<p class="text-blue-800">Thank you for your submission! Your reflection will be reviewed shortly.</p>
						</div>
					</div>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="flex items-center justify-between p-8 bg-gray-50 border-t border-gray-200">
				<div class="flex items-center gap-4">
					<button class="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100">
						<Download size="16" />
						<span class="font-medium">Download PDF</span>
					</button>
					<button class="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100">
						<Share size="16" />
						<span class="font-medium">Share</span>
					</button>
				</div>

				<!-- Navigation Buttons -->
				<div class="flex items-center gap-2">
					<button
						on:click={() => handleNavigate('prev')}
						class="flex items-center gap-2 px-4 py-2 text-white font-semibold rounded-xl transition-colors hover:opacity-90"
						style="background-color: #334642;"
					>
						<ChevronLeft size="16" />
						Previous
					</button>
					<button
						on:click={() => handleNavigate('next')}
						class="flex items-center gap-2 px-4 py-2 text-white font-semibold rounded-xl transition-colors hover:opacity-90"
						style="background-color: #334642;"
					>
						Next
						<ChevronRight size="16" />
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
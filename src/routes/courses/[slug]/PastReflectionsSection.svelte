<script>
	import { ChevronRight, ArrowRight, HelpCircle, MessageSquare, Star } from 'lucide-svelte';
	import { isComplete, needsReview } from '$lib/utils/reflection-status';

	let {
		reflections = [],
		onReadReflection = () => {}
	} = $props();

	// Use real reflections data
	const reflectionsList = reflections || [];

	let visibleReflections = $state(reflectionsList.slice(0, 6)); // Show first 6
	let showAll = $state(false);

	// Strip HTML tags for plain text display (add space to preserve word boundaries)
	const stripHtml = (html) => {
		if (!html) return '';
		return html
			.replace(/<[^>]*>/g, ' ')  // Replace tags with space
			.replace(/\s+/g, ' ')       // Collapse multiple spaces
			.trim();
	};

	const truncateText = (text, maxLength = 120) => {
		// Strip HTML first, then truncate
		const plainText = stripHtml(text);
		if (!plainText || plainText.length <= maxLength) return plainText;
		return plainText.substring(0, maxLength) + '...';
	};

	const toggleShowAll = () => {
		showAll = !showAll;
		visibleReflections = showAll ? reflectionsList : reflectionsList.slice(0, 6);
	};

	const handleReadReflection = (reflection) => {
		onReadReflection(reflection);
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

<!-- Past Reflections Section -->
<div>
	<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6 sm:mb-8">
		<h2 class="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Past Reflections</h2>
		<span class="text-white/70 text-lg">
			{reflectionsList.length} reflection{reflectionsList.length !== 1 ? 's' : ''}
		</span>
	</div>

	<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mb-8">
		{#each visibleReflections as reflection}
			<button
				onclick={() => handleReadReflection(reflection)}
				class="rounded-2xl text-left transition-all duration-200 hover:shadow-lg cursor-pointer group bg-white p-5 flex flex-col h-full"
			>
				<!-- Session & Status -->
				<div class="flex items-center justify-between mb-4">
					<span class="text-sm font-medium text-gray-500">Session {reflection.session}</span>
					<span class="text-sm font-medium {getStatusColor(reflection.status)}">
						{getStatusLabel(reflection.status)}
					</span>
				</div>

				<!-- Question -->
				<div class="mb-3">
					<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
						<HelpCircle size="12" />
						Question
					</div>
					<p class="font-semibold text-gray-900 leading-snug">
						{truncateText(reflection.question, 80)}
					</p>
				</div>

				<!-- Divider -->
				<div class="border-t border-gray-100 my-3"></div>

				<!-- Response -->
				{#if reflection.response}
					<div class="flex-1">
						<div class="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
							<MessageSquare size="12" />
							Your Response
						</div>
						<p class="text-sm text-gray-600 leading-relaxed">
							{truncateText(reflection.response, 100)}
						</p>
					</div>
				{/if}

				<!-- Feedback Preview -->
				{#if reflection.feedback}
					<div class="mt-3 p-3 rounded-lg border-l-4" style="background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 20%, white); border-left-color: var(--course-accent-dark, #334642);">
						<div class="flex items-center gap-1.5 text-xs font-semibold mb-1" style="color: var(--course-accent-dark, #334642);">
							<Star size="12" />
							Feedback Received
						</div>
						<p class="text-xs text-gray-700 leading-relaxed line-clamp-2">
							{truncateText(reflection.feedback, 80)}
						</p>
					</div>
				{/if}

				<!-- CTA -->
				<div class="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
					<span class="text-xs text-gray-400">{reflection.submittedDate}</span>
					<span class="text-sm font-medium flex items-center gap-1 group-hover:gap-2 transition-all" style="color: var(--course-accent-dark);">
						View <ArrowRight size="14" />
					</span>
				</div>
			</button>
		{/each}
	</div>

	<!-- Show More/Less Toggle -->
	{#if reflectionsList.length > 6}
		<div class="text-center">
			<button
				onclick={toggleShowAll}
				class="flex items-center gap-2 mx-auto px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl transition-colors"
			>
				{#if showAll}
					Show Less
				{:else}
					Show All {reflectionsList.length} Reflections
				{/if}
				<ChevronRight size="16" class={`transform transition-transform ${showAll ? 'rotate-90' : ''}`} />
			</button>
		</div>
	{/if}
</div>
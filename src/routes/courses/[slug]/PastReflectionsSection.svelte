<script>
	import { Eye, ChevronRight, Star, Edit2, Circle } from 'lucide-svelte';
	import { isComplete } from '$lib/utils/reflection-status';
	import ReflectionStatusBadge from '$lib/components/ReflectionStatusBadge.svelte';

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
</script>

<!-- Past Reflections Section -->
<div>
	<div class="flex items-center justify-between mb-8">
		<h2 class="text-4xl font-bold text-white">Past Reflections</h2>
		<div class="flex items-center gap-4 text-white text-lg">
			<div class="flex items-center gap-2">
				<div class="w-3 h-3 rounded-full bg-green-400"></div>
				<span class="opacity-75">
					{reflectionsList.length} reflection{reflectionsList.length !== 1 ? 's' : ''} ·
					{reflectionsList.filter(r => isComplete(r.status)).length} with feedback
				</span>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-3 gap-6 mb-8">
		{#each visibleReflections as reflection}
			<button
				onclick={() => handleReadReflection(reflection)}
				class="rounded-2xl text-left transition-all duration-200 hover:shadow-lg cursor-pointer group border border-gray-200/50 hover:border-gray-300 overflow-hidden"
				style="background-color: #eae2d9;"
			>
				<!-- Card Header -->
				<div class="flex items-center justify-between px-5 py-4 border-b border-gray-300/30">
					<div class="flex items-center gap-3">
						<div class="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm" style="background-color: #334642;">
							{reflection.session}
						</div>
						<span class="font-semibold text-gray-800">Session {reflection.session}</span>
					</div>
					<!-- Status Badge -->
					<ReflectionStatusBadge status={reflection.status} />
				</div>

				<!-- Card Body -->
				<div class="px-5 py-4 space-y-3">
					<!-- Feedback Section (if exists) -->
					{#if reflection.feedback}
						<div class="bg-green-50/50 rounded-lg p-3 border-l-2 border-green-500">
							<div class="flex items-center gap-1.5 text-xs text-green-700 font-medium mb-1">
								<Star size="12" />
								Feedback
							</div>
							<div class="text-sm text-gray-800 leading-relaxed">
								"{truncateText(reflection.feedback, 100)}"
							</div>
							{#if reflection.instructor}
								<div class="text-xs text-gray-500 mt-1.5">— {reflection.instructor}</div>
							{/if}
						</div>
					{/if}

					<!-- Your Response -->
					{#if reflection.response}
						<div>
							<div class="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-1">
								<Edit2 size="11" />
								Your response
							</div>
							<div class="text-sm text-gray-700 leading-relaxed">
								{truncateText(reflection.response, reflection.feedback ? 60 : 120)}
							</div>
						</div>
					{/if}

					<!-- Question Preview -->
					<div class="pt-2 border-t border-gray-300/30">
						<div class="flex items-start gap-1.5">
							<Circle size="10" class="text-gray-400 mt-0.5 flex-shrink-0" />
							<span class="text-xs text-gray-500 italic leading-relaxed">
								{truncateText(reflection.question, 60)}
							</span>
						</div>
					</div>
				</div>

				<!-- Card Footer -->
				<div class="px-5 py-3 bg-gray-100/30 border-t border-gray-300/30 flex items-center justify-between">
					<span class="text-xs text-gray-500">{reflection.submittedDate}</span>
					<span class="text-xs text-gray-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
						View full <Eye size="12" />
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
				class="flex items-center gap-2 mx-auto px-6 py-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold rounded-xl transition-colors"
			>
				{#if showAll}
					Show Less
				{:else}
					Show All {reflectionsList.length} Sessions
				{/if}
				<ChevronRight size="16" class={`transform transition-transform ${showAll ? 'rotate-90' : ''}`} />
			</button>
		</div>
	{/if}
</div>
<script>
	import { Eye, Clock, CheckCircle, AlertCircle, ChevronRight, Star } from 'lucide-svelte';

	let {
		reflections = [],
		onReadReflection = () => {}
	} = $props();

	// Use real reflections data
	const reflectionsList = reflections || [];

	let visibleReflections = $state(reflectionsList.slice(0, 6)); // Show first 6
	let showAll = $state(false);

	const getStatusIcon = (status) => {
		switch (status) {
			case 'submitted': return Clock;
			case 'passed': return CheckCircle;
			case 'graded': return CheckCircle; // Legacy support
			case 'draft': return AlertCircle;
			case 'needs_revision': return AlertCircle;
			case 'resubmitted': return Clock;
			default: return AlertCircle;
		}
	};

	const getStatusColor = (status) => {
		switch (status) {
			case 'submitted': return 'text-blue-600 bg-blue-100';
			case 'passed': return 'text-green-700 bg-green-50';
			case 'graded': return 'text-green-700 bg-green-50'; // Legacy support
			case 'draft': return 'text-gray-600 bg-gray-100';
			case 'needs_revision': return 'text-amber-700 bg-amber-50';
			case 'resubmitted': return 'text-blue-600 bg-blue-100';
			default: return 'text-gray-600 bg-gray-50';
		}
	};

	const getStatusText = (status) => {
		switch (status) {
			case 'submitted': return 'Submitted';
			case 'passed': return 'Feedback received';
			case 'graded': return 'Feedback received'; // Legacy support
			case 'draft': return 'Draft';
			case 'needs_revision': return 'Needs revision';
			case 'resubmitted': return 'Resubmitted';
			default: return 'Pending';
		}
	};

	const truncateText = (text, maxLength = 120) => {
		if (!text || text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
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
					{reflectionsList.filter(r => r.status === 'graded' || r.status === 'passed').length} with feedback
				</span>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-3 gap-6 mb-8">
		{#each visibleReflections as reflection}
			<button
				onclick={() => handleReadReflection(reflection)}
				class="rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-lg cursor-pointer group border border-transparent hover:border-gray-200"
				style="background-color: #eae2d9;"
			>
				<!-- Card Header - Simple -->
				<div class="flex items-start justify-between mb-4">
					<div class="flex items-center gap-3">
						<div class="text-2xl font-bold text-gray-800">Session {reflection.session}</div>
					</div>
					<!-- Simple Status -->
					<div class="text-xs {getStatusColor(reflection.status).split(' ')[0]}">
						{getStatusText(reflection.status)}
					</div>
				</div>

				<!-- Feedback First (if exists) - HIGHEST PRIORITY -->
				{#if reflection.feedback}
					<div class="mb-4">
						<div class="text-xs text-gray-500 mb-1">Feedback</div>
						<div class="font-semibold text-gray-900 leading-relaxed">
							"{truncateText(reflection.feedback, 120)}"
						</div>
						{#if reflection.instructor}
							<div class="text-xs text-gray-500 mt-1">— {reflection.instructor}</div>
						{/if}
					</div>
				{/if}

				<!-- Student Response - SECOND PRIORITY -->
				{#if reflection.response}
					<div class="mb-3">
						<div class="text-xs text-gray-500 mb-1">Your response</div>
						<div class="text-sm text-gray-700 leading-relaxed">
							{truncateText(reflection.response, reflection.feedback ? 80 : 150)}
						</div>
					</div>
				{/if}

				<!-- Question - LOWEST PRIORITY (smallest) -->
				<div class="mb-3">
					<div class="text-xs text-gray-400 italic">
						{truncateText(reflection.question, 50)}
					</div>
				</div>

				<!-- Status Messages for pending states -->
				{#if !reflection.feedback}
					{#if reflection.status === 'needs_revision'}
						<div class="mt-3 pt-3 border-t border-gray-200">
							<div class="flex items-center gap-2 text-amber-600">
								<AlertCircle size="14" />
								<span class="text-xs">Needs revision</span>
							</div>
						</div>
					{:else if reflection.status === 'submitted'}
						<div class="mt-3 pt-3 border-t border-gray-200">
							<div class="flex items-center gap-2 text-blue-600">
								<Clock size="14" />
								<span class="text-xs">Submitted {reflection.submittedDate}</span>
							</div>
						</div>
					{:else if reflection.status === 'draft'}
						<div class="mt-3 pt-3 border-t border-gray-200">
							<div class="flex items-center gap-2 text-gray-500">
								<AlertCircle size="14" />
								<span class="text-xs">Draft saved</span>
							</div>
						</div>
					{/if}
				{/if}

				<!-- Subtle hover indicator -->
				<div class="mt-4 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
					<span class="text-xs text-gray-500 flex items-center gap-1">
						Click to read full
						<Eye size="12" />
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
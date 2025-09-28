<script>
	import { Eye, Clock, CheckCircle, AlertCircle, ChevronRight, Star } from 'lucide-svelte';

	let {
		reflections = [],
		onReadReflection = () => {}
	} = $props();

	// Mock data for past reflections
	const mockReflections = [
		{
			week: 7,
			title: 'Faith in Action',
			question: 'How do you live out your faith daily?',
			status: 'submitted',
			submittedDate: '2 days ago',
			response: 'I try to live my faith through small acts of kindness and service. Every morning I pray for guidance and throughout the day I look for opportunities to help others...',
			feedback: null,
			grade: null
		},
		{
			week: 6,
			title: 'Trinity & Prayer',
			question: 'Explain the Trinity in your own words',
			status: 'graded',
			submittedDate: '1 week ago',
			response: 'The Trinity represents God as three persons - Father, Son, and Holy Spirit. While I don\'t fully understand this mystery, I experience each person differently in my prayer...',
			feedback: 'Excellent reflection! Your personal connection to each person of the Trinity shows deep spiritual growth. I particularly appreciated how you connected this doctrine to your prayer life.',
			grade: 'A',
			instructor: 'Fr. Michael'
		},
		{
			week: 5,
			title: 'Community & Service',
			question: 'How has community shaped your faith?',
			status: 'in_review',
			submittedDate: '3 days ago',
			response: 'Being part of my parish community has transformed how I understand faith. It\'s no longer just a personal relationship with God, but a shared journey...',
			feedback: null,
			grade: null
		},
		{
			week: 4,
			title: 'Scripture & Tradition',
			question: 'What role does tradition play in your faith?',
			status: 'graded',
			submittedDate: '2 weeks ago',
			response: 'Tradition provides the foundation that connects me to centuries of faithful Christians. It\'s like a river that carries the wisdom of those who came before...',
			feedback: 'Good insights into the importance of tradition. Your river metaphor is particularly effective. Consider expanding on how tradition and personal experience work together.',
			grade: 'B+',
			instructor: 'Fr. Michael'
		},
		{
			week: 3,
			title: 'Prayer Life',
			question: 'Describe your personal prayer journey',
			status: 'graded',
			submittedDate: '3 weeks ago',
			response: 'My prayer life has evolved from reciting memorized prayers to having genuine conversations with God...',
			feedback: 'Wonderful growth! Your honesty about struggles and breakthroughs in prayer is refreshing.',
			grade: 'A-',
			instructor: 'Fr. Michael'
		},
		{
			week: 2,
			title: 'God\'s Love',
			question: 'How have you experienced God\'s love?',
			status: 'graded',
			submittedDate: '1 month ago',
			response: 'I\'ve experienced God\'s love most clearly through the kindness of others, especially during difficult times...',
			feedback: 'Beautiful examples of recognizing God\'s love in daily life. Your gratitude shines through.',
			grade: 'A',
			instructor: 'Fr. Michael'
		}
	];

	let visibleReflections = $state(mockReflections.slice(0, 6)); // Show first 6
	let showAll = $state(false);

	const getStatusIcon = (status) => {
		switch (status) {
			case 'submitted': return AlertCircle;
			case 'graded': return CheckCircle;
			case 'in_review': return Clock;
			default: return AlertCircle;
		}
	};

	const getStatusColor = (status) => {
		switch (status) {
			case 'submitted': return 'text-gray-600 bg-gray-100';
			case 'graded': return 'text-green-700 bg-green-50';
			case 'in_review': return 'text-amber-700 bg-amber-50';
			default: return 'text-gray-600 bg-gray-50';
		}
	};

	const getStatusText = (status) => {
		switch (status) {
			case 'submitted': return 'Submitted';
			case 'graded': return 'Feedback received';
			case 'in_review': return 'Under review';
			default: return 'Pending';
		}
	};

	const truncateText = (text, maxLength = 120) => {
		if (!text || text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	};

	const toggleShowAll = () => {
		showAll = !showAll;
		visibleReflections = showAll ? mockReflections : mockReflections.slice(0, 6);
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
				<span class="opacity-75">Progress: {mockReflections.filter(r => r.status === 'graded').length}/7 completed</span>
			</div>
		</div>
	</div>

	<div class="grid grid-cols-3 gap-6 mb-8">
		{#each visibleReflections as reflection}
			<button
				on:click={() => handleReadReflection(reflection)}
				class="rounded-2xl p-6 text-left transition-all duration-200 hover:shadow-lg cursor-pointer group border border-transparent hover:border-gray-200"
				style="background-color: #eae2d9;"
			>
				<!-- Card Header - Simple -->
				<div class="flex items-start justify-between mb-4">
					<div class="flex items-center gap-3">
						<div class="text-2xl font-bold text-gray-800">Week {reflection.week}</div>
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
					{#if reflection.status === 'in_review'}
						<div class="mt-3 pt-3 border-t border-gray-200">
							<div class="flex items-center gap-2 text-amber-600">
								<Clock size="14" />
								<span class="text-xs">Awaiting feedback</span>
							</div>
						</div>
					{:else if reflection.status === 'submitted'}
						<div class="mt-3 pt-3 border-t border-gray-200">
							<div class="flex items-center gap-2 text-gray-500">
								<CheckCircle size="14" />
								<span class="text-xs">Submitted {reflection.submittedDate}</span>
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
	{#if mockReflections.length > 6}
		<div class="text-center">
			<button
				on:click={toggleShowAll}
				class="flex items-center gap-2 mx-auto px-6 py-3 bg-white bg-opacity-20 hover:bg-opacity-30 text-white font-semibold rounded-xl transition-colors"
			>
				{#if showAll}
					Show Less
				{:else}
					Show All {mockReflections.length} Weeks
				{/if}
				<ChevronRight size="16" class={`transform transition-transform ${showAll ? 'rotate-90' : ''}`} />
			</button>
		</div>
	{/if}
</div>
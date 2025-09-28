<script>
	import { ChevronDown, ChevronUp, Edit3, Calendar, Users, MessageSquare, CheckCircle, Clock, AlertCircle } from 'lucide-svelte';
	import AccfHeader from '../AccfHeader.svelte';
	import ReflectionWriter from '../ReflectionWriter.svelte';

	// For now using mock data - will replace with real data loading later
	// export let data;

	// Page state
	let activeTab = $state('my-reflections'); // 'my-reflections' | 'my-cohort'
	let showReflectionWriter = $state(false);
	let expandedReflections = $state(new Set()); // Track which reflections are expanded

	// Mock current reflection question (if one is due)
	const currentReflectionQuestion = $state({
		weekNumber: 8,
		question: "What is the reason you look to God for answers over cultural sources and making prayer central to your life?",
		dueDate: "March 25, 2024",
		isOverdue: false,
		hasSubmitted: false
	});

	// Mock user's reflections (chronological, newest first)
	const myReflections = [
		{
			id: 8,
			weekNumber: 8,
			question: "What is the reason you look to God for answers over cultural sources and making prayer central to your life?",
			myResponse: "",
			submittedAt: null,
			status: 'not_started',
			feedback: null,
			grade: null,
			markedAt: null,
			markedBy: null
		},
		{
			id: 7,
			weekNumber: 7,
			question: "How do you see God working in your daily life through small moments and ordinary experiences?",
			myResponse: "This week I've been paying closer attention to the small moments where I feel God's presence. Yesterday, while stuck in traffic, instead of getting frustrated, I found myself praying for the people around me. It was such a simple shift, but it felt profound. I realized that every mundane moment can become sacred when we invite God into it. The way sunlight filtered through my kitchen window this morning during my coffee felt like a gentle reminder that God is in the ordinary. I'm learning that divine encounters don't always come with thunder and lightning - sometimes they come in the quiet whisper of everyday grace.",
			submittedAt: "March 18, 2024",
			status: 'marked',
			feedback: "Beautiful reflection, Sarah! Your observation about finding the sacred in ordinary moments shows real spiritual maturity. The traffic example is particularly powerful - transforming frustration into prayer is exactly what contemplative living looks like. I encourage you to continue this practice of 'mindful presence' throughout your day. Consider keeping a small journal of these moments. How might you help others in your hub recognize these divine encounters in their own lives?",
			grade: true, // pass
			markedAt: "March 20, 2024",
			markedBy: "Fr. Michael Torres"
		},
		{
			id: 6,
			weekNumber: 6,
			question: "How has your understanding of the Eucharist deepened through this week's materials?",
			myResponse: "The concept of 'becoming what we receive' completely transformed how I understand communion. I used to think of the Eucharist as something I do for God, but now I see it as God doing something in me. When we receive the Body of Christ, we don't just take Christ into ourselves - we become part of the mystical body. This means every time I leave Mass, I'm called to be Christ in the world. It's both humbling and terrifying. The readings about the early Christian communities sharing everything in common makes so much more sense now. If we're truly one body, then caring for each other isn't charity - it's necessity.",
			submittedAt: "March 11, 2024",
			status: 'marked',
			feedback: "Excellent insight about becoming what we receive! You've grasped one of the most profound mysteries of our faith. Your connection to the early Christian community is spot-on. This understanding should indeed transform how we live outside of Mass. For your continued growth, I'd suggest reading St. Augustine's famous words: 'Receive what you are, become what you receive.' How might this understanding change your approach to serving others in your community?",
			grade: true,
			markedAt: "March 13, 2024",
			markedBy: "Fr. Michael Torres"
		},
		{
			id: 5,
			weekNumber: 5,
			question: "Reflect on a time when you experienced God's mercy in your life.",
			myResponse: "",
			submittedAt: null,
			status: 'overdue',
			feedback: null,
			grade: null,
			markedAt: null,
			markedBy: null,
			dueDate: "March 4, 2024"
		}
	];

	// Mock cohort reflections (from other students, newest first)
	const cohortReflections = [
		{
			id: 1,
			studentName: "Michael Chen",
			studentInitials: "MC",
			weekNumber: 8,
			question: "What is the reason you look to God for answers over cultural sources and making prayer central to your life?",
			response: "Growing up in a culture that prioritizes self-reliance and material success, turning to God for guidance felt almost counter-cultural. But this week's readings on the Tower of Babel really hit home. When we try to build our own towers to heaven - through wealth, achievement, or status - we end up more confused and divided than ever. I've experienced this firsthand in my career. The more I climbed the corporate ladder, the more empty I felt.\n\nPrayer has become my anchor in a world that constantly shifts its definitions of success and happiness. When cultural voices tell me I need more, prayer reminds me of what I already have. When society says I need to be self-made, prayer connects me to the ultimate source of all good things. It's not that I ignore practical wisdom or human knowledge, but I've learned to filter everything through the lens of faith first.\n\nCentral prayer isn't escapism - it's the most realistic thing I do each day. It's acknowledging that I'm not the center of the universe, but I'm loved by the One who is.",
			submittedAt: "March 22, 2024",
			status: 'submitted',
			isPublic: true
		},
		{
			id: 2,
			studentName: "Jennifer Davis",
			studentInitials: "JD",
			weekNumber: 7,
			question: "How do you see God working in your daily life through small moments and ordinary experiences?",
			response: "God speaks to me most clearly through my children. Last week, my 4-year-old son asked me why flowers grow. As I tried to explain photosynthesis in terms he could understand, I suddenly heard myself describing a miracle. Sunlight and water and tiny seeds becoming something beautiful - how is that not magic? How is that not God?\n\nI've started seeing my role as a mother as a form of contemplative practice. Wiping tears, packing lunches, reading bedtime stories - these aren't interruptions to my spiritual life, they ARE my spiritual life. Every act of care is an act of love, and every act of love participates in God's love.\n\nThe monotony that used to frustrate me - the endless cycle of meals and laundry and baths - has become a rhythm of grace. I'm learning that holiness isn't found in grand gestures but in showing up faithfully to the small, repetitive acts of love that nobody notices except God.",
			submittedAt: "March 19, 2024",
			status: 'submitted',
			isPublic: true
		},
		{
			id: 3,
			studentName: "Robert Wilson",
			studentInitials: "RW",
			weekNumber: 6,
			question: "How has your understanding of the Eucharist deepened through this week's materials?",
			response: "I'll be honest - I used to go to communion out of habit more than anything else. Growing up Catholic, it was just something you did during Mass. But this week's study on the Last Supper completely changed my perspective.\n\nJesus chose bread and wine - the most ordinary things - to become the most extraordinary gift. He didn't choose gold or precious stones. He chose the stuff of daily life, the food that sustains us. This tells me that God wants to transform the ordinary, not replace it.\n\nNow when I approach the altar, I think about all the ordinary bread I've eaten in my life, all the meals shared with family and friends. The Eucharist doesn't take me out of these human experiences - it sanctifies them. Every meal becomes a chance to remember God's provision. Every time I break bread with others, I'm participating in something sacred.\n\nThe phrase 'food for the journey' makes so much more sense now. We're not just receiving Jesus - we're receiving the strength to be Jesus for others in our daily lives.",
			submittedAt: "March 12, 2024",
			status: 'submitted',
			isPublic: true
		}
	];

	// Toggle functions
	const toggleReflectionExpansion = (reflectionId) => {
		if (expandedReflections.has(reflectionId)) {
			expandedReflections.delete(reflectionId);
		} else {
			expandedReflections.add(reflectionId);
		}
		expandedReflections = new Set(expandedReflections);
	};

	const openReflectionWriter = () => {
		showReflectionWriter = true;
	};

	const closeReflectionWriter = () => {
		showReflectionWriter = false;
	};

	const handleReflectionSubmit = () => {
		// Handle reflection submission
		console.log('Reflection submitted');
		closeReflectionWriter();
	};

	const formatDate = (dateString) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	};

	const truncateText = (text, maxLength = 200) => {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	};
</script>

<div class="min-h-screen" style="background-color: #334642;">
	<AccfHeader currentPage="reflections" userName="Sarah" />

	<div class="px-16 py-8">
		<div class="max-w-4xl mx-auto">

			<!-- Page Header -->
			<div class="mb-8">
				<h1 class="text-4xl font-bold text-white mb-2">Reflections</h1>
				<p class="text-white opacity-75">Your spiritual journey through weekly reflections</p>
			</div>

			<!-- Current Reflection Due (if applicable) -->
			{#if currentReflectionQuestion && !currentReflectionQuestion.hasSubmitted}
				<div class="bg-white rounded-2xl p-6 mb-8 border-l-4" style="border-color: #c59a6b;">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-2 mb-2">
								<Edit3 size="20" style="color: #c59a6b;" />
								<h3 class="text-xl font-bold text-gray-800">Week {currentReflectionQuestion.weekNumber} Reflection Due</h3>
								{#if currentReflectionQuestion.isOverdue}
									<span class="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
										Overdue
									</span>
								{/if}
							</div>
							<p class="text-gray-700 mb-4 text-lg leading-relaxed">
								{currentReflectionQuestion.question}
							</p>
							<p class="text-sm text-gray-600 mb-4">
								Due: {formatDate(currentReflectionQuestion.dueDate)}
							</p>
						</div>
						<button
							on:click={openReflectionWriter}
							class="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-colors hover:opacity-90"
							style="background-color: #334642;"
						>
							<Edit3 size="18" />
							Write Reflection
						</button>
					</div>
				</div>
			{/if}

			<!-- Tab Navigation -->
			<div class="flex gap-1 mb-8 p-1 rounded-2xl" style="background-color: rgba(234, 226, 217, 0.1);">
				<button
					on:click={() => activeTab = 'my-reflections'}
					class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors"
					class:bg-white={activeTab === 'my-reflections'}
					class:text-gray-800={activeTab === 'my-reflections'}
					class:text-white={activeTab !== 'my-reflections'}
					class:opacity-75={activeTab !== 'my-reflections'}
				>
					<Calendar size="18" />
					My Reflections
				</button>
				<button
					on:click={() => activeTab = 'my-cohort'}
					class="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-colors"
					class:bg-white={activeTab === 'my-cohort'}
					class:text-gray-800={activeTab === 'my-cohort'}
					class:text-white={activeTab !== 'my-cohort'}
					class:opacity-75={activeTab !== 'my-cohort'}
				>
					<Users size="18" />
					My Cohort
				</button>
			</div>

			<!-- Reflections Feed -->
			<div class="space-y-6">
				{#if activeTab === 'my-reflections'}
					<!-- My Reflections -->
					{#each myReflections as reflection}
						<div class="bg-white rounded-2xl p-6 shadow-sm">
							<!-- Reflection Header -->
							<div class="flex items-start justify-between mb-4">
								<div class="flex-1">
									<div class="flex items-center gap-3 mb-2">
										<h3 class="text-xl font-bold text-gray-800">Week {reflection.weekNumber}</h3>
										<div class="flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
											class:bg-green-100={reflection.status === 'marked' && reflection.grade}
											class:text-green-700={reflection.status === 'marked' && reflection.grade}
											class:bg-red-100={reflection.status === 'overdue'}
											class:text-red-700={reflection.status === 'overdue'}
											class:bg-blue-100={reflection.status === 'submitted'}
											class:text-blue-700={reflection.status === 'submitted'}
											class:bg-orange-100={reflection.status === 'not_started'}
											class:text-orange-700={reflection.status === 'not_started'}
										>
											{#if reflection.status === 'marked'}
												<CheckCircle size="14" />
												{reflection.grade ? 'Pass' : 'Needs Work'}
											{:else if reflection.status === 'submitted'}
												<Clock size="14" />
												Awaiting Feedback
											{:else if reflection.status === 'overdue'}
												<AlertCircle size="14" />
												Overdue
											{:else}
												<Edit3 size="14" />
												Not Started
											{/if}
										</div>
									</div>
									<p class="text-gray-700 font-medium mb-3">{reflection.question}</p>
								</div>
							</div>

							{#if reflection.status === 'not_started' || reflection.status === 'overdue'}
								<!-- Not started or overdue -->
								<div class="text-center py-8">
									<p class="text-gray-600 mb-4">
										{reflection.status === 'overdue' ? 'This reflection is overdue.' : 'You haven\'t written this reflection yet.'}
									</p>
									<button
										on:click={openReflectionWriter}
										class="flex items-center gap-2 px-6 py-3 rounded-2xl font-semibold text-white transition-colors hover:opacity-90 mx-auto"
										style="background-color: #334642;"
									>
										<Edit3 size="18" />
										{reflection.status === 'overdue' ? 'Submit Late Reflection' : 'Write Reflection'}
									</button>
								</div>
							{:else}
								<!-- Has content -->
								<div class="space-y-4">
									<!-- My Response -->
									<div>
										<h4 class="font-semibold text-gray-800 mb-2">Your Response</h4>
										<div class="bg-gray-50 rounded-xl p-4">
											{#if expandedReflections.has(reflection.id)}
												<p class="text-gray-700 leading-relaxed whitespace-pre-line">{reflection.myResponse}</p>
											{:else}
												<p class="text-gray-700 leading-relaxed">{truncateText(reflection.myResponse)}</p>
											{/if}
											{#if reflection.myResponse.length > 200}
												<button
													on:click={() => toggleReflectionExpansion(reflection.id)}
													class="flex items-center gap-1 mt-3 text-sm font-medium transition-colors"
													style="color: #c59a6b;"
												>
													{expandedReflections.has(reflection.id) ? 'Show Less' : 'Read More'}
													{#if expandedReflections.has(reflection.id)}
														<ChevronUp size="14" />
													{:else}
														<ChevronDown size="14" />
													{/if}
												</button>
											{/if}
										</div>
									</div>

									<!-- Feedback (if available) -->
									{#if reflection.feedback}
										<div>
											<div class="flex items-center justify-between mb-2">
												<h4 class="font-semibold text-gray-800">Feedback</h4>
												<div class="text-sm text-gray-600">
													{reflection.markedBy} • {formatDate(reflection.markedAt)}
												</div>
											</div>
											<div class="rounded-xl p-4" style="background-color: #f9f6f2;">
												<p class="text-gray-700 leading-relaxed">{reflection.feedback}</p>
											</div>
										</div>
									{/if}

									<!-- Submission Info -->
									{#if reflection.submittedAt}
										<div class="text-sm text-gray-600 pt-2 border-t border-gray-200">
											Submitted on {formatDate(reflection.submittedAt)}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}

				{:else}
					<!-- My Cohort Reflections -->
					{#each cohortReflections as reflection}
						<div class="bg-white rounded-2xl p-6 shadow-sm">
							<!-- Student Header -->
							<div class="flex items-center gap-3 mb-4">
								<div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold" style="background-color: #334642;">
									{reflection.studentInitials}
								</div>
								<div class="flex-1">
									<h3 class="font-semibold text-gray-800">{reflection.studentName}</h3>
									<p class="text-sm text-gray-600">Week {reflection.weekNumber} • {formatDate(reflection.submittedAt)}</p>
								</div>
								<div class="flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
									<MessageSquare size="14" />
									Public
								</div>
							</div>

							<!-- Question -->
							<p class="text-gray-700 font-medium mb-4">{reflection.question}</p>

							<!-- Response (always full for cohort) -->
							<div class="bg-gray-50 rounded-xl p-4">
								<p class="text-gray-700 leading-relaxed whitespace-pre-line">{reflection.response}</p>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>

	<!-- Reflection Writer Component -->
	{#if showReflectionWriter}
		<div class="px-16 pb-8">
			<ReflectionWriter
				bind:isVisible={showReflectionWriter}
				question={currentReflectionQuestion?.question || ''}
				onClose={closeReflectionWriter}
			/>
		</div>
	{/if}
</div>
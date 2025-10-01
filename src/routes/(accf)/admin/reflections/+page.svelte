<script>
	import { MessageSquare, CheckCircle, XCircle, Clock, User, Calendar, Filter, Search, Star } from 'lucide-svelte';

	let selectedFilter = $state('pending');
	let selectedCohort = $state('all');
	let searchQuery = $state('');
	let selectedReflection = $state(null);
	let showMarkingModal = $state(false);

	// Mock reflection data
	let reflections = $state([
		{
			id: 1,
			student: { name: 'Sarah Johnson', email: 'sarah.j@email.com', hub: 'St. Mary\'s Parish' },
			cohort: 'February 2025 - Foundations of Faith',
			session: 3,
			question: 'What does faith mean to you personally, and how has your understanding evolved throughout your life?',
			content: 'Faith, to me, has been a journey of discovery that began in childhood but has deepened significantly through my adult experiences. Initially, faith was something I inherited from my family - attending Sunday Mass, saying prayers before meals, and learning Bible stories. However, as I\'ve navigated life\'s challenges, particularly during difficult times like the loss of my father last year, my understanding has evolved from a passive acceptance to an active, living relationship with God.\n\nWhat strikes me most about faith is how it provides both comfort and challenge. It comforts me in knowing that I\'m not alone in my struggles, but it also challenges me to live differently - to be more forgiving, more generous, and more hopeful than I might naturally be. I\'ve come to understand that faith isn\'t about having all the answers, but about trusting in God\'s love even when questions remain.\n\nThrough this course, I\'m beginning to see how the Church\'s teachings connect to these personal experiences, providing a framework that both validates my journey and guides my continued growth.',
			isPublic: true,
			submittedAt: '2025-01-15T14:30:00Z',
			status: 'pending',
			assignedTo: 'admin1',
			feedback: '',
			passStatus: null
		},
		{
			id: 2,
			student: { name: 'Michael Chen', email: 'mchen@email.com', hub: 'Sacred Heart Parish' },
			cohort: 'February 2025 - Foundations of Faith',
			session: 3,
			question: 'What does faith mean to you personally, and how has your understanding evolved throughout your life?',
			content: 'My faith journey has been quite different from many of my peers, as I came to Catholicism as an adult convert. Growing up in a non-religious household, I initially approached faith with skepticism and many questions. It wasn\'t until college, when I began studying philosophy and encountered Catholic intellectual tradition through authors like Thomas Aquinas and C.S. Lewis, that I began to see faith not as blind belief, but as a reasonable response to ultimate questions.\n\nThe conversion process taught me that faith is both personal and communal. While my relationship with God is deeply personal, I\'ve discovered that faith flourishes in community. The Catholic Church provides not just individual spiritual nourishment, but a place where I can contribute to something larger than myself.',
			isPublic: false,
			submittedAt: '2025-01-14T09:15:00Z',
			status: 'marked',
			assignedTo: 'admin1',
			feedback: 'Excellent reflection, Michael. Your journey from skepticism to faith through intellectual inquiry is inspiring. You demonstrate a mature understanding of how personal faith intersects with community. Consider exploring how the sacraments might deepen your sense of belonging to the Church community.',
			passStatus: 'pass'
		},
		{
			id: 3,
			student: { name: 'Maria Rodriguez', email: 'maria.r@email.com', hub: 'St. Joseph\'s Parish' },
			cohort: 'August 2024 - Moral Teaching',
			session: 7,
			question: 'How can Catholic social teaching guide our response to current social issues?',
			content: 'Catholic social teaching offers a unique perspective on current social issues because it emphasizes the dignity of every human person as the foundation for social action. When I look at issues like poverty, immigration, and healthcare access, the principle of human dignity calls us to see beyond statistics to the real people affected.\n\nThe principle of solidarity particularly resonates with me. It\'s not enough to simply feel bad about injustice; we\'re called to act. This has motivated me to volunteer at our local food bank and advocate for better housing policies in our community.',
			isPublic: true,
			submittedAt: '2025-01-13T16:45:00Z',
			status: 'overdue',
			assignedTo: 'admin2',
			feedback: '',
			passStatus: null
		},
		{
			id: 4,
			student: { name: 'David Thompson', email: 'dthompson@email.com', hub: 'Holy Spirit Parish' },
			cohort: 'February 2025 - Scripture & Tradition',
			session: 4,
			question: 'How do Scripture and Tradition work together to inform our faith?',
			content: 'Scripture and Tradition work together like two sides of the same coin in informing our faith. Scripture provides us with the written Word of God, the foundational texts that reveal God\'s plan of salvation. However, Tradition helps us understand and interpret these texts correctly, ensuring that we don\'t fall into personal interpretations that might lead us astray.',
			isPublic: false,
			submittedAt: '2025-01-16T11:20:00Z',
			status: 'pending',
			assignedTo: 'admin1',
			feedback: '',
			passStatus: null
		}
	]);

	let cohorts = $state([
		'February 2025 - Foundations of Faith',
		'February 2025 - Scripture & Tradition',
		'August 2024 - Moral Teaching',
		'August 2024 - Sacraments & Liturgy'
	]);

	let markingForm = $state({
		feedback: '',
		passStatus: 'pass',
		isPublic: false
	});

	const filterOptions = [
		{ value: 'all', label: 'All Reflections', count: reflections.length },
		{ value: 'pending', label: 'Pending Review', count: reflections.filter(r => r.status === 'pending').length },
		{ value: 'overdue', label: 'Overdue', count: reflections.filter(r => r.status === 'overdue').length },
		{ value: 'marked', label: 'Recently Marked', count: reflections.filter(r => r.status === 'marked').length }
	];

	const getStatusColor = (status) => {
		switch (status) {
			case 'pending': return 'bg-orange-100 text-orange-800';
			case 'overdue': return 'bg-red-100 text-red-800';
			case 'marked': return 'bg-green-100 text-green-800';
			default: return 'bg-gray-100 text-gray-800';
		}
	};

	const getPassStatusIcon = (passStatus) => {
		if (passStatus === 'pass') return CheckCircle;
		if (passStatus === 'fail') return XCircle;
		return Clock;
	};

	const getPassStatusColor = (passStatus) => {
		if (passStatus === 'pass') return 'text-green-600';
		if (passStatus === 'fail') return 'text-red-600';
		return 'text-orange-600';
	};

	const filteredReflections = $derived(() => {
		let filtered = reflections;

		// Filter by status
		if (selectedFilter !== 'all') {
			filtered = filtered.filter(r => r.status === selectedFilter);
		}

		// Filter by cohort
		if (selectedCohort !== 'all') {
			filtered = filtered.filter(r => r.cohort === selectedCohort);
		}

		// Search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(r =>
				r.student.name.toLowerCase().includes(query) ||
				r.student.email.toLowerCase().includes(query) ||
				r.content.toLowerCase().includes(query)
			);
		}

		return filtered.sort((a, b) => {
			// Sort by status priority (overdue first, then pending, then marked)
			const statusOrder = { overdue: 0, pending: 1, marked: 2 };
			if (statusOrder[a.status] !== statusOrder[b.status]) {
				return statusOrder[a.status] - statusOrder[b.status];
			}
			// Then by submission date (newest first)
			return new Date(b.submittedAt) - new Date(a.submittedAt);
		});
	});

	const openMarkingModal = (reflection) => {
		selectedReflection = reflection;
		markingForm = {
			feedback: reflection.feedback || '',
			passStatus: reflection.passStatus || 'pass',
			isPublic: reflection.isPublic
		};
		showMarkingModal = true;
	};

	const closeMarkingModal = () => {
		showMarkingModal = false;
		selectedReflection = null;
		markingForm = { feedback: '', passStatus: 'pass', isPublic: false };
	};

	const submitMarking = () => {
		if (!selectedReflection) return;

		// Update the reflection
		const index = reflections.findIndex(r => r.id === selectedReflection.id);
		if (index !== -1) {
			reflections[index] = {
				...reflections[index],
				feedback: markingForm.feedback,
				passStatus: markingForm.passStatus,
				status: 'marked',
				markedAt: new Date().toISOString()
			};
		}

		closeMarkingModal();
	};

	const formatDate = (dateString) => {
		return new Date(dateString).toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const getWordCount = (text) => {
		return text.trim().split(/\s+/).length;
	};
</script>

<div class="px-16">
	<div class="py-12">
		<div class="max-w-7xl mx-auto">
			<!-- Header -->
			<div class="flex items-center justify-between mb-8">
				<div>
					<h1 class="text-5xl font-bold text-white mb-2">Reflection Review</h1>
					<p class="text-xl text-white/80">Mark and provide feedback on student reflections</p>
				</div>
				<div class="text-white/80">
					<span class="text-2xl font-bold">{filteredReflections.filter(r => r.status === 'pending' || r.status === 'overdue').length}</span>
					<span class="text-lg">pending review</span>
				</div>
			</div>

			<!-- Filters -->
			<div class="bg-white rounded-2xl p-6 shadow-sm mb-8">
				<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
					<!-- Status Filter -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3">Filter by Status</label>
						<div class="flex flex-wrap gap-2">
							{#each filterOptions as option}
								<button
									onclick={() => selectedFilter = option.value}
									class="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors"
									class:bg-blue-100={selectedFilter === option.value}
									class:text-blue-800={selectedFilter === option.value}
									class:bg-gray-100={selectedFilter !== option.value}
									class:text-gray-700={selectedFilter !== option.value}
								>
									{option.label}
									<span class="bg-white px-2 py-1 rounded text-xs">{option.count}</span>
								</button>
							{/each}
						</div>
					</div>

					<!-- Cohort Filter -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3">Filter by Cohort</label>
						<select
							bind:value={selectedCohort}
							class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
							style="focus:ring-color: #c59a6b;"
						>
							<option value="all">All Cohorts</option>
							{#each cohorts as cohort}
								<option value={cohort}>{cohort}</option>
							{/each}
						</select>
					</div>

					<!-- Search -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3">Search</label>
						<div class="relative">
							<Search size="20" class="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
							<input
								bind:value={searchQuery}
								type="text"
								placeholder="Search by student name or content..."
								class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
								style="focus:ring-color: #c59a6b;"
							/>
						</div>
					</div>
				</div>
			</div>

			<!-- Reflections List -->
			<div class="space-y-4">
				{#each filteredReflections as reflection}
					<div class="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
						<!-- Header -->
						<div class="flex items-start justify-between mb-4">
							<div class="flex items-center gap-4">
								<div class="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
									<User size="20" class="text-gray-600" />
								</div>
								<div>
									<h3 class="font-bold text-lg text-gray-800">{reflection.student.name}</h3>
									<p class="text-sm text-gray-600">{reflection.student.email} • {reflection.student.hub}</p>
									<p class="text-sm text-gray-500">{reflection.cohort} • Session {reflection.session}</p>
								</div>
							</div>
							<div class="flex items-center gap-3">
								<span class="px-3 py-1 rounded-full text-sm font-semibold {getStatusColor(reflection.status)}">
									{reflection.status}
								</span>
								{#if reflection.passStatus}
									<svelte:component
										this={getPassStatusIcon(reflection.passStatus)}
										size="20"
										class={getPassStatusColor(reflection.passStatus)}
									/>
								{/if}
								<div class="text-right text-sm text-gray-500">
									<div>{formatDate(reflection.submittedAt)}</div>
									<div>{getWordCount(reflection.content)} words</div>
								</div>
							</div>
						</div>

						<!-- Question -->
						<div class="mb-4 p-4 bg-gray-50 rounded-lg">
							<h4 class="font-semibold text-gray-800 mb-2">Reflection Question:</h4>
							<p class="text-gray-700 italic">"{reflection.question}"</p>
						</div>

						<!-- Content Preview -->
						<div class="mb-4">
							<p class="text-gray-800 leading-relaxed">
								{reflection.content.length > 300 ? reflection.content.substring(0, 300) + '...' : reflection.content}
							</p>
						</div>

						<!-- Visibility & Actions -->
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-4">
								<div class="flex items-center gap-2">
									{#if reflection.isPublic}
										<div class="w-2 h-2 bg-green-500 rounded-full"></div>
										<span class="text-sm text-green-700 font-semibold">Public</span>
									{:else}
										<div class="w-2 h-2 bg-gray-400 rounded-full"></div>
										<span class="text-sm text-gray-600">Private</span>
									{/if}
								</div>
								{#if reflection.feedback}
									<div class="text-sm text-blue-600 font-semibold">Feedback provided</div>
								{/if}
							</div>
							<div class="flex gap-3">
								<button
									class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
									style="background-color: #eae2d9; color: #334642;"
								>
									View Full
								</button>
								{#if reflection.status === 'pending' || reflection.status === 'overdue'}
									<button
										onclick={() => openMarkingModal(reflection)}
										class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
										style="background-color: #c59a6b; color: white;"
									>
										Mark Reflection
									</button>
								{:else}
									<button
										onclick={() => openMarkingModal(reflection)}
										class="px-4 py-2 text-sm font-semibold rounded-lg transition-colors"
										style="background-color: #334642; color: white;"
									>
										Edit Marking
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}

				{#if filteredReflections.length === 0}
					<div class="text-center py-12">
						<MessageSquare size="64" class="mx-auto mb-4 text-gray-400" />
						<h3 class="text-xl font-bold text-gray-600 mb-2">No reflections found</h3>
						<p class="text-gray-500">Try adjusting your filters or search criteria</p>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Marking Modal -->
{#if showMarkingModal && selectedReflection}
	<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
		<div class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
			<div class="p-8">
				<!-- Modal Header -->
				<div class="flex items-start justify-between mb-6">
					<div>
						<h2 class="text-2xl font-bold text-gray-800 mb-2">Mark Reflection</h2>
						<p class="text-gray-600">{selectedReflection.student.name} • Session {selectedReflection.session}</p>
					</div>
					<button
						onclick={closeMarkingModal}
						class="p-2 text-gray-500 hover:text-gray-700 rounded-full hover:bg-gray-100"
					>
						<X size="24" />
					</button>
				</div>

				<!-- Student Reflection -->
				<div class="mb-6">
					<h3 class="font-semibold text-gray-800 mb-3">Student Reflection:</h3>
					<div class="bg-gray-50 rounded-lg p-6">
						<p class="text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedReflection.content}</p>
						<div class="mt-4 text-sm text-gray-500">
							{getWordCount(selectedReflection.content)} words • Submitted {formatDate(selectedReflection.submittedAt)}
						</div>
					</div>
				</div>

				<!-- Marking Form -->
				<div class="space-y-6">
					<!-- Pass/Fail -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3">Assessment</label>
						<div class="flex gap-4">
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									bind:group={markingForm.passStatus}
									type="radio"
									value="pass"
									class="text-green-600 focus:ring-green-500"
								/>
								<CheckCircle size="20" class="text-green-600" />
								<span class="font-semibold text-green-800">Pass</span>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input
									bind:group={markingForm.passStatus}
									type="radio"
									value="fail"
									class="text-red-600 focus:ring-red-500"
								/>
								<XCircle size="20" class="text-red-600" />
								<span class="font-semibold text-red-800">Needs Revision</span>
							</label>
						</div>
					</div>

					<!-- Feedback -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-3">Feedback for Student</label>
						<textarea
							bind:value={markingForm.feedback}
							placeholder="Provide constructive feedback to help the student grow in their faith journey..."
							rows="6"
							class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none"
							style="focus:ring-color: #c59a6b;"
						></textarea>
						<p class="text-xs text-gray-500 mt-1">This feedback will be visible to the student</p>
					</div>

					<!-- Actions -->
					<div class="flex gap-4 pt-4">
						<button
							onclick={submitMarking}
							class="flex-1 py-3 px-6 font-semibold rounded-lg transition-colors"
							style="background-color: #c59a6b; color: white;"
						>
							Submit Marking
						</button>
						<button
							onclick={closeMarkingModal}
							class="flex-1 py-3 px-6 font-semibold rounded-lg transition-colors border border-gray-300 text-gray-700 hover:bg-gray-50"
						>
							Cancel
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
<script>
	import { X, Download, ChevronDown, ChevronRight, FileText, Play, Mic, Book } from 'lucide-svelte';

	let {
		material = null,
		isVisible = $bindable(false),
		currentWeek = 8,
		onClose = () => {}
	} = $props();

	let selectedDocument = $state(null);
	let expandedWeeks = $state(new Set([currentWeek]));

	const handleClose = () => {
		isVisible = false;
		onClose();
	};

	const toggleWeek = (weekNum) => {
		if (expandedWeeks.has(weekNum)) {
			expandedWeeks.delete(weekNum);
		} else {
			expandedWeeks.add(weekNum);
		}
		expandedWeeks = new Set(expandedWeeks);
	};

	const selectDocument = (doc) => {
		selectedDocument = doc;
	};

	// Mock document tree for all weeks
	const documentTree = {
		1: [
			{ id: 'w1_intro', title: 'Introduction to Faith', type: 'document', icon: FileText },
			{ id: 'w1_livestream', title: 'Welcome Livestream', type: 'livestream', icon: Play },
			{ id: 'w1_catechism', title: 'Catechism Chapter 1', type: 'document', icon: FileText }
		],
		2: [
			{ id: 'w2_scripture', title: 'Scripture Basics', type: 'document', icon: FileText },
			{ id: 'w2_podcast', title: 'Understanding God', type: 'podcast', icon: Mic },
			{ id: 'w2_summary', title: 'Week 2 Summary', type: 'document', icon: FileText }
		],
		3: [
			{ id: 'w3_prayer', title: 'The Power of Prayer', type: 'document', icon: FileText },
			{ id: 'w3_livestream', title: 'Prayer Workshop', type: 'livestream', icon: Play },
			{ id: 'w3_reading', title: 'Sacred Fire Ch. 1', type: 'book', icon: Book }
		],
		4: [
			{ id: 'w4_sacraments', title: 'Introduction to Sacraments', type: 'document', icon: FileText },
			{ id: 'w4_catechism', title: 'Catechism Chapter 2', type: 'document', icon: FileText },
			{ id: 'w4_discussion', title: 'Sacraments Discussion', type: 'podcast', icon: Mic }
		],
		5: [
			{ id: 'w5_community', title: 'Faith in Community', type: 'document', icon: FileText },
			{ id: 'w5_livestream', title: 'Building Community', type: 'livestream', icon: Play },
			{ id: 'w5_reading', title: 'Sacred Fire Ch. 2', type: 'book', icon: Book }
		],
		6: [
			{ id: 'w6_service', title: 'Call to Service', type: 'document', icon: FileText },
			{ id: 'w6_catechism', title: 'Catechism Chapter 3', type: 'document', icon: FileText },
			{ id: 'w6_testimony', title: 'Service Stories', type: 'podcast', icon: Mic }
		],
		7: [
			{ id: 'w7_discipleship', title: 'Living as Disciples', type: 'document', icon: FileText },
			{ id: 'w7_livestream', title: 'Discipleship Today', type: 'livestream', icon: Play },
			{ id: 'w7_summary', title: 'Course Review', type: 'document', icon: FileText }
		],
		8: [
			{ id: 'w8_trinity', title: 'Catechism Chapter 4', type: 'document', icon: FileText },
			{ id: 'w8_livestream', title: 'Livestream: Foundations of Faith', type: 'livestream', icon: Play },
			{ id: 'w8_podcast', title: 'Catholic Podcast', type: 'podcast', icon: Mic },
			{ id: 'w8_book', title: 'Sacred Fire - Ronald Rolheiser', type: 'book', icon: Book },
			{ id: 'w8_summary', title: 'Content Summary Week 7', type: 'document', icon: FileText }
		]
	};

	// Mock structured content blocks
	const documentContent = {
		'w8_trinity': {
			title: 'Catechism Chapter 4: The Trinity',
			type: 'native',
			blocks: [
				{ type: 'h1', content: 'The Trinity' },
				{ type: 'h2', content: 'Understanding God as Three Persons' },
				{ type: 'p', content: 'The mystery of the Trinity is central to Christian faith. God exists as three distinct persons - Father, Son, and Holy Spirit - yet remains one divine essence.' },
				{ type: 'h2', content: 'Key Concepts' },
				{ type: 'ol', items: [
					'Unity of Essence: The three persons share one divine nature',
					'Distinction of Persons: Each person has unique characteristics',
					'Mutual Relationships: The persons exist in perfect communion'
				]},
				{ type: 'h3', content: 'The Father' },
				{ type: 'p', content: 'The Father is the source and origin of the Trinity. He is revealed as the creator and sustainer of all that exists.' },
				{ type: 'h3', content: 'The Son' },
				{ type: 'p', content: 'Jesus Christ, the Son, is the Word made flesh. Through His incarnation, death, and resurrection, He reveals the Father\'s love.' },
				{ type: 'h3', content: 'The Holy Spirit' },
				{ type: 'p', content: 'The Holy Spirit is the advocate and sanctifier, who continues Christ\'s work in the Church and in individual believers.' },
				{ type: 'h2', content: 'Reflection Questions' },
				{ type: 'ul', items: [
					'How do you experience each person of the Trinity in your daily life?',
					'What does it mean to say God is both one and three?',
					'How does the Trinity serve as a model for human relationships?'
				]},
				{ type: 'h3', content: 'Prayer' },
				{ type: 'p', content: 'Glory be to the Father, and to the Son, and to the Holy Spirit. As it was in the beginning, is now, and ever shall be, world without end. Amen.', italic: true }
			]
		},
		'w8_book': {
			title: 'Sacred Fire - Ronald Rolheiser',
			type: 'native',
			blocks: [
				{ type: 'h1', content: 'Sacred Fire' },
				{ type: 'h2', content: 'Chapter 3: The Call to Discipleship' },
				{ type: 'p', content: 'Discipleship is not just about following rules or attending church services. It\'s about a fundamental reorientation of our entire life toward God and neighbor.' },
				{ type: 'h2', content: 'What Does It Mean to Follow Christ?' },
				{ type: 'p', content: 'Following Christ involves three essential movements:' },
				{ type: 'ol', items: [
					'Dying to Self: Letting go of our ego-driven desires',
					'Rising in Love: Embracing God\'s unconditional love',
					'Serving Others: Living out our faith in practical ways'
				]},
				{ type: 'h3', content: 'The Challenge of Modern Discipleship' },
				{ type: 'p', content: 'In our contemporary world, we face unique challenges that the early Christians did not encounter:' },
				{ type: 'ul', items: [
					'Information overload and constant distraction',
					'Materialism and consumer culture',
					'Individualism versus community',
					'Secular worldview dominance'
				]},
				{ type: 'h2', content: 'Practical Steps for Growth' },
				{ type: 'p', content: 'Rolheiser suggests several concrete practices for deepening our discipleship:' },
				{ type: 'h3', content: '1. Daily Prayer and Reflection' },
				{ type: 'p', content: 'Set aside time each day for quiet prayer and Scripture reading. This helps us stay connected to God\'s voice amidst the noise of daily life.' },
				{ type: 'h3', content: '2. Community Engagement' },
				{ type: 'p', content: 'Actively participate in a faith community. Christianity is not meant to be lived in isolation.' },
				{ type: 'h3', content: '3. Service to Others' },
				{ type: 'p', content: 'Look for opportunities to serve, especially those who are marginalized or in need. This is where faith becomes tangible.' }
			]
		}
	};

	// YouTube content
	const youtubeContent = {
		'w8_livestream': { videoId: 'dQw4w9WgXcQ', title: 'Livestream: Foundations of Faith' },
		'w8_podcast': { videoId: 'jNQXAC9IVRw', title: 'Catholic Podcast' }
	};

	const getContent = (docId) => {
		if (documentContent[docId]) {
			return { type: 'native', ...documentContent[docId] };
		}
		if (youtubeContent[docId]) {
			return { type: 'youtube', ...youtubeContent[docId] };
		}
		return null;
	};

	// Initialize with current material
	$effect(() => {
		if (material && isVisible) {
			const docId = `w${currentWeek}_${material.type === 'livestream' ? 'livestream' :
			                                material.type === 'podcast' ? 'podcast' :
			                                material.type === 'book' ? 'book' :
			                                material.title.toLowerCase().includes('catechism') ? 'trinity' : 'summary'}`;
			selectedDocument = getContent(docId);
		}
	});

	const content = $derived(selectedDocument);
</script>

{#if isVisible}
	<div class="relative z-20">
		<div class="max-w-7xl mx-auto">
			<div class="bg-white rounded-3xl shadow-lg overflow-hidden flex h-[80vh]">

				<!-- Left Sidebar - Document Tree (Cream with Dark Text) -->
				<div class="w-80 bg-gray-50 flex flex-col h-full rounded-l-3xl">
					<!-- Sidebar Header -->
					<div class="p-6 border-b border-gray-200">
						<h3 class="text-lg font-bold text-gray-800">Course Materials</h3>
						<p class="text-sm text-gray-600 mt-1">All weeks • Foundations of Faith</p>
					</div>

					<!-- Document Tree -->
					<div class="flex-1 overflow-y-auto p-4 space-y-2">
						{#each Object.entries(documentTree) as [weekNum, docs]}
							<div class="mb-3">
								<!-- Week Header -->
								<button
									class="flex items-center gap-2 w-full p-2 rounded-lg hover:bg-gray-100 transition-colors text-left"
									on:click={() => toggleWeek(parseInt(weekNum))}
								>
									{#if expandedWeeks.has(parseInt(weekNum))}
										<ChevronDown size="16" class="text-gray-500" />
									{:else}
										<ChevronRight size="16" class="text-gray-500" />
									{/if}
									<span class="font-semibold text-gray-800">Week {weekNum}</span>
								</button>

								<!-- Document List -->
								{#if expandedWeeks.has(parseInt(weekNum))}
									<div class="ml-6 mt-1 space-y-1">
										{#each docs as doc}
											<button
												class="flex items-center gap-2 w-full p-2 rounded-lg text-sm transition-colors hover:bg-gray-100"
												class:bg-gray-200={selectedDocument?.title === doc.title}
												class:shadow-sm={selectedDocument?.title === doc.title}
												on:click={() => selectDocument(getContent(doc.id))}
											>
												<svelte:component this={doc.icon} size="14" class="text-gray-500" />
												<span class="text-gray-700 text-left flex-1">
													{doc.title}
												</span>
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<!-- Main Content Area (White Background) -->
				<div class="flex-1 flex flex-col h-full bg-white rounded-r-3xl">
					<!-- Header (Slightly Darker) -->
					<div class="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50 rounded-tr-3xl">
						<div>
							<h3 class="text-2xl font-bold text-gray-800">
								{content ? content.title : 'Select a document'}
							</h3>
							{#if content}
								<p class="text-sm text-gray-600 mt-1">
									{content.type === 'youtube' ? 'Video Content' : 'Text Document'}
								</p>
							{/if}
						</div>
						<button
							on:click={handleClose}
							class="p-2 rounded-xl hover:bg-gray-100 transition-colors"
						>
							<X size="20" class="text-gray-600" />
						</button>
					</div>

					<!-- Content Display -->
					<div class="flex-1 p-6 overflow-y-auto min-h-0 bg-white">
						{#if content?.type === 'youtube'}
							<!-- YouTube Video Embed -->
							<div class="aspect-video rounded-2xl overflow-hidden shadow-md max-w-4xl mx-auto">
								<iframe
									width="100%"
									height="100%"
									src="https://www.youtube.com/embed/{content.videoId}?rel=0&modestbranding=1"
									title={content.title}
									frameborder="0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowfullscreen
									class="w-full h-full"
								></iframe>
							</div>
						{:else if content?.type === 'native'}
							<!-- Structured Content Blocks -->
							<div class="max-w-4xl mx-auto space-y-6">
								{#each content.blocks as block}
									{#if block.type === 'h1'}
										<h1 class="text-4xl font-bold mb-6 mt-8 text-gray-900">
											{block.content}
										</h1>
									{:else if block.type === 'h2'}
										<h2 class="text-3xl font-bold mb-4 mt-8 text-gray-800">
											{block.content}
										</h2>
									{:else if block.type === 'h3'}
										<h3 class="text-2xl font-semibold mb-3 mt-6 text-gray-800">
											{block.content}
										</h3>
									{:else if block.type === 'p'}
										<p class="text-lg leading-relaxed mb-4 text-gray-700" class:italic={block.italic}>
											{block.content}
										</p>
									{:else if block.type === 'ol'}
										<ol class="list-decimal list-inside space-y-2 mb-6 ml-6">
											{#each block.items as item}
												<li class="text-lg text-gray-700 leading-relaxed">{item}</li>
											{/each}
										</ol>
									{:else if block.type === 'ul'}
										<ul class="list-disc list-inside space-y-2 mb-6 ml-6">
											{#each block.items as item}
												<li class="text-lg text-gray-700 leading-relaxed">{item}</li>
											{/each}
										</ul>
									{/if}
								{/each}
							</div>
						{:else}
							<!-- No Content Selected -->
							<div class="flex flex-col items-center justify-center h-64 text-gray-500">
								<FileText size="48" class="mb-4" />
								<p class="text-xl font-medium">Select a document to view</p>
								<p class="text-sm">Choose from the materials tree on the left</p>
							</div>
						{/if}
					</div>

					<!-- Footer -->
					{#if content}
						<div class="flex items-center justify-between p-6 bg-gray-50 border-t border-gray-200 rounded-br-3xl">
							<div class="text-sm text-gray-600">
								{#if content.type === 'youtube'}
									<span>Video content • Click to expand for full screen</span>
								{:else}
									<span>Document content • {content.blocks?.length || 0} sections</span>
								{/if}
							</div>
							<button
								class="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors rounded-lg hover:bg-gray-100"
							>
								<Download size="16" />
								<span class="text-sm font-medium">Download</span>
							</button>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
{/if}

<style>

	/* Custom prose styling for better readability */
	:global(.prose h1) {
		@apply text-3xl font-bold mb-6 mt-8;
		color: #1e2322;
	}

	:global(.prose h2) {
		@apply text-2xl font-bold mb-4 mt-8;
		color: #334642;
	}

	:global(.prose h3) {
		@apply text-xl font-semibold mb-3 mt-6;
		color: #334642;
	}

	:global(.prose p) {
		@apply mb-4 leading-relaxed;
	}

	:global(.prose ol) {
		@apply mb-6 ml-6;
	}

	:global(.prose ul) {
		@apply mb-6 ml-6;
	}

	:global(.prose li) {
		@apply mb-2;
	}

	:global(.prose strong) {
		@apply font-semibold;
		color: #c59a6b;
	}

	:global(.prose blockquote) {
		@apply border-l-4 pl-6 italic my-6;
		border-color: #c59a6b;
		background-color: #f9f6f2;
		padding: 1.5rem;
		border-radius: 0.5rem;
	}

	:global(.prose cite) {
		@apply text-sm not-italic;
		color: #666;
	}

	:global(.prose em) {
		@apply italic;
		color: #666;
	}
</style>
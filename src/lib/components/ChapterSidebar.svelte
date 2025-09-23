<script>
	import {
		ChevronDown,
		ChevronRight,
		FileText,
		Hash,
		Book,
		BarChart3,
		Eye,
		EyeOff,
		Menu,
		X,
		Bookmark,
		Type,
		List,
		Quote,
		Sparkles,
		Heart,
		Search,
		Users,
		Volume2,
		BookOpen,
		MessageCircle
	} from 'lucide-svelte';

	let {
		chapters = [],
		blocks = [],
		selectedChapter = $bindable(null),
		onChapterSelect = () => {},
		onScrollToChapter = () => {}
	} = $props();

	let collapsedChapters = $state(new Set());
	let collapsedSections = $state(new Set());
	let showAllBlocks = $state(false);
	let isCollapsed = $state(false);

	// Define standard reflection activities that should be grouped together
	const REFLECTION_ACTIVITIES = ['Reflect', 'Pray', 'Listen', 'Worship'];
	const OTHER_ACTIVITIES = ['Research', 'Share', 'Read'];

	// Map sections to icons
	const SECTION_ICONS = {
		'Introduction': Book,
		'Reflection': Heart,
		'Research': Search,
		'Share': Users,
		'Read': BookOpen,
		'Default': MessageCircle
	};

	// Enhanced chapters with hierarchical section structure
	let structuredChapters = $derived(
		chapters.map((chapter, index) => {
			const chapterIndex = blocks.findIndex((b) => b.id === chapter.id);
			let chapterBlocks = [];

			if (chapterIndex !== -1) {
				// Find all blocks in this chapter (until next chapter or end)
				for (let i = chapterIndex; i < blocks.length; i++) {
					if (i > chapterIndex && blocks[i].tag === 'chapter') break;
					chapterBlocks.push({...blocks[i], position: i});
				}
			}

			// Detect sections based on h2 headings
			const sections = [];
			let currentSection = null;

			let reflectionSection = null;

			chapterBlocks.forEach((block, idx) => {
				if (idx === 0 && block.tag === 'chapter') {
					// Skip the chapter title itself
					return;
				}

				// Check if this is a reflection activity
				const isReflectionActivity = block.tag === 'h2' && REFLECTION_ACTIVITIES.includes(block.content);
				const isSubheading = block.tag === 'h2' || block.tag === 'h3';

				if (isReflectionActivity) {
					// Group reflection activities into one section
					if (!reflectionSection) {
						reflectionSection = {
							id: `reflection-${chapter.id}`,
							name: 'Reflection',
							type: 'reflection',
							level: 'reflection',
							blocks: [],
							subActivities: [],
							icon: SECTION_ICONS['Reflection']
						};
						sections.push(reflectionSection);
						currentSection = reflectionSection;
					}
					// Add this reflection activity as a sub-activity
					reflectionSection.subActivities.push({
						id: block.id,
						name: block.content,
						blocks: []
					});
					currentSection = reflectionSection;
				} else if (isSubheading) {
					// Create a new section for each other subheading
					currentSection = {
						id: block.id,
						name: block.content,
						type: 'subheading',
						level: block.tag, // h2 or h3
						blocks: [],
						icon: SECTION_ICONS['Default']
					};
					sections.push(currentSection);
				} else if (currentSection) {
					// Add block to current section
					if (currentSection.type === 'reflection' && currentSection.subActivities.length > 0) {
						// Add to the most recent reflection sub-activity
						const lastActivity = currentSection.subActivities[currentSection.subActivities.length - 1];
						lastActivity.blocks.push(block);
					} else {
						// Add directly to section
						currentSection.blocks.push(block);
					}
				} else {
					// No section yet, these are introduction blocks
					if (!sections.length || sections[0].name !== 'Introduction') {
						// Create introduction section if it doesn't exist
						currentSection = {
							id: `intro-${chapter.id}`,
							name: 'Introduction',
							type: 'introduction',
							level: 'intro',
							blocks: [],
							icon: SECTION_ICONS['Introduction']
						};
						sections.unshift(currentSection);
					}
					sections[0].blocks.push(block);
				}
			});

			// Calculate stats for each section
			sections.forEach(section => {
				let totalBlockCount = section.blocks.length;

				// For reflection sections, count blocks in sub-activities too
				if (section.subActivities) {
					section.subActivities.forEach(activity => {
						activity.blockCount = activity.blocks.length;
						totalBlockCount += activity.blockCount;
					});
					section.activityCount = section.subActivities.length;
				}

				section.blockCount = totalBlockCount;
				section.hasContent = totalBlockCount > 0;

				// Group blocks by type within section
				section.blocksByType = section.blocks.reduce((acc, block) => {
					const type = getBlockTypeCategory(block.tag);
					if (!acc[type]) acc[type] = [];
					acc[type].push(block);
					return acc;
				}, {});
			});

			return {
				...chapter,
				index: index + 1,
				blocks: chapterBlocks,
				blockCount: chapterBlocks.length - 1, // Exclude chapter title
				sections,
				sectionCount: sections.length,
				isVisible: chapterBlocks.some(b => b.isVisible !== false),
				hasContent: chapterBlocks.length > 1 // More than just the chapter title
			};
		})
	);

	function getBlockTypeCategory(tag) {
		const categories = {
			'Content': ['paragraph', 'quote', 'callout', 'note'],
			'Lists': ['ul', 'ol'],
			'Special': ['prayer', 'scripture'],
			'Headings': ['h1', 'h2', 'h3', 'title'],
			'Other': []
		};

		for (const [category, tags] of Object.entries(categories)) {
			if (tags.includes(tag)) return category;
		}
		return 'Other';
	}

	function selectChapter(chapterId) {
		selectedChapter = selectedChapter === chapterId ? null : chapterId;
		onChapterSelect(chapterId);
	}

	function toggleChapterCollapse(chapterId) {
		if (collapsedChapters.has(chapterId)) {
			collapsedChapters.delete(chapterId);
		} else {
			collapsedChapters.add(chapterId);
		}
		collapsedChapters = new Set(collapsedChapters);
	}

	function toggleSectionCollapse(sectionId) {
		if (collapsedSections.has(sectionId)) {
			collapsedSections.delete(sectionId);
		} else {
			collapsedSections.add(sectionId);
		}
		collapsedSections = new Set(collapsedSections);
	}

	function scrollToChapter(chapterId) {
		onScrollToChapter(chapterId);
	}

	function scrollToSection(blockId) {
		onScrollToChapter(blockId);
	}

	function getBlockIcon(tag) {
		const iconMap = {
			'h1': Type, 'h2': Type, 'h3': Type,
			'paragraph': FileText, 'quote': Quote, 'callout': Sparkles,
			'prayer': Bookmark, 'scripture': Book, 'note': Hash,
			'ul': List, 'ol': List,
			'chapter': Book, 'title': Type
		};
		return iconMap[tag] || FileText;
	}

	// Quick stats for the sidebar header
	let sidebarStats = $derived({
		totalChapters: structuredChapters.length,
		totalBlocks: blocks.length,
		totalSections: structuredChapters.reduce((acc, ch) => acc + ch.sectionCount, 0),
		visibleChapters: structuredChapters.filter(c => c.isVisible).length,
		chaptersWithContent: structuredChapters.filter(c => c.hasContent).length
	});
</script>

<aside class="flex h-screen sticky top-0 transition-all duration-300 bg-white border-r border-gray-200 shadow-sm {isCollapsed ? 'w-16' : 'w-96'} lg:w-96">
	<!-- Mobile/Collapsed Toggle Button -->
	<button
		onclick={() => (isCollapsed = !isCollapsed)}
		class="lg:hidden absolute top-4 right-2 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
		title={isCollapsed ? 'Open chapter navigation' : 'Close chapter navigation'}
	>
		{#if isCollapsed}
			<Menu class="w-4 h-4 text-gray-600" />
		{:else}
			<X class="w-4 h-4 text-gray-600" />
		{/if}
	</button>

	<!-- Sidebar Content -->
	<div class="flex flex-col w-full {isCollapsed ? 'lg:flex hidden' : 'flex'}">
	<!-- Sidebar Header -->
	<div class="border-b border-gray-200 p-4">
		<div class="flex items-center justify-between mb-3">
			<h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
				<Book class="w-5 h-5 text-blue-600" />
				Document Structure
			</h2>
			<button
				onclick={() => (showAllBlocks = !showAllBlocks)}
				class="flex items-center gap-1 text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 transition-colors"
				title={showAllBlocks ? 'Hide block details' : 'Show block details'}
			>
				{#if showAllBlocks}
					<EyeOff class="w-3 h-3" />
					Less
				{:else}
					<Eye class="w-3 h-3" />
					More
				{/if}
			</button>
		</div>

		<!-- Quick Stats -->
		<div class="grid grid-cols-3 gap-2 text-sm text-gray-600">
			<div class="bg-blue-50 rounded p-2 text-center">
				<div class="flex items-center justify-center gap-1 text-blue-900 font-semibold">
					<Book class="w-3 h-3" />
					{sidebarStats.totalChapters}
				</div>
				<div class="text-xs">Chapters</div>
			</div>
			<div class="bg-purple-50 rounded p-2 text-center">
				<div class="flex items-center justify-center gap-1 text-purple-900 font-semibold">
					<Hash class="w-3 h-3" />
					{sidebarStats.totalSections}
				</div>
				<div class="text-xs">Sections</div>
			</div>
			<div class="bg-green-50 rounded p-2 text-center">
				<div class="flex items-center justify-center gap-1 text-green-900 font-semibold">
					<BarChart3 class="w-3 h-3" />
					{sidebarStats.totalBlocks}
				</div>
				<div class="text-xs">Blocks</div>
			</div>
		</div>

		<!-- Clear Selection Button -->
		{#if selectedChapter}
			<button
				onclick={() => selectChapter(null)}
				class="w-full mt-3 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center justify-center gap-2"
			>
				<ChevronRight class="w-3 h-3 rotate-180" />
				Show All Chapters
			</button>
		{/if}
	</div>

	<!-- Chapters List -->
	<div class="flex-1 overflow-y-auto">
		{#if structuredChapters.length === 0}
			<div class="p-6 text-center text-gray-500">
				<Book class="w-12 h-12 mx-auto mb-3 text-gray-300" />
				<p class="text-sm">No chapters found</p>
				<p class="text-xs mt-1">Add blocks with "chapter" tag to create structure</p>
			</div>
		{:else}
			<div class="p-2">
				{#each structuredChapters as chapter (chapter.id)}
					<div class="mb-3 border border-gray-200 rounded-lg overflow-hidden">
						<!-- Chapter Header -->
						<div
							class="group flex items-center gap-2 p-3 cursor-pointer transition-all hover:bg-gray-50 {selectedChapter === chapter.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}"
						>
							<!-- Collapse Toggle -->
							<button
								onclick={(e) => { e.stopPropagation(); toggleChapterCollapse(chapter.id); }}
								class="p-1 hover:bg-gray-200 rounded transition-colors"
							>
								{#if collapsedChapters.has(chapter.id)}
									<ChevronRight class="w-4 h-4 text-gray-400" />
								{:else}
									<ChevronDown class="w-4 h-4 text-gray-400" />
								{/if}
							</button>

							<!-- Chapter Info -->
							<div
								class="flex-1 min-w-0"
								onclick={() => selectChapter(chapter.id)}
							>
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-2 min-w-0">
										<span class="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
											Ch. {chapter.index}
										</span>
										<span class="truncate font-semibold text-gray-900 text-sm">
											{chapter.title}
										</span>
									</div>

									<!-- Chapter Stats -->
									<div class="flex items-center gap-2 text-xs text-gray-500 ml-2">
										<span class="bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded" title="{chapter.sectionCount} sections">
											{chapter.sectionCount}
										</span>
										<span class="bg-green-100 text-green-700 px-1.5 py-0.5 rounded" title="{chapter.blockCount} blocks">
											{chapter.blockCount}
										</span>
										{#if !chapter.isVisible}
											<span class="text-red-500" title="Contains hidden blocks">●</span>
										{/if}
									</div>
								</div>
							</div>

							<!-- Quick Actions -->
							<div class="opacity-0 group-hover:opacity-100 transition-opacity">
								<button
									onclick={(e) => { e.stopPropagation(); scrollToChapter(chapter.id); }}
									class="p-1 hover:bg-blue-100 rounded transition-colors"
									title="Jump to chapter"
								>
									<Hash class="w-3 h-3 text-blue-500" />
								</button>
							</div>
						</div>

						<!-- Chapter Sections (when expanded) -->
						{#if !collapsedChapters.has(chapter.id) && (showAllBlocks || selectedChapter === chapter.id)}
							<div class="bg-gray-50 border-t border-gray-200">
								{#if chapter.sections.length > 0}
									{#each chapter.sections as section (section.id)}
										<div class="border-b border-gray-100 last:border-b-0">
											<!-- Section Header -->
											<div class="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors">
												<button
													onclick={() => toggleSectionCollapse(section.id)}
													class="p-0.5 hover:bg-gray-200 rounded transition-colors"
												>
													{#if collapsedSections.has(section.id)}
														<ChevronRight class="w-3 h-3 text-gray-400" />
													{:else}
														<ChevronDown class="w-3 h-3 text-gray-400" />
													{/if}
												</button>

												<svelte:component this={section.icon} class="w-4 h-4 text-gray-500 flex-shrink-0" />

												<span class="flex-1 font-medium text-sm {section.type === 'introduction' ? 'text-gray-700' : section.type === 'reflection' ? 'text-purple-700' : section.level === 'h2' ? 'text-blue-700' : 'text-purple-700'}">
													{section.name}
													{#if section.type === 'reflection' && section.activityCount}
														<span class="text-xs text-gray-500 ml-1">({section.activityCount} activities)</span>
													{:else if section.level && section.level !== 'intro' && section.level !== 'reflection'}
														<span class="text-xs text-gray-500 ml-1 uppercase bg-gray-100 px-1 py-0.5 rounded">{section.level}</span>
													{/if}
												</span>

												<span class="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded">
													{section.blockCount}
												</span>

												<button
													onclick={() => scrollToSection(section.id)}
													class="opacity-0 hover:opacity-100 p-0.5 hover:bg-blue-100 rounded transition-all"
													title="Jump to section"
												>
													<Hash class="w-3 h-3 text-blue-500" />
												</button>
											</div>

											<!-- Section Content (when expanded) -->
											{#if !collapsedSections.has(section.id) && showAllBlocks}
												<div class="pl-6 pr-4 pb-2 space-y-2">
													<!-- Show reflection sub-activities if this is a reflection section -->
													{#if section.subActivities && section.subActivities.length > 0}
														{#each section.subActivities as activity}
															<div class="border-l-2 border-purple-200 pl-3 mb-2">
																<div class="flex items-center gap-2 mb-1">
																	<svelte:component this={SECTION_ICONS['Reflection']} class="w-3 h-3 text-purple-500" />
																	<span class="text-sm font-medium text-purple-700">
																		{activity.name}
																	</span>
																	<span class="text-xs text-gray-500 bg-gray-200 px-1 py-0.5 rounded">
																		{activity.blockCount}
																	</span>
																	<button
																		onclick={() => scrollToSection(activity.id)}
																		class="p-0.5 hover:bg-purple-100 rounded transition-all"
																		title="Jump to activity"
																	>
																		<Hash class="w-3 h-3 text-purple-500" />
																	</button>
																</div>
																{#if activity.blocks.length > 0}
																	<div class="space-y-1 ml-4">
																		{#each activity.blocks.slice(0, 2) as block}
																			<div class="flex items-center gap-2 py-0.5 px-2 rounded hover:bg-gray-100 text-xs cursor-pointer"
																				onclick={() => scrollToSection(block.id)}>
																				<svelte:component this={getBlockIcon(block.tag)} class="w-3 h-3 text-gray-400 flex-shrink-0" />
																				<span class="truncate text-gray-600 flex-1">
																					{block.content.substring(0, 40)}{block.content.length > 40 ? '...' : ''}
																				</span>
																			</div>
																		{/each}
																		{#if activity.blocks.length > 2}
																			<div class="text-xs text-gray-400 px-2 py-0.5">
																				+{activity.blocks.length - 2} more...
																			</div>
																		{/if}
																	</div>
																{/if}
															</div>
														{/each}
													{/if}

													<!-- Show regular blocks if not a reflection section or if there are direct blocks -->
													{#if section.blocks.length > 0}
														{#each Object.entries(section.blocksByType) as [type, typeBlocks]}
															{#if typeBlocks.length > 0}
																<div class="mb-2">
																	<div class="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">
																		{type} ({typeBlocks.length})
																	</div>
																	{#each typeBlocks.slice(0, 3) as block}
																		<div class="flex items-center gap-2 py-0.5 px-2 rounded hover:bg-gray-100 text-xs cursor-pointer"
																			onclick={() => scrollToSection(block.id)}>
																			<svelte:component this={getBlockIcon(block.tag)} class="w-3 h-3 text-gray-400 flex-shrink-0" />
																			<span class="truncate text-gray-600 flex-1">
																				{block.content.substring(0, 60)}{block.content.length > 60 ? '...' : ''}
																			</span>
																		</div>
																	{/each}
																	{#if typeBlocks.length > 3}
																		<div class="text-xs text-gray-400 px-2 py-0.5">
																			+{typeBlocks.length - 3} more...
																		</div>
																	{/if}
																</div>
															{/if}
														{/each}
													{/if}
												</div>
											{/if}
										</div>
									{/each}
								{:else}
									<div class="text-xs text-gray-400 px-4 py-3 italic">
										No sections detected in this chapter
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Sidebar Footer -->
	<div class="border-t border-gray-200 p-4">
		<div class="text-xs text-gray-500 space-y-1">
			<div class="flex items-center gap-1">
				<BarChart3 class="w-3 h-3" />
				{sidebarStats.chaptersWithContent} chapters with content
			</div>
			<div class="flex items-center gap-1">
				<Eye class="w-3 h-3" />
				{sidebarStats.visibleChapters} visible chapters
			</div>
			{#if selectedChapter}
				{@const selected = structuredChapters.find(c => c.id === selectedChapter)}
				{#if selected}
					<div class="mt-2 p-2 bg-blue-50 rounded text-blue-700">
						<div class="font-medium">Current: {selected.title}</div>
						<div class="text-xs">{selected.sectionCount} sections, {selected.blockCount} blocks</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
	</div>
</aside>
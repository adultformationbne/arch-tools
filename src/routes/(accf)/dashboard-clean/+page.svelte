<script>
	import { Play, FileText, Mic, Book, Edit3, Download } from 'lucide-svelte';
	import AccfHeader from '../AccfHeader.svelte';
	import HubCoordinatorBar from '../HubCoordinatorBar.svelte';
	import WeekNavigationTabs from '../WeekNavigationTabs.svelte';
	import ReflectionWriter from '../ReflectionWriter.svelte';
	import MaterialViewer from '../MaterialViewer.svelte';
	import PastReflectionsSection from '../PastReflectionsSection.svelte';
	import PublicReflectionsFeed from '../PublicReflectionsFeed.svelte';
	import ReflectionModal from '../ReflectionModal.svelte';

	// Svelte 5 state with runes
	let currentWeek = $state(8);
	let availableWeeks = $state(8); // Student can access weeks 1-8
	let showReflectionWriter = $state(false);
	let showMaterialViewer = $state(false);
	let selectedMaterial = $state(null);
	let showReflectionModal = $state(false);
	let selectedReflection = $state(null);

	// Mock data that would come from database
	let courseData = $state({
		title: "Foundations of Faith",
		currentWeekData: {
			weekNumber: 8,
			sessionOverview: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim",
			materials: [
				{ type: 'livestream', title: 'Livestream: Foundations of Faith', icon: Play, viewable: true },
				{ type: 'document', title: 'Catechism Chapter 4', icon: FileText, viewable: true },
				{ type: 'podcast', title: 'Catholic Podcast', icon: Mic, viewable: true },
				{ type: 'book', title: 'Sacred Fire - Ronald Rolheiser', icon: Book, viewable: true },
				{ type: 'document', title: 'Content Summary Week 7', icon: FileText, viewable: false }
			],
			reflectionQuestion: "What is the reason you look to God for answers over cultural sources and making prayer central to your life?",
			reflectionStatus: "not_started"
		}
	});

	const handleWeekChange = (weekNum) => {
		console.log(`Switched to week ${weekNum}`);
		// Here you would fetch new data for the selected week
		// fetchWeekData(weekNum);
	};

	const openReflectionWriter = () => {
		showReflectionWriter = true;
	};

	const closeReflectionWriter = () => {
		showReflectionWriter = false;
	};

	const openMaterial = (material) => {
		if (material.viewable) {
			selectedMaterial = material;
			showMaterialViewer = true;
		}
	};

	const closeMaterialViewer = () => {
		showMaterialViewer = false;
		selectedMaterial = null;
	};

	const openReflectionModal = (reflection) => {
		selectedReflection = reflection;
		showReflectionModal = true;
	};

	const closeReflectionModal = () => {
		showReflectionModal = false;
		selectedReflection = null;
	};

	const navigateReflection = (currentWeek, direction) => {
		// In real app, this would navigate to adjacent reflections
		console.log(`Navigate ${direction} from week ${currentWeek}`);
	};

	// Derived values
	const currentWeekData = $derived(courseData.currentWeekData);
	const materials = $derived(currentWeekData.materials);
</script>

<div class="min-h-screen" style="background-color: #334642;">
	<AccfHeader currentPage="dashboard" userName="Sarah" />

	<!-- Hub Coordinator Bar (only shows for hub coordinators) -->
	<div class="px-16">
		<HubCoordinatorBar />
	</div>

	<!-- Main Content with Week Navigation -->
	<div class="px-16 pb-16">
		<div class="max-w-7xl mx-auto">
			<WeekNavigationTabs
				bind:currentWeek={currentWeek}
				totalWeeks={8}
				availableWeeks={availableWeeks}
				onWeekChange={handleWeekChange}
			>
				<div class="p-12">
					<div class="grid grid-cols-2 gap-12">
						<!-- Left Column - Course Info and Materials -->
						<div>
							<!-- Course Header -->
							<div class="mb-10">
								<h1 class="text-5xl font-bold text-gray-800 mb-4">{courseData.title}</h1>
								<div class="flex items-center gap-4">
									<h2 class="text-3xl font-semibold" style="color: #c59a6b;">Week {currentWeek}</h2>
									<div class="h-1 w-20 rounded" style="background-color: #c59a6b;"></div>
								</div>
							</div>

							<!-- This Week's Materials -->
							<div>
								<h3 class="text-2xl font-bold text-gray-800 mb-8">This week's materials</h3>
								<div class="space-y-4">
									{#each materials as material, index}
										<div
											class="flex items-center justify-between p-5 rounded-2xl transition-colors cursor-pointer group"
											class:primary={index === 0}
											class:hover:opacity-90={material.viewable}
											class:cursor-not-allowed={!material.viewable}
											style={index === 0 ? "background-color: #c59a6b;" : "background-color: #f5f0e8;"}
											on:click={() => openMaterial(material)}
										>
											<div class="flex items-center gap-4">
												<svelte:component this={material.icon} size="24" class={index === 0 ? "text-white" : "text-gray-700"} />
												<span class="font-semibold text-lg" class:text-white={index === 0} class:text-gray-800={index !== 0}>
													{material.title}
												</span>
											</div>

											<!-- Hover Download Icon (for non-viewable materials) -->
											{#if !material.viewable}
												<div class="opacity-0 group-hover:opacity-100 transition-opacity">
													<Download size="20" class="text-gray-600" />
												</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						</div>

						<!-- Right Column - Session Overview and Reflection -->
						<div class="flex flex-col justify-between h-full">
							<!-- Session Overview -->
							<div>
								<p class="text-lg font-semibold text-gray-800 leading-relaxed">
									<span class="font-bold">Session overview:</span> {currentWeekData.sessionOverview}
								</p>
							</div>

							<!-- Reflection Question -->
							<div class="bg-white rounded-3xl p-8 shadow-sm">
								<div class="text-lg font-semibold mb-4" style="color: #c59a6b;">Question:</div>
								<h4 class="text-2xl font-bold text-gray-800 mb-8 leading-tight">
									{currentWeekData.reflectionQuestion}
								</h4>

								<!-- Status and Button -->
								<div class="flex items-center justify-between">
									<div class="flex items-center gap-3">
										<span class="text-gray-700 font-semibold text-lg">
											{currentWeekData.reflectionStatus === 'not_started' ? 'Not started' :
											 currentWeekData.reflectionStatus === 'completed' ? 'Completed' : 'In progress'}
										</span>
										<div
											class="w-3 h-3 rounded-full"
											class:bg-orange-400={currentWeekData.reflectionStatus === 'not_started'}
											class:bg-green-500={currentWeekData.reflectionStatus === 'completed'}
											class:bg-blue-400={currentWeekData.reflectionStatus === 'in_progress'}
										></div>
									</div>
									<button
										on:click={openReflectionWriter}
										class="flex items-center gap-3 px-8 py-4 text-white font-semibold text-lg rounded-3xl transition-colors hover:opacity-90"
										style="background-color: #334642;"
									>
										<Edit3 size="20" />
										Write Reflection
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</WeekNavigationTabs>
		</div>
	</div>

	<!-- Material Viewer Component (with wrapper for margin) -->
	<div class="px-16 pb-8">
		<MaterialViewer
			bind:isVisible={showMaterialViewer}
			material={selectedMaterial}
			currentWeek={currentWeek}
			onClose={closeMaterialViewer}
		/>
	</div>

	<!-- Reflection Writer Component (with wrapper for margin) -->
	<div class="px-16 pb-8">
		<ReflectionWriter
			bind:isVisible={showReflectionWriter}
			question={currentWeekData.reflectionQuestion}
			onClose={closeReflectionWriter}
		/>
	</div>

	<!-- Past Reflections Section (with wrapper for margin) -->
	<div class="px-16 pb-16">
		<PastReflectionsSection onReadReflection={openReflectionModal} />
	</div>

	<!-- Public Reflections Feed -->
	<div class="px-16 pb-16">
		<PublicReflectionsFeed onReadReflection={openReflectionModal} />
	</div>

	<!-- Reflection Reading Modal (no margin needed - it's a modal) -->
	<ReflectionModal
		bind:isVisible={showReflectionModal}
		reflection={selectedReflection}
		onClose={closeReflectionModal}
		onNavigate={navigateReflection}
	/>
</div>
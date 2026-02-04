<script>
	import { Plus, BookOpen, Calendar, Users, Edit, Trash2, MoreVertical } from '$lib/icons';
	import { navigating } from '$app/stores';
	import ModuleModal from '$lib/components/ModuleModal.svelte';
	import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
	import { toastError } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import { getCohortStatus } from '$lib/utils/cohort-status';

	// Helper to check if cohort is active based on session progress
	const isActiveCohort = (cohort) => {
		const status = getCohortStatus(cohort.current_session || 0, cohort.total_sessions || 8);
		return status === 'active';
	};

	let { data } = $props();
	const course = $derived(data.course);
	const dataModules = $derived(data.modules || []);
	let modules = $state([]);

	// Sync modules when data changes (e.g., after navigation or modal save)
	$effect(() => {
		modules = dataModules;
	});

	// Show loading state during navigation
	let isLoading = $derived($navigating !== null);

	// Modal state
	let showModuleModal = $state(false);
	let editingModule = $state(null);
	let openDropdown = $state(null);

	// Delete confirmation state
	let showDeleteConfirm = $state(false);
	let moduleToDelete = $state(null);

	function handleCreateModule() {
		editingModule = null;
		showModuleModal = true;
	}

	function handleEditModule(module) {
		editingModule = module;
		showModuleModal = true;
		openDropdown = null;
	}

	function confirmDeleteModule(module) {
		moduleToDelete = module;
		showDeleteConfirm = true;
		openDropdown = null;
	}

	async function handleDeleteModule() {
		const module = moduleToDelete;
		showDeleteConfirm = false;
		moduleToDelete = null;

		if (!module) return;

		try {
			const response = await fetch(`/admin/courses/${course.slug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_module',
					moduleId: module.id
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to delete module');
			}

			// Remove from list
			modules = modules.filter(m => m.id !== module.id);
		} catch (err) {
			console.error('Error deleting module:', err);
			toastError(err.message || 'Failed to delete module', 'Delete Failed');
		}
	}

	function handleModuleSaved(savedModule) {
		// Update modules list
		if (editingModule) {
			// Update existing module
			const index = modules.findIndex(m => m.id === savedModule.id);
			if (index !== -1) {
				modules[index] = savedModule; // Direct mutation triggers reactivity
			}
		} else {
			// Add new module
			modules = [...modules, savedModule].sort((a, b) => a.order_number - b.order_number);
		}
	}

	function handleCloseModal() {
		showModuleModal = false;
		editingModule = null;
	}

	function toggleDropdown(moduleId) {
		openDropdown = openDropdown === moduleId ? null : moduleId;
	}
</script>

<div class="p-3 sm:p-4 lg:p-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
		<div>
			<h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
				{course?.name || 'Course'} Modules
			</h1>
			<p class="text-white/80 mt-1 sm:mt-2 text-sm sm:text-base">
				Manage course modules, sessions, and curriculum structure
			</p>
		</div>
		<button
			onclick={handleCreateModule}
			class="flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-6 py-3 min-h-[44px] rounded-lg font-semibold transition-colors"
			style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
		>
			<Plus size={20} />
			Create Module
		</button>
	</div>

	<!-- Modules Grid -->
	{#if modules.length === 0}
		<div class="text-center py-10 sm:py-16 px-4">
			<BookOpen size={40} class="mx-auto mb-3 sm:mb-4 sm:w-12 sm:h-12" style="color: var(--course-accent-light);" />
			<h3 class="text-lg sm:text-xl font-semibold mb-2 text-white">
				No modules yet
			</h3>
			<p class="text-white/80 mb-4 sm:mb-6 text-sm sm:text-base">Create your first module to organise course content</p>
			<button
				onclick={handleCreateModule}
				class="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-4 sm:px-6 py-3 min-h-[44px] rounded-lg font-semibold"
				style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
			>
				<Plus size={20} />
				Create Module
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 transition-opacity duration-200" class:opacity-60={isLoading && modules.length > 0} class:pointer-events-none={isLoading && modules.length > 0}>
			{#if isLoading && modules.length === 0}
				<!-- Show skeleton loaders during initial load -->
				<SkeletonLoader type="card" count={3} height="200px" />
			{:else}
				{#each modules as module}
				<div
					class="bg-white border rounded-lg p-4 sm:p-5 lg:p-6 hover:shadow-lg transition-shadow"
					style="border-color: var(--course-surface);"
				>
					<!-- Module Header -->
					<div class="flex items-start justify-between mb-3 sm:mb-4">
						<div class="flex-1 min-w-0 pr-2">
							<div class="text-xs sm:text-sm font-semibold mb-1" style="color: var(--course-accent-light);">
								Module {module.order_number}
							</div>
							<h3 class="text-lg sm:text-xl font-bold truncate" style="color: var(--course-accent-dark);">
								{module.name}
							</h3>
						</div>

						<!-- Dropdown Menu -->
						<div class="relative flex-shrink-0">
							<button
								onclick={() => toggleDropdown(module.id)}
								class="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-gray-100 rounded transition-colors"
								title="Module options"
							>
								<MoreVertical size={18} style="color: var(--course-accent-dark);" />
							</button>

							{#if openDropdown === module.id}
								<div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
									<button
										onclick={() => handleEditModule(module)}
										class="w-full text-left px-4 py-3 sm:py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700"
									>
										<Edit size={16} />
										Edit Module
									</button>
									<a
										href="/admin/courses/{course?.slug}/sessions?module={module.id}"
										class="w-full text-left px-4 py-3 sm:py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 block"
										onclick={() => openDropdown = null}
									>
										<BookOpen size={16} />
										Edit Sessions
									</a>
									<button
										onclick={() => confirmDeleteModule(module)}
										class="w-full text-left px-4 py-3 sm:py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 border-t border-gray-100"
									>
										<Trash2 size={16} />
										Delete Module
									</button>
								</div>
							{/if}
						</div>
					</div>

					<!-- Description -->
					{#if module.description}
						<p class="text-sm text-gray-600 mb-3 sm:mb-4 line-clamp-2">
							{module.description}
						</p>
					{/if}

					<!-- Stats -->
					<div class="grid grid-cols-2 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t" style="border-color: var(--course-surface);">
						<div class="text-center">
							<div class="flex items-center justify-center mb-1">
								<BookOpen size={16} style="color: var(--course-accent-light);" />
							</div>
							<div class="text-xl sm:text-2xl font-bold" style="color: var(--course-accent-dark);">
								{module.sessionCount || 0}
							</div>
							<div class="text-xs text-gray-500">Sessions</div>
						</div>
						<div class="text-center">
							<div class="flex items-center justify-center mb-1">
								<Calendar size={16} style="color: var(--course-accent-light);" />
							</div>
							<div class="text-xl sm:text-2xl font-bold" style="color: var(--course-accent-dark);">
								{module.cohorts?.length || 0}
							</div>
							<div class="text-xs text-gray-500">Cohorts</div>
						</div>
					</div>

					<!-- Active Cohorts List -->
					{#if module.cohorts && module.cohorts.length > 0}
						{@const activeCohorts = module.cohorts.filter(isActiveCohort)}
						{#if activeCohorts.length > 0}
						<div class="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t" style="border-color: var(--course-surface);">
							<div class="text-xs font-semibold text-gray-500 mb-2">Active Cohorts:</div>
							<div class="space-y-1">
								{#each activeCohorts.slice(0, 2) as cohort}
									<div class="text-sm text-gray-700 truncate">{cohort.name}</div>
								{/each}
								{#if activeCohorts.length > 2}
									<div class="text-xs text-gray-500">
										+{activeCohorts.length - 2} more
									</div>
								{/if}
							</div>
						</div>
						{/if}
					{/if}
				</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<!-- Module Modal -->
<ModuleModal
	isOpen={showModuleModal}
	module={editingModule}
	courseId={course?.id}
	courseSlug={course?.slug}
	onClose={handleCloseModal}
	onSave={handleModuleSaved}
/>

<!-- Confirmation Modal -->
<ConfirmationModal
	show={showDeleteConfirm}
	title="Delete Module"
	confirmText="Delete"
	cancelText="Cancel"
	onConfirm={handleDeleteModule}
	onCancel={() => {
		showDeleteConfirm = false;
		moduleToDelete = null;
	}}
>
	<p>Are you sure you want to delete "<strong>{moduleToDelete?.name}</strong>"?</p>
	<p class="text-sm text-gray-600 mt-2">This action cannot be undone.</p>
</ConfirmationModal>

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>

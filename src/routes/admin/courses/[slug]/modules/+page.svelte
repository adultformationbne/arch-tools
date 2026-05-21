<script>
	import { Plus, BookOpen, Calendar, Edit, Trash2, MoreVertical, Globe, ExternalLink, Copy, Check } from '$lib/icons';
	import { navigating } from '$app/stores';
	import ModuleModal from '$lib/components/ModuleModal.svelte';
	import PublicPageEditorModal from '$lib/components/PublicPageEditorModal.svelte';
	import SkeletonLoader from '$lib/components/SkeletonLoader.svelte';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import { getCohortStatus, getTotalSessions } from '$lib/utils/cohort-status';

	// Helper to check if cohort is active based on session progress
	const isActiveCohort = (cohort) => {
		const status = getCohortStatus(cohort.current_session || 0, getTotalSessions(cohort));
		return status === 'active';
	};

	let { data } = $props();
	const course = $derived(data.course);
	const dataModules = $derived(data.modules || []);
	let modules = $state([]);
	const publicPagesEnabled = $derived(data.courseFeatures?.publicPagesEnabled ?? false);

	// Public page editor modal state
	let publicPageModalModule = $state(null);

	// Title page editor state
	let titlePageJson = $state('');
	let titlePageOpen = $state(false);
	let titlePageSaving = $state(false);

	// Copy URL state
	let urlCopied = $state(false);

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

	function openPublicPageEditor(module) {
		openDropdown = null;
		publicPageModalModule = module;
	}

	function handlePublicPageSaved(updatedModule) {
		modules = modules.map(m => m.id === updatedModule.id ? { ...m, ...updatedModule } : m);
		publicPageModalModule = null;
	}

	async function copyPublicUrl() {
		const url = `${window.location.origin}/p/${course.slug}`;
		await navigator.clipboard.writeText(url);
		urlCopied = true;
		setTimeout(() => urlCopied = false, 2000);
	}

	function openTitlePageEditor() {
		titlePageJson = data.courseTitlePage ? JSON.stringify(data.courseTitlePage, null, 2) : '';
		titlePageOpen = true;
	}

	async function saveTitlePage() {
		let parsed = null;
		if (titlePageJson.trim()) {
			try {
				parsed = JSON.parse(titlePageJson);
				if (!Array.isArray(parsed)) throw new Error('Must be a JSON array');
			} catch (e) {
				toastError(e.message || 'Invalid JSON', 'JSON Error');
				return;
			}
		}
		titlePageSaving = true;
		try {
			const res = await fetch(`/admin/courses/${course.slug}/modules/api`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ courseTitlePage: parsed })
			});
			const result = await res.json();
			if (!res.ok || !result.success) throw new Error(result.error || 'Save failed');
			toastSuccess('Course intro page saved');
			titlePageOpen = false;
		} catch (e) {
			toastError(e.message || 'Failed to save', 'Save Failed');
		} finally {
			titlePageSaving = false;
		}
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
		<div class="flex flex-wrap items-center gap-2 sm:gap-3">
			{#if publicPagesEnabled}
				<button
					onclick={copyPublicUrl}
					class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
					style="border-color: var(--course-accent-light); color: var(--course-accent-light);"
				>
					{#if urlCopied}
						<Check size={15} /> Copied!
					{:else}
						<Copy size={15} /> Copy public URL
					{/if}
				</button>
				<a
					href="/p/{course?.slug}"
					target="_blank"
					class="flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
					style="border-color: var(--course-accent-light); color: var(--course-accent-light);"
				>
					<ExternalLink size={15} /> View public guide
				</a>
			{/if}
			<button
				onclick={handleCreateModule}
				class="flex items-center justify-center gap-2 px-4 sm:px-6 py-3 min-h-[44px] rounded-lg font-semibold transition-colors"
				style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
			>
				<Plus size={20} />
				Create Module
			</button>
		</div>
	</div>

	<!-- Course title / intro page editor (only when public pages enabled) -->
	{#if publicPagesEnabled}
		<div class="mb-6 bg-white rounded-xl border" style="border-color: var(--course-surface);">
			<button
				type="button"
				onclick={() => { if (!titlePageOpen) openTitlePageEditor(); else titlePageOpen = false; }}
				class="w-full flex items-center justify-between px-5 py-4 text-left"
			>
				<div class="flex items-center gap-2.5">
					<Globe size={16} style="color: var(--course-accent-light);" />
					<span class="font-semibold text-gray-800">Course Introduction Page</span>
					<span class="text-xs px-1.5 py-0.5 rounded-full {data.courseTitlePage ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}">
						{data.courseTitlePage ? 'has content' : 'empty'}
					</span>
				</div>
				<div class="flex items-center gap-2">
					<a href="/p/{course?.slug}" target="_blank" class="text-gray-400 hover:text-gray-600 p-1" onclick={(e) => e.stopPropagation()}>
						<ExternalLink size={14} />
					</a>
					<span class="text-gray-400 text-sm">{titlePageOpen ? '▲' : '▼'}</span>
				</div>
			</button>
			{#if titlePageOpen}
				<div class="px-5 pb-5 border-t border-gray-100 pt-4">
					<p class="text-xs text-gray-500 mb-3">Optional blocks shown above the session list on the course home page (<code class="bg-gray-100 px-1 rounded">/p/{course?.slug}</code>). Leave empty to show just the course name and description.</p>
					<textarea
						bind:value={titlePageJson}
						rows="10"
						class="w-full text-xs font-mono border border-gray-200 rounded-lg p-3 resize-y focus:outline-none focus:border-gray-400 bg-gray-50"
						placeholder="Paste JSON block array here…"
						spellcheck="false"
					></textarea>
					<div class="flex justify-end mt-2">
						<button
							onclick={saveTitlePage}
							disabled={titlePageSaving}
							class="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-50"
							style="background-color: var(--course-accent-dark); color: white;"
						>
							{titlePageSaving ? 'Saving…' : 'Save intro page'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}

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

					<!-- Public Page -->
					{#if publicPagesEnabled}
						<div class="mt-3 pt-3 border-t" style="border-color: var(--course-surface);">
							<div class="flex items-center justify-between">
								<div class="flex items-center gap-2">
									<Globe size={14} style="color: var(--course-accent-light);" />
									<span class="text-xs font-semibold text-gray-600">Public Page</span>
									{#if module.public_page_content}
										<span class="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">has content</span>
									{:else}
										<span class="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">empty</span>
									{/if}
									{#if module.section_name}
										<span class="text-xs text-gray-400 truncate max-w-[100px]" title={module.section_name}>{module.section_name}</span>
									{/if}
								</div>
								<div class="flex items-center gap-1">
									{#if module.public_page_content}
										<a
											href="/p/{course.slug}/{module.order_number}"
											target="_blank"
											class="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors"
											title="Preview public page"
										>
											<ExternalLink size={14} />
										</a>
									{/if}
									<button
										onclick={() => openPublicPageEditor(module)}
										class="text-xs px-2 py-1 rounded border transition-colors"
										style="border-color: var(--course-surface); color: var(--course-accent-dark);"
									>
										Edit
									</button>
								</div>
							</div>
						</div>
					{/if}
				</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>

<!-- Public Page Editor Modal -->
<PublicPageEditorModal
	isOpen={!!publicPageModalModule}
	module={publicPageModalModule}
	courseSlug={course?.slug}
	onClose={() => publicPageModalModule = null}
	onSaved={handlePublicPageSaved}
/>

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

<script>
	import { Plus, BookOpen, Calendar, Users, Edit, Trash2, MoreVertical } from 'lucide-svelte';
	import ModuleModal from '$lib/components/ModuleModal.svelte';

	let { data } = $props();
	let course = $derived(data.course);
	let modules = $state(data.modules || []);

	// Modal state
	let showModuleModal = $state(false);
	let editingModule = $state(null);
	let openDropdown = $state(null);

	function handleCreateModule() {
		editingModule = null;
		showModuleModal = true;
	}

	function handleEditModule(module) {
		editingModule = module;
		showModuleModal = true;
		openDropdown = null;
	}

	async function handleDeleteModule(module) {
		const confirmed = confirm(`Are you sure you want to delete "${module.name}"? This cannot be undone.`);
		if (!confirmed) return;

		try {
			const response = await fetch(`/courses/${course.slug}/admin/api`, {
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
			openDropdown = null;
		} catch (err) {
			console.error('Error deleting module:', err);
			alert(err.message || 'Failed to delete module');
		}
	}

	function handleModuleSaved(savedModule) {
		// Update modules list
		if (editingModule) {
			// Update existing module
			const index = modules.findIndex(m => m.id === savedModule.id);
			if (index !== -1) {
				modules[index] = savedModule;
				modules = [...modules]; // Trigger reactivity
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

<div class="px-16 py-8">
	<!-- Header -->
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-3xl font-bold text-white">
				{course?.name || 'Course'} Modules
			</h1>
			<p class="text-white/80 mt-2">
				Manage course modules, sessions, and curriculum structure
			</p>
		</div>
		<button
			onclick={handleCreateModule}
			class="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors"
			style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
		>
			<Plus size={20} />
			Create Module
		</button>
	</div>

	<!-- Modules Grid -->
	{#if modules.length === 0}
		<div class="text-center py-16">
			<BookOpen size={48} class="mx-auto mb-4" style="color: var(--course-accent-light);" />
			<h3 class="text-xl font-semibold mb-2 text-white">
				No modules yet
			</h3>
			<p class="text-white/80 mb-6">Create your first module to organize course content</p>
			<button
				onclick={handleCreateModule}
				class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold"
				style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
			>
				<Plus size={20} />
				Create Module
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each modules as module}
				<div
					class="bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow"
					style="border-color: var(--course-surface);"
				>
					<!-- Module Header -->
					<div class="flex items-start justify-between mb-4">
						<div class="flex-1">
							<div class="text-sm font-semibold mb-1" style="color: var(--course-accent-light);">
								Module {module.order_number}
							</div>
							<h3 class="text-xl font-bold" style="color: var(--course-accent-dark);">
								{module.name}
							</h3>
						</div>

						<!-- Dropdown Menu -->
						<div class="relative">
							<button
								onclick={() => toggleDropdown(module.id)}
								class="p-2 hover:bg-gray-100 rounded transition-colors"
								title="Module options"
							>
								<MoreVertical size={18} style="color: var(--course-accent-dark);" />
							</button>

							{#if openDropdown === module.id}
								<div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-10">
									<button
										onclick={() => handleEditModule(module)}
										class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700"
									>
										<Edit size={16} />
										Edit Module
									</button>
									<a
										href="/courses/{course?.slug}/admin/sessions?module={module.id}"
										class="w-full text-left px-4 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-700 block"
										onclick={() => openDropdown = null}
									>
										<BookOpen size={16} />
										Edit Sessions
									</a>
									<button
										onclick={() => handleDeleteModule(module)}
										class="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-red-600 border-t border-gray-100"
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
						<p class="text-sm text-gray-600 mb-4 line-clamp-2">
							{module.description}
						</p>
					{/if}

					<!-- Stats -->
					<div class="grid grid-cols-2 gap-4 pt-4 border-t" style="border-color: var(--course-surface);">
						<div class="text-center">
							<div class="flex items-center justify-center mb-1">
								<BookOpen size={16} style="color: var(--course-accent-light);" />
							</div>
							<div class="text-2xl font-bold" style="color: var(--course-accent-dark);">
								{module.sessions?.[0]?.count || 0}
							</div>
							<div class="text-xs text-gray-500">Sessions</div>
						</div>
						<div class="text-center">
							<div class="flex items-center justify-center mb-1">
								<Calendar size={16} style="color: var(--course-accent-light);" />
							</div>
							<div class="text-2xl font-bold" style="color: var(--course-accent-dark);">
								{module.cohorts?.length || 0}
							</div>
							<div class="text-xs text-gray-500">Cohorts</div>
						</div>
					</div>

					<!-- Active Cohorts List -->
					{#if module.cohorts && module.cohorts.length > 0}
						<div class="mt-4 pt-4 border-t" style="border-color: var(--course-surface);">
							<div class="text-xs font-semibold text-gray-500 mb-2">Active Cohorts:</div>
							<div class="space-y-1">
								{#each module.cohorts.filter(c => c.status === 'active').slice(0, 2) as cohort}
									<div class="text-sm text-gray-700">{cohort.name}</div>
								{/each}
								{#if module.cohorts.filter(c => c.status === 'active').length > 2}
									<div class="text-xs text-gray-500">
										+{module.cohorts.filter(c => c.status === 'active').length - 2} more
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			{/each}
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

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>

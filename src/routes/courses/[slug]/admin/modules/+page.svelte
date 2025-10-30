<script>
	import { Plus, BookOpen, Calendar, Users, Edit, Trash2 } from 'lucide-svelte';

	let { data } = $props();
	let course = $derived(data.course);
	let modules = $derived(data.modules || []);
</script>

<div class="px-16 py-8">
	<!-- Header -->
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-3xl font-bold" style="color: var(--course-accent-dark);">
				{course?.name || 'Course'} Modules
			</h1>
			<p class="text-gray-600 mt-2">
				Manage course modules, sessions, and curriculum structure
			</p>
		</div>
		<button
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
			<h3 class="text-xl font-semibold mb-2" style="color: var(--course-accent-dark);">
				No modules yet
			</h3>
			<p class="text-gray-600 mb-6">Create your first module to organize course content</p>
			<button
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
						<a
							href="/courses/{course?.slug}/admin/sessions?module={module.id}"
							class="px-3 py-1.5 text-sm hover:bg-gray-100 rounded flex items-center gap-1"
							title="Edit sessions"
							style="color: var(--course-accent-dark);"
						>
							<Edit size={16} />
							<span class="font-medium">Edit</span>
						</a>
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

<style>
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>

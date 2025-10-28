<script>
	import { Plus, BookOpen, Users, Calendar, Archive, Edit } from 'lucide-svelte';

	let { data } = $props();
	let courses = $derived(data.courses || []);
</script>

<div class="px-16 py-8">
	<!-- Header -->
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-3xl font-bold" style="color: #334642;">Courses</h1>
			<p class="text-gray-600 mt-2">
				Manage course programs, modules, and cohorts
			</p>
		</div>
		<a
			href="/admin/courses/new"
			class="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors"
			style="background-color: #c59a6b; color: #1e2322;"
		>
			<Plus size={20} />
			Create Course
		</a>
	</div>

	<!-- Courses Grid -->
	{#if courses.length === 0}
		<div class="text-center py-16">
			<BookOpen size={48} class="mx-auto mb-4" style="color: #c59a6b;" />
			<h3 class="text-xl font-semibold mb-2" style="color: #334642;">No courses yet</h3>
			<p class="text-gray-600 mb-6">Create your first course to get started</p>
			<a
				href="/admin/courses/new"
				class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold"
				style="background-color: #c59a6b; color: #1e2322;"
			>
				<Plus size={20} />
				Create Course
			</a>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each courses as course}
				<a
					href="/admin/courses/{course.id}"
					class="bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow"
					style="border-color: #eae2d9;"
				>
					<!-- Status Badge -->
					<div class="flex items-start justify-between mb-4">
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-1" style="color: #334642;">
								{course.short_name || course.name}
							</h3>
							{#if course.short_name && course.name !== course.short_name}
								<p class="text-sm text-gray-600">{course.name}</p>
							{/if}
						</div>
						<span
							class="px-3 py-1 text-xs font-semibold rounded-full"
							class:bg-green-100={course.status === 'active'}
							class:text-green-800={course.status === 'active'}
							class:bg-gray-100={course.status === 'draft'}
							class:text-gray-800={course.status === 'draft'}
							class:bg-red-100={course.status === 'archived'}
							class:text-red-800={course.status === 'archived'}
						>
							{course.status}
						</span>
					</div>

					<!-- Description -->
					{#if course.description}
						<p class="text-sm text-gray-600 mb-4 line-clamp-2">
							{course.description}
						</p>
					{/if}

					<!-- Stats -->
					<div class="grid grid-cols-3 gap-4 pt-4 border-t" style="border-color: #eae2d9;">
						<div class="text-center">
							<div class="flex items-center justify-center mb-1">
								<BookOpen size={16} style="color: #c59a6b;" />
							</div>
							<div class="text-2xl font-bold" style="color: #334642;">
								{course.module_count}
							</div>
							<div class="text-xs text-gray-500">Modules</div>
						</div>
						<div class="text-center">
							<div class="flex items-center justify-center mb-1">
								<Calendar size={16} style="color: #c59a6b;" />
							</div>
							<div class="text-2xl font-bold" style="color: #334642;">
								{course.cohort_count}
							</div>
							<div class="text-xs text-gray-500">Cohorts</div>
						</div>
						<div class="text-center">
							<div class="flex items-center justify-center mb-1">
								<Users size={16} style="color: #c59a6b;" />
							</div>
							<div class="text-2xl font-bold" style="color: #334642;">
								{course.active_cohorts}
							</div>
							<div class="text-xs text-gray-500">Active</div>
						</div>
					</div>

					<!-- Duration -->
					{#if course.duration_weeks}
						<div class="mt-4 text-sm text-gray-600 text-center">
							{course.duration_weeks} weeks total
						</div>
					{/if}
				</a>
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

<script lang="ts">
	import { BookOpen, ChevronRight } from 'lucide-svelte';
	import { Card } from '$lib/design-system';

	let { data } = $props();
	const courses = data.courses || [];
	const noEnrollments = data.noEnrollments || false;
</script>

<svelte:head>
	<title>My Courses</title>
</svelte:head>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-8">
			<h1 class="flex items-center text-3xl font-bold text-gray-900">
				<BookOpen class="mr-3 h-8 w-8" />
				My Courses
			</h1>
			<p class="mt-2 text-gray-600">
				{#if noEnrollments}
					You are not currently enrolled in any courses
				{:else}
					Select a course to continue
				{/if}
			</p>
		</div>

		<!-- Courses Grid -->
		{#if courses.length > 0}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each courses as course}
					{@const accentDark = course.settings?.theme?.accentDark || '#334642'}
					{@const accentLight = course.settings?.theme?.accentLight || '#c59a6b'}
					<Card padding="none" shadow="md" class="overflow-hidden transition-all hover:shadow-lg">
						<!-- Accent color bar at top -->
						<div
							class="h-2"
							style="background: linear-gradient(90deg, {accentDark} 0%, {accentLight} 100%);"
						></div>

						<a href="/courses/{course.slug}/dashboard" class="block">
							<div class="p-6">
								<!-- Course Header -->
								<div class="mb-4 flex items-start justify-between">
									<div class="flex-1">
										<h3 class="text-xl font-semibold" style="color: {accentDark};">
											{course.name}
										</h3>
										{#if course.short_name}
											<p class="mt-1 text-sm font-medium text-gray-500">{course.short_name}</p>
										{/if}
									</div>
									<div
										class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full"
										style="background-color: {accentLight};"
									>
										<ChevronRight class="h-5 w-5" style="color: {accentDark};" />
									</div>
								</div>

								<!-- Course Description -->
								{#if course.description}
									<p class="line-clamp-3 text-sm text-gray-600">
										{course.description}
									</p>
								{/if}
							</div>
						</a>

						<!-- Footer -->
						<div
							class="flex items-center justify-between border-t px-6 py-3"
							style="background-color: {accentLight}20; border-color: {accentLight};"
						>
							<span class="text-sm font-medium" style="color: {accentDark};"> View Dashboard </span>
						</div>
					</Card>
				{/each}
			</div>
		{:else}
			<!-- Empty State -->
			<Card padding="xl" class="text-center">
				<BookOpen class="mx-auto h-12 w-12 text-gray-400" />
				<h3 class="mt-4 text-lg font-medium text-gray-900">No courses yet</h3>
				<p class="mt-2 text-sm text-gray-500">
					Contact an administrator to enroll in a course.
				</p>
			</Card>
		{/if}
	</div>
</div>

<style>
	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>

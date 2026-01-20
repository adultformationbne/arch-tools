<script lang="ts">
	import { BookOpen, ChevronRight, Users, GraduationCap } from '$lib/icons';
	import { Card } from '$lib/design-system';

	let { data } = $props();
	const courseData = data.courseData || [];
	const noEnrollments = data.noEnrollments || false;

	function getRoleBadge(role: string) {
		if (role === 'coordinator') {
			return { label: 'Coordinator', class: 'bg-purple-100 text-purple-800' };
		}
		return { label: 'Student', class: 'bg-blue-100 text-blue-800' };
	}
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
					Select a cohort to continue
				{/if}
			</p>
		</div>

		<!-- Courses List -->
		{#if courseData.length > 0}
			<div class="space-y-8">
				{#each courseData as { course, enrollments }}
					{@const accentDark = course.settings?.theme?.accentDark || '#334642'}
					{@const accentLight = course.settings?.theme?.accentLight || '#c59a6b'}

					<Card padding="none" shadow="md" class="overflow-hidden">
						<!-- Course Header -->
						<div
							class="px-6 py-4"
							style="background: linear-gradient(90deg, {accentDark} 0%, {accentLight} 100%);"
						>
							<h2 class="text-xl font-bold text-white">{course.name}</h2>
							{#if course.short_name}
								<p class="mt-1 text-sm text-white/80">{course.short_name}</p>
							{/if}
						</div>

						<!-- Cohort Enrollments -->
						<div class="divide-y divide-gray-100">
							{#each enrollments as enrollment}
								{@const roleBadge = getRoleBadge(enrollment.role)}
								<a
									href="/courses/select-cohort?course={course.slug}&cohort={enrollment.cohortId}&courseId={course.id}"
									class="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
								>
									<div class="flex items-center gap-4">
										<div
											class="flex h-10 w-10 items-center justify-center rounded-full"
											style="background-color: {accentLight}30;"
										>
											{#if enrollment.role === 'coordinator'}
												<Users class="h-5 w-5" style="color: {accentDark};" />
											{:else}
												<GraduationCap class="h-5 w-5" style="color: {accentDark};" />
											{/if}
										</div>
										<div>
											<p class="font-medium text-gray-900">{enrollment.cohortName}</p>
											<p class="text-sm text-gray-500">{enrollment.moduleName}</p>
										</div>
									</div>
									<div class="flex items-center gap-3">
										<span class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {roleBadge.class}">
											{roleBadge.label}
										</span>
										<ChevronRight class="h-5 w-5 text-gray-400" />
									</div>
								</a>
							{/each}
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

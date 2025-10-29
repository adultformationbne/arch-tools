<script>
	let { data } = $props();

	const courses = data.courses || [];
	const userRole = data.userRole;
	const noEnrollments = data.noEnrollments || false;
</script>

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
		<div class="text-center mb-12">
			<h1 class="text-4xl font-bold text-gray-900 mb-4">
				{#if userRole === 'admin'}
					Course Management
				{:else}
					My Courses
				{/if}
			</h1>
			<p class="text-lg text-gray-600">
				{#if userRole === 'admin'}
					Select a course to manage
				{:else if noEnrollments}
					You are not currently enrolled in any courses
				{:else}
					Select a course to continue
				{/if}
			</p>
		</div>

		{#if courses.length > 0}
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{#each courses as course}
					<a
						href="/courses/{course.slug}/{userRole === 'admin' ? 'admin' : 'dashboard'}"
						class="block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 p-6"
					>
						<div class="flex items-start justify-between mb-4">
							<div>
								<h3 class="text-xl font-semibold text-gray-900">{course.name}</h3>
								{#if course.short_name}
									<p class="text-sm text-gray-500 mt-1">{course.short_name}</p>
								{/if}
							</div>
							<svg
								class="w-5 h-5 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M9 5l7 7-7 7"
								/>
							</svg>
						</div>
						{#if course.description}
							<p class="text-gray-600 text-sm line-clamp-3">{course.description}</p>
						{/if}
					</a>
				{/each}
			</div>
		{:else if noEnrollments}
			<div class="text-center py-12">
				<svg
					class="mx-auto h-12 w-12 text-gray-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
					/>
				</svg>
				<h3 class="mt-4 text-lg font-medium text-gray-900">No courses yet</h3>
				<p class="mt-2 text-sm text-gray-500">
					Contact an administrator to enroll in a course.
				</p>
			</div>
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

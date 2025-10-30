<script>
	import CourseAdminSidebar from '$lib/components/CourseAdminSidebar.svelte';

	let { data, children } = $props();

	const courseSlug = data.courseSlug;
</script>

<div class="admin-layout">
	<CourseAdminSidebar {courseSlug} />

	<main class="admin-content">
		{@render children()}
	</main>
</div>

<style>
	.admin-layout {
		display: flex;
		min-height: 100vh;
		background-color: var(--course-accent-dark);
	}

	.admin-content {
		flex: 1;
		overflow-x: hidden;
	}
</style>

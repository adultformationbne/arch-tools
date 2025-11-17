<script>
	import MaterialViewer from '../MaterialViewer.svelte';

	let { data } = $props();

	// Extract data from server load
	const { materialsBySession, currentSession, materials, courseName } = data;

	// Find a default material to show (first material from current session)
	const defaultMaterial = materialsBySession[currentSession]?.[0] || null;
	let selectedMaterial = $state(defaultMaterial);
</script>

<div class="px-16 py-8">
	<div class="max-w-7xl mx-auto">
		<!-- Page Header -->
		<div class="mb-8">
			<h1 class="text-4xl font-bold text-white mb-2">Course Materials</h1>
			<p class="text-white opacity-75">Access all your course content and resources</p>
		</div>

		<!-- Material Viewer (always visible on this page) -->
		<MaterialViewer
			isVisible={true}
			material={selectedMaterial}
			currentSession={currentSession}
			materialsBySession={materialsBySession}
			courseName={courseName || 'Course Materials'}
			onClose={() => {}}
		/>
	</div>
</div>
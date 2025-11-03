<script>
	let {
		sessionOverview = '',
		onOverviewChange = () => {},
		placeholder = 'Write a brief overview of what students will learn this week...',
		sessionNumber = 1
	} = $props();

	const handleBlur = () => {
		onOverviewChange(sessionOverview);
	};

	// Custom placeholder for Pre-Start
	const displayPlaceholder = sessionNumber === 0
		? 'Welcome message for Pre-Start. This appears before Session 1 starts. Include course start date and what students should expect...'
		: placeholder;
</script>

<div class="bg-white rounded-2xl p-6 shadow-sm">
	<h2 class="text-xl font-bold text-gray-800 mb-4">
		{sessionNumber === 0 ? 'Pre-Start Welcome Message' : 'Session Overview'}
	</h2>
	<textarea
		bind:value={sessionOverview}
		onblur={handleBlur}
		placeholder={displayPlaceholder}
		rows="3"
		class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none"
		style="focus:ring-color: #c59a6b;"
	></textarea>
</div>
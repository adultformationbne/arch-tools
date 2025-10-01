<script>
	let {
		sessionOverview = '',
		onOverviewChange = () => {},
		placeholder = 'Write a brief overview of what students will learn this week...'
	} = $props();

	const handleBlur = () => {
		onOverviewChange(sessionOverview);
	};
</script>

<div class="bg-white rounded-2xl p-6 shadow-sm">
	<h2 class="text-xl font-bold text-gray-800 mb-4">Session Overview</h2>
	<textarea
		bind:value={sessionOverview}
		onblur={handleBlur}
		{placeholder}
		rows="3"
		class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none"
		style="focus:ring-color: #c59a6b;"
	></textarea>
</div>
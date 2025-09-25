<script>
	let {
		leftPanel,
		rightPanel,
		leftWidth = 'lg:w-96',
		showRight = true,
		backgroundColor = 'bg-gray-50'
	} = $props();
</script>

<div class="min-h-screen {backgroundColor}">
	<div class="flex flex-col lg:flex-row h-screen">
		<!-- Left Panel -->
		<div class="{leftWidth} w-full bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col">
			{@render leftPanel()}
		</div>

		<!-- Right Panel -->
		<div class="flex-1 flex flex-col {showRight ? 'block' : 'hidden lg:flex'}">
			{@render rightPanel()}
		</div>
	</div>
</div>
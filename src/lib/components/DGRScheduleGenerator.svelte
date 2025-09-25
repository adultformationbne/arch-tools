<script>
	let {
		formData = { startDate: new Date().toISOString().split('T')[0], days: 14 },
		onGenerate = () => {}
	} = $props();
</script>

<div class="rounded-lg bg-white p-6 shadow-sm">
	<h2 class="mb-4 text-lg font-semibold">Generate Schedule</h2>
	<div class="flex items-end gap-4">
		<div>
			<label for="start-date" class="mb-1 block text-sm font-medium text-gray-700">Start Date</label>
			<input
				id="start-date"
				type="date"
				bind:value={formData.startDate}
				class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
		</div>
		<div>
			<label for="num-days" class="mb-1 block text-sm font-medium text-gray-700">Number of Days</label>
			<input
				id="num-days"
				type="number"
				bind:value={formData.days}
				min="1"
				max="365"
				class="w-24 rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			/>
		</div>
		<button
			onclick={() => onGenerate(formData)}
			class="rounded-md bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
		>
			Generate Schedule
		</button>
	</div>
</div>
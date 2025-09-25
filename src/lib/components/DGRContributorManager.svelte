<script>
	import { toast } from '$lib/stores/toast.svelte.js';

	let {
		contributors = [],
		dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
		onAddContributor = () => {},
		onUpdateContributor = () => {}
	} = $props();

	let newContributor = $state({
		name: '',
		email: '',
		preferred_days: [],
		day_of_month: null,
		notes: ''
	});

	function togglePreferredDay(day) {
		const index = newContributor.preferred_days.indexOf(day);
		if (index > -1) {
			newContributor.preferred_days.splice(index, 1);
		} else {
			newContributor.preferred_days.push(day);
		}
	}

	async function handleAddContributor() {
		if (!newContributor.name || !newContributor.email) {
			toast.error({
				title: 'Missing Information',
				message: 'Please provide both name and email',
				duration: 3000
			});
			return;
		}

		await onAddContributor(newContributor);

		// Reset form
		newContributor = {
			name: '',
			email: '',
			preferred_days: [],
			day_of_month: null,
			notes: ''
		};
	}

	async function handleDayOfMonthChange(contributor, newValue) {
		const newDayOfMonth = newValue ? parseInt(newValue) : null;
		await onUpdateContributor(contributor.id, { day_of_month: newDayOfMonth });
	}
</script>

<div class="space-y-6">
	<!-- Add Contributor Form -->
	<div class="rounded-lg bg-white p-6 shadow-sm">
		<h2 class="mb-4 text-lg font-semibold">Add New Contributor</h2>
		<div class="space-y-4">
			<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div>
					<label for="contributor-name" class="mb-1 block text-sm font-medium text-gray-700">Name</label>
					<input
						id="contributor-name"
						type="text"
						bind:value={newContributor.name}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						placeholder="Sr. Mary Catherine"
					/>
				</div>
				<div>
					<label for="contributor-email" class="mb-1 block text-sm font-medium text-gray-700">Email</label>
					<input
						id="contributor-email"
						type="email"
						bind:value={newContributor.email}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						placeholder="contributor@example.com"
					/>
				</div>
			</div>

			<fieldset>
				<legend class="mb-2 block text-sm font-medium text-gray-700">Preferred Days</legend>
				<div class="flex flex-wrap gap-2">
					{#each dayNames as day, index}
						<button
							onclick={() => togglePreferredDay(index)}
							class="rounded px-3 py-1 text-sm {newContributor.preferred_days.includes(index)
								? 'bg-blue-600 text-white'
								: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
						>
							{day}
						</button>
					{/each}
				</div>
			</fieldset>

			<div>
				<label for="contributor-day-of-month" class="mb-1 block text-sm font-medium text-gray-700">
					Day of Month Assignment (1-31)
				</label>
				<select
					id="contributor-day-of-month"
					bind:value={newContributor.day_of_month}
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
				>
					<option value={null}>No specific day</option>
					{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
						<option value={day}>{day}</option>
					{/each}
				</select>
				<p class="mt-1 text-xs text-gray-500">
					Assign this contributor to write on a specific day each month (e.g., always the 15th)
				</p>
			</div>

			<div>
				<label for="contributor-notes" class="mb-1 block text-sm font-medium text-gray-700">Notes</label>
				<textarea
					id="contributor-notes"
					bind:value={newContributor.notes}
					rows="2"
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					placeholder="Any additional notes or preferences..."
				></textarea>
			</div>

			<button
				onclick={handleAddContributor}
				class="rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
			>
				Add Contributor
			</button>
		</div>
	</div>

	<!-- Contributors List -->
	<div class="overflow-hidden rounded-lg bg-white shadow-sm">
		<div class="border-b border-gray-200 px-6 py-4">
			<h2 class="text-lg font-semibold">Contributors</h2>
		</div>

		{#if contributors.length === 0}
			<div class="px-6 py-8 text-center text-gray-500">
				No contributors found. Add some contributors to get started.
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Name
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Email
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Preferred Days
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Day of Month
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Status
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Notes
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#each contributors as contributor (contributor.id)}
							<tr>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm font-medium text-gray-900">{contributor.name}</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm text-gray-500">{contributor.email}</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="text-sm text-gray-500">
										{contributor.preferred_days?.map((d) => dayNames[d]).join(', ') || 'Any day'}
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<select
										value={contributor.day_of_month || ''}
										onchange={(e) => handleDayOfMonthChange(contributor, e.target.value)}
										class="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
									>
										<option value="">None</option>
										{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
											<option value={day}>{day}</option>
										{/each}
									</select>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class="inline-flex rounded-full px-2 text-xs font-semibold leading-5 {contributor.is_active
										? 'bg-green-100 text-green-800'
										: 'bg-gray-100 text-gray-800'}">
										{contributor.is_active ? 'Active' : 'Inactive'}
									</span>
								</td>
								<td class="px-6 py-4">
									<div class="max-w-xs truncate text-sm text-gray-500">
										{contributor.notes || '—'}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
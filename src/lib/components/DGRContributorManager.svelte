<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import { Copy, ExternalLink, RefreshCw, Plus, ChevronDown, ChevronUp } from 'lucide-svelte';

	let {
		contributors = [],
		dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
		onAddContributor = () => {},
		onUpdateContributor = () => {}
	} = $props();

	let newContributor = $state({
		name: '',
		email: '',
		schedule_pattern: null,
		pattern_value: null,
		notes: ''
	});

	let formExpanded = $state(false);

	async function handleAddContributor() {
		if (!newContributor.name || !newContributor.email) {
			toast.error({
				title: 'Missing Information',
				message: 'Please provide both name and email',
				duration: 3000
			});
			return;
		}

		// Build schedule_pattern JSON if pattern is selected
		let schedule_pattern = null;
		if (newContributor.schedule_pattern === 'day_of_month' && newContributor.pattern_value) {
			schedule_pattern = { type: 'day_of_month', value: parseInt(newContributor.pattern_value) };
		} else if (newContributor.schedule_pattern === 'day_of_week' && newContributor.pattern_value !== null) {
			schedule_pattern = { type: 'day_of_week', value: parseInt(newContributor.pattern_value) };
		}

		await onAddContributor({ ...newContributor, schedule_pattern });

		// Reset form and collapse
		newContributor = {
			name: '',
			email: '',
			schedule_pattern: null,
			pattern_value: null,
			notes: ''
		};
		formExpanded = false;
	}

	async function handlePatternChange(contributor, patternType, patternValue) {
		let schedule_pattern = null;
		if (patternType === 'day_of_month' && patternValue) {
			schedule_pattern = { type: 'day_of_month', value: parseInt(patternValue) };
		} else if (patternType === 'day_of_week' && patternValue !== null) {
			schedule_pattern = { type: 'day_of_week', value: parseInt(patternValue) };
		}
		await onUpdateContributor(contributor.id, { schedule_pattern });
	}

	function getContributorLink(contributor) {
		if (!contributor.access_token) return null;
		return `${window.location.origin}/dgr/write/${contributor.access_token}`;
	}

	function copyLink(contributor) {
		const link = getContributorLink(contributor);
		if (link) {
			navigator.clipboard.writeText(link).then(() => {
				toast.success({
					title: 'Link Copied!',
					message: 'Contributor link copied to clipboard',
					duration: 2000
				});
			});
		}
	}

	function getPatternDescription(pattern) {
		if (!pattern) return 'Manual assignment only';
		if (pattern.type === 'day_of_month') return `Every ${pattern.value}${getOrdinalSuffix(pattern.value)} of month`;
		if (pattern.type === 'day_of_week') return `Every ${dayNames[pattern.value]}`;
		return 'Manual assignment';
	}

	function getOrdinalSuffix(num) {
		const j = num % 10;
		const k = num % 100;
		if (j === 1 && k !== 11) return 'st';
		if (j === 2 && k !== 12) return 'nd';
		if (j === 3 && k !== 13) return 'rd';
		return 'th';
	}
</script>

<div class="space-y-6">
	<!-- Add Contributor Form -->
	<div class="rounded-lg bg-white shadow-sm">
		<button
			onclick={() => (formExpanded = !formExpanded)}
			class="flex w-full items-center justify-between p-6 text-left hover:bg-gray-50 transition-colors"
		>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
					<Plus class="h-5 w-5 text-green-600" />
				</div>
				<div>
					<h2 class="text-lg font-semibold text-gray-900">Add New Contributor</h2>
					<p class="text-sm text-gray-500">Click to expand form</p>
				</div>
			</div>
			{#if formExpanded}
				<ChevronUp class="h-5 w-5 text-gray-400" />
			{:else}
				<ChevronDown class="h-5 w-5 text-gray-400" />
			{/if}
		</button>

		{#if formExpanded}
			<div class="border-t border-gray-200 p-6">
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

					<div>
						<label for="pattern-type" class="mb-1 block text-sm font-medium text-gray-700">
							Schedule Pattern
						</label>
						<div class="grid grid-cols-2 gap-4">
							<select
								id="pattern-type"
								bind:value={newContributor.schedule_pattern}
								class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								<option value={null}>Manual assignment only</option>
								<option value="day_of_month">Day of Month</option>
								<option value="day_of_week">Day of Week</option>
							</select>

							{#if newContributor.schedule_pattern === 'day_of_month'}
								<select
									bind:value={newContributor.pattern_value}
									class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								>
									<option value={null}>Select day...</option>
									{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
										<option value={day}>{day}{getOrdinalSuffix(day)}</option>
									{/each}
								</select>
							{:else if newContributor.schedule_pattern === 'day_of_week'}
								<select
									bind:value={newContributor.pattern_value}
									class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								>
									<option value={null}>Select day...</option>
									{#each dayNames as day, index}
										<option value={index}>{day}</option>
									{/each}
								</select>
							{/if}
						</div>
						<p class="mt-1 text-xs text-gray-500">
							Set a recurring schedule pattern, or leave as manual for ad-hoc assignments
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
		{/if}
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
								Schedule Pattern
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Access Link
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Status
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
								<td class="px-6 py-4">
									<div class="text-sm text-gray-700">
										{getPatternDescription(contributor.schedule_pattern)}
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									{#if contributor.access_token}
										<div class="flex items-center gap-2">
											<button
												onclick={() => copyLink(contributor)}
												class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
												title="Copy contributor link"
											>
												<Copy class="h-4 w-4" />
												<span class="text-xs">Copy Link</span>
											</button>
											<a
												href={getContributorLink(contributor)}
												target="_blank"
												class="inline-flex items-center text-gray-500 hover:text-gray-700"
												title="Open link"
											>
												<ExternalLink class="h-4 w-4" />
											</a>
										</div>
									{:else}
										<span class="text-xs text-gray-400">No token</span>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span class="inline-flex rounded-full px-2 text-xs font-semibold leading-5 {contributor.active
										? 'bg-green-100 text-green-800'
										: 'bg-gray-100 text-gray-800'}">
										{contributor.active ? 'Active' : 'Inactive'}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
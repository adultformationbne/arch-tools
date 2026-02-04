<script>
	import { ChevronUp } from '$lib/icons';
	import { toast } from '$lib/stores/toast.svelte.js';
	import DGRSchedulePatternSelector from './DGRSchedulePatternSelector.svelte';

	let {
		expanded = $bindable(false),
		onAddContributor = () => {}
	} = $props();

	let newContributor = $state({
		name: '',
		email: '',
		title: '',
		schedule_pattern: null,
		pattern_values: [],
		notes: '',
		is_guest: false
	});

	async function handleSubmit() {
		// Guest contributors only need a name
		if (!newContributor.name) {
			toast.error({
				title: 'Missing Information',
				message: 'Please provide a name',
				duration: 3000
			});
			return;
		}

		// Regular contributors need email
		if (!newContributor.is_guest && !newContributor.email) {
			toast.error({
				title: 'Missing Information',
				message: 'Please provide an email for regular contributors',
				duration: 3000
			});
			return;
		}

		// Build schedule_pattern JSON if pattern is selected (not for guests)
		let schedule_pattern = null;
		if (!newContributor.is_guest && newContributor.schedule_pattern && newContributor.pattern_values.length > 0) {
			schedule_pattern = {
				type: newContributor.schedule_pattern,
				values: newContributor.pattern_values.map(v => parseInt(v))
			};
		}

		await onAddContributor({
			name: newContributor.name,
			email: newContributor.is_guest ? null : newContributor.email,
			title: newContributor.title,
			notes: newContributor.notes,
			schedule_pattern,
			is_guest: newContributor.is_guest
		});

		// Reset form and collapse
		newContributor = {
			name: '',
			email: '',
			title: '',
			schedule_pattern: null,
			pattern_values: [],
			notes: '',
			is_guest: false
		};
		expanded = false;
	}
</script>

<div class="rounded-lg bg-white shadow-sm {expanded ? '' : 'hidden'}">
	<div class="flex items-center justify-between border-b border-gray-200 p-4">
		<h3 class="font-semibold text-gray-900">Add New Contributor</h3>
		<button onclick={() => (expanded = false)} class="text-gray-400 hover:text-gray-600">
			<ChevronUp class="h-5 w-5" />
		</button>
	</div>

	<div class="p-6">
		<div class="space-y-4">
			<!-- Guest toggle -->
			<div class="flex items-center gap-3">
				<label class="relative inline-flex cursor-pointer items-center">
					<input
						type="checkbox"
						bind:checked={newContributor.is_guest}
						class="peer sr-only"
					/>
					<div class="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300"></div>
				</label>
				<div>
					<span class="text-sm font-medium text-gray-700">Guest Contributor</span>
					<p class="text-xs text-gray-500">External author for attribution only (no portal access)</p>
				</div>
			</div>

			<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div class="md:col-span-2">
					<label for="contributor-name" class="mb-1 block text-sm font-medium text-gray-700">Name</label>
					<input
						id="contributor-name"
						type="text"
						bind:value={newContributor.name}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						placeholder="Michael Grace"
					/>
				</div>
				<div>
					<label for="contributor-title" class="mb-1 block text-sm font-medium text-gray-700">Title</label>
					<select
						id="contributor-title"
						bind:value={newContributor.title}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					>
						<option value="">None</option>
						<option value="Fr">Fr</option>
						<option value="Sr">Sr</option>
						<option value="Br">Br</option>
						<option value="Deacon">Deacon</option>
					</select>
					<p class="mt-1 text-xs text-gray-500">Used when addressing by first name</p>
				</div>
			</div>

			{#if !newContributor.is_guest}
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

				<DGRSchedulePatternSelector
					bind:patternType={newContributor.schedule_pattern}
					bind:patternValues={newContributor.pattern_values}
					mode="multi"
				/>
			{/if}

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
				onclick={handleSubmit}
				class="rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
			>
				Add Contributor
			</button>
		</div>
	</div>
</div>

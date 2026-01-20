<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import { Plus, Trash2, Save, AlertCircle } from '$lib/icons';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let { rules = $bindable([]) } = $props();

	let newRule = $state({
		name: '',
		description: '',
		condition_season: '',
		condition_day_type: '',
		condition_liturgical_day_contains: '',
		action_type: 'block_assignment',
		action_message: '',
		active: true,
		priority: 100
	});

	let showAddForm = $state(false);
	let saving = $state(false);
	let showDeleteConfirm = $state(false);
	let ruleToDelete = $state(null);

	// Options populated from database
	const seasonOptions = ['Advent', 'Christmas', 'Lent', 'Easter', 'Easter Triduum', 'Holy Week', 'Ordinary'];
	const dayTypeOptions = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
	const actionTypes = [
		{ value: 'block_assignment', label: 'Block Assignment', description: 'Prevent contributors from being assigned' },
		{ value: 'skip_pattern', label: 'Skip Pattern', description: 'Skip pattern-based assignments only' }
	];

	async function loadRules() {
		try {
			const response = await fetch('/api/dgr-admin/assignment-rules');
			const data = await response.json();
			if (data.error) throw new Error(data.error);
			rules = data.rules || [];
		} catch (error) {
			toast.error({
				title: 'Failed to load rules',
				message: error.message,
				duration: 3000
			});
		}
	}

	async function addRule() {
		if (!newRule.name || !newRule.action_type) {
			toast.warning({
				title: 'Missing Information',
				message: 'Rule name and action type are required',
				duration: 3000
			});
			return;
		}

		saving = true;
		try {
			const response = await fetch('/api/dgr-admin/assignment-rules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'create', rule: newRule })
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Rule Created',
				message: `${newRule.name} has been added`,
				duration: 3000
			});

			// Reset form
			newRule = {
				name: '',
				description: '',
				condition_season: '',
				condition_day_type: '',
				condition_liturgical_day_contains: '',
				action_type: 'block_assignment',
				action_message: '',
				active: true,
				priority: 100
			};
			showAddForm = false;

			await loadRules();
		} catch (error) {
			toast.error({
				title: 'Failed to create rule',
				message: error.message,
				duration: 5000
			});
		} finally {
			saving = false;
		}
	}

	async function toggleRuleActive(rule) {
		saving = true;
		try {
			const response = await fetch('/api/dgr-admin/assignment-rules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update',
					rule_id: rule.id,
					updates: { active: !rule.active }
				})
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			toast.success({
				title: rule.active ? 'Rule Disabled' : 'Rule Enabled',
				message: `${rule.name} is now ${!rule.active ? 'active' : 'inactive'}`,
				duration: 2000
			});

			await loadRules();
		} catch (error) {
			toast.error({
				title: 'Failed to update rule',
				message: error.message,
				duration: 3000
			});
		} finally {
			saving = false;
		}
	}

	function confirmDeleteRule(rule) {
		ruleToDelete = rule;
		showDeleteConfirm = true;
	}

	async function deleteRule() {
		const rule = ruleToDelete;
		showDeleteConfirm = false;
		ruleToDelete = null;

		if (!rule) return;

		saving = true;
		try {
			const response = await fetch('/api/dgr-admin/assignment-rules', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete',
					rule_id: rule.id
				})
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Rule Deleted',
				message: `${rule.name} has been removed`,
				duration: 2000
			});

			await loadRules();
		} catch (error) {
			toast.error({
				title: 'Failed to delete rule',
				message: error.message,
				duration: 3000
			});
		} finally {
			saving = false;
		}
	}

	function getRuleConditionSummary(rule) {
		const conditions = [];
		if (rule.condition_season) conditions.push(`Season: ${rule.condition_season}`);
		if (rule.condition_day_type) conditions.push(`Day: ${rule.condition_day_type}`);
		if (rule.condition_liturgical_day_contains) conditions.push(`Contains: ${rule.condition_liturgical_day_contains}`);
		return conditions.length > 0 ? conditions.join(', ') : 'All dates';
	}

	// Load rules on mount
	$effect(() => {
		loadRules();
	});
</script>

<div class="space-y-6">
	<!-- Header with Add Button -->
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-lg font-semibold text-gray-900">Assignment Rules</h2>
			<p class="text-sm text-gray-600">Control when contributors can be assigned based on liturgical calendar</p>
		</div>
		<button
			onclick={() => (showAddForm = !showAddForm)}
			class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
		>
			<Plus class="h-4 w-4" />
			Add Rule
		</button>
	</div>

	<!-- Add Rule Form -->
	{#if showAddForm}
		<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 text-md font-semibold">Create New Rule</h3>
			<div class="space-y-4">
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label for="rule-name" class="mb-1 block text-sm font-medium text-gray-700">
							Rule Name <span class="text-red-500">*</span>
						</label>
						<input
							id="rule-name"
							type="text"
							bind:value={newRule.name}
							placeholder="e.g., Block Lent Assignments"
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						/>
					</div>
					<div>
						<label for="rule-priority" class="mb-1 block text-sm font-medium text-gray-700">
							Priority
						</label>
						<input
							id="rule-priority"
							type="number"
							bind:value={newRule.priority}
							placeholder="100"
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
						/>
						<p class="mt-1 text-xs text-gray-500">Lower number = higher priority</p>
					</div>
				</div>

				<div>
					<label for="rule-description" class="mb-1 block text-sm font-medium text-gray-700">
						Description
					</label>
					<input
						id="rule-description"
						type="text"
						bind:value={newRule.description}
						placeholder="Brief description of this rule"
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</div>

				<div class="rounded-md bg-blue-50 p-4">
					<h4 class="mb-3 text-sm font-semibold text-blue-900">Conditions (If...)</h4>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
						<div>
							<label for="condition-season" class="mb-1 block text-sm font-medium text-gray-700">
								Season
							</label>
							<select
								id="condition-season"
								bind:value={newRule.condition_season}
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								<option value="">Any</option>
								{#each seasonOptions as season}
									<option value={season}>{season}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="condition-day" class="mb-1 block text-sm font-medium text-gray-700">
								Day Type
							</label>
							<select
								id="condition-day"
								bind:value={newRule.condition_day_type}
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								<option value="">Any</option>
								{#each dayTypeOptions as day}
									<option value={day}>{day}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="condition-contains" class="mb-1 block text-sm font-medium text-gray-700">
								Day Contains
							</label>
							<input
								id="condition-contains"
								type="text"
								bind:value={newRule.condition_liturgical_day_contains}
								placeholder="e.g., Christmas"
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							/>
						</div>
					</div>
				</div>

				<div class="rounded-md bg-green-50 p-4">
					<h4 class="mb-3 text-sm font-semibold text-green-900">Action (Then...)</h4>
					<div class="space-y-3">
						<div>
							<label for="action-type" class="mb-1 block text-sm font-medium text-gray-700">
								Action Type <span class="text-red-500">*</span>
							</label>
							<select
								id="action-type"
								bind:value={newRule.action_type}
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								{#each actionTypes as action}
									<option value={action.value}>{action.label} - {action.description}</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="action-message" class="mb-1 block text-sm font-medium text-gray-700">
								Message to Display
							</label>
							<input
								id="action-message"
								type="text"
								bind:value={newRule.action_message}
								placeholder="e.g., Lenten reflections are sourced from special program"
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							/>
						</div>
					</div>
				</div>

				<div class="flex gap-3">
					<button
						onclick={addRule}
						disabled={saving}
						class="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-white hover:bg-green-700 disabled:opacity-50"
					>
						<Save class="h-4 w-4" />
						{saving ? 'Saving...' : 'Create Rule'}
					</button>
					<button
						onclick={() => (showAddForm = false)}
						class="rounded-md border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Rules List -->
	<div class="overflow-hidden rounded-lg bg-white shadow-sm">
		{#if rules.length === 0}
			<div class="px-6 py-8 text-center text-gray-500">
				<AlertCircle class="mx-auto mb-2 h-8 w-8 text-gray-400" />
				<p>No assignment rules configured yet.</p>
				<p class="mt-1 text-sm">Create rules to control when contributors can be assigned.</p>
			</div>
		{:else}
			<div class="divide-y divide-gray-200">
				{#each rules as rule (rule.id)}
					<div class="flex items-center justify-between p-4 hover:bg-gray-50">
						<div class="flex-1">
							<div class="flex items-center gap-3">
								<h3 class="font-semibold text-gray-900">{rule.name}</h3>
								<span
									class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {rule.active
										? 'bg-green-100 text-green-800'
										: 'bg-gray-100 text-gray-600'}"
								>
									{rule.active ? 'Active' : 'Disabled'}
								</span>
								<span class="text-xs text-gray-500">Priority: {rule.priority}</span>
							</div>
							{#if rule.description}
								<p class="mt-1 text-sm text-gray-600">{rule.description}</p>
							{/if}
							<div class="mt-2 flex flex-wrap gap-2 text-xs">
								<span class="rounded bg-blue-100 px-2 py-1 text-blue-800">
									If: {getRuleConditionSummary(rule)}
								</span>
								<span class="rounded bg-green-100 px-2 py-1 text-green-800">
									Then: {rule.action_type.replace('_', ' ')}
								</span>
							</div>
							{#if rule.action_message}
								<p class="mt-2 text-sm italic text-gray-500">"{rule.action_message}"</p>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							<button
								onclick={() => toggleRuleActive(rule)}
								class="rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
							>
								{rule.active ? 'Disable' : 'Enable'}
							</button>
							<button
								onclick={() => confirmDeleteRule(rule)}
								class="rounded-md p-2 text-red-600 hover:bg-red-50"
								title="Delete rule"
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- Confirmation Modal -->
<ConfirmationModal
	show={showDeleteConfirm}
	title="Delete Assignment Rule"
	confirmText="Delete"
	cancelText="Cancel"
	onConfirm={deleteRule}
	onCancel={() => {
		showDeleteConfirm = false;
		ruleToDelete = null;
	}}
>
	<p>Are you sure you want to delete the rule "<strong>{ruleToDelete?.name}</strong>"?</p>
	<p class="text-sm text-gray-600 mt-2">This action cannot be undone.</p>
</ConfirmationModal>

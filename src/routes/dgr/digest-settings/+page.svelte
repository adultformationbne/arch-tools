<script>
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import { Mail, Clock, Calendar, Check } from '$lib/icons';

	let { data } = $props();

	let task = $state(null);
	let dgrAdmins = $state([]);
	let selectedRecipientIds = $state([]);
	let saving = $state(false);
	let runOnWeekdays = $state(true);
	let runOnWeekends = $state(false);
	let enabled = $state(true);

	// Sync state from server data
	$effect(() => {
		task = data.task;
		dgrAdmins = data.dgrAdmins;
		selectedRecipientIds = (data.currentRecipients || []).map(r => r.id);
		runOnWeekdays = task?.run_on_weekdays ?? true;
		runOnWeekends = task?.run_on_weekends ?? false;
		enabled = task?.enabled ?? true;
	});

	async function saveSettings() {
		saving = true;

		try {
			// Build recipients array from selected IDs
			const recipients = dgrAdmins
				.filter(admin => selectedRecipientIds.includes(admin.id))
				.map(admin => ({
					id: admin.id,
					email: admin.email,
					name: admin.full_name
				}));

			const response = await fetch('/dgr/digest-settings/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					taskId: task.id,
					enabled,
					runOnWeekdays,
					runOnWeekends,
					recipients
				})
			});

			const result = await response.json();

			if (result.error) {
				throw new Error(result.error);
			}

			toastSuccess('Settings saved');
		} catch (error) {
			toastError(error.message || 'Failed to save settings');
		} finally {
			saving = false;
		}
	}

	function toggleRecipient(adminId) {
		if (selectedRecipientIds.includes(adminId)) {
			selectedRecipientIds = selectedRecipientIds.filter(id => id !== adminId);
		} else {
			selectedRecipientIds = [...selectedRecipientIds, adminId];
		}
	}

	function selectAll() {
		selectedRecipientIds = dgrAdmins.map(a => a.id);
	}

	function selectNone() {
		selectedRecipientIds = [];
	}
</script>

<div class="mx-auto max-w-3xl p-4 sm:p-6">
	<div class="mb-6">
		<h1 class="text-2xl font-bold text-gray-900">Daily Digest Settings</h1>
		<p class="mt-1 text-sm text-gray-600">
			Configure who receives the daily DGR digest email and when it runs.
		</p>
	</div>

	{#if !task}
		<div class="rounded-lg bg-yellow-50 p-4 text-yellow-800">
			Digest task not found. Please contact support.
		</div>
	{:else}
		<div class="space-y-6">
			<!-- Enable/Disable -->
			<div class="rounded-lg bg-white p-6 shadow-sm">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<Mail class="h-5 w-5 text-gray-400" />
						<div>
							<h2 class="font-semibold text-gray-900">Daily Digest</h2>
							<p class="text-sm text-gray-500">Send a summary email each morning</p>
						</div>
					</div>
					<button
						type="button"
						onclick={() => enabled = !enabled}
						class="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#009199] focus:ring-offset-2 {enabled ? 'bg-[#009199]' : 'bg-gray-200'}"
						role="switch"
						aria-checked={enabled}
					>
						<span
							class="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {enabled ? 'translate-x-5' : 'translate-x-0'}"
						></span>
					</button>
				</div>
			</div>

			<!-- Schedule -->
			<div class="rounded-lg bg-white p-6 shadow-sm">
				<div class="flex items-center gap-3 mb-4">
					<Calendar class="h-5 w-5 text-gray-400" />
					<h2 class="font-semibold text-gray-900">Schedule</h2>
				</div>

				<div class="flex items-center gap-3 mb-3">
					<Clock class="h-4 w-4 text-gray-400" />
					<span class="text-sm text-gray-600">Runs at <strong>8:30am Brisbane time</strong></span>
				</div>

				<div class="space-y-3">
					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={runOnWeekdays}
							class="h-4 w-4 rounded border-gray-300 text-[#009199] focus:ring-[#009199]"
						/>
						<span class="text-sm text-gray-700">Run on weekdays (Mon-Fri)</span>
					</label>

					<label class="flex items-center gap-3 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={runOnWeekends}
							class="h-4 w-4 rounded border-gray-300 text-[#009199] focus:ring-[#009199]"
						/>
						<span class="text-sm text-gray-700">Run on weekends (Sat-Sun)</span>
					</label>
				</div>
			</div>

			<!-- Recipients -->
			<div class="rounded-lg bg-white p-6 shadow-sm">
				<div class="flex items-center justify-between mb-4">
					<h2 class="font-semibold text-gray-900">Recipients</h2>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={selectAll}
							class="text-xs text-[#009199] hover:underline"
						>
							Select all
						</button>
						<span class="text-gray-300">|</span>
						<button
							type="button"
							onclick={selectNone}
							class="text-xs text-gray-500 hover:underline"
						>
							Clear
						</button>
					</div>
				</div>

				<p class="text-sm text-gray-500 mb-4">
					Select which DGR admins should receive the daily digest email.
				</p>

				<div class="space-y-2">
					{#each dgrAdmins as admin}
						{@const isSelected = selectedRecipientIds.includes(admin.id)}
						<button
							type="button"
							onclick={() => toggleRecipient(admin.id)}
							class="w-full flex items-center justify-between p-3 rounded-lg border transition-colors {isSelected ? 'border-[#009199] bg-[#009199]/5' : 'border-gray-200 hover:border-gray-300'}"
						>
							<div class="text-left">
								<div class="font-medium text-gray-900">{admin.full_name}</div>
								<div class="text-sm text-gray-500">{admin.email}</div>
							</div>
							<div class="flex-shrink-0">
								{#if isSelected}
									<div class="h-6 w-6 rounded-full bg-[#009199] flex items-center justify-center">
										<Check class="h-4 w-4 text-white" />
									</div>
								{:else}
									<div class="h-6 w-6 rounded-full border-2 border-gray-300"></div>
								{/if}
							</div>
						</button>
					{/each}
				</div>

				{#if dgrAdmins.length === 0}
					<p class="text-sm text-gray-500 italic">No DGR admins found.</p>
				{/if}
			</div>

			<!-- Last Run Status -->
			{#if task.last_run_at}
				<div class="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
					<strong>Last run:</strong>
					{new Date(task.last_run_at).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })}
					<span class="ml-2 {task.last_run_status === 'success' ? 'text-green-600' : task.last_run_status === 'error' ? 'text-red-600' : 'text-yellow-600'}">
						({task.last_run_status})
					</span>
					{#if task.last_run_message}
						<span class="text-gray-500">- {task.last_run_message}</span>
					{/if}
				</div>
			{/if}

			<!-- Save Button -->
			<div class="flex justify-end">
				<button
					type="button"
					onclick={saveSettings}
					disabled={saving}
					class="rounded-lg bg-[#009199] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#007a80] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{saving ? 'Saving...' : 'Save Settings'}
				</button>
			</div>
		</div>
	{/if}
</div>

<ToastContainer />

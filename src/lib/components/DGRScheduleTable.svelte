<script>
	import { Send, Eye, Trash2 } from 'lucide-svelte';
	import { decodeHtmlEntities } from '$lib/utils/html.js';

	let {
		schedule = [],
		contributors = [],
		statusColors = {},
		statusOptions = [],
		onUpdateAssignment = () => {},
		onUpdateStatus = () => {},
		onOpenReviewModal = () => {},
		onSendToWordPress = () => {},
		onOpenDeleteConfirm = () => {},
		onCopySubmissionUrl = () => {}
	} = $props();

	function formatDate(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		const options = {
			weekday: 'short',
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		};
		return date.toLocaleDateString('en-AU', options);
	}
</script>

<div class="overflow-hidden rounded-lg bg-white shadow-sm">
	<div class="border-b border-gray-200 px-6 py-4">
		<h2 class="text-lg font-semibold">Upcoming Schedule</h2>
	</div>

	{#if schedule.length === 0}
		<div class="px-6 py-8 text-center text-gray-500">
			No schedule entries found. Generate a schedule to get started.
		</div>
	{:else}
		<div class="overflow-x-auto">
			<table class="min-w-full divide-y divide-gray-200">
				<thead class="bg-gray-50">
					<tr>
						<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Date
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Gospel Reference
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Contributor
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Status
						</th>
						<th class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#each schedule as entry (entry.id)}
						<tr>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm font-medium text-gray-900">
									{formatDate(entry.date)}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<div class="text-sm text-gray-700">
									{entry.gospel_reference ? decodeHtmlEntities(entry.gospel_reference) : '—'}
								</div>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<select
									value={entry.contributor_id || ''}
									onchange={(e) => onUpdateAssignment(entry.id, e.target.value)}
									class="rounded border border-gray-300 px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:outline-none"
								>
									<option value="">Unassigned</option>
									{#each contributors as contributor}
										<option value={contributor.id}>
											{contributor.name}
										</option>
									{/each}
								</select>
							</td>
							<td class="px-6 py-4 whitespace-nowrap">
								<select
									value={entry.status}
									onchange={(e) => onUpdateStatus(entry.id, e.target.value)}
									class="rounded border border-gray-300 px-2 py-1 text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none {statusColors[
										entry.status
									]} font-medium"
								>
									{#each statusOptions as option}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</td>
							<td class="space-x-3 px-6 py-4 text-sm font-medium whitespace-nowrap">
								{#if entry.submission_token && entry.status === 'pending'}
									<button
										onclick={() => onCopySubmissionUrl(entry.submission_token)}
										class="inline-flex items-center gap-1 text-blue-600 hover:text-blue-900"
									>
										<Send class="h-3 w-3" />
										Copy Link
									</button>
								{/if}
								{#if entry.status === 'submitted' || entry.status === 'approved'}
									<button
										onclick={() => onOpenReviewModal(entry)}
										class="inline-flex items-center gap-1 text-purple-600 hover:text-purple-900"
									>
										<Eye class="h-3 w-3" />
										{entry.status === 'approved' ? 'Edit' : 'Review'}
									</button>
								{/if}
								{#if entry.status === 'approved'}
									<button
										onclick={() => onSendToWordPress(entry.id)}
										class="inline-flex items-center gap-1 text-green-600 hover:text-green-900"
									>
										<Send class="h-3 w-3" />
										Send to WordPress
									</button>
								{/if}
								<button
									onclick={() => onOpenDeleteConfirm(entry)}
									class="inline-flex items-center gap-1 text-red-600 hover:text-red-900"
								>
									<Trash2 class="h-3 w-3" />
									Remove
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
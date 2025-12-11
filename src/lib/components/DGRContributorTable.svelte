<script>
	import DGRContributorRow from './DGRContributorRow.svelte';

	let {
		contributors = [],
		sendingWelcomeIds = new Set(),
		openMenuId = null,
		onToggleMenu = () => {},
		onCloseMenu = () => {},
		onSendWelcome = () => {},
		onResendWelcome = () => {},
		onEdit = () => {},
		onDelete = () => {}
	} = $props();

	let isSendingAny = $derived(sendingWelcomeIds.size > 0);
</script>

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
						<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Name
						</th>
						<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Email
						</th>
						<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Pattern
						</th>
						<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Welcome Email
						</th>
						<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Last Visit
						</th>
						<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
							Actions
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-200 bg-white">
					{#each contributors as contributor (contributor.id)}
						<DGRContributorRow
							{contributor}
							isSendingThis={sendingWelcomeIds.has(contributor.id)}
							{isSendingAny}
							menuOpen={openMenuId === contributor.id}
							{onToggleMenu}
							{onCloseMenu}
							{onSendWelcome}
							{onResendWelcome}
							{onEdit}
							{onDelete}
						/>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

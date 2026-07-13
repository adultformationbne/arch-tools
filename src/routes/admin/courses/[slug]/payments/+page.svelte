<script>
	import { Tag, ExternalLink, Search } from '$lib/icons';
	import { formatPrice } from '$lib/utils/enrollment-links';

	let { data } = $props();

	const payments = $derived(data.payments || []);
	const summary = $derived(data.summary || { currency: 'AUD', totalCents: 0, completed: 0, pending: 0, abandoned: 0, failed: 0, total: 0 });

	let statusFilter = $state('all');
	let search = $state('');

	const filtered = $derived.by(() => {
		let rows = payments;
		if (statusFilter !== 'all') rows = rows.filter((p) => p.status === statusFilter);
		const term = search.trim().toLowerCase();
		if (term) {
			rows = rows.filter(
				(p) =>
					(p.full_name || '').toLowerCase().includes(term) ||
					(p.email || '').toLowerCase().includes(term)
			);
		}
		return rows;
	});

	function statusColor(status) {
		if (status === 'completed' || status === 'paid') return 'bg-green-100 text-green-700';
		if (status === 'pending') return 'bg-amber-100 text-amber-700';
		if (status === 'failed' || status === 'abandoned') return 'bg-red-100 text-red-700';
		return 'bg-gray-100 text-gray-600';
	}

	function formatDate(dateString) {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	const filters = [
		{ key: 'all', label: 'All' },
		{ key: 'completed', label: 'Completed' },
		{ key: 'pending', label: 'Pending' },
		{ key: 'abandoned', label: 'Abandoned' },
		{ key: 'failed', label: 'Failed' }
	];
</script>

<div class="p-3 sm:p-4 lg:p-6">
	<div class="py-6 sm:py-8 lg:py-12">
		<div class="max-w-7xl mx-auto">
			<!-- Header -->
			<div class="mb-6 sm:mb-8">
				<h1 class="text-2xl font-bold text-gray-900 flex items-center gap-2">
					<Tag size={22} />
					Payments
				</h1>
				<p class="text-sm text-gray-500 mt-1">Billing and payment history across this course's cohorts.</p>
			</div>

			<!-- Summary cards -->
			<div class="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
				<div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
					<p class="text-[11px] text-gray-500 uppercase tracking-wider">Collected</p>
					<p class="text-xl font-bold text-gray-900 mt-1">{formatPrice(summary.totalCents, summary.currency)}</p>
					<p class="text-[11px] text-gray-400 mt-0.5">{summary.completed} completed</p>
				</div>
				<div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
					<p class="text-[11px] text-gray-500 uppercase tracking-wider">Pending</p>
					<p class="text-xl font-bold text-amber-600 mt-1">{summary.pending}</p>
				</div>
				<div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
					<p class="text-[11px] text-gray-500 uppercase tracking-wider">Abandoned</p>
					<p class="text-xl font-bold text-gray-500 mt-1">{summary.abandoned}</p>
				</div>
				<div class="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
					<p class="text-[11px] text-gray-500 uppercase tracking-wider">Failed</p>
					<p class="text-xl font-bold text-red-600 mt-1">{summary.failed}</p>
				</div>
			</div>

			<!-- Controls -->
			<div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
				<div class="flex flex-wrap gap-1.5">
					{#each filters as f}
						<button
							onclick={() => (statusFilter = f.key)}
							class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors {statusFilter === f.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}"
						>
							{f.label}
						</button>
					{/each}
				</div>
				<div class="relative sm:ml-auto">
					<Search size={15} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
					<input
						type="text"
						bind:value={search}
						placeholder="Search payer…"
						class="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64"
					/>
				</div>
			</div>

			<!-- Table -->
			<div class="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
				{#if filtered.length === 0}
					<p class="text-sm text-gray-500 text-center py-12">
						{payments.length === 0 ? 'No payments recorded yet.' : 'No payments match this filter.'}
					</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="bg-gray-50 border-b border-gray-200">
								<tr>
									<th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Payer</th>
									<th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cohort</th>
									<th class="px-4 py-3 text-right text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
									<th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
									<th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Date</th>
									<th class="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Invoice</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each filtered as p}
									<tr class="hover:bg-gray-50">
										<td class="px-4 py-3">
											<div class="font-medium text-gray-900">{p.full_name || '—'}</div>
											<div class="text-xs text-gray-500">{p.email}</div>
										</td>
										<td class="px-4 py-3 text-gray-700">
											<div>{p.cohort?.name || '—'}</div>
											{#if p.cohort?.module?.name}
												<div class="text-xs text-gray-400">{p.cohort.module.name}</div>
											{/if}
										</td>
										<td class="px-4 py-3 text-right">
											<span class="font-semibold text-gray-900">{formatPrice(p.amount_cents, p.currency)}</span>
											{#if p.discount_code}
												<div class="text-[11px] text-green-700">
													{p.discount_code}{p.discount_amount_cents ? ` (−${formatPrice(p.discount_amount_cents, p.currency)})` : ''}
												</div>
											{/if}
										</td>
										<td class="px-4 py-3">
											<span class="inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full {statusColor(p.status)}">{p.status}</span>
										</td>
										<td class="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(p.paid_at || p.created_at)}</td>
										<td class="px-4 py-3">
											{#if p.stripe_invoice_url}
												<a href={p.stripe_invoice_url} target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700">
													View <ExternalLink size={12} />
												</a>
											{:else}
												<span class="text-gray-300">—</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			{#if payments.length >= 500}
				<p class="text-xs text-gray-400 mt-3">Showing the 500 most recent payments.</p>
			{/if}
		</div>
	</div>
</div>

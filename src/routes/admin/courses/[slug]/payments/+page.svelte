<script>
	import { Tag, ExternalLink, Search, ChevronDown, RefreshCw } from '$lib/icons';
	import { formatPrice } from '$lib/utils/enrollment-links';

	let { data } = $props();

	const entries = $derived(data.entries || []);
	const notCompleted = $derived(data.notCompleted || []);
	const summary = $derived(
		data.summary || {
			currency: 'AUD',
			totalCents: 0,
			paid: 0,
			inProgress: 0,
			failed: 0,
			notCompleted: 0,
			retriesAbsorbed: 0,
			attemptTotal: 0
		}
	);

	let outcomeFilter = $state('all');
	let search = $state('');
	let expanded = $state({});
	let showNotCompleted = $state(false);

	const OUTCOMES = {
		paid: { label: 'Paid', pill: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/25' },
		in_progress: { label: 'In progress', pill: 'bg-sky-400/15 text-sky-300 ring-sky-400/25' },
		not_completed: { label: 'Not completed', pill: 'bg-white/10 text-white/55 ring-white/15' },
		failed: { label: 'Failed', pill: 'bg-red-400/15 text-red-300 ring-red-400/25' },
		refunded: { label: 'Refunded', pill: 'bg-white/10 text-white/70 ring-white/15' }
	};

	const outcomeOf = (key) => OUTCOMES[key] || { label: key, pill: 'bg-white/10 text-white/70 ring-white/15' };

	const filters = $derived([
		{ key: 'all', label: 'All', count: entries.length },
		{ key: 'paid', label: 'Paid', count: summary.paid },
		{ key: 'in_progress', label: 'In progress', count: summary.inProgress },
		{ key: 'failed', label: 'Failed', count: summary.failed }
	]);

	const filtered = $derived.by(() => {
		let rows = entries;
		if (outcomeFilter !== 'all') rows = rows.filter((e) => e.outcome === outcomeFilter);
		const term = search.trim().toLowerCase();
		if (term) {
			rows = rows.filter(
				(e) =>
					(e.payment.full_name || '').toLowerCase().includes(term) ||
					(e.payment.email || '').toLowerCase().includes(term)
			);
		}
		return rows;
	});

	function formatDate(dateString) {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function formatDateTime(dateString) {
		if (!dateString) return '—';
		return new Date(dateString).toLocaleString('en-AU', {
			day: 'numeric',
			month: 'short',
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	/**
	 * The cohort name usually restates the module name ("Module 4 - A People on
	 * Mission" under "Module 4: A People on Mission"), so only show the second
	 * line when it actually adds something.
	 */
	function cohortLines(payment) {
		const cohort = payment.cohort?.name || '';
		const module = payment.cohort?.module?.name || '';
		const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
		if (!module) return { primary: cohort || '—', secondary: null };
		if (!cohort || normalise(cohort) === normalise(module)) return { primary: module, secondary: null };
		return { primary: module, secondary: cohort };
	}

	const attemptLabel = (n) => `${n} attempts`;
</script>

<div class="p-3 sm:p-4 lg:p-6">
	<div class="py-6 sm:py-8 lg:py-10">
		<div class="max-w-7xl mx-auto">
			<!-- Header -->
			<div class="mb-5 sm:mb-6">
				<h1 class="text-2xl font-bold text-white flex items-center gap-2">
					<Tag size={22} />
					Payments
				</h1>
				<p class="text-sm text-white/50 mt-1">
					One row per registration across this course's cohorts.
				</p>
			</div>

			<!-- Summary -->
			<div class="grid grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3 mb-3">
				<div class="rounded-xl bg-white/[0.07] ring-1 ring-white/10 p-4">
					<p class="text-[10px] font-semibold text-white/45 uppercase tracking-wider">Collected</p>
					<p class="text-2xl font-bold text-white mt-1.5 tabular-nums">
						{formatPrice(summary.totalCents, summary.currency)}
					</p>
					<p class="text-[11px] text-white/40 mt-1">
						{summary.paid} payment{summary.paid === 1 ? '' : 's'}
					</p>
				</div>
				<div class="rounded-xl bg-white/[0.07] ring-1 ring-white/10 p-4">
					<p class="text-[10px] font-semibold text-white/45 uppercase tracking-wider">In progress</p>
					<p class="text-2xl font-bold text-sky-300 mt-1.5 tabular-nums">{summary.inProgress}</p>
					<p class="text-[11px] text-white/40 mt-1">checkout open now</p>
				</div>
				<div class="rounded-xl bg-white/[0.07] ring-1 ring-white/10 p-4">
					<p class="text-[10px] font-semibold text-white/45 uppercase tracking-wider">Failed</p>
					<p class="text-2xl font-bold mt-1.5 tabular-nums {summary.failed > 0 ? 'text-red-300' : 'text-white/70'}">
						{summary.failed}
					</p>
					<p class="text-[11px] text-white/40 mt-1">declined or blocked</p>
				</div>
			</div>

			<div class="mb-5"></div>

			<!-- Controls -->
			<div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
				<div class="flex flex-wrap gap-1.5">
					{#each filters as f}
						<button
							onclick={() => (outcomeFilter = f.key)}
							class="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors {outcomeFilter === f.key
								? 'bg-white text-gray-900'
								: 'bg-white/[0.07] text-white/70 ring-1 ring-white/10 hover:bg-white/[0.12]'}"
						>
							{f.label}
							<span class="opacity-50 tabular-nums">{f.count}</span>
						</button>
					{/each}
				</div>
				<div class="relative sm:ml-auto">
					<Search size={15} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/35" />
					<input
						type="text"
						bind:value={search}
						placeholder="Search payer…"
						class="pl-8 pr-3 py-1.5 text-sm rounded-lg w-full sm:w-64 bg-white/[0.07] ring-1 ring-white/10 text-white placeholder:text-white/35 focus:outline-none focus:ring-2 focus:ring-white/30"
					/>
				</div>
			</div>

			<!-- Table -->
			<div class="rounded-xl bg-white/[0.05] ring-1 ring-white/10 overflow-hidden">
				{#if filtered.length === 0}
					<p class="text-sm text-white/45 text-center py-14">
						{entries.length === 0 ? 'No payments recorded yet.' : 'Nothing matches this filter.'}
					</p>
				{:else}
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead>
								<tr class="border-b border-white/10">
									<th class="px-4 py-3 text-left text-[10px] font-semibold text-white/45 uppercase tracking-wider">Payer</th>
									<th class="px-4 py-3 text-left text-[10px] font-semibold text-white/45 uppercase tracking-wider">Cohort</th>
									<th class="px-4 py-3 text-right text-[10px] font-semibold text-white/45 uppercase tracking-wider">Amount</th>
									<th class="px-4 py-3 text-left text-[10px] font-semibold text-white/45 uppercase tracking-wider">Status</th>
									<th class="px-4 py-3 text-left text-[10px] font-semibold text-white/45 uppercase tracking-wider">Date</th>
									<th class="px-4 py-3 text-right text-[10px] font-semibold text-white/45 uppercase tracking-wider">Invoice</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-white/[0.07]">
								{#each filtered as entry (entry.key)}
									{@const p = entry.payment}
									{@const lines = cohortLines(p)}
									{@const o = outcomeOf(entry.outcome)}
									<tr class="hover:bg-white/[0.04] transition-colors">
										<td class="px-4 py-3 align-top">
											<div class="font-medium text-white">{p.full_name || '—'}</div>
											<div class="text-xs text-white/45">{p.email}</div>
											{#if entry.attemptCount > 1}
												<button
													onclick={() => (expanded = { ...expanded, [entry.key]: !expanded[entry.key] })}
													class="mt-1.5 inline-flex items-center gap-1 text-[11px] text-white/45 hover:text-white/80 transition-colors"
												>
													<ChevronDown
														size={12}
														class="transition-transform {expanded[entry.key] ? 'rotate-180' : ''}"
													/>
													{attemptLabel(entry.attemptCount)}
												</button>
											{/if}
										</td>
										<td class="px-4 py-3 align-top text-white/80">
											<div>{lines.primary}</div>
											{#if lines.secondary}
												<div class="text-xs text-white/40">{lines.secondary}</div>
											{/if}
										</td>
										<td class="px-4 py-3 align-top text-right">
											<span class="font-semibold text-white tabular-nums">
												{formatPrice(p.amount_cents, p.currency)}
											</span>
											{#if p.discount_code}
												<div class="text-[11px] text-emerald-300">
													{p.discount_code}{p.discount_amount_cents
														? ` (−${formatPrice(p.discount_amount_cents, p.currency)})`
														: ''}
												</div>
											{/if}
										</td>
										<td class="px-4 py-3 align-top">
											<span class="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ring-1 {o.pill}">
												{o.label}
											</span>
										</td>
										<td class="px-4 py-3 align-top text-white/55 whitespace-nowrap">
											{formatDate(p.paid_at || p.created_at)}
										</td>
										<td class="px-4 py-3 align-top text-right">
											{#if p.stripe_invoice_url}
												<a
													href={p.stripe_invoice_url}
													target="_blank"
													rel="noopener noreferrer"
													class="inline-flex items-center gap-1 text-xs font-medium text-sky-300 hover:text-sky-200"
												>
													View <ExternalLink size={12} />
												</a>
											{:else}
												<span class="text-white/20">—</span>
											{/if}
										</td>
									</tr>

									{#if expanded[entry.key] && entry.attempts.length > 0}
										<tr class="bg-black/15">
											<td colspan="6" class="px-4 py-3">
												<p class="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-2">
													Earlier checkout attempts
												</p>
												<ul class="space-y-1">
													{#each entry.attempts as a}
														<li class="flex items-center gap-2 text-xs text-white/50">
															<span class="w-1 h-1 rounded-full bg-white/25"></span>
															<span class="tabular-nums">{formatDateTime(a.created_at)}</span>
															<span class="text-white/30">·</span>
															<span>{a.status === 'expired' ? 'session expired' : a.status}</span>
														</li>
													{/each}
												</ul>
											</td>
										</tr>
									{/if}
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>

			<!--
				Incomplete checkouts: nearly always someone filling in the form to see
				the price and leaving. Kept on file, kept out of the way — collapsed by
				default so the ledger above reads as the real numbers.
			-->
			{#if notCompleted.length > 0}
				<div class="mt-3 rounded-xl bg-white/[0.03] ring-1 ring-white/[0.07] overflow-hidden">
					<button
						onclick={() => (showNotCompleted = !showNotCompleted)}
						class="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
					>
						<ChevronDown
							size={14}
							class="text-white/35 transition-transform {showNotCompleted ? 'rotate-180' : ''}"
						/>
						<span class="text-xs font-medium text-white/55">Not completed</span>
						<span class="text-xs text-white/30 tabular-nums">{notCompleted.length}</span>
						<span class="ml-auto text-[11px] text-white/25 hidden sm:block">
							started checkout, never paid
						</span>
					</button>

					{#if showNotCompleted}
						<div class="border-t border-white/[0.07] divide-y divide-white/[0.05]">
							{#each notCompleted as entry (entry.key)}
								{@const p = entry.payment}
								{@const lines = cohortLines(p)}
								<div class="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
									<span class="text-white/60">{p.full_name || '—'}</span>
									<span class="text-white/35">{p.email}</span>
									<span class="text-white/25">{lines.primary}</span>
									<span class="ml-auto flex items-baseline gap-3 text-white/30">
										{#if entry.attemptCount > 1}
											<span>{attemptLabel(entry.attemptCount)}</span>
										{/if}
										<span class="tabular-nums whitespace-nowrap">{formatDate(p.created_at)}</span>
									</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}

			{#if summary.retriesAbsorbed > 0}
				<p class="flex items-start gap-1.5 text-[11px] text-white/30 mt-3">
					<RefreshCw size={12} class="mt-px shrink-0" />
					<span>
						{summary.retriesAbsorbed} expired checkout{summary.retriesAbsorbed === 1 ? '' : 's'} folded into the
						payment{summary.retriesAbsorbed === 1 ? ' it' : 's they'} later completed — reloads and card retries, not separate sales.
					</span>
				</p>
			{/if}

			{#if data.truncated}
				<p class="text-xs text-white/35 mt-3">
					Showing the 500 most recent checkout attempts.
				</p>
			{/if}
		</div>
	</div>
</div>

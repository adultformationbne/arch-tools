<script lang="ts">
	/**
	 * Settings > Analytics: site-wide usage from the first-party tracker
	 * ($lib/analytics/tracker.ts). Platform admins only; everything comes from
	 * GET /api/admin/analytics, which wraps the analytics_overview() database function.
	 */
	import { BarChart3 } from '$lib/icons';
	import AnalyticsDailyChart from './AnalyticsDailyChart.svelte';

	type Totals = {
		visitors: number;
		visits: number;
		pageViews: number;
		medianEngagedSeconds: number;
		signedInVisitors: number;
		videoViews: number;
		watchSeconds: number;
	};
	type Overview = {
		days: number;
		from: string;
		trackingSince: string | null;
		totals: Totals;
		previous: Totals;
		daily: { day: string; visitors: number; pageViews: number; videoViews: number }[];
		courses: { slug: string; name: string | null; visitors: number; pageViews: number; publicPageViews: number; videoViews: number; watchSeconds: number }[];
		videos: { materialId: string | null; playbackId: string; title: string | null; courseSlug: string | null; viewers: number; views: number; watchSeconds: number; durationSeconds: number | null; avgPercentWatched: number | null; completionRate: number }[];
		pages: { host: string; path: string; pageViews: number; visitors: number; medianEngagedSeconds: number }[];
		referrers: { source: string; visits: number; visitors: number }[];
		campaigns: { source: string | null; medium: string | null; campaign: string | null; visits: number }[];
		devices: { device: string; visitors: number }[];
		countries: { country: string; visitors: number }[];
	};

	const RANGES = [
		{ days: 7, label: '7 days' },
		{ days: 30, label: '30 days' },
		{ days: 90, label: '90 days' },
		{ days: 365, label: '12 months' }
	];
	const MAIN_HOST = 'app.archdiocesanministries.org.au';

	let days = $state(30);
	let data = $state<Overview | null>(null);
	let loading = $state(true);
	let failed = $state(false);
	let showAllPages = $state(false);
	const PAGES_SHOWN = 10;

	$effect(() => {
		load(days);
	});

	let requestId = 0;
	async function load(range: number) {
		const id = ++requestId;
		loading = true;
		failed = false;
		try {
			const res = await fetch(`/api/admin/analytics?days=${range}`);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const body = await res.json();
			if (id === requestId) data = body;
		} catch (err) {
			console.error('Error loading analytics:', err);
			if (id === requestId) failed = true;
		} finally {
			if (id === requestId) loading = false;
		}
	}

	// ---- Formatting ----
	const number = new Intl.NumberFormat('en-AU');
	const compact = new Intl.NumberFormat('en-AU', { notation: 'compact', maximumFractionDigits: 1 });
	const fmtNumber = (n: number) => (n >= 10_000 ? compact.format(n) : number.format(n));

	function fmtDuration(seconds: number) {
		if (!seconds) return '0s';
		if (seconds < 60) return `${Math.round(seconds)}s`;
		if (seconds < 3600) {
			const m = Math.floor(seconds / 60);
			const s = Math.round(seconds % 60);
			return s ? `${m}m ${s}s` : `${m}m`;
		}
		const h = Math.floor(seconds / 3600);
		const m = Math.round((seconds % 3600) / 60);
		return m ? `${h}h ${m}m` : `${h}h`;
	}

	const fmtDate = (iso: string) =>
		new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Australia/Brisbane' }).format(new Date(iso));

	/** Change vs the previous period, or null when there is nothing to compare with */
	function change(now: number, before: number) {
		if (!before) return null;
		return Math.round(((now - before) / before) * 100);
	}

	const rangeLabel = $derived(RANGES.find((r) => r.days === days)?.label ?? `${days} days`);
	const trackedPartly = $derived(!!data?.trackingSince && new Date(data.trackingSince) > new Date(data.from));

	const tiles = $derived(
		data
			? [
					{ label: 'Visitors', value: fmtNumber(data.totals.visitors), now: data.totals.visitors, before: data.previous.visitors, hint: `${fmtNumber(data.totals.signedInVisitors)} signed in` },
					{ label: 'Visits', value: fmtNumber(data.totals.visits), now: data.totals.visits, before: data.previous.visits },
					{ label: 'Page views', value: fmtNumber(data.totals.pageViews), now: data.totals.pageViews, before: data.previous.pageViews },
					{ label: 'Typical time on page', value: fmtDuration(data.totals.medianEngagedSeconds), now: data.totals.medianEngagedSeconds, before: data.previous.medianEngagedSeconds, hint: 'Median, tab visible' },
					{ label: 'Video views', value: fmtNumber(data.totals.videoViews), now: data.totals.videoViews, before: data.previous.videoViews },
					{ label: 'Watch time', value: fmtDuration(data.totals.watchSeconds), now: data.totals.watchSeconds, before: data.previous.watchSeconds, hint: 'Distinct seconds seen' }
				]
			: []
	);

	const courseName = (slug: string | null) =>
		(slug && data?.courses.find((c) => c.slug === slug)?.name) || slug || '—';

	function videoTitle(v: Overview['videos'][number]) {
		if (v.title) return v.title;
		return v.playbackId.startsWith('youtube:') ? `YouTube ${v.playbackId.slice(8)}` : 'Untitled video';
	}

	const share = (n: number, list: { visitors: number }[]) => {
		const total = list.reduce((sum, x) => sum + x.visitors, 0);
		return total ? Math.round((n / total) * 100) : 0;
	};

	const countryName = (code: string) => {
		if (code === '??') return 'Unknown';
		try {
			return new Intl.DisplayNames(['en-AU'], { type: 'region' }).of(code) ?? code;
		} catch {
			return code;
		}
	};

	const th = 'px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider';
	const thNum = 'px-4 sm:px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider';
	const td = 'px-4 sm:px-6 py-3 text-sm text-gray-900';
	const tdNum = 'px-4 sm:px-6 py-3 text-sm text-gray-900 text-right tabular-nums';
</script>

<!-- Header -->
<div class="px-8 py-8 border-b border-gray-200 bg-gray-50">
	<div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
		<div>
			<h2 class="text-2xl font-bold text-gray-900 flex items-center">
				<BarChart3 class="h-6 w-6 mr-3" />
				Analytics
			</h2>
			<p class="mt-2 text-sm text-gray-600">
				Site-wide usage: visitors, public course pages and course videos
			</p>
		</div>
		<div class="inline-flex self-start rounded border border-gray-300 bg-white p-1" role="group" aria-label="Date range">
			{#each RANGES as r (r.days)}
				<button
					type="button"
					onclick={() => (days = r.days)}
					aria-pressed={days === r.days}
					class="px-3 sm:px-4 py-2 rounded text-xs font-bold uppercase tracking-wide transition-colors {days === r.days
						? 'bg-gray-900 text-white'
						: 'text-gray-700 hover:bg-gray-100'}"
				>
					{r.label}
				</button>
			{/each}
		</div>
	</div>
	{#if data && trackedPartly && data.trackingSince}
		<p class="mt-4 text-xs text-gray-600">
			Tracking began on {fmtDate(data.trackingSince)}, so earlier days in this range have no data.
		</p>
	{/if}
</div>

{#if failed}
	<div class="px-8 py-16 text-center">
		<p class="text-sm text-gray-700">Analytics could not be loaded.</p>
		<button
			type="button"
			onclick={() => load(days)}
			class="mt-4 inline-flex items-center px-6 py-3 border border-gray-900 text-sm font-bold uppercase tracking-wide text-gray-900 rounded hover:bg-gray-100 transition-colors"
		>
			Try again
		</button>
	</div>
{:else if !data}
	<div class="px-8 py-16 text-center text-sm text-gray-500">Loading analytics…</div>
{:else}
	<div class="transition-opacity {loading ? 'opacity-50' : ''}" aria-busy={loading}>
		<!-- Headline figures -->
		<div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 border-b border-gray-200">
			{#each tiles as tile (tile.label)}
				{@const delta = change(tile.now, tile.before)}
				<div class="px-6 py-6 border-gray-200 border-r border-b xl:border-b-0">
					<p class="text-xs font-bold text-gray-600 uppercase tracking-wide">{tile.label}</p>
					<p class="mt-2 text-2xl font-bold text-gray-900 tabular-nums">{tile.value}</p>
					<p class="mt-1 text-xs text-gray-600">
						{#if delta === null}
							<span class="text-gray-500">No earlier data to compare</span>
						{:else}
							<span class="font-semibold {delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-700' : 'text-gray-700'}">
								{delta > 0 ? '▲' : delta < 0 ? '▼' : '■'}
								{Math.abs(delta)}%
							</span>
							vs previous {rangeLabel}
						{/if}
					</p>
					{#if tile.hint}
						<p class="mt-1 text-xs text-gray-500">{tile.hint}</p>
					{/if}
				</div>
			{/each}
		</div>

		<!-- Visitors over time -->
		<section class="px-8 py-8 border-b border-gray-200">
			<h3 class="text-xs font-bold text-gray-900 uppercase tracking-wide mb-4">
				Visitors per {data.daily.length > 92 ? 'week' : 'day'}
			</h3>
			<AnalyticsDailyChart daily={data.daily} />
		</section>

		<!-- Courses -->
		<section class="border-b border-gray-200">
			<h3 class="px-8 pt-8 pb-4 text-xs font-bold text-gray-900 uppercase tracking-wide">Courses</h3>
			{#if data.courses.length === 0}
				<p class="px-8 pb-8 text-sm text-gray-500">No course activity in this range.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="{th} pl-8">Course</th>
								<th class={thNum}>Visitors</th>
								<th class={thNum}>Page views</th>
								<th class={thNum}>Public guide views</th>
								<th class={thNum}>Video views</th>
								<th class="{thNum} pr-8">Watch time</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-100">
							{#each data.courses as c (c.slug)}
								<tr>
									<td class="{td} pl-8 font-medium min-w-48">{c.name ?? c.slug}</td>
									<td class={tdNum}>{fmtNumber(c.visitors)}</td>
									<td class={tdNum}>{fmtNumber(c.pageViews)}</td>
									<td class={tdNum}>{fmtNumber(c.publicPageViews)}</td>
									<td class={tdNum}>{fmtNumber(c.videoViews)}</td>
									<td class="{tdNum} pr-8">{fmtDuration(c.watchSeconds)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		<!-- Videos -->
		<section class="border-b border-gray-200">
			<div class="px-8 pt-8 pb-4">
				<h3 class="text-xs font-bold text-gray-900 uppercase tracking-wide">Videos</h3>
				<p class="mt-1 text-xs text-gray-600">
					“Watched” counts distinct parts of the video seen, so rewatching does not add to it. Completed means 90% or more watched.
				</p>
			</div>
			{#if data.videos.length === 0}
				<p class="px-8 pb-8 text-sm text-gray-500">No videos were played in this range.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="{th} pl-8">Video</th>
								<th class={thNum}>Viewers</th>
								<th class={th}>Avg watched</th>
								<th class={thNum}>Completed</th>
								<th class="{thNum} pr-8">Watch time</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-100">
							{#each data.videos as v (v.materialId ?? v.playbackId)}
								<tr>
									<td class="{td} pl-8 min-w-56">
										<p class="font-medium">{videoTitle(v)}</p>
										<p class="text-xs text-gray-500">
											{courseName(v.courseSlug)}{#if v.durationSeconds}&nbsp;· {fmtDuration(v.durationSeconds)} long{/if}
										</p>
									</td>
									<td class={tdNum}>
										{fmtNumber(v.viewers)}
										{#if v.views > v.viewers}<span class="block text-xs text-gray-500">{fmtNumber(v.views)} views</span>{/if}
									</td>
									<td class={td}>
										{#if v.avgPercentWatched !== null}
											<div class="flex items-center gap-3 min-w-36">
												<div class="h-2 flex-1 rounded-full bg-gray-200" aria-hidden="true">
													<div class="h-2 rounded-full bg-gray-900" style="width: {v.avgPercentWatched}%"></div>
												</div>
												<span class="tabular-nums w-10 text-right">{v.avgPercentWatched}%</span>
											</div>
										{:else}
											<span class="text-gray-500">—</span>
										{/if}
									</td>
									<td class={tdNum}>{v.completionRate}%</td>
									<td class="{tdNum} pr-8">{fmtDuration(v.watchSeconds)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>

		<!-- Top pages -->
		<section class="border-b border-gray-200">
			<div class="px-8 pt-8 pb-4">
				<h3 class="text-xs font-bold text-gray-900 uppercase tracking-wide">Top pages</h3>
				<p class="mt-1 text-xs text-gray-600">Pages that differ only by an ID (one per reflection question, video, …) are combined as “…”.</p>
			</div>
			{#if data.pages.length === 0}
				<p class="px-8 pb-8 text-sm text-gray-500">No page views in this range.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th class="{th} pl-8">Page</th>
								<th class={thNum}>Views</th>
								<th class={thNum}>Visitors</th>
								<th class="{thNum} pr-8">Typical time</th>
							</tr>
						</thead>
						<tbody class="bg-white divide-y divide-gray-100">
							{#each showAllPages ? data.pages : data.pages.slice(0, PAGES_SHOWN) as p (p.host + p.path)}
								<tr>
									<td class="{td} pl-8 font-mono text-xs break-all min-w-56">
										{#if p.host !== MAIN_HOST}<span class="text-gray-500">{p.host}</span>{/if}{p.path}
									</td>
									<td class={tdNum}>{fmtNumber(p.pageViews)}</td>
									<td class={tdNum}>{fmtNumber(p.visitors)}</td>
									<td class="{tdNum} pr-8">{fmtDuration(p.medianEngagedSeconds)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
				{#if data.pages.length > PAGES_SHOWN}
					<div class="px-8 py-4 border-t border-gray-100">
						<button
							type="button"
							onclick={() => (showAllPages = !showAllPages)}
							class="text-xs font-bold uppercase tracking-wide text-gray-700 hover:text-gray-900"
						>
							{showAllPages ? 'Show fewer' : `Show all ${data.pages.length}`}
						</button>
					</div>
				{/if}
			{/if}
		</section>

		<!-- Sources, devices, countries -->
		<div class="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
			<section class="px-8 py-8">
				<h3 class="text-xs font-bold text-gray-900 uppercase tracking-wide mb-4">Where visits came from</h3>
				<ul class="space-y-2">
					{#each data.referrers as r (r.source)}
						<li class="flex items-baseline justify-between gap-4 text-sm">
							<span class="text-gray-900 break-all">{r.source}</span>
							<span class="tabular-nums text-gray-700">{fmtNumber(r.visits)}</span>
						</li>
					{:else}
						<li class="text-sm text-gray-500">No visits in this range.</li>
					{/each}
				</ul>
				{#if data.campaigns.length}
					<h4 class="mt-6 mb-2 text-xs font-bold text-gray-600 uppercase tracking-wide">Campaign links</h4>
					<ul class="space-y-2">
						{#each data.campaigns as c, i (i)}
							<li class="flex items-baseline justify-between gap-4 text-sm">
								<span class="text-gray-900 break-all">
									{c.campaign ?? c.source}
									<span class="text-xs text-gray-500">{[c.source, c.medium].filter(Boolean).join(' / ')}</span>
								</span>
								<span class="tabular-nums text-gray-700">{fmtNumber(c.visits)}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			<section class="px-8 py-8">
				<h3 class="text-xs font-bold text-gray-900 uppercase tracking-wide mb-4">Devices</h3>
				<ul class="space-y-3">
					{#each data.devices as d (d.device)}
						{@const pct = share(d.visitors, data.devices)}
						<li class="text-sm">
							<div class="flex justify-between mb-1">
								<span class="capitalize text-gray-900">{d.device}</span>
								<span class="tabular-nums text-gray-700">{pct}%</span>
							</div>
							<div class="h-2 rounded-full bg-gray-200" aria-hidden="true">
								<div class="h-2 rounded-full bg-gray-900" style="width: {pct}%"></div>
							</div>
						</li>
					{:else}
						<li class="text-sm text-gray-500">No visitors in this range.</li>
					{/each}
				</ul>
			</section>

			<section class="px-8 py-8">
				<h3 class="text-xs font-bold text-gray-900 uppercase tracking-wide mb-4">Countries</h3>
				<ul class="space-y-2">
					{#each data.countries as c (c.country)}
						<li class="flex items-baseline justify-between gap-4 text-sm">
							<span class="text-gray-900">{countryName(c.country)}</span>
							<span class="tabular-nums text-gray-700">
								{fmtNumber(c.visitors)}
								<span class="text-xs text-gray-500">({share(c.visitors, data.countries)}%)</span>
							</span>
						</li>
					{:else}
						<li class="text-sm text-gray-500">No visitors in this range.</li>
					{/each}
				</ul>
			</section>
		</div>
	</div>
{/if}

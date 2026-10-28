<script lang="ts">
	/**
	 * Visitors over time as columns, one per day (or per week for long ranges), with a
	 * hover tooltip carrying that bucket's visitors, page views and video views.
	 * Single series, so no legend: the section heading names what is plotted.
	 */
	type Day = { day: string; visitors: number; pageViews: number; videoViews: number };
	type Bucket = Day & { label: string };

	let { daily = [] as Day[] } = $props();

	const HEIGHT = 180;
	const AXIS_W = 36;
	const BAR_MAX = 24;
	const GAP = 2;
	// Room above the plot for the top axis label
	const TOP = 8;

	let width = $state(600);
	let hovered = $state<number | null>(null);

	const dateFmt = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
	const fmt = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

	// Over ~3 months, days get too thin to read or hover: fold them into weeks.
	// Visitors per week is the sum of daily visitors, so a returning visitor counts once a day.
	const buckets = $derived.by((): Bucket[] => {
		if (daily.length <= 92) return daily.map((d) => ({ ...d, label: fmt(d.day) }));
		// Count weeks back from today so the latest bar is a whole week, not a stub
		const weeks: Bucket[] = [];
		for (let end = daily.length; end > 0; end -= 7) {
			const chunk = daily.slice(Math.max(0, end - 7), end);
			weeks.push({
				day: chunk[0].day,
				label: `${fmt(chunk[0].day)} – ${fmt(chunk[chunk.length - 1].day)}`,
				visitors: chunk.reduce((n, d) => n + d.visitors, 0),
				pageViews: chunk.reduce((n, d) => n + d.pageViews, 0),
				videoViews: chunk.reduce((n, d) => n + d.videoViews, 0)
			});
		}
		return weeks.reverse();
	});
	const weekly = $derived(daily.length > 92);

	// Round the top of the axis up to a clean number
	const yMax = $derived.by(() => {
		const max = Math.max(1, ...buckets.map((b) => b.visitors));
		const step = 10 ** Math.floor(Math.log10(max));
		const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((v) => v >= max) ?? max;
		return Math.max(nice, 4);
	});
	const ticks = $derived([0, yMax / 2, yMax]);

	const plotW = $derived(Math.max(width - AXIS_W, 50));
	const slot = $derived(plotW / Math.max(buckets.length, 1));
	const barW = $derived(Math.max(Math.min(slot - GAP, BAR_MAX), 1));
	const y = (v: number) => HEIGHT - (v / yMax) * (HEIGHT - TOP);

	// Label a handful of x positions, never every bar: about one per 70px
	const labelEvery = $derived(Math.max(1, Math.ceil(buckets.length / Math.max(2, Math.floor(plotW / 70)))));

	/** Column path: square at the baseline, 4px rounded data-end */
	function column(x: number, top: number, w: number) {
		const h = HEIGHT - top;
		if (h <= 0) return '';
		const r = Math.min(4, w / 2, h);
		return `M${x},${HEIGHT} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${HEIGHT} Z`;
	}

	const compact = (n: number) => new Intl.NumberFormat('en-AU', { notation: 'compact' }).format(n);
	const tip = $derived(hovered !== null ? buckets[hovered] : null);
	const tipLeft = $derived(hovered !== null ? AXIS_W + slot * hovered + slot / 2 : 0);
</script>

<div class="relative" bind:clientWidth={width}>
	<svg
		width={width}
		height={HEIGHT + 28}
		role="img"
		aria-label="{weekly ? 'Weekly' : 'Daily'} visitors"
		onmouseleave={() => (hovered = null)}
	>
		<!-- Gridlines + y-axis labels -->
		{#each ticks as t (t)}
			<line x1={AXIS_W} x2={width} y1={y(t)} y2={y(t)} class="stroke-gray-200" stroke-width="1" />
			<text x={AXIS_W - 8} y={y(t)} dy="0.32em" text-anchor="end" class="fill-gray-500 text-[11px]">{compact(t)}</text>
		{/each}

		{#each buckets as b, i (b.day)}
			{@const x = AXIS_W + slot * i + (slot - barW) / 2}
			<path d={column(x, y(b.visitors), barW)} class={hovered === null || hovered === i ? 'fill-gray-900' : 'fill-gray-300'} />
			<!-- Hit target: the whole slot, full height -->
			<rect
				x={AXIS_W + slot * i}
				y="0"
				width={slot}
				height={HEIGHT}
				fill="transparent"
				role="presentation"
				onmouseenter={() => (hovered = i)}
			/>
			<!-- Counted from the latest bar so today is always labelled; skip any that would clip -->
			{#if (buckets.length - 1 - i) % labelEvery === 0 && AXIS_W + slot * i + slot / 2 > AXIS_W + 20}
				<text
					x={i === buckets.length - 1 ? width : AXIS_W + slot * i + slot / 2}
					y={HEIGHT + 18}
					text-anchor={i === buckets.length - 1 ? 'end' : 'middle'}
					class="fill-gray-500 text-[11px]"
				>
					{fmt(b.day)}
				</text>
			{/if}
		{/each}
	</svg>

	{#if tip}
		<div
			class="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded border border-gray-200 bg-white px-3 py-2 text-xs shadow-sm whitespace-nowrap"
			style="left: {Math.min(Math.max(tipLeft, 80), width - 80)}px"
		>
			<p class="font-bold text-gray-900 mb-1">{tip.label}</p>
			<p class="text-gray-700"><span class="font-semibold text-gray-900">{tip.visitors}</span> {weekly ? 'daily visitors, added up' : 'visitors'}</p>
			<p class="text-gray-700"><span class="font-semibold text-gray-900">{tip.pageViews}</span> page views</p>
			<p class="text-gray-700"><span class="font-semibold text-gray-900">{tip.videoViews}</span> video views</p>
		</div>
	{/if}
</div>

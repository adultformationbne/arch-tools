<script>
	import { brisbaneToday, getTileStatus, tilesForDate } from '$lib/utils/dgr-promo-tiles.js';

	let {
		tiles = [],
		savingState = false,
		onSave = () => {},
		onAddTile = () => {},
		onRemoveTile = () => {},
		/** DGR posts dated today or later, from /api/dgr-admin/promo-tiles/sync */
		upcomingPosts = [],
		upcomingLoading = false,
		upcomingError = null,
		syncingState = false,
		onSyncPosts = () => {},
		onRefreshUpcoming = () => {}
	} = $props();

	const today = brisbaneToday();

	const activeTiles = $derived(tilesForDate(tiles, today));
	// Posts we can push the new tiles into; posts with an error have no anchor to swap
	const stalePosts = $derived(upcomingPosts.filter((p) => p.stale && !p.error));
	const blockedPosts = $derived(upcomingPosts.filter((p) => p.error));

	const statusConfig = {
		active: { label: 'Active', class: 'bg-green-100 text-green-800' },
		no_expiry: { label: 'No expiry', class: 'bg-blue-100 text-blue-700' },
		expiring_soon: { label: 'Expiring soon', class: 'bg-amber-100 text-amber-800' },
		scheduled: { label: 'Scheduled', class: 'bg-purple-100 text-purple-800' },
		expired: { label: 'Expired', class: 'bg-red-100 text-red-700' },
		empty: { label: 'No image', class: 'bg-gray-100 text-gray-500' }
	};

	function formatDate(iso) {
		if (!iso) return '';
		const d = new Date(iso + 'T00:00:00');
		return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' });
	}

	function windowLabel(tile) {
		if (tile.starts_at && tile.expires_at) return `${formatDate(tile.starts_at)} – ${formatDate(tile.expires_at)}`;
		if (tile.starts_at) return `From ${formatDate(tile.starts_at)}`;
		if (tile.expires_at) return `Until ${formatDate(tile.expires_at)}`;
		return 'Always';
	}
</script>

<div class="space-y-8">
	<!-- Live preview of what will actually publish -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h3 class="text-base font-semibold text-gray-900">Publishing today</h3>
				<p class="mt-0.5 text-sm text-gray-500">These tiles appear on a reflection dated {formatDate(today)}</p>
			</div>
			<span class="text-sm font-medium text-gray-500">{activeTiles.length} of 3</span>
		</div>

		{#if activeTiles.length === 0}
			<div class="rounded-lg border-2 border-dashed border-gray-200 py-10 text-center">
				<p class="text-sm text-gray-400">No active tiles today — none will be published</p>
			</div>
		{:else}
			<div class="flex flex-wrap gap-4">
				{#each activeTiles as tile}
					<div class="flex flex-col items-center gap-2">
						<img
							src={tile.image_url}
							alt={tile.title || 'Promo tile'}
							class="h-28 w-28 rounded-lg border border-gray-200 object-cover shadow-sm"
							onerror={(e) => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.display = 'none'; }}
						/>
						{#if tile.title}
							<span class="max-w-28 truncate text-center text-xs text-gray-600">{tile.title}</span>
						{/if}
						<span class="text-xs text-gray-400">{windowLabel(tile)}</span>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Already-published posts -->
	<div class="rounded-lg border p-6 shadow-sm {stalePosts.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}">
		<div class="mb-3 flex flex-wrap items-start justify-between gap-3">
			<div>
				<h3 class="text-base font-semibold text-gray-900">Already on WordPress</h3>
				<p class="mt-0.5 text-sm text-gray-600">
					Saving tiles never changes posts that are already published or scheduled.
					{#if stalePosts.length > 0}
						<strong>{stalePosts.length} post{stalePosts.length === 1 ? '' : 's'}</strong> from today onward
						{stalePosts.length === 1 ? 'shows' : 'show'} different tiles to what you have saved.
					{:else if upcomingPosts.length > 0}
						All {upcomingPosts.length} post{upcomingPosts.length === 1 ? '' : 's'} from today onward match the saved tiles.
					{/if}
					{#if blockedPosts.length > 0}
						{blockedPosts.length} post{blockedPosts.length === 1 ? '' : 's'} cannot be updated automatically and must be edited in WordPress.
					{/if}
				</p>
			</div>
			<div class="flex items-center gap-2">
				<button
					onclick={() => onRefreshUpcoming()}
					disabled={upcomingLoading || syncingState}
					class="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
				>
					{upcomingLoading ? 'Checking…' : 'Re-check'}
				</button>
				{#if stalePosts.length > 0}
					<button
						onclick={() => onSyncPosts(stalePosts.map((p) => p.id))}
						disabled={syncingState || upcomingLoading}
						class="rounded-md bg-amber-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{syncingState
							? 'Updating…'
							: `Update ${stalePosts.length} post${stalePosts.length === 1 ? '' : 's'}`}
					</button>
				{/if}
			</div>
		</div>

		{#if upcomingError}
			<p class="text-sm text-red-600">Could not reach WordPress: {upcomingError}</p>
		{:else if upcomingLoading && upcomingPosts.length === 0}
			<p class="text-sm text-gray-400">Checking published posts…</p>
		{:else if upcomingPosts.length === 0}
			<p class="text-sm text-gray-400">No published or scheduled reflections from today onward.</p>
		{:else}
			<ul class="divide-y divide-gray-200/70 text-sm">
				{#each upcomingPosts as post}
					<li class="flex flex-wrap items-center justify-between gap-2 py-2">
						<div class="flex items-center gap-3">
							<span class="inline-block h-2 w-2 rounded-full {post.error ? 'bg-red-500' : post.stale ? 'bg-amber-500' : 'bg-green-500'}"></span>
							<a href={post.link} target="_blank" rel="noopener" class="font-medium text-gray-800 hover:underline">
								{post.title}
							</a>
							<span class="rounded-full px-2 py-0.5 text-xs {post.status === 'future' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}">
								{post.status === 'future' ? 'Scheduled' : 'Published'}
							</span>
						</div>
						<div class="flex items-center gap-2">
							{#if post.tiles.length === 0}
								<span class="text-xs text-gray-400">No tiles</span>
							{:else}
								{#each post.tiles as tile}
									<img
										src={tile.image_url}
										alt={tile.title || 'Tile'}
										title={tile.title}
										class="h-8 w-8 rounded border border-gray-200 object-cover"
									/>
								{/each}
							{/if}
							<span
								class="ml-2 text-xs {post.error ? 'font-medium text-red-700' : post.stale ? 'font-medium text-amber-700' : 'text-gray-400'}"
								title={post.error || ''}
							>
								{post.error ? 'Cannot update' : post.stale ? 'Needs update' : 'Up to date'}
							</span>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<!-- Tile management -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h3 class="text-base font-semibold text-gray-900">Manage Tiles</h3>
				<p class="mt-0.5 text-sm text-gray-500">
					Up to 3 tiles. A start date holds a tile back until that day's reflection; an expiry date retires it after that day.
				</p>
			</div>
		</div>

		<div class="space-y-5">
			{#each tiles as tile, index}
				{@const status = getTileStatus(tile, today)}
				{@const isExpired = status === 'expired'}
				{@const badDates = tile.starts_at && tile.expires_at && tile.starts_at > tile.expires_at}
				<div class="rounded-lg border p-4 {isExpired ? 'border-red-200 bg-red-50/40 opacity-75' : 'border-gray-200 bg-gray-50'}">
					<div class="mb-3 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-gray-800">Tile {index + 1}</span>
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusConfig[status].class}">
								{statusConfig[status].label}
							</span>
							{#if tile.image_url}
								<span class="text-xs text-gray-400">{windowLabel(tile)}</span>
							{/if}
						</div>
						{#if tiles.length > 1}
							<button
								onclick={() => onRemoveTile(index)}
								class="text-sm font-medium text-red-500 hover:text-red-700"
							>
								Remove
							</button>
						{/if}
					</div>

					<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<!-- Image URL spans full width -->
						<div class="sm:col-span-2">
							<label for="tile-{index}-image" class="block text-sm font-medium text-gray-700">
								Image URL
							</label>
							<input
								id="tile-{index}-image"
								type="text"
								bind:value={tile.image_url}
								placeholder="https://archdiocesanministries.org.au/wp-content/uploads/..."
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							/>
						</div>

						<div>
							<label for="tile-{index}-title" class="block text-sm font-medium text-gray-700">
								Title <span class="font-normal text-gray-400">(optional)</span>
							</label>
							<input
								id="tile-{index}-title"
								type="text"
								bind:value={tile.title}
								placeholder="Event name"
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							/>
						</div>

						<div>
							<label for="tile-{index}-link" class="block text-sm font-medium text-gray-700">
								Link URL <span class="font-normal text-gray-400">(optional)</span>
							</label>
							<input
								id="tile-{index}-link"
								type="text"
								bind:value={tile.link_url}
								placeholder="https://..."
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							/>
						</div>

						<div>
							<label for="tile-{index}-starts" class="block text-sm font-medium text-gray-700">
								Start date <span class="font-normal text-gray-400">(optional)</span>
							</label>
							<input
								id="tile-{index}-starts"
								type="date"
								bind:value={tile.starts_at}
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							/>
							<p class="mt-1 text-xs text-gray-400">Leave blank to start immediately. Reflections dated earlier are never changed.</p>
						</div>

						<div>
							<label for="tile-{index}-expires" class="block text-sm font-medium text-gray-700">
								Expiry date <span class="font-normal text-gray-400">(optional)</span>
							</label>
							<input
								id="tile-{index}-expires"
								type="date"
								bind:value={tile.expires_at}
								min={tile.starts_at || undefined}
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							/>
							<p class="mt-1 text-xs {badDates ? 'text-red-600' : 'text-gray-400'}">
								{badDates ? 'Expiry must be on or after the start date' : 'Last day the tile is shown'}
							</p>
						</div>

						{#if tile.image_url}
							<div class="flex items-end sm:col-span-2">
								<img
									src={tile.image_url}
									alt={tile.title || 'Promo tile ' + (index + 1)}
									class="h-20 w-20 rounded-lg border border-gray-300 object-cover"
									onerror={(e) => { if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.display = 'none'; }}
								/>
							</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<div class="mt-6 flex items-center justify-between">
			<div class="flex items-center gap-3">
				{#if tiles.length < 3}
					<button
						onclick={() => onAddTile()}
						class="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
					>
						+ Add tile
					</button>
				{/if}
				<span class="text-sm text-gray-400">{tiles.length} of 3 tiles</span>
			</div>
			<button
				onclick={() => onSave(tiles)}
				disabled={savingState}
				class="rounded-md bg-blue-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
			>
				{savingState ? 'Saving...' : 'Save tiles'}
			</button>
		</div>
	</div>
</div>

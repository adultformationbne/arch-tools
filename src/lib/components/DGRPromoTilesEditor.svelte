<script>
	let {
		tiles = [],
		savingState = false,
		onSave = () => {},
		onAddTile = () => {},
		onRemoveTile = () => {}
	} = $props();

	const today = new Date().toISOString().split('T')[0];

	function getTileStatus(tile) {
		if (!tile.image_url) return 'empty';
		if (!tile.expires_at) return 'no_expiry';
		if (tile.expires_at < today) return 'expired';
		const ms = new Date(tile.expires_at) - new Date(today);
		const days = Math.ceil(ms / (1000 * 60 * 60 * 24));
		if (days <= 7) return 'expiring_soon';
		return 'active';
	}

	const activeTiles = $derived(
		tiles.filter((t) => {
			const s = getTileStatus(t);
			return s === 'active' || s === 'no_expiry' || s === 'expiring_soon';
		})
	);

	const statusConfig = {
		active: { label: 'Active', class: 'bg-green-100 text-green-800' },
		no_expiry: { label: 'No expiry', class: 'bg-blue-100 text-blue-700' },
		expiring_soon: { label: 'Expiring soon', class: 'bg-amber-100 text-amber-800' },
		expired: { label: 'Expired', class: 'bg-red-100 text-red-700' },
		empty: { label: 'No image', class: 'bg-gray-100 text-gray-500' }
	};
</script>

<div class="space-y-8">
	<!-- Live preview of what will actually publish -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h3 class="text-base font-semibold text-gray-900">Currently Publishing</h3>
				<p class="mt-0.5 text-sm text-gray-500">These tiles will appear in the next DGR</p>
			</div>
			<span class="text-sm font-medium text-gray-500">{activeTiles.length} of 3</span>
		</div>

		{#if activeTiles.length === 0}
			<div class="rounded-lg border-2 border-dashed border-gray-200 py-10 text-center">
				<p class="text-sm text-gray-400">No active tiles — none will be published</p>
			</div>
		{:else}
			<div class="flex flex-wrap gap-4">
				{#each activeTiles as tile}
					<div class="flex flex-col items-center gap-2">
						<img
							src={tile.image_url}
							alt={tile.title || 'Promo tile'}
							class="h-28 w-28 rounded-lg border border-gray-200 object-cover shadow-sm"
							onerror={(e) => (e.target.style.display = 'none')}
						/>
						{#if tile.title}
							<span class="max-w-28 truncate text-center text-xs text-gray-600">{tile.title}</span>
						{/if}
						{#if tile.expires_at}
							<span class="text-xs text-gray-400">Expires {tile.expires_at}</span>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Tile management -->
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h3 class="text-base font-semibold text-gray-900">Manage Tiles</h3>
				<p class="mt-0.5 text-sm text-gray-500">Up to 3 tiles. Add an expiry date to retire a tile automatically.</p>
			</div>
		</div>

		<div class="space-y-5">
			{#each tiles as tile, index}
				{@const status = getTileStatus(tile)}
				{@const isExpired = status === 'expired'}
				<div class="rounded-lg border p-4 {isExpired ? 'border-red-200 bg-red-50/40 opacity-75' : 'border-gray-200 bg-gray-50'}">
					<div class="mb-3 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-sm font-medium text-gray-800">Tile {index + 1}</span>
							<span class="rounded-full px-2 py-0.5 text-xs font-medium {statusConfig[status].class}">
								{statusConfig[status].label}
							</span>
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
							<label for="tile-{tile.position}-image" class="block text-sm font-medium text-gray-700">
								Image URL
							</label>
							<input
								id="tile-{tile.position}-image"
								type="text"
								bind:value={tile.image_url}
								placeholder="https://archdiocesanministries.org.au/wp-content/uploads/..."
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							/>
						</div>

						<div>
							<label for="tile-{tile.position}-title" class="block text-sm font-medium text-gray-700">
								Title <span class="font-normal text-gray-400">(optional)</span>
							</label>
							<input
								id="tile-{tile.position}-title"
								type="text"
								bind:value={tile.title}
								placeholder="Event name"
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							/>
						</div>

						<div>
							<label for="tile-{tile.position}-link" class="block text-sm font-medium text-gray-700">
								Link URL <span class="font-normal text-gray-400">(optional)</span>
							</label>
							<input
								id="tile-{tile.position}-link"
								type="text"
								bind:value={tile.link_url}
								placeholder="https://..."
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							/>
						</div>

						<div>
							<label for="tile-{tile.position}-expires" class="block text-sm font-medium text-gray-700">
								Expiry date <span class="font-normal text-gray-400">(optional)</span>
							</label>
							<input
								id="tile-{tile.position}-expires"
								type="date"
								bind:value={tile.expires_at}
								class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							/>
							<p class="mt-1 text-xs text-gray-400">Tile will stop publishing after this date</p>
						</div>

						{#if tile.image_url}
							<div class="flex items-end">
								<img
									src={tile.image_url}
									alt={tile.title || 'Promo tile ' + tile.position}
									class="h-20 w-20 rounded-lg border border-gray-300 object-cover"
									onerror={(e) => (e.target.style.display = 'none')}
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
						onclick={onAddTile}
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

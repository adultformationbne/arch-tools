<script>
	let {
		tiles = [],
		savingState = false,
		onSave = () => {},
		onAddTile = () => {},
		onRemoveTile = () => {}
	} = $props();

	function handleSave() {
		onSave(tiles);
	}

	function handleAddTile() {
		onAddTile();
	}

	function handleRemoveTile(index) {
		onRemoveTile(index);
	}
</script>

<div class="space-y-6">
	<div class="rounded-lg bg-white p-6 shadow">
		<h3 class="mb-4 text-lg font-medium text-gray-900">Promotional Event Tiles</h3>
		<p class="mb-6 text-sm text-gray-600">
			Manage the promotional tiles that appear at the bottom of Daily Gospel Reflections.
			Enter WordPress media URLs for each tile position.
		</p>

		<div class="space-y-6">
			{#each tiles as tile, index}
				<div class="border rounded-lg p-4 bg-gray-50">
					<div class="flex items-center justify-between mb-3">
						<h4 class="font-medium text-gray-900">Tile {index + 1}</h4>
						{#if tiles.length > 1}
							<button
								onclick={() => handleRemoveTile(index)}
								class="text-red-600 hover:text-red-800 text-sm font-medium"
							>
								Remove
							</button>
						{/if}
					</div>

					<div class="grid grid-cols-1 gap-4">
						<div>
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

						<div class="grid grid-cols-2 gap-4">
							<div>
								<label for="tile-{tile.position}-title" class="block text-sm font-medium text-gray-700">
									Title (optional)
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
									Link URL (optional)
								</label>
								<input
									id="tile-{tile.position}-link"
									type="text"
									bind:value={tile.link_url}
									placeholder="https://..."
									class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
								/>
							</div>
						</div>

						{#if tile.image_url}
							<div class="mt-3">
								<p class="text-sm font-medium text-gray-700 mb-2">Preview:</p>
								<img
									src={tile.image_url}
									alt={tile.title || 'Promo tile ' + tile.position}
									class="h-32 w-32 object-cover rounded-lg border border-gray-300"
									onerror={(e) => e.target.style.display = 'none'}
								/>
							</div>
						{/if}
					</div>
				</div>
			{/each}

			{#if tiles.length < 3}
				<div class="text-center">
					<button
						onclick={handleAddTile}
						class="inline-flex items-center rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
					>
						+ Add Another Tile
					</button>
				</div>
			{/if}

			<div class="flex justify-between items-center mt-6">
				<div class="text-sm text-gray-500">
					{tiles.length} of 3 tiles
				</div>
				<button
					onclick={handleSave}
					disabled={savingState}
					class="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
				>
					{savingState ? 'Saving...' : 'Save Promo Tiles'}
				</button>
			</div>
		</div>
	</div>
</div>
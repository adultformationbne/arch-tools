<script>
	import { toast, DURATIONS } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGRPromoTilesEditor from '$lib/components/DGRPromoTilesEditor.svelte';

	let promoTiles = $state([{ position: 1, image_url: '', title: '', link_url: '' }]);
	let savingTiles = $state(false);
	let loading = $state(true);

	$effect(() => {
		(async () => {
			await loadPromoTiles();
			loading = false;
		})();
	});

	async function loadPromoTiles() {
		try {
			const response = await fetch('/api/dgr-admin/promo-tiles');
			const data = await response.json();

			if (data.error) throw new Error(data.error);

			// Update the promoTiles array with fetched data
			if (data.tiles && data.tiles.length > 0) {
				// Only include tiles that have image URLs (not empty ones)
				const activeTiles = data.tiles.filter((tile) => tile.image_url);
				if (activeTiles.length > 0) {
					promoTiles = activeTiles.map((tile) => ({
						position: tile.position,
						image_url: tile.image_url || '',
						title: tile.title || '',
						link_url: tile.link_url || ''
					}));
				} else {
					// No active tiles, start with one empty tile
					promoTiles = [{ position: 1, image_url: '', title: '', link_url: '' }];
				}
			}
		} catch (error) {
			console.error('Failed to load promo tiles:', error);
			toast.error({
				title: 'Failed to load promo tiles',
				message: error.message,
				duration: DURATIONS.medium
			});
		}
	}

	async function savePromoTiles() {
		savingTiles = true;
		const loadingId = toast.loading({
			title: 'Saving promo tiles...',
			message: 'Updating promotional content'
		});

		try {
			// Only save tiles that have image URLs, reposition them as 1, 2, 3
			const tilesToSave = promoTiles
				.filter((tile) => tile.image_url && tile.image_url.trim())
				.map((tile, index) => ({
					...tile,
					position: index + 1
				}));

			const response = await fetch('/api/dgr-admin/promo-tiles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tiles: tilesToSave })
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.dismiss(loadingId);
			toast.success({
				title: 'Promo tiles saved',
				message: `${tilesToSave.length} promotional tile${tilesToSave.length !== 1 ? 's' : ''} updated`,
				duration: DURATIONS.short
			});

			// Reload to refresh positions
			await loadPromoTiles();
		} catch (error) {
			toast.dismiss(loadingId);
			toast.error({
				title: 'Failed to save promo tiles',
				message: error.message,
				duration: DURATIONS.medium
			});
		} finally {
			savingTiles = false;
		}
	}

	function addTile() {
		if (promoTiles.length < 3) {
			promoTiles.push({
				position: promoTiles.length + 1,
				image_url: '',
				title: '',
				link_url: ''
			});
		}
	}

	function removeTile(index) {
		if (promoTiles.length > 1) {
			promoTiles.splice(index, 1);
			// Update positions
			promoTiles.forEach((tile, idx) => {
				tile.position = idx + 1;
			});
		}
	}
</script>

<div class="mx-auto max-w-7xl p-6">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900">Promo Tiles</h1>
		<p class="mt-1 text-sm text-gray-600">
			Manage promotional tiles that appear at the bottom of Daily Gospel Reflections
		</p>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
		</div>
	{:else}
		<DGRPromoTilesEditor
			bind:tiles={promoTiles}
			savingState={savingTiles}
			onSave={savePromoTiles}
			onAddTile={addTile}
			onRemoveTile={removeTile}
		/>
	{/if}
</div>

<ToastContainer />

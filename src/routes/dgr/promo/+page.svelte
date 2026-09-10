<script>
	import { toast, DURATIONS } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGRPromoTilesEditor from '$lib/components/DGRPromoTilesEditor.svelte';

	const emptyTile = (position) => ({
		position,
		image_url: '',
		title: '',
		link_url: '',
		starts_at: null,
		expires_at: null
	});

	let promoTiles = $state([emptyTile(1)]);
	let savingTiles = $state(false);
	let loading = $state(true);

	// Published/scheduled WordPress posts from today onward
	let upcomingPosts = $state([]);
	let upcomingLoading = $state(false);
	let upcomingError = $state(null);
	let syncing = $state(false);

	$effect(() => {
		(async () => {
			await Promise.all([loadPromoTiles(), loadUpcomingPosts()]);
			loading = false;
		})();
	});

	async function loadPromoTiles() {
		try {
			const response = await fetch('/api/dgr-admin/promo-tiles');
			const data = await response.json();

			if (data.error) throw new Error(data.error);

			const activeTiles = (data.tiles || []).filter((tile) => tile.image_url);
			if (activeTiles.length > 0) {
				promoTiles = activeTiles.map((tile) => ({
					position: tile.position,
					image_url: tile.image_url || '',
					title: tile.title || '',
					link_url: tile.link_url || '',
					starts_at: tile.starts_at || null,
					expires_at: tile.expires_at || null
				}));
			} else {
				promoTiles = [emptyTile(1)];
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

	async function loadUpcomingPosts() {
		upcomingLoading = true;
		upcomingError = null;
		try {
			const response = await fetch('/api/dgr-admin/promo-tiles/sync');
			const data = await response.json();
			if (data.error) throw new Error(data.error);
			upcomingPosts = data.upcomingPosts || [];
		} catch (error) {
			console.error('Failed to check published posts:', error);
			upcomingError = error.message;
		} finally {
			upcomingLoading = false;
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
					starts_at: tile.starts_at || null,
					expires_at: tile.expires_at || null,
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

			// The save response already tells us which published posts are now out of date
			if (data.wordpressError) {
				upcomingError = data.wordpressError;
			} else {
				upcomingError = null;
				upcomingPosts = data.upcomingPosts || [];
				const stale = upcomingPosts.filter((p) => p.stale).length;
				if (stale > 0) {
					toast.warning({
						title: `${stale} published post${stale === 1 ? '' : 's'} still show${stale === 1 ? 's' : ''} the old tiles`,
						message: 'Use "Update posts" to push the new tiles to WordPress.',
						duration: DURATIONS.medium
					});
				}
			}

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

	async function syncPosts(postIds) {
		if (!postIds?.length) return;
		syncing = true;
		const loadingId = toast.loading({
			title: 'Updating WordPress posts...',
			message: `Swapping promo tiles in ${postIds.length} post${postIds.length === 1 ? '' : 's'}`
		});

		try {
			const response = await fetch('/api/dgr-admin/promo-tiles/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ postIds })
			});
			const data = await response.json();
			if (data.error) throw new Error(data.error);

			toast.dismiss(loadingId);
			const failed = (data.results || []).filter((r) => r.error);
			if (failed.length === 0) {
				toast.success({
					title: 'WordPress posts updated',
					message: `${data.updated} post${data.updated === 1 ? '' : 's'} now show${data.updated === 1 ? 's' : ''} the current tiles`,
					duration: DURATIONS.short
				});
			} else {
				toast.warning({
					title: `${data.updated} updated, ${failed.length} failed`,
					message: failed.map((r) => `${r.date || r.id}: ${r.error}`).join(' · '),
					duration: DURATIONS.long
				});
			}
		} catch (error) {
			toast.dismiss(loadingId);
			toast.error({
				title: 'Failed to update WordPress posts',
				message: error.message,
				duration: DURATIONS.medium
			});
		} finally {
			syncing = false;
			await loadUpcomingPosts();
		}
	}

	function addTile() {
		if (promoTiles.length < 3) {
			promoTiles.push(emptyTile(promoTiles.length + 1));
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
			tiles={promoTiles}
			savingState={savingTiles}
			onSave={savePromoTiles}
			onAddTile={addTile}
			onRemoveTile={removeTile}
			{upcomingPosts}
			{upcomingLoading}
			{upcomingError}
			syncingState={syncing}
			onSyncPosts={syncPosts}
			onRefreshUpcoming={loadUpcomingPosts}
		/>
	{/if}
</div>

<ToastContainer />

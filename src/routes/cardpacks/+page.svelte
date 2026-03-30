<script lang="ts">
	import { apiPost, apiDelete } from '$lib/utils/api-handler.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import autoAnimate from '@formkit/auto-animate';
	import { fade, fly } from 'svelte/transition';

	let { data } = $props();

	const COLORS = [
		{ id: 'red', dot: 'bg-red-500', badge: 'bg-red-500/15 text-red-400 ring-red-500/30', ring: 'ring-red-500' },
		{ id: 'orange', dot: 'bg-orange-500', badge: 'bg-orange-500/15 text-orange-400 ring-orange-500/30', ring: 'ring-orange-500' },
		{ id: 'amber', dot: 'bg-amber-500', badge: 'bg-amber-500/15 text-amber-400 ring-amber-500/30', ring: 'ring-amber-500' },
		{ id: 'green', dot: 'bg-green-500', badge: 'bg-green-500/15 text-green-400 ring-green-500/30', ring: 'ring-green-500' },
		{ id: 'teal', dot: 'bg-teal-500', badge: 'bg-teal-500/15 text-teal-400 ring-teal-500/30', ring: 'ring-teal-500' },
		{ id: 'blue', dot: 'bg-blue-500', badge: 'bg-blue-500/15 text-blue-400 ring-blue-500/30', ring: 'ring-blue-500' },
		{ id: 'violet', dot: 'bg-violet-500', badge: 'bg-violet-500/15 text-violet-400 ring-violet-500/30', ring: 'ring-violet-500' },
		{ id: 'pink', dot: 'bg-pink-500', badge: 'bg-pink-500/15 text-pink-400 ring-pink-500/30', ring: 'ring-pink-500' },
		{ id: 'gray', dot: 'bg-gray-500', badge: 'bg-gray-500/15 text-gray-400 ring-gray-500/30', ring: 'ring-gray-500' },
	];

	function getColor(colorId: string) {
		return COLORS.find((c) => c.id === colorId) ?? COLORS[COLORS.length - 1];
	}

	// State
	let packs = $state(data.packs ?? []);
	let selectedPackId = $state<string | null>(packs[0]?.id ?? null);
	let selectedPack = $derived(packs.find((p: any) => p.id === selectedPackId) ?? null);

	// Pack form
	let newPackTitle = $state('');
	let showNewPackForm = $state(false);
	let creatingPack = $state(false);

	// Label form
	let showLabelForm = $state(false);
	let newLabelName = $state('');
	let newLabelColor = $state('blue');
	let creatingLabel = $state(false);

	// Card form
	let newCardContent = $state('');
	let selectedLabelIds = $state<Set<string>>(new Set());

	// Filter
	let filterLabelId = $state<string | null>(null);

	// View
	let viewMode = $state<'grid' | 'stack'>('stack');
	let stackIndex = $state(0);
	let isShuffling = $state(false);
	let shuffleKey = $state(0);
	let deckOrder = $state<any[]>([]);

	// Delete
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<{ type: 'pack' | 'card' | 'label'; id: string } | null>(null);

	// Derived
	const labels = $derived(selectedPack?.cardpack_labels ?? []);
	const cards = $derived(selectedPack?.cardpack_cards ?? []);
	const filteredCards = $derived(
		filterLabelId
			? cards.filter((c: any) => c.cardpack_card_labels?.some((cl: any) => cl.label_id === filterLabelId))
			: cards
	);
	const sortedCards = $derived([...filteredCards].sort((a: any, b: any) => a.sort_order - b.sort_order));

	function getCardLabels(card: any) {
		const labelIds = (card.cardpack_card_labels ?? []).map((cl: any) => cl.label_id);
		return labels.filter((l: any) => labelIds.includes(l.id));
	}

	// Sync deck
	let lastCardIds = $state('');
	$effect(() => {
		const ids = sortedCards.map((c: any) => c.id).join(',');
		if (ids !== lastCardIds) {
			lastCardIds = ids;
			deckOrder = [...sortedCards];
			stackIndex = 0;
		}
	});

	const currentCard = $derived(deckOrder[stackIndex] ?? null);
	const deckSize = $derived(deckOrder.length);

	function nextCard() { if (deckSize > 0) stackIndex = (stackIndex + 1) % deckSize; }
	function prevCard() { if (deckSize > 0) stackIndex = (stackIndex - 1 + deckSize) % deckSize; }

	let shuffleAngle = $state(0);

	async function shuffleDeck() {
		if (deckSize < 2 || isShuffling) return;
		isShuffling = true;

		// Fisher-Yates shuffle
		const shuffled = [...deckOrder];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}

		// Pick a random angle for the fly-in
		shuffleAngle = (Math.random() - 0.5) * 30;
		shuffleKey++;
		deckOrder = shuffled;
		stackIndex = 0;

		await new Promise((r) => setTimeout(r, 350));
		isShuffling = false;
	}

	function toggleLabel(id: string) {
		const next = new Set(selectedLabelIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		selectedLabelIds = next;
	}

	async function createPack() {
		if (!newPackTitle.trim()) return;
		creatingPack = true;
		try {
			const result = await apiPost('/api/cardpacks', { title: newPackTitle.trim() }, { successMessage: 'Pack created' });
			if (result?.pack) {
				packs = [{ ...result.pack, cardpack_cards: [], cardpack_labels: [] }, ...packs];
				selectedPackId = result.pack.id;
				newPackTitle = '';
				showNewPackForm = false;
			}
		} catch {} finally { creatingPack = false; }
	}

	async function createLabel() {
		if (!newLabelName.trim() || !selectedPackId) return;
		creatingLabel = true;
		try {
			const result = await apiPost('/api/cardpacks/labels', {
				packId: selectedPackId,
				name: newLabelName.trim(),
				color: newLabelColor
			}, { successMessage: 'Label created' });
			if (result?.label) {
				const pi = packs.findIndex((p: any) => p.id === selectedPackId);
				if (pi !== -1) {
					packs[pi] = { ...packs[pi], cardpack_labels: [...(packs[pi].cardpack_labels ?? []), result.label] };
					packs = [...packs];
				}
				newLabelName = '';
				showLabelForm = false;
			}
		} catch {} finally { creatingLabel = false; }
	}

	let cardCounter = $state(0);

	function addCard() {
		if (!newCardContent.trim() || !selectedPackId) return;
		const pi = packs.findIndex((p: any) => p.id === selectedPackId);
		if (pi === -1) return;

		const tempId = 'temp-' + (++cardCounter);
		const currentCards = packs[pi].cardpack_cards ?? [];
		const nextOrder = currentCards.length > 0
			? Math.max(...currentCards.map((c: any) => c.sort_order ?? 0)) + 1
			: 0;

		// Optimistic card
		const optimisticCard = {
			id: tempId,
			pack_id: selectedPackId,
			content: newCardContent.trim(),
			sort_order: nextOrder,
			created_at: new Date().toISOString(),
			cardpack_card_labels: [...selectedLabelIds].map((lid) => ({ label_id: lid }))
		};

		packs[pi] = { ...packs[pi], cardpack_cards: [...currentCards, optimisticCard] };
		packs = [...packs];
		const savedContent = newCardContent.trim();
		const savedLabels = [...selectedLabelIds];
		const savedPackId = selectedPackId;
		newCardContent = '';

		// Fire and forget — replace temp card with real one when done
		fetch('/api/cardpacks/cards', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ packId: savedPackId, content: savedContent, labelIds: savedLabels })
		}).then((r) => r.json()).then((result) => {
			if (result?.card) {
				const idx = packs.findIndex((p: any) => p.id === savedPackId);
				if (idx !== -1) {
					packs[idx] = {
						...packs[idx],
						cardpack_cards: packs[idx].cardpack_cards.map((c: any) =>
							c.id === tempId ? { ...result.card, cardpack_card_labels: optimisticCard.cardpack_card_labels } : c
						)
					};
					packs = [...packs];
				}
			}
		}).catch(() => {
			// Rollback on failure
			const idx = packs.findIndex((p: any) => p.id === savedPackId);
			if (idx !== -1) {
				packs[idx] = { ...packs[idx], cardpack_cards: packs[idx].cardpack_cards.filter((c: any) => c.id !== tempId) };
				packs = [...packs];
			}
		});
	}

	function confirmDelete(type: 'pack' | 'card' | 'label', id: string) {
		deleteTarget = { type, id };
		showDeleteConfirm = true;
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		showDeleteConfirm = false;
		const { type, id } = deleteTarget;

		if (type === 'pack') {
			try {
				await apiDelete('/api/cardpacks', { packId: id }, { successMessage: 'Pack deleted' });
				packs = packs.filter((p: any) => p.id !== id);
				if (selectedPackId === id) selectedPackId = packs[0]?.id ?? null;
			} catch {}
		} else if (type === 'label') {
			try {
				await apiDelete('/api/cardpacks/labels', { labelId: id }, { successMessage: 'Label deleted' });
				const pi = packs.findIndex((p: any) => p.id === selectedPackId);
				if (pi !== -1) {
					packs[pi] = {
						...packs[pi],
						cardpack_labels: packs[pi].cardpack_labels.filter((l: any) => l.id !== id),
						cardpack_cards: packs[pi].cardpack_cards.map((c: any) => ({
							...c,
							cardpack_card_labels: (c.cardpack_card_labels ?? []).filter((cl: any) => cl.label_id !== id)
						}))
					};
					packs = [...packs];
				}
				if (filterLabelId === id) filterLabelId = null;
				selectedLabelIds.delete(id);
				selectedLabelIds = new Set(selectedLabelIds);
			} catch {}
		} else {
			try {
				await apiDelete('/api/cardpacks/cards', { cardId: id }, { successMessage: 'Card removed' });
				const pi = packs.findIndex((p: any) => p.id === selectedPackId);
				if (pi !== -1) {
					packs[pi] = { ...packs[pi], cardpack_cards: packs[pi].cardpack_cards.filter((c: any) => c.id !== id) };
					packs = [...packs];
				}
			} catch {}
		}
		deleteTarget = null;
	}

	function handleCardKeydown(e: KeyboardEvent) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addCard(); }
	function handlePackKeydown(e: KeyboardEvent) { if (e.key === 'Enter') createPack(); }
	function handleLabelKeydown(e: KeyboardEvent) { if (e.key === 'Enter') createLabel(); }
</script>

<div class="min-h-screen bg-gray-950 -mt-[1px]">
	<div class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
		<!-- Header -->
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-xl font-bold text-gray-100">Card Packs</h1>
			<button
				onclick={() => (showNewPackForm = !showNewPackForm)}
				class="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-white/15 border border-white/10 transition-colors"
			>
				{showNewPackForm ? 'Cancel' : '+ New Pack'}
			</button>
		</div>

		<!-- New Pack Form -->
		{#if showNewPackForm}
			<div class="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-4" transition:fly={{ y: -10, duration: 200 }}>
				<div class="flex gap-3">
					<input type="text" bind:value={newPackTitle} onkeydown={handlePackKeydown} placeholder="Pack title..."
						class="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500" />
					<button onclick={createPack} disabled={creatingPack || !newPackTitle.trim()}
						class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50 transition-colors">
						{creatingPack ? 'Creating...' : 'Create'}
					</button>
				</div>
			</div>
		{/if}

		{#if packs.length === 0 && !showNewPackForm}
			<div class="rounded-lg border-2 border-dashed border-gray-700 p-12 text-center" transition:fade>
				<p class="text-sm text-gray-500">No card packs yet. Create your first one to get started.</p>
			</div>
		{:else}
			<!-- Pack Tabs -->
			{#if packs.length > 0}
				<div class="mb-6 flex flex-wrap gap-2" use:autoAnimate>
					{#each packs as pack (pack.id)}
						<div
							class="group relative flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer {selectedPackId === pack.id
								? 'bg-white text-gray-900 shadow-lg shadow-white/10 scale-105'
								: 'bg-gray-800/80 text-gray-400 hover:bg-gray-800 hover:text-gray-300'}"
							role="button" tabindex="0"
							onclick={() => { selectedPackId = pack.id; filterLabelId = null; }}
							onkeydown={(e) => { if (e.key === 'Enter') { selectedPackId = pack.id; filterLabelId = null; } }}
						>
							{pack.title}
							<span class="ml-1.5 text-[10px] opacity-60">({pack.cardpack_cards?.length ?? 0})</span>
							<button
								onclick={(e) => { e.stopPropagation(); confirmDelete('pack', pack.id); }}
								class="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity {selectedPackId === pack.id ? 'hover:bg-gray-200 text-gray-500' : 'hover:bg-gray-700 text-gray-500'}"
								title="Delete pack">&times;</button>
						</div>
					{/each}
				</div>
			{/if}

			{#if selectedPack}
				<div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
					<!-- Left Side -->
					<div class="lg:col-span-2 space-y-4">
						<!-- Labels Manager -->
						<div class="rounded-xl border border-gray-800 bg-gray-900 p-4">
							<div class="flex items-center justify-between {showLabelForm ? 'mb-3' : ''}">
								<h3 class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Labels{labels.length > 0 && !showLabelForm ? ' (' + labels.length + ')' : ''}</h3>
								<button
									onclick={() => (showLabelForm = !showLabelForm)}
									class="text-[11px] font-medium text-gray-500 hover:text-gray-300 transition-colors"
								>
									{showLabelForm ? 'Cancel' : '+ Add Label'}
								</button>
							</div>

							<!-- Add Label Form (hidden until clicked) -->
							{#if showLabelForm}
								<div class="mb-3 p-3 rounded-lg bg-gray-800/60 border border-gray-700/50 space-y-2.5" transition:fly={{ y: -8, duration: 150 }}>
									<input type="text" bind:value={newLabelName} onkeydown={handleLabelKeydown} placeholder="Label name..."
										class="w-full rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-200 placeholder-gray-600 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-600" />
									<div class="flex flex-wrap gap-1.5">
										{#each COLORS as color (color.id)}
											<button
												onclick={() => (newLabelColor = color.id)}
												class="h-5 w-5 rounded-full transition-all {color.dot} {newLabelColor === color.id
													? 'ring-2 ring-offset-1 ring-offset-gray-800 ' + color.ring + ' scale-110'
													: 'opacity-40 hover:opacity-80 hover:scale-110'}"
											></button>
										{/each}
									</div>
									<!-- Preview -->
									{#if newLabelName.trim()}
										{@const previewColor = getColor(newLabelColor)}
										<div class="flex items-center gap-2">
											<span class="text-[10px] text-gray-600">Preview:</span>
											<span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 {previewColor.badge}">
												<span class="h-1.5 w-1.5 rounded-full {previewColor.dot}"></span>
												{newLabelName.trim()}
											</span>
										</div>
									{/if}
									<button onclick={createLabel} disabled={creatingLabel || !newLabelName.trim()}
										class="w-full rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/15 disabled:opacity-40 transition-colors">
										{creatingLabel ? 'Creating...' : 'Create Label'}
									</button>
								</div>
							{/if}

							<!-- Existing labels only shown when managing labels -->
							{#if showLabelForm && labels.length > 0}
								<div class="flex flex-wrap gap-1.5" use:autoAnimate>
									{#each labels as lbl (lbl.id)}
										{@const c = getColor(lbl.color)}
										<div class="group inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 {c.badge}">
											<span class="h-1.5 w-1.5 rounded-full {c.dot}"></span>
											{lbl.name}
											<button
												onclick={() => confirmDelete('label', lbl.id)}
												class="h-3.5 w-3.5 flex items-center justify-center rounded-full text-[9px] opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
												title="Delete label">&times;</button>
										</div>
									{/each}
								</div>
							{/if}
						</div>

						<!-- Card Form -->
						<div class="rounded-xl border border-gray-800 bg-gray-900 p-5">
							<h2 class="mb-4 text-sm font-semibold text-gray-200">Add a Card</h2>

							<!-- Toggle labels onto this card -->
							{#if labels.length > 0}
								<div class="mb-3">
									<label class="mb-1.5 block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Attach Labels</label>
									<div class="flex flex-wrap gap-1.5">
										{#each labels as lbl (lbl.id)}
											{@const c = getColor(lbl.color)}
											{@const active = selectedLabelIds.has(lbl.id)}
											<button
												onclick={() => toggleLabel(lbl.id)}
												class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ring-1 {active
													? c.badge + ' shadow-sm'
													: 'ring-gray-700 text-gray-600 hover:text-gray-400 hover:ring-gray-600'}"
											>
												<span class="h-1.5 w-1.5 rounded-full {active ? c.dot : 'bg-gray-600'}"></span>
												{lbl.name}
											</button>
										{/each}
									</div>
								</div>
							{/if}

							<textarea
								bind:value={newCardContent}
								onkeydown={handleCardKeydown}
								placeholder="Write your card content..."
								rows="4"
								class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 resize-none"
							></textarea>
							<div class="mt-3 flex items-center justify-between">
								<span class="text-[10px] text-gray-600">
									{#if newCardContent.trim()}
										{newCardContent.trim().length} chars
									{:else}
										Cmd+Enter to submit
									{/if}
								</span>
								<button onclick={addCard} disabled={!newCardContent.trim()}
									class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50 transition-colors">
									Add Card
								</button>
							</div>
						</div>

						<!-- Filter by Label -->
						{#if labels.length > 0 && cards.length > 0}
							<div class="rounded-xl border border-gray-800 bg-gray-900 p-4" transition:fly={{ y: 10, duration: 200 }}>
								<h3 class="text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-3">Filter</h3>
								<div class="flex flex-wrap gap-1.5" use:autoAnimate>
									<button
										onclick={() => (filterLabelId = null)}
										class="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all {filterLabelId === null
											? 'bg-white text-gray-900'
											: 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
									>
										All <span class="opacity-50">{cards.length}</span>
									</button>
									{#each labels as lbl (lbl.id)}
										{@const c = getColor(lbl.color)}
										{@const count = cards.filter((card: any) => card.cardpack_card_labels?.some((cl: any) => cl.label_id === lbl.id)).length}
										{#if count > 0}
											<button
												onclick={() => (filterLabelId = filterLabelId === lbl.id ? null : lbl.id)}
												class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all ring-1 {filterLabelId === lbl.id
													? c.badge + ' shadow-sm'
													: 'ring-gray-700/50 text-gray-500 hover:text-gray-400'}"
											>
												<span class="h-1.5 w-1.5 rounded-full {c.dot}"></span>
												{lbl.name}
												<span class="opacity-50">{count}</span>
											</button>
										{/if}
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Right Side: Card Display -->
					<div class="lg:col-span-3">
						<div class="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6">
							<div class="mb-5 flex items-center justify-between">
								<div class="text-center flex-1">
									<h2 class="text-lg font-bold text-gray-100">{selectedPack.title}</h2>
									<p class="mt-1 text-[11px] text-gray-500">
										{sortedCards.length}{filterLabelId ? ' filtered' : ''} card{sortedCards.length !== 1 ? 's' : ''}
									</p>
								</div>
								<div class="flex items-center rounded-lg bg-gray-800 p-0.5">
									<button onclick={() => (viewMode = 'stack')}
										class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all {viewMode === 'stack' ? 'bg-gray-700 text-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-400'}">Stack</button>
									<button onclick={() => (viewMode = 'grid')}
										class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all {viewMode === 'grid' ? 'bg-gray-700 text-gray-200 shadow-sm' : 'text-gray-500 hover:text-gray-400'}">Grid</button>
								</div>
							</div>

							{#if sortedCards.length === 0}
								<div class="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-700" transition:fade>
									<p class="text-xs text-gray-600">{filterLabelId ? 'No cards match this filter' : 'Cards will appear here'}</p>
								</div>
							{:else if viewMode === 'stack'}
								<div class="flex flex-col items-center">
									<div class="relative w-72 h-80 mx-auto mb-6" aria-label="Card deck">
										{#each { length: Math.min(deckSize - 1, 4) } as _, i}
											{@const depth = Math.min(deckSize - 1, 4) - i}
											<div class="absolute inset-0 rounded-2xl border border-gray-700/50 bg-gray-800 shadow-sm"
												style="transform: translateY({depth * 3}px) translateX({depth * 1}px) rotate({depth * 0.4}deg); z-index: {i}; opacity: {1 - depth * 0.2};"></div>
										{/each}

										{#if currentCard}
											{@const cardLabels = getCardLabels(currentCard)}
											{@const topColor = cardLabels[0] ? getColor(cardLabels[0].color) : null}
											{#key currentCard.id + '-' + shuffleKey}
												<div
													class="absolute inset-0 rounded-2xl border border-gray-700/60 shadow-xl shadow-black/30 flex flex-col overflow-hidden"
													style="z-index: 10; background: linear-gradient(to bottom right, rgb(31 41 55 / 0.95), rgb(17 24 39 / 0.98));"
													in:fly={{ x: isShuffling ? Math.cos(shuffleAngle * Math.PI / 180) * 120 : 80, y: isShuffling ? Math.sin(shuffleAngle * Math.PI / 180) * 120 : 0, duration: 300 }}
												>
													<!-- Color stripe -->
													<div class="h-1.5 w-full {topColor ? topColor.dot : 'bg-gray-700'}"></div>

													<div class="flex flex-col justify-between flex-1 p-6">
														<!-- Labels -->
														<div class="flex flex-wrap gap-1.5">
															{#each cardLabels as lbl (lbl.id)}
																{@const c = getColor(lbl.color)}
																<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 {c.badge}">
																	<span class="h-1.5 w-1.5 rounded-full {c.dot}"></span>
																	{lbl.name}
																</span>
															{/each}
														</div>

														<!-- Content -->
														<div class="flex-1 flex items-center py-3">
															<p class="text-base text-gray-200 leading-relaxed whitespace-pre-wrap">{currentCard.content}</p>
														</div>

														<div class="flex items-center justify-between text-[10px] text-gray-600">
															<span>#{currentCard.sort_order + 1}</span>
															<span>{stackIndex + 1} / {deckSize}</span>
														</div>
													</div>
												</div>
											{/key}
										{/if}
									</div>

									<!-- Controls -->
									<div class="flex items-center gap-3">
										<button onclick={prevCard} disabled={deckSize < 2}
											class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-400 shadow-sm hover:bg-gray-700 hover:text-gray-300 transition-all disabled:opacity-30" title="Previous card">
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
										</button>
										<button onclick={shuffleDeck} disabled={deckSize < 2 || isShuffling}
											class="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-medium text-gray-900 shadow-lg shadow-white/10 hover:bg-gray-200 active:scale-95 transition-all disabled:opacity-50">
											<svg class="h-4 w-4 {isShuffling ? 'spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
											</svg>
											{isShuffling ? 'Shuffling...' : 'Shuffle'}
										</button>
										<button onclick={nextCard} disabled={deckSize < 2}
											class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-400 shadow-sm hover:bg-gray-700 hover:text-gray-300 transition-all disabled:opacity-30" title="Next card">
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
										</button>
									</div>

									{#if deckSize > 1 && deckSize <= 20}
										<div class="mt-4 flex gap-1 justify-center">
											{#each deckOrder as card, i (card.id)}
												{@const cl = getCardLabels(card)}
												{@const dotC = cl[0] ? getColor(cl[0].color) : getColor('gray')}
												<button onclick={() => (stackIndex = i)}
													class="h-2 w-2 rounded-full transition-all {i === stackIndex
														? dotC.dot + ' scale-125 ring-1 ring-offset-1 ring-offset-gray-950 ' + dotC.ring
														: 'bg-gray-700 hover:bg-gray-600'}"
													title="Card {i + 1}"></button>
											{/each}
										</div>
									{:else if deckSize > 20}
										<p class="mt-4 text-[10px] text-gray-600 text-center">{stackIndex + 1} of {deckSize} cards</p>
									{/if}
								</div>
							{:else}
								<!-- Grid View -->
								<div class="grid grid-cols-2 sm:grid-cols-3 gap-3" use:autoAnimate>
									{#each sortedCards as card (card.id)}
										{@const cardLabels = getCardLabels(card)}
										{@const topColor = cardLabels[0] ? getColor(cardLabels[0].color) : null}
										<div class="group relative rounded-xl overflow-hidden border border-gray-800 bg-gray-800/50 hover:bg-gray-800/80 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20">
											<!-- Color stripe -->
											<div class="h-1 w-full {topColor ? topColor.dot : 'bg-gray-700'}"></div>
											<div class="p-4">
												<button onclick={() => confirmDelete('card', card.id)}
													class="absolute top-2 right-2 h-5 w-5 flex items-center justify-center rounded-full text-[10px] text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700 hover:text-gray-400"
													title="Remove card">&times;</button>

												<!-- Labels -->
												{#if cardLabels.length > 0}
													<div class="flex flex-wrap gap-1 mb-2">
														{#each cardLabels as lbl (lbl.id)}
															{@const c = getColor(lbl.color)}
															<span class="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-medium ring-1 {c.badge}">
																<span class="h-1 w-1 rounded-full {c.dot}"></span>
																{lbl.name}
															</span>
														{/each}
													</div>
												{/if}

												<p class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-5">{card.content}</p>
												<div class="mt-3 text-[9px] text-gray-600">#{card.sort_order + 1}</div>
											</div>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</div>
			{/if}
		{/if}
	</div>
</div>

<ConfirmationModal show={showDeleteConfirm} onConfirm={handleDelete}
	onCancel={() => { showDeleteConfirm = false; deleteTarget = null; }}>
	<p>Delete this {deleteTarget?.type === 'pack' ? 'card pack and all its cards' : deleteTarget?.type === 'label' ? 'label (cards keep their content)' : 'card'}?</p>
</ConfirmationModal>

<style>
	@keyframes spin-icon { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	:global(.spin) { animation: spin-icon 0.5s ease-in-out; }
</style>

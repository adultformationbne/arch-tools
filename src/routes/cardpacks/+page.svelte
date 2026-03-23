<script lang="ts">
	import { apiPost, apiDelete } from '$lib/utils/api-handler.js';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import autoAnimate from '@formkit/auto-animate';
	import { fade, fly } from 'svelte/transition';

	let { data } = $props();

	// Dark mode color system - rich tinted backgrounds with bright accents
	const CARD_COLORS = [
		{ id: 'red', label: 'Red', bg: 'bg-red-950/60', border: 'border-red-800/50', dot: 'bg-red-500', text: 'text-red-400', ring: 'ring-red-500', hover: 'hover:bg-red-900/40' },
		{ id: 'orange', label: 'Orange', bg: 'bg-orange-950/60', border: 'border-orange-800/50', dot: 'bg-orange-500', text: 'text-orange-400', ring: 'ring-orange-500', hover: 'hover:bg-orange-900/40' },
		{ id: 'amber', label: 'Amber', bg: 'bg-amber-950/60', border: 'border-amber-800/50', dot: 'bg-amber-500', text: 'text-amber-400', ring: 'ring-amber-500', hover: 'hover:bg-amber-900/40' },
		{ id: 'green', label: 'Green', bg: 'bg-green-950/60', border: 'border-green-800/50', dot: 'bg-green-500', text: 'text-green-400', ring: 'ring-green-500', hover: 'hover:bg-green-900/40' },
		{ id: 'teal', label: 'Teal', bg: 'bg-teal-950/60', border: 'border-teal-800/50', dot: 'bg-teal-500', text: 'text-teal-400', ring: 'ring-teal-500', hover: 'hover:bg-teal-900/40' },
		{ id: 'blue', label: 'Blue', bg: 'bg-blue-950/60', border: 'border-blue-800/50', dot: 'bg-blue-500', text: 'text-blue-400', ring: 'ring-blue-500', hover: 'hover:bg-blue-900/40' },
		{ id: 'violet', label: 'Violet', bg: 'bg-violet-950/60', border: 'border-violet-800/50', dot: 'bg-violet-500', text: 'text-violet-400', ring: 'ring-violet-500', hover: 'hover:bg-violet-900/40' },
		{ id: 'pink', label: 'Pink', bg: 'bg-pink-950/60', border: 'border-pink-800/50', dot: 'bg-pink-500', text: 'text-pink-400', ring: 'ring-pink-500', hover: 'hover:bg-pink-900/40' },
		{ id: 'gray', label: 'Gray', bg: 'bg-gray-800/60', border: 'border-gray-700/50', dot: 'bg-gray-400', text: 'text-gray-400', ring: 'ring-gray-500', hover: 'hover:bg-gray-700/40' },
	];

	function getColor(colorId: string) {
		return CARD_COLORS.find((c) => c.id === colorId) ?? CARD_COLORS[CARD_COLORS.length - 1];
	}

	// State
	let packs = $state(data.packs ?? []);
	let selectedPackId = $state<string | null>(packs[0]?.id ?? null);
	let selectedPack = $derived(packs.find((p: any) => p.id === selectedPackId) ?? null);

	// New pack form
	let newPackTitle = $state('');
	let showNewPackForm = $state(false);
	let creatingPack = $state(false);

	// New card form
	let newCardContent = $state('');
	let selectedColor = $state('blue');
	let addingCard = $state(false);

	// Filter/sort
	let colorFilter = $state<string | null>(null);
	let sortBy = $state<'order' | 'color'>('order');

	// View mode
	let viewMode = $state<'grid' | 'stack'>('stack');
	let stackIndex = $state(0);
	let isShuffling = $state(false);
	let shuffleKey = $state(0);
	let deckOrder = $state<any[]>([]);

	// Delete confirmation
	let showDeleteConfirm = $state(false);
	let deleteTarget = $state<{ type: 'pack' | 'card'; id: string } | null>(null);

	// Cards derived
	const cards = $derived(selectedPack?.cardpack_cards ?? []);
	const filteredCards = $derived(
		colorFilter ? cards.filter((c: any) => c.color === colorFilter) : cards
	);
	const sortedCards = $derived(
		[...filteredCards].sort((a: any, b: any) => {
			if (sortBy === 'color') {
				const colorOrder = CARD_COLORS.map((c) => c.id);
				const diff = colorOrder.indexOf(a.color || 'gray') - colorOrder.indexOf(b.color || 'gray');
				return diff !== 0 ? diff : a.sort_order - b.sort_order;
			}
			return a.sort_order - b.sort_order;
		})
	);

	// Sync deck order only when the actual card set changes (add/remove/filter), not after shuffle
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

	// Color counts for filter bar
	const colorCounts = $derived(
		CARD_COLORS.reduce((acc: Record<string, number>, color) => {
			acc[color.id] = cards.filter((c: any) => c.color === color.id).length;
			return acc;
		}, {})
	);

	function nextCard() {
		if (deckSize > 0) {
			stackIndex = (stackIndex + 1) % deckSize;
		}
	}

	function prevCard() {
		if (deckSize > 0) {
			stackIndex = (stackIndex - 1 + deckSize) % deckSize;
		}
	}

	async function shuffleDeck() {
		if (deckSize < 2 || isShuffling) return;
		isShuffling = true;
		shuffleKey++;

		// Wait for fan-out animation
		await new Promise((r) => setTimeout(r, 400));

		// Fisher-Yates shuffle
		const shuffled = [...deckOrder];
		for (let i = shuffled.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
		}
		deckOrder = shuffled;
		stackIndex = 0;

		// Wait for settle animation
		await new Promise((r) => setTimeout(r, 300));
		isShuffling = false;
	}

	async function createPack() {
		if (!newPackTitle.trim()) return;
		creatingPack = true;
		try {
			const result = await apiPost('/api/cardpacks', { title: newPackTitle.trim() }, { successMessage: 'Pack created' });
			if (result?.pack) {
				packs = [result.pack, ...packs];
				selectedPackId = result.pack.id;
				newPackTitle = '';
				showNewPackForm = false;
			}
		} catch {
			// apiPost handles toast
		} finally {
			creatingPack = false;
		}
	}

	async function addCard() {
		if (!newCardContent.trim() || !selectedPackId) return;
		addingCard = true;
		try {
			const result = await apiPost('/api/cardpacks/cards', {
				packId: selectedPackId,
				content: newCardContent.trim(),
				color: selectedColor
			});
			if (result?.card) {
				const packIndex = packs.findIndex((p: any) => p.id === selectedPackId);
				if (packIndex !== -1) {
					packs[packIndex] = {
						...packs[packIndex],
						cardpack_cards: [...(packs[packIndex].cardpack_cards ?? []), result.card]
					};
					packs = [...packs];
				}
				newCardContent = '';
			}
		} catch {
			// apiPost handles toast
		} finally {
			addingCard = false;
		}
	}

	function confirmDelete(type: 'pack' | 'card', id: string) {
		deleteTarget = { type, id };
		showDeleteConfirm = true;
	}

	async function handleDelete() {
		if (!deleteTarget) return;
		showDeleteConfirm = false;

		if (deleteTarget.type === 'pack') {
			try {
				await apiDelete('/api/cardpacks', { packId: deleteTarget.id }, { successMessage: 'Pack deleted' });
				packs = packs.filter((p: any) => p.id !== deleteTarget!.id);
				if (selectedPackId === deleteTarget.id) {
					selectedPackId = packs[0]?.id ?? null;
				}
			} catch {
				// handled
			}
		} else {
			try {
				await apiDelete('/api/cardpacks/cards', { cardId: deleteTarget.id }, { successMessage: 'Card removed' });
				const packIndex = packs.findIndex((p: any) => p.id === selectedPackId);
				if (packIndex !== -1) {
					packs[packIndex] = {
						...packs[packIndex],
						cardpack_cards: packs[packIndex].cardpack_cards.filter((c: any) => c.id !== deleteTarget!.id)
					};
					packs = [...packs];
				}
			} catch {
				// handled
			}
		}
		deleteTarget = null;
	}

	function handleCardKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
			addCard();
		}
	}

	function handlePackKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			createPack();
		}
	}
</script>

<div class="cardpacks-dark min-h-screen bg-gray-950 -mt-[1px]">
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
					<input
						type="text"
						bind:value={newPackTitle}
						onkeydown={handlePackKeydown}
						placeholder="Pack title..."
						class="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
					/>
					<button
						onclick={createPack}
						disabled={creatingPack || !newPackTitle.trim()}
						class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50 transition-colors"
					>
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
			<!-- Pack Selector Tabs -->
			{#if packs.length > 0}
				<div class="mb-6 flex flex-wrap gap-2" use:autoAnimate>
					{#each packs as pack (pack.id)}
						<div
							class="group relative flex items-center rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer {selectedPackId === pack.id
								? 'bg-white text-gray-900 shadow-lg shadow-white/10 scale-105'
								: 'bg-gray-800/80 text-gray-400 hover:bg-gray-800 hover:text-gray-300'}"
							role="button"
							tabindex="0"
							onclick={() => (selectedPackId = pack.id)}
							onkeydown={(e) => { if (e.key === 'Enter') selectedPackId = pack.id; }}
						>
							{pack.title}
							<span class="ml-1.5 text-[10px] opacity-60">({pack.cardpack_cards?.length ?? 0})</span>
							<button
								onclick={(e) => { e.stopPropagation(); confirmDelete('pack', pack.id); }}
								class="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity {selectedPackId === pack.id
									? 'hover:bg-gray-200 text-gray-500'
									: 'hover:bg-gray-700 text-gray-500'}"
								title="Delete pack"
							>
								&times;
							</button>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Main Content -->
			{#if selectedPack}
				<div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
					<!-- Left Side: Card Input (2 cols) -->
					<div class="lg:col-span-2 space-y-4">
						<div class="rounded-xl border border-gray-800 bg-gray-900 p-5">
							<h2 class="mb-4 text-sm font-semibold text-gray-200">Add a Card</h2>

							<!-- Color Picker -->
							<div class="mb-3">
								<label class="mb-1.5 block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Color</label>
								<div class="flex flex-wrap gap-1.5">
									{#each CARD_COLORS as color (color.id)}
										<button
											onclick={() => (selectedColor = color.id)}
											class="h-7 w-7 rounded-full transition-all {color.dot} {selectedColor === color.id
												? 'ring-2 ring-offset-2 ring-offset-gray-900 ' + color.ring + ' scale-110'
												: 'hover:scale-110 opacity-60 hover:opacity-100'}"
											title={color.label}
										></button>
									{/each}
								</div>
							</div>

							<!-- Text Input -->
							<textarea
								bind:value={newCardContent}
								onkeydown={handleCardKeydown}
								placeholder="Write your card content..."
								rows="5"
								class="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 resize-none"
							></textarea>
							<div class="mt-3 flex items-center justify-between">
								<span class="text-[10px] text-gray-600">
									{#if newCardContent.trim()}
										{newCardContent.trim().length} chars
									{:else}
										Cmd+Enter to submit
									{/if}
								</span>
								<button
									onclick={addCard}
									disabled={addingCard || !newCardContent.trim()}
									class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-200 disabled:opacity-50 transition-colors"
								>
									{addingCard ? 'Adding...' : 'Add Card'}
								</button>
							</div>
						</div>

						<!-- Color Filter & Sort -->
						{#if cards.length > 0}
							<div class="rounded-xl border border-gray-800 bg-gray-900 p-4" transition:fly={{ y: 10, duration: 200 }}>
								<div class="flex items-center justify-between mb-3">
									<h3 class="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Filter & Sort</h3>
									<button
										onclick={() => (sortBy = sortBy === 'order' ? 'color' : 'order')}
										class="text-[11px] font-medium text-gray-500 hover:text-gray-300 transition-colors px-2 py-0.5 rounded-full {sortBy === 'color' ? 'bg-gray-800' : ''}"
									>
										Sort: {sortBy === 'color' ? 'By Color' : 'By Order'}
									</button>
								</div>
								<div class="flex flex-wrap gap-1.5">
									<button
										onclick={() => (colorFilter = null)}
										class="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all {colorFilter === null
											? 'bg-white text-gray-900'
											: 'bg-gray-800 text-gray-400 hover:bg-gray-700'}"
									>
										All <span class="opacity-60">{cards.length}</span>
									</button>
									{#each CARD_COLORS as color (color.id)}
										{#if colorCounts[color.id] > 0}
											<button
												onclick={() => (colorFilter = colorFilter === color.id ? null : color.id)}
												class="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all {colorFilter === color.id
													? color.bg + ' ' + color.text + ' ring-1 ' + color.ring
													: 'bg-gray-800/60 text-gray-500 hover:bg-gray-800'}"
											>
												<span class="h-2 w-2 rounded-full {color.dot}"></span>
												{color.label}
												<span class="opacity-60">{colorCounts[color.id]}</span>
											</button>
										{/if}
									{/each}
								</div>
							</div>
						{/if}
					</div>

					<!-- Right Side: Card Pack Display (3 cols) -->
					<div class="lg:col-span-3">
						<div class="rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-950 p-6">
							<!-- Header with view toggle -->
							<div class="mb-5 flex items-center justify-between">
								<div class="text-center flex-1">
									<h2 class="text-lg font-bold text-gray-100">{selectedPack.title}</h2>
									<p class="mt-1 text-[11px] text-gray-500">
										{sortedCards.length}{colorFilter ? ' filtered' : ''} card{sortedCards.length !== 1 ? 's' : ''}
									</p>
								</div>
								<!-- View Toggle -->
								<div class="flex items-center rounded-lg bg-gray-800 p-0.5">
									<button
										onclick={() => (viewMode = 'stack')}
										class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all {viewMode === 'stack'
											? 'bg-gray-700 text-gray-200 shadow-sm'
											: 'text-gray-500 hover:text-gray-400'}"
									>
										Stack
									</button>
									<button
										onclick={() => (viewMode = 'grid')}
										class="rounded-md px-2.5 py-1 text-[11px] font-medium transition-all {viewMode === 'grid'
											? 'bg-gray-700 text-gray-200 shadow-sm'
											: 'text-gray-500 hover:text-gray-400'}"
									>
										Grid
									</button>
								</div>
							</div>

							{#if sortedCards.length === 0}
								<div class="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-gray-700" transition:fade>
									<p class="text-xs text-gray-600">
										{colorFilter ? 'No cards with this color' : 'Cards will appear here'}
									</p>
								</div>
							{:else if viewMode === 'stack'}
								<!-- Stack View -->
								<div class="flex flex-col items-center">
									<!-- The deck -->
									<div class="relative w-72 h-80 mx-auto mb-6" aria-label="Card deck">
										<!-- Background cards (deck depth) -->
										{#each { length: Math.min(deckSize - 1, 4) } as _, i}
											{@const depth = Math.min(deckSize - 1, 4) - i}
											<div
												class="absolute inset-0 rounded-2xl border border-gray-700/50 bg-gray-800 shadow-sm"
												style="
													transform: translateY({depth * 3}px) translateX({depth * 1}px) rotate({depth * 0.4}deg);
													z-index: {i};
													opacity: {1 - depth * 0.2};
												"
											></div>
										{/each}

										<!-- Current card -->
										{#if currentCard}
											{@const color = getColor(currentCard.color)}
											{#key currentCard.id + '-' + shuffleKey}
												<div
													class="absolute inset-0 rounded-2xl border-2 {color.border} {color.bg} p-6 shadow-xl shadow-black/30 flex flex-col justify-between backdrop-blur-sm {isShuffling ? 'shuffle-animate' : ''}"
													style="z-index: 10;"
													in:fly={{ x: isShuffling ? 0 : 80, duration: 250, delay: isShuffling ? 300 : 0 }}
												>
													<!-- Color badge -->
													<div class="flex items-center gap-2">
														<span class="h-3 w-3 rounded-full {color.dot} shadow-sm shadow-current"></span>
														<span class="text-[10px] font-semibold {color.text} uppercase tracking-wider">{color.label}</span>
													</div>

													<!-- Content -->
													<div class="flex-1 flex items-center py-4">
														<p class="text-base text-gray-200 leading-relaxed whitespace-pre-wrap">{currentCard.content}</p>
													</div>

													<!-- Footer -->
													<div class="flex items-center justify-between text-[10px] text-gray-600">
														<span>#{currentCard.sort_order + 1}</span>
														<span>{stackIndex + 1} / {deckSize}</span>
													</div>
												</div>
											{/key}
										{/if}
									</div>

									<!-- Controls -->
									<div class="flex items-center gap-3">
										<button
											onclick={prevCard}
											disabled={deckSize < 2}
											class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-400 shadow-sm hover:bg-gray-700 hover:text-gray-300 transition-all disabled:opacity-30"
											title="Previous card"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
										</button>

										<button
											onclick={shuffleDeck}
											disabled={deckSize < 2 || isShuffling}
											class="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-medium text-gray-900 shadow-lg shadow-white/10 hover:bg-gray-200 hover:shadow-xl hover:shadow-white/15 active:scale-95 transition-all disabled:opacity-50 {isShuffling ? 'shuffle-btn' : ''}"
										>
											<svg class="h-4 w-4 {isShuffling ? 'spin' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
													d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
											</svg>
											{isShuffling ? 'Shuffling...' : 'Shuffle'}
										</button>

										<button
											onclick={nextCard}
											disabled={deckSize < 2}
											class="flex h-9 w-9 items-center justify-center rounded-full border border-gray-700 bg-gray-800 text-gray-400 shadow-sm hover:bg-gray-700 hover:text-gray-300 transition-all disabled:opacity-30"
											title="Next card"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
										</button>
									</div>

									<!-- Dot indicators (max 20 shown) -->
									{#if deckSize > 1 && deckSize <= 20}
										<div class="mt-4 flex gap-1 justify-center">
											{#each deckOrder as card, i (card.id)}
												{@const dotColor = getColor(card.color)}
												<button
													onclick={() => (stackIndex = i)}
													class="h-2 w-2 rounded-full transition-all {i === stackIndex
														? dotColor.dot + ' scale-125 ring-1 ring-offset-1 ring-offset-gray-950 ' + dotColor.ring
														: 'bg-gray-700 hover:bg-gray-600'}"
													title="Card {i + 1}"
												></button>
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
										{@const color = getColor(card.color)}
										<div
											class="group relative rounded-xl border {color.border} {color.bg} p-4 shadow-sm hover:shadow-lg hover:shadow-black/20 transition-all duration-200 hover:-translate-y-0.5"
										>
											<button
												onclick={() => confirmDelete('card', card.id)}
												class="absolute top-2 right-2 h-5 w-5 flex items-center justify-center rounded-full text-[10px] opacity-0 group-hover:opacity-100 transition-opacity {color.text} {color.hover}"
												title="Remove card"
											>
												&times;
											</button>
											<div class="mb-2 flex items-center gap-1.5">
												<span class="h-2 w-2 rounded-full {color.dot}"></span>
												<span class="text-[9px] font-medium {color.text} uppercase tracking-wider">{color.label}</span>
											</div>
											<p class="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-5">{card.content}</p>
											<div class="mt-3 text-[9px] text-gray-600">#{card.sort_order + 1}</div>
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

<ConfirmationModal
	show={showDeleteConfirm}
	onConfirm={handleDelete}
	onCancel={() => {
		showDeleteConfirm = false;
		deleteTarget = null;
	}}
>
	<p>Delete this {deleteTarget?.type === 'pack' ? 'card pack and all its cards' : 'card'}?</p>
</ConfirmationModal>

<style>
	@keyframes shuffle-fan {
		0% { transform: rotate(0deg) translateY(0); }
		30% { transform: rotate(-8deg) translateY(-20px) translateX(-30px); }
		60% { transform: rotate(8deg) translateY(-20px) translateX(30px); }
		100% { transform: rotate(0deg) translateY(0); }
	}

	@keyframes spin-icon {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	:global(.shuffle-animate) {
		animation: shuffle-fan 0.5s ease-in-out;
	}

	:global(.spin) {
		animation: spin-icon 0.6s ease-in-out;
	}

	:global(.shuffle-btn) {
		animation: pulse 0.6s ease-in-out;
	}

	@keyframes pulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.05); }
	}
</style>

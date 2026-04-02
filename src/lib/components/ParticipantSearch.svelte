<script lang="ts">
	import { Search, X } from '$lib/icons';

	interface Participant {
		id: string;
		name: string;
		email: string;
	}

	let { participants = [], selected = $bindable('all'), variant = 'desktop' }: {
		participants: Participant[];
		selected: string;
		variant: 'desktop' | 'mobile';
	} = $props();

	let query = $state('');
	let isOpen = $state(false);
	let highlightIndex = $state(-1);
	let inputEl: HTMLInputElement | null = $state(null);
	let listEl: HTMLDivElement | null = $state(null);

	const filtered = $derived.by(() => {
		if (!query.trim()) return participants;
		const q = query.toLowerCase().trim();
		return participants.filter(p => {
			const name = (p.name || '').toLowerCase();
			return name.startsWith(q) || name.split(/\s+/).some(word => word.startsWith(q));
		});
	});

	const selectedName = $derived(
		selected === 'all' ? '' : participants.find(p => p.id === selected)?.name || ''
	);

	function selectParticipant(participant: Participant) {
		selected = participant.id;
		query = '';
		isOpen = false;
		highlightIndex = -1;
	}

	function clear() {
		selected = 'all';
		query = '';
		isOpen = false;
		highlightIndex = -1;
	}

	function handleFocus() {
		isOpen = true;
		highlightIndex = -1;
	}

	function handleBlur(e: FocusEvent) {
		// Delay to allow click on list item
		setTimeout(() => {
			if (!listEl?.contains(document.activeElement)) {
				isOpen = false;
				highlightIndex = -1;
				query = '';
			}
		}, 150);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!isOpen) {
			if (e.key === 'ArrowDown' || e.key === 'Enter') {
				isOpen = true;
				e.preventDefault();
			}
			return;
		}

		if (e.key === 'ArrowDown') {
			e.preventDefault();
			highlightIndex = Math.min(highlightIndex + 1, filtered.length - 1);
			scrollToHighlighted();
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightIndex = Math.max(highlightIndex - 1, 0);
			scrollToHighlighted();
		} else if (e.key === 'Enter' && highlightIndex >= 0) {
			e.preventDefault();
			selectParticipant(filtered[highlightIndex]);
		} else if (e.key === 'Escape') {
			isOpen = false;
			highlightIndex = -1;
			query = '';
			inputEl?.blur();
		}
	}

	function scrollToHighlighted() {
		if (listEl && highlightIndex >= 0) {
			const items = listEl.querySelectorAll('[data-participant-item]');
			items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
		}
	}

	const isDesktop = $derived(variant === 'desktop');
	const inputClass = $derived(isDesktop
		? 'w-full pl-7 pr-7 py-1.5 text-xs border rounded-lg text-white placeholder-white/40 focus:outline-none'
		: 'w-full pl-8 pr-8 py-2 text-sm border rounded-lg text-white placeholder-white/40 focus:outline-none'
	);
	const inputStyle = 'background-color: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);';
</script>

<div class="relative">
	{#if selected !== 'all'}
		<!-- Selected state -->
		<div
			class={isDesktop
				? 'flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-white border'
				: 'flex items-center justify-between px-3 py-2 text-sm rounded-lg text-white border'}
			style="background-color: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2);"
		>
			<span class="truncate">{selectedName}</span>
			<button
				onclick={clear}
				class="ml-2 text-white/50 hover:text-white flex-shrink-0"
				aria-label="Clear participant filter"
			>
				<X size={isDesktop ? 12 : 14} />
			</button>
		</div>
	{:else}
		<!-- Search state -->
		<div class="relative">
			<Search size={isDesktop ? 12 : 14} class="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-white/40" />
			<input
				bind:this={inputEl}
				bind:value={query}
				type="text"
				placeholder="Search by name..."
				class={inputClass}
				style={inputStyle}
				onfocus={handleFocus}
				onblur={handleBlur}
				onkeydown={handleKeydown}
			/>
		</div>

		<!-- Dropdown -->
		{#if isOpen}
			<div
				bind:this={listEl}
				class="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-lg shadow-lg border"
				style="background-color: var(--course-accent-dark, #1f2937); border-color: rgba(255,255,255,0.15);"
			>
				{#if filtered.length === 0}
					<div class="px-3 py-2 text-xs text-white/40">No participants found</div>
				{:else}
					{#each filtered as participant, i}
						<button
							data-participant-item
							class="w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors {highlightIndex === i ? 'bg-white/15 text-white' : 'text-white/80'}"
							onmousedown={() => selectParticipant(participant)}
						>
							<div class="font-medium truncate">{participant.name}</div>
							<div class="text-[10px] text-white/40 truncate">{participant.email}</div>
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	{/if}
</div>

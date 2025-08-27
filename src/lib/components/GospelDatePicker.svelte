<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { decodeHtmlEntities } from '$lib/utils/html.js';

	interface GospelDatePickerProps {
		region?: string;
		compact?: boolean;
	}

	let { region = 'australia.brisbane', compact = false }: GospelDatePickerProps = $props();

	let selectedDate = $state(new Date().toISOString().split('T')[0]);
	let loading = $state(false);
	let error = $state('');
	let gospelData = $state<any>(null);

	const dispatch = createEventDispatcher();

	async function fetchGospelForDate() {
		try {
			loading = true;
			error = '';
			gospelData = null;

			const targetDate = new Date(selectedDate);
			const year = targetDate.getFullYear();
			const month = String(targetDate.getMonth() + 1).padStart(2, '0');
			const day = String(targetDate.getDate()).padStart(2, '0');
			const dateStr = `${year}${month}${day}`;

			const callbackName = 'universalisCallback' + Date.now();

			window[callbackName] = function (data: any) {
				if (data && data.Mass_G && data.Mass_G.source) {
					const cleanGospel = decodeHtmlEntities(data.Mass_G.source);

					gospelData = {
						date: data.date,
						gospel: cleanGospel,
						heading: data.Mass_G.heading,
						feast: data.day
					};

					// Dispatch event for parent components
					dispatch('gospel-selected', gospelData);
				} else {
					error = 'No Gospel reading found for this date';
				}

				document.head.removeChild(script);
				delete window[callbackName];
				loading = false;
			};

			const script = document.createElement('script');
			script.src = `https://universalis.com/${region}/${dateStr}/jsonpmass.js?callback=${callbackName}`;
			script.onerror = () => {
				error = 'Failed to load liturgical data';
				document.head.removeChild(script);
				delete window[callbackName];
				loading = false;
			};

			document.head.appendChild(script);
		} catch (err) {
			error = `Error loading Gospel: ${err instanceof Error ? err.message : String(err)}`;
			loading = false;
		}
	}

	function getTodaysGospel() {
		selectedDate = new Date().toISOString().split('T')[0];
		fetchGospelForDate();
	}
</script>

<div class={compact ? 'space-y-2' : 'space-y-4 rounded-lg border border-green-200 bg-green-50 p-4'}>
	{#if !compact}
		<h3 class="text-lg font-medium text-green-800">📅 Daily Gospel Readings</h3>
	{/if}

	<form
		onsubmit={(e) => {
			e.preventDefault();
			fetchGospelForDate();
		}}
		class="space-y-3"
	>
		<div
			class={compact ? 'flex items-end gap-2' : 'grid grid-cols-1 items-end gap-4 md:grid-cols-2'}
		>
			<div class={compact ? 'flex-1' : ''}>
				<label for="selectedDate" class="mb-1 block text-sm font-medium text-green-700">
					Select Date
				</label>
				<input
					id="selectedDate"
					type="date"
					bind:value={selectedDate}
					class="w-full rounded-md border border-green-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-green-500 focus:outline-none"
					required
				/>
			</div>

			<div class={compact ? '' : 'flex gap-2'}>
				<button
					type="submit"
					disabled={loading}
					class="rounded-md bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{loading ? 'Loading...' : compact ? '🔍' : '🔍 Get Gospel'}
				</button>

				{#if !compact}
					<button
						type="button"
						onclick={getTodaysGospel}
						disabled={loading}
						class="rounded-md bg-green-500 px-4 py-2 font-medium text-white transition-colors hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
					>
						📖 Today
					</button>
				{/if}
			</div>
		</div>

		{#if !compact}
			<p class="text-sm text-green-600">
				Get the Gospel reading from the {region === 'australia.brisbane'
					? 'Brisbane Catholic'
					: 'liturgical'} calendar.
			</p>
		{/if}
	</form>

	{#if error}
		<div class="rounded border border-red-200 bg-red-50 p-2">
			<p class="text-sm text-red-700">{error}</p>
		</div>
	{/if}

	{#if gospelData}
		<div class="rounded border border-green-200 bg-white p-4">
			<div class="space-y-2">
				<p class="text-sm font-medium text-green-800">{gospelData.date}</p>
				<p class="text-lg font-semibold text-gray-900">{gospelData.gospel}</p>
				{#if gospelData.heading}
					<p class="text-sm text-gray-600 italic">"{gospelData.heading}"</p>
				{/if}
				{#if gospelData.feast && !compact}
					<div class="text-xs text-gray-500" contenteditable="false">
						{@html gospelData.feast}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

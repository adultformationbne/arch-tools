<script>
	import { onMount } from 'svelte';

	// State
	let evaluations = $state([]);
	let loading = $state(false);
	let error = $state(null);
	let isExpanded = $state(false);

	// Single quality slider (0-100, default 50)
	let qualitySlider = $state(50);

	// Generate thresholds based on slider value
	let thresholds = $derived.by(() => {
		// Convert 0-100 slider to factor (0 = strict, 100 = lenient)
		// Create much more dramatic differences
		const strictness = qualitySlider / 100; // 0 to 1

		return {
			// Green thresholds - DRAMATIC difference from strict to lenient
			green_min_relatability: Math.max(1, Math.round(8.5 - strictness * 4)), // 8.5 → 4.5 (4 point swing!)
			green_min_accessibility: Math.max(1, Math.round(9 - strictness * 4.5)), // 9 → 4.5 (4.5 point swing!)

			// Orange thresholds - moderate difference
			orange_min_relatability: Math.max(1, Math.round(6 - strictness * 2)), // 6 → 4
			orange_min_accessibility: Math.max(1, Math.round(7 - strictness * 2.5)), // 7 → 4.5

			// Red thresholds - theology/historical are only bad when combined with poor relatability/accessibility
			// So we make these more forgiving as we get lenient
			red_max_emotional_resonance: Math.max(1, Math.round(2.5 + strictness * 1.5)), // 2.5 → 4 (more forgiving)
			red_combo_threshold: Math.max(1, Math.round(4 + strictness * 2)) // Combined relatability + accessibility threshold
		};
	});

	// Props from parent
	let { onAnalyticsReady = null } = $props();

	// Export thresholds for use by editor components
	export { thresholds };

	// Notify parent when analytics functions are ready
	$effect(() => {
		if (onAnalyticsReady && evaluations.length > 0) {
			onAnalyticsReady({
				getBlockRecommendation,
				getBlockScores,
				evaluations: evaluations
			});
		}
	});

	let searchQuery = $state('');
	let sortBy = $state('relatability');
	let sortOrder = $state('desc');

	// Computed properties with defensive programming
	let filteredEvaluations = $derived(() => {
		try {
			if (!Array.isArray(evaluations) || evaluations.length === 0) return [];

			const filtered = evaluations.filter((evaluation) => {
				if (!evaluation || typeof evaluation !== 'object') return false;
				const scores = evaluation.scores;
				if (!scores || typeof scores !== 'object') return false;

				// Apply search filter only - no score filtering in sidebar
				const scoresMatch = true;

				// Apply search filter
				const searchMatch =
					!searchQuery ||
					(evaluation.content_full &&
						typeof evaluation.content_full === 'string' &&
						evaluation.content_full.toLowerCase().includes(searchQuery.toLowerCase())) ||
					(evaluation.block_id &&
						typeof evaluation.block_id === 'string' &&
						evaluation.block_id.toLowerCase().includes(searchQuery.toLowerCase()));

				return scoresMatch && searchMatch;
			});

			// Sort safely
			return filtered.sort((a, b) => {
				try {
					const aScore = a.scores && typeof a.scores[sortBy] === 'number' ? a.scores[sortBy] : 0;
					const bScore = b.scores && typeof b.scores[sortBy] === 'number' ? b.scores[sortBy] : 0;
					return sortOrder === 'desc' ? bScore - aScore : aScore - bScore;
				} catch {
					return 0;
				}
			});
		} catch (error) {
			console.error('Error in filteredEvaluations:', error);
			return [];
		}
	});

	let stats = $derived(() => {
		try {
			if (!Array.isArray(evaluations) || evaluations.length === 0) return null;
			if (!Array.isArray(filteredEvaluations)) return null;

			const metrics = ['relatability', 'accessibility', 'emotional_resonance', 'theological_depth'];
			const result = {
				total: evaluations.length,
				filtered: filteredEvaluations.length
			};

			metrics.forEach((metric) => {
				try {
					const values = evaluations
						.filter(
							(e) =>
								e &&
								e.scores &&
								typeof e.scores === 'object' &&
								typeof e.scores[metric] === 'number'
						)
						.map((e) => e.scores[metric]);

					if (values.length > 0) {
						result[metric] = {
							avg: (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
						};
					}
				} catch (error) {
					console.warn(`Error calculating stats for ${metric}:`, error);
				}
			});

			return result;
		} catch (error) {
			console.error('Error in stats calculation:', error);
			return null;
		}
	});

	let recommendations = $derived(() => {
		if (!Array.isArray(filteredEvaluations)) return [];
		return filteredEvaluations
			.filter((e) => e && e.scores && typeof e.scores === 'object')
			.map((e) => getRecommendation(e.scores));
	});

	let recommendationCounts = $derived(() => {
		if (!Array.isArray(recommendations)) return { keepCount: 0, editCount: 0, removeCount: 0 };
		const keepCount = recommendations.filter((r) => r && r.type === 'keep').length;
		const editCount = recommendations.filter((r) => r && r.type === 'edit').length;
		const removeCount = recommendations.filter((r) => r && r.type === 'remove').length;
		return { keepCount, editCount, removeCount };
	});

	function getRecommendation(scores) {
		if (!scores || typeof scores !== 'object')
			return { type: 'edit', color: 'gray', label: 'UNKNOWN' };

		const relatability = typeof scores.relatability === 'number' ? scores.relatability : 0;
		const accessibility = typeof scores.accessibility === 'number' ? scores.accessibility : 0;
		const theological_depth =
			typeof scores.theological_depth === 'number' ? scores.theological_depth : 0;
		const historical_focus =
			typeof scores.historical_focus === 'number' ? scores.historical_focus : 0;
		const emotional_resonance =
			typeof scores.emotional_resonance === 'number' ? scores.emotional_resonance : 0;

		// GREEN: High relatability AND accessibility (theology/historical don't matter if relatable!)
		if (
			relatability >= thresholds.green_min_relatability &&
			accessibility >= thresholds.green_min_accessibility
		) {
			return { type: 'keep', color: 'green', label: 'KEEP' };
		}

		// RED: Very poor emotional connection OR poor relatability+accessibility combo
		const comboScore = relatability + accessibility;
		if (
			emotional_resonance <= thresholds.red_max_emotional_resonance ||
			comboScore < thresholds.red_combo_threshold
		) {
			return { type: 'remove', color: 'red', label: 'REMOVE' };
		}

		// ORANGE: Everything else (including high theology/historical that's still somewhat relatable)
		return { type: 'edit', color: 'orange', label: 'EDIT' };
	}

	// Export function for use by editor
	export function getBlockRecommendation(blockId) {
		const evaluation = evaluations.find((e) => e.block_id === blockId);
		if (!evaluation) return null;
		return getRecommendation(evaluation.scores);
	}

	export function getBlockScores(blockId) {
		const evaluation = evaluations.find((e) => e.block_id === blockId);
		if (!evaluation || !evaluation.scores) return null;
		return evaluation.scores;
	}

	function getScoreColor(score) {
		if (!score || typeof score !== 'number') return 'text-gray-600 bg-gray-100';
		if (score >= 8) return 'text-green-600 bg-green-100';
		if (score >= 6) return 'text-blue-600 bg-blue-100';
		if (score >= 4) return 'text-orange-600 bg-orange-100';
		return 'text-red-600 bg-red-100';
	}

	function getSafeScore(evaluation, metric) {
		if (!evaluation || !evaluation.scores || typeof evaluation.scores !== 'object') {
			return null;
		}
		const score = evaluation.scores[metric];
		return typeof score === 'number' ? score : null;
	}

	function getSafeScoreDisplay(evaluation, metric) {
		const score = getSafeScore(evaluation, metric);
		return score !== null ? score : 'N/A';
	}

	async function loadEvaluations() {
		loading = true;
		error = null;

		try {
			console.log('🔄 Loading evaluations from /evaluation.json...');
			const response = await fetch('/evaluation.json');
			if (!response.ok) {
				throw new Error(`Failed to load evaluations: ${response.statusText}`);
			}
			const data = await response.json();
			console.log('📊 Raw data received:', { hasData: !!data, type: typeof data });

			if (!data || typeof data !== 'object') {
				throw new Error('Invalid evaluation data format');
			}

			const rawEvaluations = data.evaluations;
			if (!Array.isArray(rawEvaluations)) {
				throw new Error('Evaluations is not an array');
			}

			// Validate and sanitize the data
			const validEvaluations = rawEvaluations.filter((evaluation) => {
				return (
					evaluation &&
					typeof evaluation === 'object' &&
					evaluation.scores &&
					typeof evaluation.scores === 'object'
				);
			});

			evaluations = validEvaluations;
			console.log(
				`✅ Loaded ${evaluations.length} valid evaluations out of ${rawEvaluations.length} total`
			);
			console.log(
				'🔍 First 3 evaluation IDs:',
				evaluations.slice(0, 3).map((e) => e.block_id)
			);
		} catch (err) {
			error = err.message;
			evaluations = []; // Ensure it's always an array
			console.error('❌ Error loading evaluations:', err);
		} finally {
			loading = false;
		}
	}

	async function loadSettings() {
		try {
			const response = await fetch('/api/settings?key=analytics_thresholds');
			const result = await response.json();

			if (result.success && result.data) {
				// Load the quality slider value instead of individual thresholds
				qualitySlider = result.data.qualitySlider || 50;
				console.log('✅ Loaded analytics settings from database');
			}
		} catch (error) {
			console.error('Error loading analytics settings:', error);
			// Use defaults if loading fails
		}
	}

	async function saveSettings() {
		try {
			const response = await fetch('/api/settings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					key: 'analytics_thresholds',
					value: { qualitySlider },
					description: 'Content quality slider setting for analytics recommendations'
				})
			});

			const result = await response.json();
			if (result.success) {
				console.log('✅ Saved analytics settings to database');
			} else {
				console.error('Failed to save settings:', result.error);
			}
		} catch (error) {
			console.error('Error saving analytics settings:', error);
		}
	}

	// Auto-save settings when slider changes (with debounce)
	let saveTimeout = null;
	$effect(() => {
		// Watch for slider changes
		qualitySlider;

		// Clear existing timeout
		if (saveTimeout) {
			clearTimeout(saveTimeout);
		}

		// Set new timeout to save after 1 second of no changes
		saveTimeout = setTimeout(async () => {
			await saveSettings();
		}, 1000);
	});

	onMount(async () => {
		await loadSettings();
		await loadEvaluations();
	});
</script>

<!-- Analytics Sidebar -->
<div
	class="fixed top-0 right-0 z-40 h-full border-l border-gray-200 bg-white shadow-lg transition-all duration-300 {isExpanded
		? 'w-96'
		: 'w-12'}"
>
	<!-- Toggle Button -->
	<button
		onclick={() => (isExpanded = !isExpanded)}
		class="absolute top-4 left-0 -translate-x-full transform rounded-l-lg bg-orange-600 p-2 text-white transition-colors hover:bg-orange-700"
		title={isExpanded ? 'Collapse Analytics' : 'Expand Analytics'}
	>
		{#if isExpanded}
			📊 ✕
		{:else}
			📊
		{/if}
	</button>

	{#if isExpanded}
		<div class="h-full overflow-y-auto p-4">
			<!-- Header -->
			<div class="mb-4">
				<h3 class="mb-1 text-lg font-semibold text-gray-900">📊 Analytics</h3>
				<p class="text-xs text-gray-500">LLM Content Analysis</p>
			</div>

			{#if loading}
				<div class="flex items-center justify-center py-8">
					<div class="text-center">
						<div
							class="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-orange-600"
						></div>
						<p class="text-xs text-gray-600">Loading...</p>
					</div>
				</div>
			{:else if error}
				<div class="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
					<div class="text-xs font-medium text-red-800">Error loading data</div>
					<p class="mt-1 text-xs text-red-700">{error}</p>
				</div>
			{:else}
				<!-- Quick Stats -->
				{#if stats}
					<div class="mb-4 grid grid-cols-2 gap-2">
						<div class="rounded-lg bg-blue-50 p-2 text-center">
							<div class="text-lg font-bold text-blue-600">{stats.total}</div>
							<div class="text-xs text-blue-600">Total</div>
						</div>
						<div class="rounded-lg bg-green-50 p-2 text-center">
							<div class="text-lg font-bold text-green-600">{stats.filtered}</div>
							<div class="text-xs text-green-600">Filtered</div>
						</div>
					</div>

					<!-- Key Metrics -->
					<div class="mb-4 space-y-2">
						<div class="text-xs font-medium text-gray-700">Avg Scores</div>
						{#each ['relatability', 'accessibility', 'emotional_resonance', 'theological_depth'] as metric}
							{#if stats[metric]}
								<div class="flex justify-between text-xs">
									<span class="text-gray-600 capitalize">{metric.replace('_', ' ')}</span>
									<span class="font-medium">{stats[metric].avg}</span>
								</div>
							{/if}
						{/each}
					</div>
				{/if}

				<!-- Recommendations Summary -->
				{#if recommendationCounts}
					<div class="mb-4">
						<div class="mb-2 text-xs font-medium text-gray-700">Recommendations</div>
						<div class="space-y-1">
							<div class="flex justify-between text-xs">
								<span class="text-green-600">🟢 Keep</span>
								<span class="font-medium">{recommendationCounts.keepCount}</span>
							</div>
							<div class="flex justify-between text-xs">
								<span class="text-orange-600">🟡 Edit</span>
								<span class="font-medium">{recommendationCounts.editCount}</span>
							</div>
							<div class="flex justify-between text-xs">
								<span class="text-red-600">🔴 Remove</span>
								<span class="font-medium">{recommendationCounts.removeCount}</span>
							</div>
						</div>
					</div>
				{/if}

				<!-- Content Quality Slider -->
				<div class="mb-4">
					<div class="mb-2 text-xs font-medium text-gray-700">🎯 Content Quality Standards</div>
					<div class="mb-3 text-xs text-gray-500">Balance strictness vs. leniency</div>

					<div class="rounded-lg bg-gradient-to-r from-red-50 via-yellow-50 to-green-50 p-3">
						<div class="mb-2 flex justify-between text-xs">
							<span class="font-medium text-red-600">Strict</span>
							<span class="text-gray-600">Quality Level: {Math.round(qualitySlider)}</span>
							<span class="font-medium text-green-600">Lenient</span>
						</div>

						<input
							type="range"
							bind:value={qualitySlider}
							min="0"
							max="100"
							step="1"
							class="slider h-2 w-full cursor-pointer appearance-none rounded-lg bg-gradient-to-r from-red-300 via-yellow-300 to-green-300"
						/>

						<div class="mt-2 flex justify-between text-xs text-gray-600">
							<span>Fewer 🟢</span>
							<span>More 🟢</span>
						</div>
					</div>

					<!-- Current Thresholds Display -->
					<div class="mt-3 rounded bg-gray-50 p-2 text-xs">
						<div class="mb-1 font-medium">Current Thresholds:</div>
						<div class="space-y-1 text-xs">
							<div class="text-green-600">
								🟢 Green: Relatability {thresholds.green_min_relatability}+ AND Accessibility {thresholds.green_min_accessibility}+
							</div>
							<div class="text-red-600">
								🔴 Red: Emotion ≤{thresholds.red_max_emotional_resonance} OR Combo &lt;{thresholds.red_combo_threshold}
							</div>
							<div class="text-orange-600">
								🟡 Orange: Everything else (theology/historical OK if relatable!)
							</div>
						</div>
					</div>
				</div>

				<!-- Search -->
				<input
					bind:value={searchQuery}
					placeholder="Search content..."
					class="mb-4 w-full rounded border border-gray-300 px-2 py-1 text-xs focus:border-transparent focus:ring-1 focus:ring-orange-500"
				/>

				<!-- Content List -->
				<div class="mb-2 text-xs font-medium text-gray-700">
					Content Blocks ({Array.isArray(filteredEvaluations) ? filteredEvaluations.length : 0})
				</div>
				<div class="max-h-64 space-y-2 overflow-y-auto">
					{#each Array.isArray(filteredEvaluations) ? filteredEvaluations.slice(0, 20) : [] as evaluation}
						{@const recommendation = getRecommendation(evaluation?.scores)}
						<div class="rounded border border-gray-200 p-2 text-xs">
							<div class="mb-1 flex items-center justify-between">
								<span
									class="inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium
                             bg-{recommendation.color}-100 text-{recommendation.color}-800"
								>
									{recommendation.label}
								</span>
								<div class="flex gap-1">
									{#each ['relatability', 'accessibility'] as metric}
										{@const score = getSafeScore(evaluation, metric)}
										<span class="text-xs font-medium {getScoreColor(score)} rounded px-1 py-0.5">
											{getSafeScoreDisplay(evaluation, metric)}
										</span>
									{/each}
								</div>
							</div>
							<p class="leading-tight text-gray-700">
								{evaluation.content_full && typeof evaluation.content_full === 'string'
									? evaluation.content_full.substring(0, 80) + '...'
									: 'No content available'}
							</p>
						</div>
					{/each}

					{#if Array.isArray(filteredEvaluations) && filteredEvaluations.length > 20}
						<div class="py-2 text-center text-xs text-gray-500">
							+{filteredEvaluations.length - 20} more blocks
						</div>
					{/if}
				</div>

				<!-- Full Analytics functionality will be integrated here later -->
			{/if}
		</div>
	{/if}
</div>

<style>
	/* Custom scrollbar for content list */
	.max-h-64::-webkit-scrollbar {
		width: 4px;
	}

	.max-h-64::-webkit-scrollbar-track {
		background: #f1f5f9;
		border-radius: 2px;
	}

	.max-h-64::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 2px;
	}

	.max-h-64::-webkit-scrollbar-thumb:hover {
		background: #94a3b8;
	}
</style>

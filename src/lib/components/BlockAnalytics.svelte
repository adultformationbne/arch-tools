<script>
	let { blockId, getBlockRecommendation, getBlockScores, compact = false } = $props();

	// Get analytics data
	let recommendation = $derived(() => {
		try {
			if (!getBlockRecommendation) {
				console.log(`⚠️ getBlockRecommendation function not available for block ${blockId}`);
				return null;
			}
			const result = getBlockRecommendation(blockId);
			console.log(`🎯 Recommendation for ${blockId}:`, result);
			return result;
		} catch (e) {
			console.error(`❌ Error getting recommendation for ${blockId}:`, e);
			return null;
		}
	});

	let scores = $derived(() => {
		try {
			return getBlockScores ? getBlockScores(blockId) : null;
		} catch {
			return null;
		}
	});

	// Show tooltip
	let showTooltip = $state(false);

	function getTrafficLightIcon(type) {
		switch (type) {
			case 'keep':
				return '🟢';
			case 'edit':
				return '🟡';
			case 'remove':
				return '🔴';
			default:
				return '⚪';
		}
	}

	function getTrafficLightText(type) {
		switch (type) {
			case 'keep':
				return 'Keep - Good content';
			case 'edit':
				return 'Edit - Needs improvement';
			case 'remove':
				return 'Remove - Poor fit';
			default:
				return 'No analysis available';
		}
	}

	function formatScore(score) {
		return typeof score === 'number' ? score.toFixed(1) : 'N/A';
	}
</script>

{#if recommendation}
	<div class="relative inline-block">
		<!-- Traffic Light Indicator -->
		<div
			class="analytics-indicator {compact ? 'text-sm' : 'text-base'} cursor-help"
			onmouseenter={() => (showTooltip = true)}
			onmouseleave={() => (showTooltip = false)}
			title={getTrafficLightText(recommendation.type)}
		>
			{getTrafficLightIcon(recommendation.type)}
		</div>

		<!-- Detailed Tooltip -->
		{#if showTooltip && scores}
			<div
				class="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg bg-gray-900 p-3 text-xs text-white shadow-lg"
			>
				<!-- Arrow -->
				<div
					class="absolute top-full left-4 h-0 w-0 border-t-4 border-r-4 border-l-4 border-transparent border-t-gray-900"
				></div>

				<!-- Header -->
				<div class="mb-2 flex items-center gap-2 font-medium">
					{getTrafficLightIcon(recommendation.type)}
					<span class="capitalize">{recommendation.label}</span>
				</div>

				<!-- Scores Grid -->
				<div class="grid grid-cols-2 gap-2 text-xs">
					<div class="space-y-1">
						<div class="flex justify-between">
							<span class="text-gray-300">Relatability:</span>
							<span
								class="font-mono {scores.relatability >= 7
									? 'text-green-400'
									: scores.relatability >= 5
										? 'text-yellow-400'
										: 'text-red-400'}"
							>
								{formatScore(scores.relatability)}
							</span>
						</div>

						<div class="flex justify-between">
							<span class="text-gray-300">Accessibility:</span>
							<span
								class="font-mono {scores.accessibility >= 7
									? 'text-green-400'
									: scores.accessibility >= 5
										? 'text-yellow-400'
										: 'text-red-400'}"
							>
								{formatScore(scores.accessibility)}
							</span>
						</div>

						<div class="flex justify-between">
							<span class="text-gray-300">Emotion:</span>
							<span
								class="font-mono {scores.emotional_resonance >= 7
									? 'text-green-400'
									: scores.emotional_resonance >= 5
										? 'text-yellow-400'
										: 'text-red-400'}"
							>
								{formatScore(scores.emotional_resonance)}
							</span>
						</div>
					</div>

					<div class="space-y-1">
						<div class="flex justify-between">
							<span class="text-gray-300">Theology:</span>
							<span
								class="font-mono {scores.theological_depth <= 5
									? 'text-green-400'
									: scores.theological_depth <= 7
										? 'text-yellow-400'
										: 'text-red-400'}"
							>
								{formatScore(scores.theological_depth)}
							</span>
						</div>

						<div class="flex justify-between">
							<span class="text-gray-300">Practical:</span>
							<span
								class="font-mono {scores.practical_application >= 7
									? 'text-green-400'
									: scores.practical_application >= 5
										? 'text-yellow-400'
										: 'text-red-400'}"
							>
								{formatScore(scores.practical_application)}
							</span>
						</div>

						<div class="flex justify-between">
							<span class="text-gray-300">Historical:</span>
							<span
								class="font-mono {scores.historical_focus <= 5
									? 'text-green-400'
									: scores.historical_focus <= 7
										? 'text-yellow-400'
										: 'text-red-400'}"
							>
								{formatScore(scores.historical_focus)}
							</span>
						</div>
					</div>
				</div>

				<!-- Quick interpretation -->
				<div class="mt-2 border-t border-gray-700 pt-2 text-xs text-gray-300">
					{#if recommendation.type === 'keep'}
						✅ High relatability & accessibility, good for modern readers
					{:else if recommendation.type === 'edit'}
						✏️ Has potential but needs editing for better engagement
					{:else if recommendation.type === 'remove'}
						❌ Too complex, dry, or historically focused for target audience
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.analytics-indicator {
		opacity: 0.8;
		transition: opacity 0.2s ease;
	}

	.analytics-indicator:hover {
		opacity: 1;
		filter: drop-shadow(0 0 4px rgba(0, 0, 0, 0.3));
	}
</style>

<script>
	let { blockId, evaluations = [], showTooltip = false } = $props();

	// Debug: just for the known good ID
	$effect(() => {
		if (blockId === 'a69696b7-84ce-4daf-a94f-38993e7852af' && evaluations.length > 0) {
			console.log(`🔍 Testing lookup for known block a69696b7...`);
			const test = evaluations.find((e) => e.block_id === 'a69696b7-84ce-4daf-a94f-38993e7852af');
			console.log(`Result:`, test ? 'FOUND!' : 'NOT FOUND');
			if (test) {
				console.log('Scores:', test.scores);
				console.log('Recommendation value:', recommendation);

				// Manual calculation for debug
				const s = test.scores;
				const relatability = s.relatability || 0;
				const accessibility = s.accessibility || 0;
				const theological_depth = s.theological_depth || 0;
				const emotional_resonance = s.emotional_resonance || 0;

				console.log('Manual calc:', {
					relatability,
					accessibility,
					theological_depth,
					emotional_resonance
				});

				if (relatability >= 6 && accessibility >= 7 && theological_depth <= 6) {
					console.log('Should be GREEN');
				} else if (relatability <= 3 || emotional_resonance <= 3 || theological_depth >= 8) {
					console.log('Should be RED');
				} else {
					console.log('Should be ORANGE');
				}
			}
		}
	});

	// Find evaluation for this block and calculate recommendation
	let result = $derived.by(() => {
		const evaluation = evaluations.find((e) => e.block_id === blockId);

		if (!evaluation || !evaluation.scores) {
			return { evaluation: null, recommendation: 'none' };
		}

		const s = evaluation.scores;
		const relatability = s.relatability || 0;
		const accessibility = s.accessibility || 0;
		const emotional_resonance = s.emotional_resonance || 0;

		// Simple thresholds for now - will be replaced by parent's algorithm
		let recommendation;
		// Green: High relatability AND accessibility
		if (relatability >= 6 && accessibility >= 6) {
			recommendation = 'green';
		}
		// Red: Poor emotional connection OR poor combo
		else if (emotional_resonance <= 3 || relatability + accessibility < 8) {
			recommendation = 'red';
		}
		// Orange: Everything else
		else {
			recommendation = 'orange';
		}

		return { evaluation, recommendation };
	});

	let evaluation = $derived(result.evaluation);
	let recommendation = $derived(result.recommendation);

	// Get color for dot
	function getDotColor(type) {
		switch (type) {
			case 'green':
				return 'bg-green-500';
			case 'orange':
				return 'bg-orange-500';
			case 'red':
				return 'bg-red-500';
			default:
				return 'bg-gray-300';
		}
	}

	function getText(type) {
		switch (type) {
			case 'green':
				return 'Keep - Good content';
			case 'orange':
				return 'Edit - Needs improvement';
			case 'red':
				return 'Remove - Poor fit';
			default:
				return 'No analysis available';
		}
	}

	let showHover = $state(false);
</script>

{#if evaluation}
	<div
		class="relative"
		onmouseenter={() => (showHover = true)}
		onmouseleave={() => (showHover = false)}
		title={getText(recommendation)}
	>
		<!-- Small colored dot -->
		<div
			class="h-2 w-2 rounded-full {getDotColor(
				recommendation
			)} cursor-help opacity-70 transition-opacity hover:opacity-100"
		></div>

		{#if showHover && showTooltip && evaluation?.scores}
			<div
				class="absolute right-0 bottom-full z-50 mb-2 w-48 rounded-lg bg-gray-900 p-3 text-xs text-white shadow-lg"
			>
				<div class="mb-2 font-bold">{getText(recommendation)}</div>

				<div class="space-y-1">
					<div>Relatability: {evaluation.scores.relatability || 'N/A'}</div>
					<div>Accessibility: {evaluation.scores.accessibility || 'N/A'}</div>
					<div>Theology: {evaluation.scores.theological_depth || 'N/A'}</div>
					<div>Emotion: {evaluation.scores.emotional_resonance || 'N/A'}</div>
				</div>

				<!-- Arrow -->
				<div
					class="absolute top-full right-4 h-0 w-0 border-t-4 border-r-4 border-l-4 border-transparent border-t-gray-900"
				></div>
			</div>
		{/if}
	</div>
{:else}
	<!-- No evaluation data - very subtle gray dot -->
	<div class="h-1.5 w-1.5 rounded-full bg-gray-200 opacity-30"></div>
{/if}

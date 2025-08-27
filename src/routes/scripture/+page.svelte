<script lang="ts">
	import ScriptureReader from '$lib/components/ScriptureReader.svelte';
</script>

<svelte:head>
	<title>Scripture Reader - Archdiocesan Ministry Tools</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="mb-8">
			<h1 class="mb-2 text-3xl font-bold text-gray-900">Scripture Reader</h1>
			<p class="text-gray-600">
				Look up Bible passages and daily Gospel readings from the Brisbane Catholic liturgical
				calendar
			</p>
		</div>
	</div>

	<ScriptureReader
		initialPassage="John 3:16"
		showGospelPicker={true}
		showPopularPassages={true}
		region="australia.brisbane"
	/>
</div>

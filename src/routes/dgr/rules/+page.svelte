<script>
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGRAssignmentRules from '$lib/components/DGRAssignmentRules.svelte';

	let rules = $state([]);
</script>

<div class="mx-auto max-w-7xl p-6">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900">Assignment Rules</h1>
		<p class="mt-1 text-sm text-gray-600">
			Configure rules to control when contributors can be automatically assigned based on the liturgical calendar
		</p>
	</div>

	<DGRAssignmentRules bind:rules />
</div>

<ToastContainer />

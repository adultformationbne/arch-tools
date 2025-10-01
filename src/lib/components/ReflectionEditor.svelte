<script>
	import { Edit3, Save, X } from 'lucide-svelte';

	let {
		reflectionQuestion = '',
		onReflectionChange = () => {},
		placeholder = 'Write the reflection question for this week...'
	} = $props();

	let editingReflection = $state(false);
	let editingQuestion = $state('');

	const startEditReflection = () => {
		editingReflection = true;
		editingQuestion = reflectionQuestion;
	};

	const saveReflectionQuestion = () => {
		onReflectionChange(editingQuestion);
		editingReflection = false;
	};

	const cancelEditReflection = () => {
		editingReflection = false;
		editingQuestion = '';
	};
</script>

<div class="bg-white rounded-2xl p-6 shadow-sm">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-xl font-bold text-gray-800">Reflection Question</h2>
		{#if !editingReflection}
			<button
				onclick={startEditReflection}
				class="p-2 text-blue-600 hover:text-blue-800"
				title="Edit reflection question"
			>
				<Edit3 size="16" />
			</button>
		{/if}
	</div>

	{#if editingReflection}
		<div>
			<textarea
				bind:value={editingQuestion}
				{placeholder}
				rows="6"
				class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none mb-4"
				style="focus:ring-color: #c59a6b;"
			></textarea>
			<div class="flex gap-2">
				<button
					onclick={saveReflectionQuestion}
					class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded font-semibold hover:bg-green-700"
				>
					<Save size="16" />
					Save
				</button>
				<button
					onclick={cancelEditReflection}
					class="flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded font-semibold hover:bg-gray-600"
				>
					<X size="16" />
					Cancel
				</button>
			</div>
		</div>
	{:else}
		<div class="text-gray-800 leading-relaxed">
			{#if reflectionQuestion}
				<p class="italic">"{reflectionQuestion}"</p>
			{:else}
				<p class="text-gray-500 italic">No reflection question set</p>
			{/if}
		</div>
	{/if}
</div>
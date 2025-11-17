<script>
	import { Edit3, Save, X, Plus } from 'lucide-svelte';

	let {
		reflectionQuestion = '',
		reflectionsEnabled = true,
		onReflectionChange = () => {},
		onReflectionsEnabledChange = () => {},
		placeholder = 'Write the reflection question for this week...',
		sessionNumber = 1
	} = $props();

	let editingReflection = $state(false);
	let editingQuestion = $state('');

	const hasQuestion = $derived(reflectionQuestion?.trim().length > 0);

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

	const toggleReflectionsEnabled = () => {
		onReflectionsEnabledChange(!reflectionsEnabled);
	};
</script>

<div class="bg-white rounded-2xl p-6 shadow-sm">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-xl font-bold text-gray-800">Reflection Question</h2>
		{#if hasQuestion && !editingReflection}
			<div class="flex items-center gap-3">
				<!-- Edit button -->
				<button
					onclick={startEditReflection}
					class="p-2 text-blue-600 hover:text-blue-800"
					title="Edit reflection question"
				>
					<Edit3 size="16" />
				</button>
				<!-- iOS-style toggle (only show if question exists) -->
				<label class="relative inline-block w-11 h-6 cursor-pointer">
					<input
						type="checkbox"
						checked={reflectionsEnabled}
						onchange={toggleReflectionsEnabled}
						class="sr-only peer"
					/>
					<div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
				</label>
			</div>
		{/if}
	</div>

	{#if editingReflection}
		<!-- Editing State -->
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
					Save Question
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
	{:else if hasQuestion}
		<!-- Question exists - show question text -->
		<div class="text-gray-800 leading-relaxed">
			<p class="italic">"{reflectionQuestion}"</p>
		</div>
	{:else}
		<!-- No question - show add button -->
		<div class="text-center py-8">
			<p class="text-gray-500 mb-4">No reflection question set for this session</p>
			<button
				onclick={startEditReflection}
				class="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors mx-auto"
			>
				<Plus size="20" />
				Add Reflection Question
			</button>
		</div>
	{/if}
</div>
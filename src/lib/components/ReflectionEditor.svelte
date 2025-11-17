<script>
	import { Edit3, Save, X, Info } from 'lucide-svelte';

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

<div class="bg-white rounded-2xl p-6 shadow-sm {!reflectionsEnabled ? 'opacity-50' : ''}">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-xl font-bold text-gray-800">Reflection Question</h2>
		<div class="flex items-center gap-3">
			<!-- iOS-style toggle -->
			<label class="relative inline-block w-11 h-6 cursor-pointer">
				<input
					type="checkbox"
					checked={reflectionsEnabled}
					onchange={toggleReflectionsEnabled}
					class="sr-only peer"
				/>
				<div class="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
			</label>
			{#if !editingReflection && reflectionsEnabled}
				<button
					onclick={startEditReflection}
					class="p-2 text-blue-600 hover:text-blue-800"
					title="Edit reflection question"
				>
					<Edit3 size="16" />
				</button>
			{/if}
		</div>
	</div>

	{#if !reflectionsEnabled}
		<div class="text-gray-500 leading-relaxed italic">
			Reflections disabled for this session
		</div>
	{:else if editingReflection}
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
		<!-- Display State -->
		<div class="text-gray-800 leading-relaxed">
			{#if reflectionQuestion}
				<p class="italic">"{reflectionQuestion}"</p>
			{:else}
				<p class="text-gray-500 italic">No reflection question set</p>
			{/if}
		</div>
	{/if}
</div>
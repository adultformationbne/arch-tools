<script>
	import { Plus, Trash2 } from '$lib/icons';

	let {
		reflectionQuestion = '',
		onReflectionChange = () => {},
		placeholder = 'Write the reflection question for this week...',
		sessionNumber = 1
	} = $props();

	let isEditing = $state(false);
	let textareaValue = $state('');
	let previousSessionNumber = $state(sessionNumber);

	const hasQuestion = $derived(reflectionQuestion?.trim().length > 0);

	const startEditing = () => {
		isEditing = true;
		textareaValue = reflectionQuestion;
	};

	const handleInput = (e) => {
		textareaValue = e.target.value;
	};

	const handleBlur = () => {
		// Save changes (always enabled by default)
		onReflectionChange(textareaValue);
		// Stay in edit mode if there's content, otherwise go back to button
		if (!textareaValue.trim()) {
			isEditing = false;
		}
	};

	const deleteQuestion = () => {
		// Clear the question
		textareaValue = '';
		onReflectionChange('');
		isEditing = false;
	};

	// Sync with prop changes
	$effect(() => {
		// Session changed - reset everything
		if (sessionNumber !== previousSessionNumber) {
			isEditing = hasQuestion;
			textareaValue = reflectionQuestion;
			previousSessionNumber = sessionNumber;
		} else {
			// Same session - sync the value
			textareaValue = reflectionQuestion;
			// Show textarea if there's a question
			if (hasQuestion && !isEditing) {
				isEditing = true;
			}
		}
	});
</script>

<div class="bg-white rounded-2xl p-6 shadow-sm">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-xl font-bold text-gray-800">Reflection Question</h2>
		{#if hasQuestion || isEditing}
			<!-- Trash icon to delete question -->
			<button
				onclick={deleteQuestion}
				class="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
				title="Delete reflection question"
			>
				<Trash2 size="18" />
			</button>
		{/if}
	</div>

	{#if hasQuestion || isEditing}
		<!-- Show textarea when editing or has question -->
		<textarea
			value={textareaValue}
			oninput={handleInput}
			onblur={handleBlur}
			{placeholder}
			rows="6"
			class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent resize-none"
			style="focus:ring-color: #c59a6b;"
		></textarea>
	{:else}
		<!-- Show Add button when no question -->
		<button
			onclick={startEditing}
			class="w-full flex items-center justify-center gap-2 px-6 py-4 text-white rounded-lg font-semibold transition-all hover:opacity-90"
			style="background-color: var(--course-accent-dark, #334642);"
		>
			<Plus size="20" />
			Add Reflection Question
		</button>
	{/if}
</div>
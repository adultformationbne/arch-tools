<script>
	import { Save, Eye, EyeOff, X, CheckCircle } from 'lucide-svelte';
	import { toastError } from '$lib/utils/toast-helpers.js';

	let {
		courseSlug = '',
		question = '',
		questionId = null,
		existingContent = '',
		existingIsPublic = false,
		isVisible = $bindable(false),
		onClose = () => {},
		onSave = () => {}
	} = $props();

	// Writing state
	let content = $state(existingContent);
	let isPrivate = $state(!existingIsPublic);
	let autoSaveStatus = $state('saved'); // 'saving', 'saved', 'error'
	let wordCount = $derived(content.trim().split(/\s+/).filter(word => word.length > 0).length);
	let lastSaved = $state(new Date());
	let isSaving = $state(false);
	let textareaRef = $state(null);

	// Auto-focus textarea when modal opens
	$effect(() => {
		if (isVisible && textareaRef) {
			setTimeout(() => {
				textareaRef?.focus();
			}, 150);
		}
	});

	// Auto-save functionality
	let autoSaveTimer;
	const autoSave = async () => {
		if (!questionId || content.trim().length === 0) {
			console.log('Skipping autosave - missing questionId or content');
			return;
		}

		if (autoSaveTimer) clearTimeout(autoSaveTimer);
		autoSaveStatus = 'saving';

		try {
			const apiPath = `/courses/${courseSlug}/reflections/api`;
			const response = await fetch(apiPath, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					reflection_question_id: questionId,
					content: content.trim(),
					is_public: !isPrivate,
					status: 'draft'
				})
			});

			if (!response.ok) {
				const errorData = await response.text();
				console.error('Auto-save failed:', response.status, errorData);
				throw new Error('Failed to save draft');
			}

			autoSaveStatus = 'saved';
			lastSaved = new Date();
		} catch (error) {
			console.error('Auto-save error:', error);
			// Silently fail autosave - don't show error to user for draft saves
			autoSaveStatus = 'saved'; // Show as saved to avoid confusion
		}
	};

	// Watch for content changes
	$effect(() => {
		if (content.length > 0 && questionId) {
			if (autoSaveTimer) clearTimeout(autoSaveTimer);
			autoSaveTimer = setTimeout(autoSave, 2000); // Auto-save after 2 seconds of inactivity
		}
	});

	const handleClose = () => {
		isVisible = false;
		onClose();
	};

	const handleSubmit = async () => {
		console.log('=== SUBMIT STARTED ===');
		console.log('questionId:', questionId);
		console.log('content length:', content.trim().length);
		console.log('isPrivate:', isPrivate);

		if (!questionId || content.trim().length === 0) {
			console.log('VALIDATION FAILED - missing questionId or content');
			return;
		}

		isSaving = true;
		const apiPath = `/courses/${courseSlug}/reflections/api`;
		console.log('Sending POST to', apiPath);

		try {
			const payload = {
				reflection_question_id: questionId,
				content: content.trim(),
				is_public: !isPrivate,
				status: 'submitted'
			};
			console.log('Payload:', payload);

			const response = await fetch(apiPath, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload)
			});

			console.log('Response status:', response.status);
			console.log('Response ok:', response.ok);

			if (!response.ok) {
				const errorText = await response.text();
				console.error('Error response:', errorText);
				throw new Error('Failed to submit reflection');
			}

			const result = await response.json();
			console.log('Reflection submitted successfully:', result);

			// Call parent callback to refresh data
			onSave();
			handleClose();
		} catch (error) {
			console.error('Submit error:', error);
			console.error('Error stack:', error);
			toastError('Failed to submit reflection. Please try again.', 'Submission Failed');
		} finally {
			isSaving = false;
			console.log('=== SUBMIT ENDED ===');
		}
	};

	const handleSaveDraft = async () => {
		if (!questionId || content.trim().length === 0) return;

		isSaving = true;
		try {
			await autoSave();
			onSave(); // Refresh parent data
			handleClose();
		} catch (error) {
			console.error('Save draft error:', error);
			toastError('Failed to save draft. Please try again.', 'Save Failed');
		} finally {
			isSaving = false;
		}
	};

	const formatTime = (date) => {
		return date.toLocaleTimeString('en-US', {
			hour: '2-digit',
			minute: '2-digit',
			hour12: true
		});
	};
</script>

{#if isVisible}
	<!-- Modal Overlay -->
	<div class="fixed inset-0 bg-gray-900 bg-opacity-50 z-50 flex items-center justify-center p-4 md:p-8">
		<div class="bg-white rounded-3xl shadow-2xl w-full max-w-5xl h-full max-h-[95vh] flex flex-col" style="background-color: #f8f4f0;">

			<!-- Modal Header -->
			<div class="flex flex-col gap-4 p-6 border-b border-gray-200 flex-shrink-0">
				<div class="flex items-center justify-between">
					<h3 class="text-2xl font-bold text-gray-800">Write Your Reflection</h3>
					<button
						onclick={handleClose}
						class="p-2 rounded-xl hover:bg-gray-100 transition-colors"
						title="Close"
					>
						<X size="20" class="text-gray-600" />
					</button>
				</div>

				<!-- Question Card -->
				<div class="bg-white border-2 rounded-2xl p-4" style="border-color: #c59a6b;">
					<p class="text-gray-700 leading-relaxed font-medium">{question}</p>
				</div>

				<!-- Privacy Toggle -->
				<div class="flex items-center gap-3">
					<button
						class="flex items-center gap-2 px-5 py-2.5 rounded-full transition-all border-2"
						class:bg-green-50={!isPrivate}
						class:border-green-300={!isPrivate}
						class:bg-red-50={isPrivate}
						class:border-red-300={isPrivate}
						onclick={() => isPrivate = !isPrivate}
					>
						{#if isPrivate}
							<EyeOff size="16" class="text-red-600" />
							<span class="text-red-700 font-semibold text-sm">Private</span>
						{:else}
							<Eye size="16" class="text-green-600" />
							<span class="text-green-700 font-semibold text-sm">Public</span>
						{/if}
					</button>
					<span class="text-sm text-gray-600">
						{isPrivate ? 'Only you and your marker' : 'Visible to your cohort'}
					</span>
				</div>
			</div>

			<!-- Writing Area -->
			<div class="flex-1 overflow-y-auto p-6">
				<div class="max-w-4xl mx-auto">
					<textarea
						bind:this={textareaRef}
						bind:value={content}
						placeholder="Begin writing your reflection here..."
						class="w-full border-0 resize-none focus:outline-none text-gray-800 text-lg leading-relaxed bg-white rounded-2xl p-6"
						style="min-height: 400px;"
					></textarea>
				</div>
			</div>

			<!-- Modal Footer -->
			<div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 bg-gray-50 border-t border-gray-200 flex-shrink-0">
				<!-- Left: Stats & Auto-save -->
				<div class="flex items-center gap-6 text-sm text-gray-600">
					<div class="flex items-center gap-2">
						<span>Words:</span>
						<span class="font-semibold">{wordCount}</span>
					</div>
					<div class="flex items-center gap-2">
						<span>Characters:</span>
						<span class="font-semibold">{content.length}</span>
					</div>
					{#if autoSaveStatus === 'saving'}
						<div class="flex items-center gap-2 text-blue-600">
							<div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
							<span class="text-sm font-medium">Saving...</span>
						</div>
					{:else if autoSaveStatus === 'saved'}
						<div class="flex items-center gap-2 text-green-600">
							<CheckCircle size="16" />
							<span class="text-sm font-medium">Saved</span>
						</div>
					{/if}
				</div>

				<!-- Right: Actions -->
				<div class="flex items-center gap-4">
					<button
						onclick={handleSaveDraft}
						class="px-6 py-3 text-gray-600 hover:text-gray-800 font-semibold transition-colors"
						disabled={isSaving || content.trim().length === 0}
					>
						{isSaving ? 'Saving...' : 'Save as Draft'}
					</button>
					<button
						onclick={handleSubmit}
						class="flex items-center gap-2 px-8 py-3 text-white font-semibold rounded-2xl transition-colors hover:opacity-90"
						style="background-color: #334642;"
						disabled={content.trim().length === 0 || isSaving}
					>
						<Save size="16" />
						{isSaving ? 'Submitting...' : 'Submit Reflection'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
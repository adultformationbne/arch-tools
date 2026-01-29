<script>
	import { goto } from '$app/navigation';
	import { Save, Send, Eye, EyeOff, X, CheckCircle, ArrowLeft } from '$lib/icons';
	import SimplifiedRichTextEditor from '$lib/components/SimplifiedRichTextEditor.svelte';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { getStatusLabel, isComplete, normalizeStatus } from '$lib/utils/reflection-status';
	import ReflectionStatusBadge from '$lib/components/ReflectionStatusBadge.svelte';

	let { data } = $props();
	const question = $derived(data.question);
	const courseSlug = $derived(data.courseSlug);
	const questionId = $derived(data.questionId);
	const existingReflection = $derived(data.existingReflection);
	const isEditable = $derived(data.isEditable);

	// Writing state (initialized from data directly)
	let content = $state(data.existingReflection?.response_text || '');
	let isPrivate = $state(!(data.existingReflection?.is_public ?? false));
	let autoSaveStatus = $state('saved');
	let lastSaved = $state(new Date());
	let isSaving = $state(false);

	// Word count calculation
	const getWordCount = (html) => {
		const text = html.replace(/<[^>]*>/g, ' ').trim();
		const words = text.split(/\s+/).filter(word => word.length > 0);
		return words.length;
	};

	let wordCount = $derived(getWordCount(content));

	// Auto-save functionality
	let autoSaveTimer;
	const autoSave = async () => {
		if (!questionId || content.trim().length === 0 || !isEditable) return;

		if (autoSaveTimer) clearTimeout(autoSaveTimer);
		autoSaveStatus = 'saving';

		try {
			const response = await fetch(`/courses/${courseSlug}/reflections/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					reflection_question_id: questionId,
					content: content.trim(),
					is_public: !isPrivate,
					status: 'draft'
				})
			});

			if (!response.ok) throw new Error('Failed to save draft');

			autoSaveStatus = 'saved';
			lastSaved = new Date();
		} catch (error) {
			console.error('Auto-save error:', error);
			autoSaveStatus = 'saved'; // Silent fail
		}
	};

	// Watch for content changes (only auto-save if editable)
	$effect(() => {
		if (content && content.length > 0 && questionId && isEditable) {
			if (autoSaveTimer) clearTimeout(autoSaveTimer);
			autoSaveTimer = setTimeout(autoSave, 2000);
		}
	});

	const handleSaveDraft = async () => {
		if (!questionId || content.trim().length === 0) {
			toastError('Please write something before saving');
			return;
		}

		isSaving = true;
		try {
			await autoSave();
			toastSuccess('Draft saved');
		} catch (error) {
			toastError('Failed to save draft');
		} finally {
			isSaving = false;
		}
	};

	const handleSubmit = async () => {
		// Cancel any pending auto-save to prevent race condition
		if (autoSaveTimer) {
			clearTimeout(autoSaveTimer);
			autoSaveTimer = null;
		}

		if (!questionId || content.trim().length === 0) {
			toastError('Please write something before submitting');
			return;
		}

		if (!isEditable) {
			toastError('This reflection cannot be edited');
			return;
		}

		isSaving = true;
		try {
			// If resubmitting after revision request, use 'resubmitted' status
			const submitStatus = existingReflection?.status === 'needs_revision' ? 'resubmitted' : 'submitted';

			const response = await fetch(`/courses/${courseSlug}/reflections/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					reflection_question_id: questionId,
					content: content.trim(),
					is_public: !isPrivate,
					status: submitStatus
				})
			});

			if (!response.ok) throw new Error('Failed to submit reflection');

			const message = submitStatus === 'resubmitted'
				? 'Reflection resubmitted successfully!'
				: 'Reflection submitted successfully!';
			toastSuccess(message);
			goto(`/courses/${courseSlug}/reflections`);
		} catch (error) {
			console.error('Submit error:', error);
			toastError('Failed to submit reflection. Please try again.');
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

<!-- Document-style Top Bar (Sticky) -->
<div class="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
	<div class="max-w-5xl mx-auto px-4 sm:px-6 py-2 sm:py-3">
		<div class="flex items-center justify-between gap-2">
			<!-- Left: Back button and title -->
			<div class="flex items-center gap-2 sm:gap-4 min-w-0">
				<a
					href="/courses/{courseSlug}/reflections"
					class="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
					title="Back to reflections"
				>
					<ArrowLeft size="20" class="text-gray-700" />
				</a>
				<div class="min-w-0">
					<h1 class="text-base sm:text-lg font-semibold text-gray-900">Reflection</h1>
					<div class="flex items-center gap-2 sm:gap-4 text-xs text-gray-500">
						<span>{wordCount} words</span>
						{#if autoSaveStatus === 'saving'}
							<span class="flex items-center gap-1 text-gray-600">
								<div class="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
								<span class="hidden sm:inline">Saving...</span>
							</span>
						{:else if autoSaveStatus === 'saved'}
							<span class="flex items-center gap-1 text-gray-600">
								<CheckCircle size="12" />
								<span class="hidden sm:inline">Saved {formatTime(lastSaved)}</span>
							</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Right: Actions -->
			<div class="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
				{#if isEditable}
					<!-- Privacy Toggle - Compact on mobile -->
					<button
						onclick={() => isPrivate = !isPrivate}
						class="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-sm font-medium transition-colors sm:hidden"
						class:bg-red-100={isPrivate}
						class:text-red-700={isPrivate}
						class:bg-green-100={!isPrivate}
						class:text-green-700={!isPrivate}
						title={isPrivate ? 'Private - tap to make public' : 'Public - tap to make private'}
					>
						{#if isPrivate}
							<EyeOff size="16" />
						{:else}
							<Eye size="16" />
						{/if}
					</button>

					<!-- Privacy Toggle Slider - Desktop only -->
					<div
						class="relative hidden sm:flex items-center rounded-full p-1 transition-colors duration-200"
						class:bg-red-100={isPrivate}
						class:bg-green-100={!isPrivate}
						title={isPrivate ? 'Private - Only you and your marker can see' : 'Public - Visible to your cohort'}
					>
						<div
							class="absolute h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-full shadow-sm transition-all duration-200 ease-in-out"
							class:bg-red-500={isPrivate}
							class:bg-green-500={!isPrivate}
							style="transform: translateX({isPrivate ? '4px' : 'calc(100% + 4px)'});"
						></div>
						<button
							class="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200"
							class:text-white={isPrivate}
							class:text-gray-400={!isPrivate}
							onclick={() => isPrivate = true}
						>
							<EyeOff size="14" />
							<span>Private</span>
						</button>
						<button
							class="relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200"
							class:text-white={!isPrivate}
							class:text-gray-400={isPrivate}
							onclick={() => isPrivate = false}
						>
							<Eye size="14" />
							<span>Public</span>
						</button>
					</div>

					<!-- Save Draft - Icon only on mobile -->
					<button
						onclick={handleSaveDraft}
						class="flex items-center gap-2 p-2 sm:px-4 sm:py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-300"
						disabled={isSaving || content.trim().length === 0}
						title="Save draft"
					>
						<Save size="18" />
						<span class="text-sm font-medium hidden sm:inline">Save Draft</span>
					</button>

					<!-- Submit/Resubmit -->
					<button
						onclick={handleSubmit}
						class="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-2.5 text-white text-sm sm:text-base font-semibold rounded-lg hover:opacity-90 transition-opacity"
						style="background-color: var(--course-accent-dark, #334642);"
						disabled={content.trim().length === 0 || isSaving}
					>
						<Send size="16" class="sm:hidden" />
						<Send size="18" class="hidden sm:block" />
						<span class="hidden sm:inline">{isSaving
							? 'Submitting...'
							: existingReflection?.status === 'needs_revision'
								? 'Resubmit'
								: 'Submit'}</span>
						<span class="sm:hidden">{isSaving ? '...' : 'Submit'}</span>
					</button>
				{:else}
					<!-- Read-only indicator -->
					<div class="flex items-center gap-2 px-3 sm:px-4 py-2 bg-gray-100 rounded-lg">
						{#if isPrivate}
							<EyeOff size="16" class="text-gray-600" />
						{:else}
							<Eye size="16" class="text-gray-600" />
						{/if}
						<span class="text-sm text-gray-600 font-semibold hidden sm:inline">
							{isPrivate ? 'Private' : 'Public'}
						</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Document Content (Natural Scroll) -->
<div class="min-h-screen bg-gray-50 pb-12 sm:pb-20">
	<div class="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
		<!-- Status Banner (if not editable) -->
		{#if !isEditable && existingReflection}
			<div class="bg-blue-50 border-l-4 border-blue-500 p-4 sm:p-6 mb-4 sm:mb-6 rounded-lg">
				<div class="flex items-start gap-3">
					<div class="flex-1">
						<div class="flex items-center gap-3 mb-2">
							<ReflectionStatusBadge status={existingReflection.status} size="large" />
						</div>
						<p class="text-blue-800">
							{#if isComplete(existingReflection.status)}
								Your reflection has been reviewed and approved. You cannot edit it anymore.
							{:else if existingReflection.marked_by}
								Your reflection has been reviewed and can no longer be edited.
							{:else}
								Your reflection has been submitted and is awaiting review. You cannot edit it once it's been reviewed.
							{/if}
						</p>
						{#if existingReflection.feedback}
							<div class="mt-4 p-4 bg-white rounded border border-blue-200">
								<p class="text-sm font-semibold text-gray-700 mb-2">Feedback:</p>
								<p class="text-gray-900">{existingReflection.feedback}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		{#if normalizeStatus(existingReflection?.status) === 'needs_revision' && isEditable}
			<div class="bg-orange-50 border-l-4 border-orange-500 p-4 sm:p-6 mb-4 sm:mb-6 rounded-lg">
				<div class="flex items-start gap-3">
					<div class="flex-1">
						<h3 class="text-orange-900 font-semibold mb-2">Revision Requested</h3>
						<p class="text-orange-800">Your instructor has requested revisions to this reflection. Please make the necessary changes and resubmit.</p>
						{#if existingReflection.feedback}
							<div class="mt-4 p-4 bg-white rounded border border-orange-200">
								<p class="text-sm font-semibold text-gray-700 mb-2">Feedback:</p>
								<p class="text-gray-900">{existingReflection.feedback}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		<!-- Question Card -->
		<div class="bg-white border-2 rounded-2xl p-4 sm:p-6 mb-4 sm:mb-8 shadow-sm" style="border-color: var(--course-accent-light, #c59a6b);">
			<h2 class="text-xs sm:text-sm font-semibold text-gray-500 mb-2">Reflection Question</h2>
			<p class="text-gray-900 leading-relaxed text-base sm:text-lg font-medium">{question}</p>
		</div>

		<!-- Rich Text Editor -->
		<div class="bg-white rounded-2xl shadow-sm" class:read-only={!isEditable}>
			<SimplifiedRichTextEditor
				bind:content
				placeholder="Begin writing your reflection here..."
				editorId="reflection-editor"
			/>
		</div>
	</div>
</div>

<style>
	/* Override editor max-height for document feel */
	:global(#reflection-editor) {
		min-height: 60vh !important;
		max-height: none !important;
		color: #1f2937 !important; /* Ensure dark text */
	}

	/* Ensure all editor content has proper text color */
	:global(#reflection-editor *) {
		color: #1f2937 !important;
	}

	/* Override strong/em colors */
	:global(#reflection-editor strong),
	:global(#reflection-editor b) {
		color: #111827 !important;
	}

	:global(#reflection-editor em),
	:global(#reflection-editor i) {
		color: #374151 !important;
	}

	/* Read-only mode */
	.read-only :global(#reflection-editor) {
		pointer-events: none;
		opacity: 0.8;
		background-color: #f9fafb;
	}

	.read-only :global(.editor-toolbar) {
		display: none;
	}
</style>

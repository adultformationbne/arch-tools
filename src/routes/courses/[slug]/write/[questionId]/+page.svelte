<script>
	import { goto } from '$app/navigation';
	import { Save, Send, Eye, EyeOff, X, CheckCircle, ArrowLeft } from 'lucide-svelte';
	import SimplifiedRichTextEditor from '$lib/components/SimplifiedRichTextEditor.svelte';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';

	let { data } = $props();
	const { question, courseSlug, questionId, existingReflection, isEditable } = data;

	// Writing state
	let content = $state(existingReflection?.response_text || '');
	let isPrivate = $state(!(existingReflection?.is_public ?? false));
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
	<div class="max-w-5xl mx-auto px-6 py-3">
		<div class="flex items-center justify-between">
			<!-- Left: Back button and title -->
			<div class="flex items-center gap-4">
				<a
					href="/courses/{courseSlug}/reflections"
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
					title="Back to reflections"
				>
					<ArrowLeft size="20" class="text-gray-700" />
				</a>
				<div>
					<h1 class="text-lg font-semibold text-gray-900">Reflection</h1>
					<div class="flex items-center gap-4 text-xs text-gray-500">
						<span>{wordCount} words</span>
						{#if autoSaveStatus === 'saving'}
							<span class="flex items-center gap-1 text-gray-600">
								<div class="w-3 h-3 border-2 border-gray-600 border-t-transparent rounded-full animate-spin"></div>
								Saving...
							</span>
						{:else if autoSaveStatus === 'saved'}
							<span class="flex items-center gap-1 text-gray-600">
								<CheckCircle size="12" />
								Saved {formatTime(lastSaved)}
							</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- Right: Actions -->
			<div class="flex items-center gap-3">
				{#if isEditable}
					<!-- Privacy Toggle -->
					<button
						class="flex items-center gap-2 px-4 py-2 rounded-lg transition-all border"
						class:bg-green-50={!isPrivate}
						class:border-green-600={!isPrivate}
						class:text-green-700={!isPrivate}
						class:bg-red-50={isPrivate}
						class:border-red-600={isPrivate}
						class:text-red-700={isPrivate}
						onclick={() => isPrivate = !isPrivate}
						title={isPrivate ? 'Private - Only you and your marker can see' : 'Public - Visible to your cohort'}
					>
						{#if isPrivate}
							<EyeOff size="16" />
							<span class="text-sm font-semibold">Private</span>
						{:else}
							<Eye size="16" />
							<span class="text-sm font-semibold">Public</span>
						{/if}
					</button>

					<!-- Save Draft -->
					<button
						onclick={handleSaveDraft}
						class="p-2.5 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						disabled={isSaving || content.trim().length === 0}
						title="Save draft"
					>
						<Save size="20" />
					</button>

					<!-- Submit/Resubmit -->
					<button
						onclick={handleSubmit}
						class="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity"
						style="background-color: var(--course-accent-dark, #334642);"
						disabled={content.trim().length === 0 || isSaving}
					>
						<Send size="18" />
						{isSaving
							? 'Submitting...'
							: existingReflection?.status === 'needs_revision'
								? 'Resubmit'
								: 'Submit'}
					</button>
				{:else}
					<!-- Read-only indicator -->
					<div class="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
						<span class="text-sm text-gray-600 font-semibold">
							{isPrivate ? 'Private' : 'Public'}
						</span>
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Document Content (Natural Scroll) -->
<div class="min-h-screen bg-gray-50 pb-20">
	<div class="max-w-5xl mx-auto px-6 py-8">
		<!-- Status Banner (if not editable) -->
		{#if !isEditable && existingReflection}
			<div class="bg-blue-50 border-l-4 border-blue-500 p-6 mb-6 rounded-lg">
				<div class="flex items-start gap-3">
					<div class="flex-1">
						<h3 class="text-blue-900 font-semibold mb-2">
							{#if existingReflection.status === 'under_review'}
								Under Review
							{:else if existingReflection.status === 'passed'}
								Passed
							{:else if existingReflection.status === 'resubmitted'}
								Resubmitted - Awaiting Review
							{:else}
								Submitted - Awaiting Review
							{/if}
						</h3>
						<p class="text-blue-800">
							{#if existingReflection.status === 'passed'}
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

		{#if existingReflection?.status === 'needs_revision' && isEditable}
			<div class="bg-orange-50 border-l-4 border-orange-500 p-6 mb-6 rounded-lg">
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
		<div class="bg-white border-2 rounded-2xl p-6 mb-8 shadow-sm" style="border-color: var(--course-accent-light, #c59a6b);">
			<div class="flex items-start gap-3">
				<div>
					<h2 class="text-sm font-semibold text-gray-500 mb-2">Reflection Question</h2>
					<p class="text-gray-900 leading-relaxed text-lg font-medium">{question}</p>
				</div>
			</div>
		</div>

		<!-- Rich Text Editor -->
		<div class="bg-white rounded-2xl shadow-sm overflow-hidden" class:read-only={!isEditable}>
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

<script lang="ts">
	import { Plus, Trash2, Edit3, ChevronUp, ChevronDown, Zap, PenTool, X, GripVertical, Check } from '$lib/icons';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let {
		sessionId = '',
		courseId = '',
		sessionNumber = 1
	} = $props();

	// ── State ──────────────────────────────────────────────────────────────────
	type QuizMode = 'instant' | 'qualitative';

	interface QuizOption {
		id: string;
		option_text: string;
		is_correct: boolean;
		order_index: number;
	}

	interface QuizQuestion {
		id: string;
		question_text: string;
		question_type: 'multiple_choice' | 'short_answer';
		order_index: number;
		points: number;
		word_limit: number | null;
		image_url: string | null;
		options: QuizOption[];
	}

	interface Quiz {
		id: string;
		mode: QuizMode;
		title: string | null;
		instructions: string | null;
		pass_threshold: number | null;
		allow_retakes: boolean;
		max_attempts: number | null;
		show_correct_answers: boolean;
		require_pass_to_advance: boolean;
		published: boolean;
		quiz_feedback_snippets: Array<{ id: string; text: string }>;
		questions: QuizQuestion[];
	}

	let quiz = $state<Quiz | null>(null);
	let loading = $state(false);
	let saving = $state(false);

	// Modals
	let showTypeModal = $state(false);
	let showQuestionModal = $state(false);
	let showDeleteQuizConfirm = $state(false);
	let quizDeleteAttemptCount = $state(0);

	// Question being added/edited (null = adding new)
	let editingQuestion = $state<QuizQuestion | null>(null);

	// Question modal form state
	let qForm = $state({
		question_text: '',
		points: 1,
		word_limit: '',
		image_url: null as string | null,
		uploadingImage: false,
		// MC fields
		options: [
			{ text: '', temp_id: 1 },
			{ text: '', temp_id: 2 }
		],
		correct_temp_id: null as number | null,
		// For editing existing options
		existing_options: [] as QuizOption[],
		correct_option_id: null as string | null
	});

	// Settings edit state (inline)
	let editingSettings = $state(false);
	let settingsForm = $state({
		title: '',
		instructions: '',
		pass_threshold: 70,
		allow_retakes: false,
		max_attempts: '',
		show_correct_answers: true,
		require_pass_to_advance: false,
		published: false,
		snippets: [] as Array<{ id: string; text: string }>,
		newSnippetText: ''
	});

	// ── Data loading ──────────────────────────────────────────────────────────
	let prevSessionId = $state('');

	$effect(() => {
		if (sessionId && sessionId !== prevSessionId) {
			prevSessionId = sessionId;
			loadQuiz();
		}
	});

	async function loadQuiz() {
		if (!sessionId) return;
		loading = true;
		try {
			const res = await fetch(`/api/courses/sessions/quiz?session_id=${sessionId}`);
			if (!res.ok) throw new Error('Failed to load quiz');
			const data = await res.json();
			quiz = data.quiz;
		} catch (e) {
			toastError('Failed to load quiz');
		} finally {
			loading = false;
		}
	}

	// ── Type selection ────────────────────────────────────────────────────────
	async function createQuiz(mode: QuizMode) {
		showTypeModal = false;
		saving = true;
		try {
			const res = await fetch('/api/courses/sessions/quiz', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ session_id: sessionId, course_id: courseId, mode })
			});
			if (!res.ok) throw new Error('Failed to create quiz');
			const data = await res.json();
			quiz = { ...data.quiz, questions: [] };
			toastSuccess(`${mode === 'instant' ? 'Instant' : 'Qualitative'} quiz created`);
			openSettings();
		} catch (e) {
			toastError('Failed to create quiz');
		} finally {
			saving = false;
		}
	}

	// ── Settings ──────────────────────────────────────────────────────────────
	function openSettings() {
		if (!quiz) return;
		settingsForm = {
			title: quiz.title || '',
			instructions: quiz.instructions || '',
			pass_threshold: quiz.pass_threshold ?? 70,
			allow_retakes: quiz.allow_retakes,
			max_attempts: quiz.max_attempts !== null ? String(quiz.max_attempts) : '',
			show_correct_answers: quiz.show_correct_answers,
			require_pass_to_advance: quiz.require_pass_to_advance,
			published: quiz.published ?? false,
			snippets: JSON.parse(JSON.stringify(quiz.quiz_feedback_snippets ?? [])),
			newSnippetText: ''
		};
		editingSettings = true;
	}

	async function saveSettings() {
		if (!quiz) return;
		saving = true;
		try {
			const patch: Record<string, unknown> = {
				id: quiz.id,
				title: settingsForm.title.trim() || null,
				instructions: settingsForm.instructions.trim() || null,
				require_pass_to_advance: settingsForm.require_pass_to_advance,
				published: settingsForm.published,
				quiz_feedback_snippets: settingsForm.snippets
			};
			if (quiz.mode === 'instant') {
				patch.pass_threshold = settingsForm.pass_threshold;
				patch.allow_retakes = settingsForm.allow_retakes;
				patch.max_attempts = settingsForm.allow_retakes && settingsForm.max_attempts
					? parseInt(settingsForm.max_attempts)
					: null;
				patch.show_correct_answers = settingsForm.show_correct_answers;
			}
			const res = await fetch('/api/courses/sessions/quiz', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(patch)
			});
			if (!res.ok) throw new Error('Failed to save settings');
			const data = await res.json();
			quiz = { ...data.quiz, questions: quiz.questions };
			editingSettings = false;
			toastSuccess('Quiz settings saved');
		} catch (e) {
			toastError('Failed to save settings');
		} finally {
			saving = false;
		}
	}

	// ── Delete quiz ───────────────────────────────────────────────────────────
	async function requestDeleteQuiz() {
		if (!quiz) return;
		// Check if attempts exist
		const res = await fetch('/api/courses/sessions/quiz', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: quiz.id })
		});
		const data = await res.json();
		if (data.needs_confirmation) {
			quizDeleteAttemptCount = data.attempt_count;
			showDeleteQuizConfirm = true;
		} else {
			quiz = null;
			toastSuccess('Quiz deleted');
		}
	}

	async function confirmDeleteQuiz() {
		if (!quiz) return;
		showDeleteQuizConfirm = false;
		saving = true;
		try {
			const res = await fetch('/api/courses/sessions/quiz', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: quiz.id, confirm: true })
			});
			if (!res.ok) throw new Error('Delete failed');
			quiz = null;
			toastSuccess('Quiz and all attempt data deleted');
		} catch (e) {
			toastError('Failed to delete quiz');
		} finally {
			saving = false;
		}
	}

	// ── Questions ─────────────────────────────────────────────────────────────
	function openAddQuestion() {
		editingQuestion = null;
		qForm = {
			question_text: '',
			points: 1,
			word_limit: '',
			image_url: null,
			uploadingImage: false,
			options: [{ text: '', temp_id: 1 }, { text: '', temp_id: 2 }],
			correct_temp_id: null,
			existing_options: [],
			correct_option_id: null
		};
		showQuestionModal = true;
	}

	function openEditQuestion(q: QuizQuestion) {
		editingQuestion = q;
		const existingOpts = [...q.options].sort((a, b) => a.order_index - b.order_index);
		const correctOpt = existingOpts.find(o => o.is_correct);
		qForm = {
			question_text: q.question_text,
			points: q.points,
			word_limit: q.word_limit !== null ? String(q.word_limit) : '',
			image_url: q.image_url ?? null,
			uploadingImage: false,
			options: [],
			correct_temp_id: null,
			existing_options: existingOpts,
			correct_option_id: correctOpt?.id ?? null
		};
		showQuestionModal = true;
	}

	function addOption() {
		const maxId = Math.max(0, ...qForm.options.map(o => o.temp_id));
		qForm.options = [...qForm.options, { text: '', temp_id: maxId + 1 }];
	}

	function removeOption(tempId: number) {
		qForm.options = qForm.options.filter(o => o.temp_id !== tempId);
		if (qForm.correct_temp_id === tempId) qForm.correct_temp_id = null;
	}

	function removeExistingOption(optId: string) {
		qForm.existing_options = qForm.existing_options.filter(o => o.id !== optId);
		if (qForm.correct_option_id === optId) qForm.correct_option_id = null;
	}

	async function saveQuestion() {
		if (!quiz) return;
		if (!qForm.question_text.trim()) {
			toastError('Question text is required');
			return;
		}
		if (quiz.mode === 'instant') {
			const allOpts = [
				...qForm.existing_options.map(o => o.option_text),
				...qForm.options.map(o => o.text)
			].filter(t => t.trim());
			if (allOpts.length < 2) {
				toastError('At least 2 options are required');
				return;
			}
			const hasCorrect = qForm.correct_option_id !== null || qForm.correct_temp_id !== null;
			if (!hasCorrect) {
				toastError('Select the correct answer');
				return;
			}
		}

		saving = true;
		try {
			if (editingQuestion) {
				// Update question text/settings
				await fetch('/api/courses/sessions/quiz/questions', {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						id: editingQuestion.id,
						question_text: qForm.question_text,
						image_url: qForm.image_url,
						points: qForm.points,
						word_limit: qForm.word_limit ? parseInt(qForm.word_limit) : null
					})
				});

				if (quiz.mode === 'instant') {
					// Delete removed existing options
					const keptIds = new Set(qForm.existing_options.map(o => o.id));
					const deletedOpts = editingQuestion.options.filter(o => !keptIds.has(o.id));
					for (const opt of deletedOpts) {
						await fetch('/api/courses/sessions/quiz/options', {
							method: 'DELETE',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ id: opt.id })
						});
					}

					// Update existing option texts
					for (const opt of qForm.existing_options) {
						await fetch('/api/courses/sessions/quiz/options', {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ id: opt.id, option_text: opt.option_text })
						});
					}

					// Add new options
					let newCorrectOptionId: string | null = null;
					for (let i = 0; i < qForm.options.length; i++) {
						const opt = qForm.options[i];
						if (!opt.text.trim()) continue;
						const res = await fetch('/api/courses/sessions/quiz/options', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								question_id: editingQuestion.id,
								option_text: opt.text,
								order_index: qForm.existing_options.length + i
							})
						});
						const d = await res.json();
						if (opt.temp_id === qForm.correct_temp_id) {
							newCorrectOptionId = d.option.id;
						}
					}

					// Set correct answer
					const finalCorrectId = newCorrectOptionId ?? qForm.correct_option_id;
					if (finalCorrectId && editingQuestion) {
						await fetch('/api/courses/sessions/quiz/options', {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								correct_option_id: finalCorrectId,
								question_id: editingQuestion.id
							})
						});
					}
				}
			} else {
				// Create new question
				const nextOrder = quiz.questions.length;
				const qRes = await fetch('/api/courses/sessions/quiz/questions', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						quiz_id: quiz.id,
						question_text: qForm.question_text,
						question_type: quiz.mode === 'instant' ? 'multiple_choice' : 'short_answer',
						order_index: nextOrder,
						points: qForm.points,
						word_limit: qForm.word_limit ? parseInt(qForm.word_limit) : null,
						image_url: qForm.image_url ?? null
					})
				});
				const qData = await qRes.json();
				const newQId = qData.question.id;

				if (quiz.mode === 'instant') {
					// Add options
					let correctOptionId: string | null = null;
					const allOptions = qForm.options.filter(o => o.text.trim());
					for (let i = 0; i < allOptions.length; i++) {
						const opt = allOptions[i];
						const oRes = await fetch('/api/courses/sessions/quiz/options', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								question_id: newQId,
								option_text: opt.text,
								order_index: i
							})
						});
						const oData = await oRes.json();
						if (opt.temp_id === qForm.correct_temp_id) {
							correctOptionId = oData.option.id;
						}
					}
					// Set correct answer
					if (correctOptionId) {
						await fetch('/api/courses/sessions/quiz/options', {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ correct_option_id: correctOptionId, question_id: newQId })
						});
					}
				}
			}

			// Reload quiz data
			await loadQuiz();
			showQuestionModal = false;
			toastSuccess(editingQuestion ? 'Question updated' : 'Question added');
		} catch (e) {
			toastError('Failed to save question');
		} finally {
			saving = false;
		}
	}

	async function deleteQuestion(questionId: string) {
		if (!quiz) return;
		saving = true;
		try {
			const res = await fetch('/api/courses/sessions/quiz/questions', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: questionId })
			});
			if (!res.ok) throw new Error('Delete failed');
			quiz.questions = quiz.questions.filter(q => q.id !== questionId);
			toastSuccess('Question deleted');
		} catch (e) {
			toastError('Failed to delete question');
		} finally {
			saving = false;
		}
	}

	async function moveQuestion(index: number, direction: 'up' | 'down') {
		if (!quiz) return;
		const questions = [...quiz.questions];
		const newIndex = direction === 'up' ? index - 1 : index + 1;
		if (newIndex < 0 || newIndex >= questions.length) return;

		[questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];
		quiz.questions = questions;

		// Persist reorder
		const orderedIds = questions.map(q => q.id);
		await fetch('/api/courses/sessions/quiz/questions/reorder', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ ordered_ids: orderedIds })
		});
	}

	// ── Image upload ──────────────────────────────────────────────────────────
	async function uploadQuestionImage(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		qForm.uploadingImage = true;
		try {
			const fd = new FormData();
			fd.append('file', file);
			const res = await fetch('/api/upload/quiz-image', {
				method: 'POST',
				body: fd
			});
			if (!res.ok) throw new Error('Upload failed');
			const { url } = await res.json();
			qForm.image_url = url;
		} catch (e) {
			toastError('Failed to upload image');
		} finally {
			qForm.uploadingImage = false;
			input.value = '';
		}
	}

	function addSnippet() {
		const text = settingsForm.newSnippetText.trim();
		if (!text) return;
		settingsForm.snippets = [...settingsForm.snippets, { id: crypto.randomUUID(), text }];
		settingsForm.newSnippetText = '';
	}

	function removeSnippet(id: string) {
		settingsForm.snippets = settingsForm.snippets.filter(s => s.id !== id);
	}

	// ── Derived ───────────────────────────────────────────────────────────────
	const isInstant = $derived(quiz?.mode === 'instant');
	const modeLabel = $derived(quiz?.mode === 'instant' ? 'Instant (Multiple Choice)' : 'Qualitative (Short Answer)');
</script>

<div class="bg-white rounded-2xl p-6 shadow-sm">
	<div class="flex items-center justify-between mb-4">
		<h2 class="text-xl font-bold text-gray-800">Quiz</h2>
		{#if quiz}
			<button
				onclick={requestDeleteQuiz}
				class="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
				title="Delete quiz"
			>
				<Trash2 size="18" />
			</button>
		{/if}
	</div>

	{#if loading}
		<div class="text-sm text-gray-400 py-4 text-center">Loading quiz...</div>

	{:else if !quiz}
		<!-- No quiz — add button -->
		<button
			onclick={() => showTypeModal = true}
			class="w-full flex items-center justify-center gap-2 px-6 py-4 text-white rounded-lg font-semibold transition-all hover:opacity-90"
			style="background-color: var(--course-accent-dark, #334642);"
		>
			<Plus size="20" />
			Add Quiz
		</button>

	{:else}
		<!-- Quiz exists — summary header -->
		<div class="mb-5">
			<div class="flex items-center gap-2 mb-1">
				{#if isInstant}
					<Zap size="16" class="text-amber-500" />
				{:else}
					<PenTool size="16" class="text-purple-500" />
				{/if}
				<span class="text-sm font-semibold text-gray-700">{modeLabel}</span>
			</div>

			{#if !editingSettings}
				<!-- Settings summary -->
				<div class="bg-gray-50 rounded-lg p-4 text-sm text-gray-600 space-y-1">
					{#if quiz.title}
						<p><span class="font-medium text-gray-700">Title:</span> {quiz.title}</p>
					{/if}
					{#if quiz.instructions}
						<p><span class="font-medium text-gray-700">Instructions:</span> {quiz.instructions}</p>
					{/if}
					{#if isInstant}
						<p><span class="font-medium text-gray-700">Pass threshold:</span> {quiz.pass_threshold ?? 70}%</p>
						{#if quiz.allow_retakes}
							<p><span class="font-medium text-gray-700">Retakes:</span> allowed{quiz.max_attempts ? ` (max ${quiz.max_attempts})` : ''}</p>
						{/if}
						<p><span class="font-medium text-gray-700">Show correct answers:</span> {quiz.show_correct_answers ? 'Yes' : 'No'}</p>
					{/if}
					{#if quiz.require_pass_to_advance}
						<p class="text-amber-700 font-medium">⚠ Passing required to advance</p>
					{/if}
				</div>
				<button
					onclick={openSettings}
					class="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
				>
					Edit settings
				</button>
			{:else}
				<!-- Settings inline form -->
				<div class="border border-gray-200 rounded-lg p-4 space-y-3">
					<h3 class="text-sm font-semibold text-gray-700">Quiz Settings</h3>

					<div>
						<label class="block text-xs font-medium text-gray-600 mb-1">Title (optional)</label>
						<input
							type="text"
							bind:value={settingsForm.title}
							placeholder="e.g. Unit 3 Knowledge Check"
							class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
						/>
					</div>

					<div>
						<label class="block text-xs font-medium text-gray-600 mb-1">Instructions (optional)</label>
						<textarea
							bind:value={settingsForm.instructions}
							rows="2"
							placeholder="Shown to participant before they start"
							class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
						></textarea>
					</div>

					{#if isInstant}
						<div class="grid grid-cols-2 gap-3">
							<div>
								<label class="block text-xs font-medium text-gray-600 mb-1">Pass threshold (%)</label>
								<input
									type="number"
									bind:value={settingsForm.pass_threshold}
									min="0"
									max="100"
									class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
								/>
							</div>
							<div>
								<label class="block text-xs font-medium text-gray-600 mb-1">Max attempts</label>
								<input
									type="number"
									bind:value={settingsForm.max_attempts}
									min="1"
									placeholder="Unlimited"
									disabled={!settingsForm.allow_retakes}
									class="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-40"
								/>
							</div>
						</div>

						<div class="space-y-2">
							<label class="flex items-center gap-2 cursor-pointer">
								<input type="checkbox" bind:checked={settingsForm.allow_retakes} class="rounded" />
								<span class="text-sm text-gray-700">Allow retakes</span>
							</label>
							<label class="flex items-center gap-2 cursor-pointer">
								<input type="checkbox" bind:checked={settingsForm.show_correct_answers} class="rounded" />
								<span class="text-sm text-gray-700">Show correct answers after submission</span>
							</label>
						</div>
					{/if}

					<label class="flex items-center gap-2 cursor-pointer">
						<input type="checkbox" bind:checked={settingsForm.require_pass_to_advance} class="rounded" />
						<span class="text-sm text-gray-700">Require pass to advance to next session</span>
					</label>

					<label class="flex items-center gap-2 cursor-pointer">
						<input type="checkbox" bind:checked={settingsForm.published} class="rounded" />
						<span class="text-sm text-gray-700">Published (visible to participants)</span>
					</label>

					<!-- Feedback snippets -->
					<div>
						<label class="block text-xs font-medium text-gray-600 mb-2">Marking Feedback Snippets</label>
						<p class="text-xs text-gray-400 mb-2">Clickable phrases shown to markers when writing feedback.</p>
						{#each settingsForm.snippets as snippet (snippet.id)}
							<div class="flex items-center gap-2 mb-1.5">
								<span class="flex-1 text-sm text-gray-700 bg-gray-50 rounded px-2 py-1 truncate">{snippet.text}</span>
								<button type="button" onclick={() => removeSnippet(snippet.id)} class="p-1 text-gray-400 hover:text-red-600 rounded flex-shrink-0">
									<X size="14" />
								</button>
							</div>
						{/each}
						<div class="flex gap-2 mt-1">
							<input
								type="text"
								bind:value={settingsForm.newSnippetText}
								placeholder="Add a snippet..."
								onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSnippet(); } }}
								class="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
							/>
							<button type="button" onclick={addSnippet} class="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 transition">
								Add
							</button>
						</div>
					</div>

					<div class="flex gap-2 pt-1">
						<button
							onclick={saveSettings}
							disabled={saving}
							class="px-4 py-2 text-sm text-white rounded font-medium hover:opacity-90 transition disabled:opacity-50"
							style="background-color: var(--course-accent-dark, #334642);"
						>
							Save Settings
						</button>
						<button
							onclick={() => editingSettings = false}
							class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded font-medium hover:bg-gray-50 transition"
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Questions list -->
		<div class="space-y-3">
			<div class="flex items-center justify-between">
				<h3 class="text-sm font-semibold text-gray-700">
					Questions ({quiz.questions.length})
				</h3>
			</div>

			{#if quiz.questions.length === 0}
				<p class="text-sm text-gray-400 text-center py-4">No questions yet.</p>
			{/if}

			{#each quiz.questions.sort((a, b) => a.order_index - b.order_index) as question, index (question.id)}
				<div class="border border-gray-200 rounded-lg p-4">
					<div class="flex items-start gap-3">
						<!-- Reorder arrows -->
						<div class="flex flex-col gap-0.5 mt-1 flex-shrink-0">
							<button
								onclick={() => moveQuestion(index, 'up')}
								disabled={index === 0}
								class="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
							>
								<ChevronUp size="14" />
							</button>
							<button
								onclick={() => moveQuestion(index, 'down')}
								disabled={index === quiz.questions.length - 1}
								class="p-0.5 text-gray-400 hover:text-gray-600 disabled:opacity-20"
							>
								<ChevronDown size="14" />
							</button>
						</div>

						<div class="flex-1 min-w-0">
							<p class="text-sm font-medium text-gray-800 mb-1">
								<span class="text-gray-400 mr-1">Q{index + 1}.</span>
								{question.question_text}
							</p>

							{#if quiz.mode === 'instant' && question.options.length > 0}
								<ul class="text-xs text-gray-500 space-y-0.5 mt-1">
									{#each question.options.sort((a, b) => a.order_index - b.order_index) as opt}
										<li class="flex items-center gap-1" class:text-green-700={opt.is_correct} class:font-medium={opt.is_correct}>
											{#if opt.is_correct}<Check size="11" />{:else}<span class="w-2.5 h-2.5 inline-block rounded-full border border-gray-300"></span>{/if}
											{opt.option_text}
										</li>
									{/each}
								</ul>
							{/if}

							<div class="flex items-center gap-3 mt-2 text-xs text-gray-400">
								{#if quiz.mode === 'instant'}
									<span>{question.points} pt{question.points !== 1 ? 's' : ''}</span>
								{/if}
								{#if question.word_limit}
									<span>Word limit: {question.word_limit}</span>
								{/if}
							</div>
						</div>

						<!-- Actions -->
						<div class="flex gap-1 flex-shrink-0">
							<button
								onclick={() => openEditQuestion(question)}
								class="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition"
								title="Edit question"
							>
								<Edit3 size="14" />
							</button>
							<button
								onclick={() => deleteQuestion(question.id)}
								class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition"
								title="Delete question"
							>
								<Trash2 size="14" />
							</button>
						</div>
					</div>
				</div>
			{/each}

			<button
				onclick={openAddQuestion}
				class="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition"
			>
				<Plus size="16" />
				Add Question
			</button>
		</div>
	{/if}
</div>

<!-- ── Quiz Type Selection Modal ─────────────────────────────────────────── -->
{#if showTypeModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="bg-white rounded-2xl shadow-xl w-full max-w-lg">
			<div class="flex items-center justify-between p-6 border-b">
				<h2 class="text-xl font-bold text-gray-800">Add Quiz</h2>
				<button onclick={() => showTypeModal = false} class="p-2 text-gray-400 hover:text-gray-700 rounded">
					<X size="20" />
				</button>
			</div>
			<div class="p-6 grid grid-cols-2 gap-4">
				<button
					onclick={() => createQuiz('instant')}
					class="group flex flex-col items-start gap-2 p-5 border-2 border-gray-200 rounded-xl hover:border-amber-400 hover:bg-amber-50 transition text-left"
				>
					<div class="p-2 bg-amber-100 rounded-lg group-hover:bg-amber-200 transition">
						<Zap size="24" class="text-amber-600" />
					</div>
					<div>
						<p class="font-bold text-gray-800">Instant</p>
						<p class="text-xs text-gray-500 mt-1">Multiple choice<br>Auto-graded<br>Instant feedback</p>
					</div>
				</button>
				<button
					onclick={() => createQuiz('qualitative')}
					class="group flex flex-col items-start gap-2 p-5 border-2 border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition text-left"
				>
					<div class="p-2 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition">
						<PenTool size="24" class="text-purple-600" />
					</div>
					<div>
						<p class="font-bold text-gray-800">Qualitative</p>
						<p class="text-xs text-gray-500 mt-1">Short answer<br>Manually marked<br>Admin writes feedback</p>
					</div>
				</button>
			</div>
			<div class="flex justify-end px-6 pb-6">
				<button onclick={() => showTypeModal = false} class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
			</div>
		</div>
	</div>
{/if}

<!-- ── Add / Edit Question Modal ─────────────────────────────────────────── -->
{#if showQuestionModal && quiz}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
			<div class="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
				<h2 class="text-xl font-bold text-gray-800">
					{editingQuestion ? 'Edit Question' : 'Add Question'}
				</h2>
				<button onclick={() => showQuestionModal = false} class="p-2 text-gray-400 hover:text-gray-700 rounded">
					<X size="20" />
				</button>
			</div>

			<div class="p-6 space-y-4">
				<!-- Question text -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Question</label>
					<textarea
						bind:value={qForm.question_text}
						rows="3"
						placeholder="Enter your question..."
						class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
					></textarea>
				</div>

				{#if isInstant}
					<!-- Points -->
					<div class="flex items-center gap-4">
						<label class="text-sm font-medium text-gray-700">Points</label>
						<input
							type="number"
							bind:value={qForm.points}
							min="1"
							class="w-20 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
						/>
					</div>

					<!-- Answer options -->
					<div>
						<label class="block text-sm font-medium text-gray-700 mb-2">Answer Options</label>

						<!-- Existing options (when editing) -->
						{#each qForm.existing_options as opt (opt.id)}
							<div class="flex items-center gap-2 mb-2">
								<input
									type="radio"
									name="correct_existing"
									value={opt.id}
									bind:group={qForm.correct_option_id}
									onclick={() => { qForm.correct_temp_id = null; }}
									class="mt-0.5"
								/>
								<input
									type="text"
									bind:value={opt.option_text}
									class="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
								/>
								<button
									onclick={() => removeExistingOption(opt.id)}
									class="p-1.5 text-gray-400 hover:text-red-600 rounded"
								>
									<X size="14" />
								</button>
							</div>
						{/each}

						<!-- New options -->
						{#each qForm.options as opt (opt.temp_id)}
							<div class="flex items-center gap-2 mb-2">
								<input
									type="radio"
									name="correct_new"
									value={opt.temp_id}
									bind:group={qForm.correct_temp_id}
									onclick={() => { qForm.correct_option_id = null; }}
									class="mt-0.5"
								/>
								<input
									type="text"
									bind:value={opt.text}
									placeholder="Option text..."
									class="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
								/>
								<button
									onclick={() => removeOption(opt.temp_id)}
									disabled={qForm.options.length + qForm.existing_options.length <= 2}
									class="p-1.5 text-gray-400 hover:text-red-600 rounded disabled:opacity-30"
								>
									<X size="14" />
								</button>
							</div>
						{/each}

						{#if qForm.options.length + qForm.existing_options.length < 6}
							<button
								onclick={addOption}
								class="mt-1 text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
							>
								<Plus size="14" /> Add Option
							</button>
						{/if}

						<p class="text-xs text-gray-400 mt-2">Select the radio button next to the correct answer.</p>
					</div>
				{:else}
					<!-- Qualitative: word limit -->
					<div class="flex items-center gap-4">
						<label class="text-sm font-medium text-gray-700">Word limit (optional)</label>
						<input
							type="number"
							bind:value={qForm.word_limit}
							min="1"
							placeholder="None"
							class="w-24 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-400"
						/>
					</div>
				{/if}
			</div>

			<div class="flex justify-end gap-2 px-6 pb-6 sticky bottom-0 bg-white border-t pt-4">
				<button onclick={() => showQuestionModal = false} class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
				<button
					onclick={saveQuestion}
					disabled={saving}
					class="px-4 py-2 text-sm text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
					style="background-color: var(--course-accent-dark, #334642);"
				>
					{saving ? 'Saving...' : editingQuestion ? 'Save Question' : 'Add Question'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- ── Delete Quiz Confirm ────────────────────────────────────────────────── -->
<ConfirmationModal
	show={showDeleteQuizConfirm}
	title="Delete Quiz"
	onConfirm={confirmDeleteQuiz}
	onCancel={() => showDeleteQuizConfirm = false}
>
	<p>This quiz has <strong>{quizDeleteAttemptCount} submitted attempt{quizDeleteAttemptCount !== 1 ? 's' : ''}</strong>. Deleting it will permanently remove all quiz data including participant responses.</p>
	<p class="text-sm text-red-600 mt-2 font-medium">This action cannot be undone.</p>
</ConfirmationModal>

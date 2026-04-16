<script lang="ts">
	import { goto, invalidateAll, beforeNavigate } from '$app/navigation';
	import { ArrowLeft, Check, X, Zap, PenTool, Clock, CheckCircle, XCircle } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import { renderMarkdown } from '$lib/utils/markdown.js';

	let { data } = $props();

	const quiz = $derived(data.quiz);
	const courseSlug = $derived(data.courseSlug);
	const sessionNumber = $derived(data.sessionNumber);
	const sessionTitle = $derived(data.sessionTitle);

	// View states: 'intro' | 'taking' | 'results' | 'history'
	type ViewState = 'intro' | 'taking' | 'results' | 'history';
	let view = $state<ViewState>('intro');
	let attempts = $state(data.attempts ?? []);
	let currentAttemptId = $state<string | null>(null);
	let submitting = $state(false);
	let showUnansweredConfirm = $state(false);
	let pendingSubmit = $state(false);

	// Quiz taking state
	let responses = $state<Record<string, string>>({});  // question_id → selected_option_id or response_text

	// Last result (shown after instant quiz submission)
	let lastResult = $state<any>(null);
	let showRestoreBanner = $state(false);

	// Auto-save responses to localStorage
	$effect(() => {
		if (currentAttemptId && view === 'taking' && Object.keys(responses).length > 0) {
			try {
				localStorage.setItem(`quiz_autosave_${currentAttemptId}`, JSON.stringify(responses));
			} catch {}
		}
	});

	// Clear autosave on navigate away
	beforeNavigate(() => {
		if (currentAttemptId) {
			try { localStorage.removeItem(`quiz_autosave_${currentAttemptId}`); } catch {}
		}
	});

	const latestAttempt = $derived(attempts[0] ?? null);
	const isInstant = $derived(quiz.mode === 'instant');

	// Determine initial view based on latest attempt
	$effect(() => {
		const latest = attempts[0];
		if (!latest) {
			view = 'intro';
		} else if (latest.status === 'in_progress') {
			// Resuming existing in_progress attempt — check for saved responses
			if (currentAttemptId !== latest.id) {
				currentAttemptId = latest.id;
				try {
					const saved = localStorage.getItem(`quiz_autosave_${latest.id}`);
					if (saved) {
						const parsed = JSON.parse(saved);
						if (Object.keys(parsed).length > 0) showRestoreBanner = true;
					}
				} catch {}
			}
			view = 'taking';
		} else if (['passed', 'failed'].includes(latest.status) && isInstant && lastResult) {
			view = 'results';
		} else if (['pending_review', 'reviewing', 'passed', 'failed'].includes(latest.status)) {
			view = 'results';
		} else {
			view = 'intro';
		}
	});

	// Check if retake is possible
	const canRetake = $derived.by(() => {
		if (!isInstant) return false;
		const latest = attempts[0];
		if (!latest || latest.status === 'in_progress') return false;
		if (!quiz.allow_retakes) return false;
		if (quiz.max_attempts !== null && attempts.length >= quiz.max_attempts) return false;
		return true;
	});

	// ── Start attempt ─────────────────────────────────────────────────────────
	async function startQuiz() {
		try {
			const res = await fetch(`/courses/${courseSlug}/quiz/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ quiz_id: quiz.id })
			});
			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || 'Failed to start quiz');
			}
			const { attempt } = await res.json();
			currentAttemptId = attempt.id;
			responses = {};
			showRestoreBanner = false;
			view = 'taking';
		} catch (e: any) {
			toastError(e.message || 'Failed to start quiz');
		}
	}

	// ── Submit attempt ────────────────────────────────────────────────────────
	async function submitQuiz() {
		// Check all answered (warn but allow partial)
		const unanswered = quiz.questions.filter((q: any) => !responses[q.id]);
		if (unanswered.length > 0) {
			pendingSubmit = true;
			showUnansweredConfirm = true;
			return;
		}

		await doSubmit();
	}

	async function doSubmit() {
		showUnansweredConfirm = false;
		pendingSubmit = false;
		if (!currentAttemptId) return;

		// Build responses array
		const responseArray = quiz.questions.map((q: any) => ({
			question_id: q.id,
			...(isInstant
				? { selected_option_id: responses[q.id] ?? null }
				: { response_text: responses[q.id] ?? '' })
		}));

		// Clear autosave
		try { localStorage.removeItem(`quiz_autosave_${currentAttemptId}`); } catch {}

		submitting = true;
		try {
			const res = await fetch(`/courses/${courseSlug}/quiz/api`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ attempt_id: currentAttemptId, responses: responseArray })
			});
			if (!res.ok) throw new Error('Failed to submit quiz');
			const { result } = await res.json();
			lastResult = result;

			if (isInstant) {
				// Merge question data into result for display
				const questionMap = new Map(quiz.questions.map((q: any) => [q.id, q]));
				if (result.responses) {
					result.responses = result.responses.map((r: any) => ({
						...r,
						question: questionMap.get(r.question_id),
						selectedOption: (questionMap.get(r.question_id) as any)?.options?.find((o: any) => o.id === r.selected_option_id),
						correctOption: r.correct_option_id
							? (questionMap.get(r.question_id) as any)?.options?.find((o: any) => o.id === r.correct_option_id)
							: null
					}));
				}
				view = 'results';
				// Reload attempts in background
				await invalidateAll();
				attempts = data.attempts ?? [];
			} else {
				// Qualitative: show submitted confirmation
				view = 'results';
				await invalidateAll();
				attempts = data.attempts ?? [];
			}
		} catch (e: any) {
			toastError(e.message || 'Failed to submit');
		} finally {
			submitting = false;
		}
	}

	const getStatusColor = (status: string) => {
		if (status === 'passed') return 'text-green-600';
		if (status === 'failed') return 'text-red-600';
		if (status === 'pending_review' || status === 'reviewing') return 'text-blue-600';
		return 'text-gray-600';
	};

	const getStatusLabel = (status: string) => {
		const labels: Record<string, string> = {
			passed: 'Passed', failed: 'Failed',
			pending_review: 'Pending Review', reviewing: 'Being Reviewed'
		};
		return labels[status] ?? status;
	};
</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<div class="bg-white border-b px-4 py-4">
		<div class="max-w-2xl mx-auto flex items-center gap-3">
			<a
				href="/courses/{courseSlug}"
				class="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition no-underline"
			>
				<ArrowLeft size="18" />
			</a>
			<div class="flex-1 min-w-0">
				<p class="text-xs text-gray-500">
					{sessionTitle || `Session ${sessionNumber}`} · {isInstant ? 'Multiple Choice' : 'Short Answer'}
				</p>
				<h1 class="text-base font-bold text-gray-800 truncate">
					{quiz.title || `Session ${sessionNumber} Quiz`}
				</h1>
			</div>
			{#if isInstant}
				<Zap size="20" class="text-amber-500 flex-shrink-0" />
			{:else}
				<PenTool size="20" class="text-purple-500 flex-shrink-0" />
			{/if}
		</div>
	</div>

	<div class="max-w-2xl mx-auto px-4 py-8">

		<!-- ── INTRO VIEW ──────────────────────────────────────────────── -->
		{#if view === 'intro'}
			<div class="bg-white rounded-2xl shadow-sm p-8 text-center">
				<div class="inline-flex p-4 rounded-full mb-4" style="background-color: #eae2d9;">
					{#if isInstant}
						<Zap size="32" class="text-amber-600" />
					{:else}
						<PenTool size="32" class="text-purple-600" />
					{/if}
				</div>

				<h2 class="text-2xl font-bold text-gray-800 mb-2">
					{quiz.title || `Session ${sessionNumber} Quiz`}
				</h2>

				<div class="flex items-center justify-center gap-4 text-sm text-gray-500 mb-6">
					<span>{quiz.questions.length} question{quiz.questions.length !== 1 ? 's' : ''}</span>
					{#if isInstant && quiz.pass_threshold}
						<span>·</span>
						<span>Pass: {quiz.pass_threshold}%</span>
					{/if}
					{#if isInstant && quiz.allow_retakes}
						<span>·</span>
						<span>Retakes allowed{quiz.max_attempts ? ` (max ${quiz.max_attempts})` : ''}</span>
					{/if}
				</div>

				{#if quiz.instructions}
					<div class="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 text-left mb-6 leading-relaxed">
						{quiz.instructions}
					</div>
				{/if}

				{#if latestAttempt && latestAttempt.status !== 'in_progress'}
					<!-- Has a prior attempt -->
					<div class="mb-6 p-4 rounded-xl border {latestAttempt.status === 'passed' ? 'border-green-200 bg-green-50' : latestAttempt.status === 'failed' ? 'border-red-200 bg-red-50' : 'border-blue-200 bg-blue-50'}">
						<p class="text-sm font-medium {getStatusColor(latestAttempt.status)}">
							Previous attempt: {getStatusLabel(latestAttempt.status)}
							{#if latestAttempt.score !== null && isInstant}
								— {latestAttempt.score}%
							{/if}
						</p>
						<button
							onclick={() => { lastResult = null; view = 'results'; }}
							class="mt-1 text-xs text-gray-500 underline hover:text-gray-700"
						>
							View results
						</button>
					</div>
				{/if}

				<button
					onclick={startQuiz}
					class="px-8 py-3 text-white font-semibold rounded-xl hover:opacity-90 transition"
					style="background-color: var(--course-accent-dark, #334642);"
				>
					{latestAttempt ? (canRetake ? 'Retake Quiz' : 'Start Quiz') : 'Start Quiz'}
				</button>
			</div>

		<!-- ── TAKING VIEW ────────────────────────────────────────────── -->
		{:else if view === 'taking'}
			<div class="space-y-6">
				<!-- Restore banner -->
				{#if showRestoreBanner}
					<div class="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
						<p class="text-sm text-blue-800">You have unsaved answers from a previous session.</p>
						<div class="flex gap-2 flex-shrink-0 ml-4">
							<button
								onclick={() => {
									try {
										const saved = localStorage.getItem(`quiz_autosave_${currentAttemptId}`);
										if (saved) responses = JSON.parse(saved);
									} catch {}
									showRestoreBanner = false;
								}}
								class="px-3 py-1.5 text-sm text-white rounded-lg font-medium transition hover:opacity-90"
								style="background-color: var(--course-accent-dark, #334642);"
							>
								Restore
							</button>
							<button
								onclick={() => {
									try { localStorage.removeItem(`quiz_autosave_${currentAttemptId}`); } catch {}
									showRestoreBanner = false;
								}}
								class="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition"
							>
								Start fresh
							</button>
						</div>
					</div>
				{/if}

				{#each quiz.questions as question, index (question.id)}
					<div class="bg-white rounded-2xl shadow-sm p-6">
						<p class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
							Question {index + 1}{isInstant ? ` · ${question.points} pt${question.points !== 1 ? 's' : ''}` : ''}
						</p>
						{#if question.image_url}
							<img src={question.image_url} alt="Question image" class="rounded-xl max-h-48 object-contain mb-3" />
						{/if}
						<div class="prose prose-sm text-gray-800 mb-4 font-semibold leading-snug">
							{@html renderMarkdown(question.question_text)}
						</div>

						{#if isInstant}
							<!-- Multiple choice options -->
							<div class="space-y-2">
								{#each question.options as option (option.id)}
									<label class="flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition
										{responses[question.id] === option.id
											? 'border-gray-700 bg-gray-50'
											: 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
									">
										<input
											type="radio"
											name="q_{question.id}"
											value={option.id}
											bind:group={responses[question.id]}
											class="sr-only"
										/>
										<div class="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0
											{responses[question.id] === option.id ? 'border-gray-700 bg-gray-700' : 'border-gray-300'}
										">
											{#if responses[question.id] === option.id}
												<div class="w-2 h-2 rounded-full bg-white"></div>
											{/if}
										</div>
										<span class="text-sm text-gray-800">{option.option_text}</span>
									</label>
								{/each}
							</div>
						{:else}
							<!-- Short answer text area -->
							<textarea
								bind:value={responses[question.id]}
								rows="5"
								placeholder="Write your answer here..."
								class="w-full px-4 py-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
							></textarea>
							{#if question.word_limit}
								<p class="text-xs text-gray-400 mt-1 text-right">
									Word limit: {question.word_limit}
									(~{(responses[question.id] ?? '').trim().split(/\s+/).filter(Boolean).length} words)
								</p>
							{/if}
						{/if}
					</div>
				{/each}

				<!-- Submit -->
				<div class="flex items-center justify-between bg-white rounded-2xl shadow-sm p-5">
					<p class="text-sm text-gray-500">
						{Object.keys(responses).filter(k => responses[k]).length} / {quiz.questions.length} answered
					</p>
					<button
						onclick={submitQuiz}
						disabled={submitting}
						class="px-6 py-2.5 text-white font-semibold rounded-xl hover:opacity-90 transition disabled:opacity-50"
						style="background-color: var(--course-accent-dark, #334642);"
					>
						{submitting ? 'Submitting...' : 'Submit Quiz'}
					</button>
				</div>
			</div>

		<!-- ── RESULTS VIEW ───────────────────────────────────────────── -->
		{:else if view === 'results'}
			{@const displayAttempt = attempts[0]}

			{#if isInstant && lastResult}
				<!-- Instant quiz result -->
				<div class="space-y-6">
					<!-- Score summary -->
					<div class="bg-white rounded-2xl shadow-sm p-8 text-center">
						{#if lastResult.status === 'passed'}
							<CheckCircle size="48" class="text-green-500 mx-auto mb-3" />
							<h2 class="text-2xl font-bold text-green-700 mb-1">Passed!</h2>
						{:else}
							<XCircle size="48" class="text-red-500 mx-auto mb-3" />
							<h2 class="text-2xl font-bold text-red-700 mb-1">Not Quite</h2>
						{/if}
						<p class="text-4xl font-bold text-gray-800">{lastResult.score}%</p>
						<p class="text-sm text-gray-500 mt-1">
							{lastResult.points_earned} / {lastResult.points_possible} point{lastResult.points_possible !== 1 ? 's' : ''}
						</p>

						{#if canRetake}
							<button
								onclick={startQuiz}
								class="mt-5 px-6 py-2.5 text-white font-semibold rounded-xl hover:opacity-90 transition text-sm"
								style="background-color: var(--course-accent-dark, #334642);"
							>
								Retake Quiz
							</button>
						{:else if lastResult.status === 'failed' && !quiz.allow_retakes}
							<p class="text-xs text-gray-400 mt-4">Retakes are not available for this quiz.</p>
						{/if}
					</div>

					<!-- Per-question breakdown -->
					{#if lastResult.responses}
						<div class="space-y-3">
							{#each lastResult.responses as r, index}
								<div class="bg-white rounded-2xl shadow-sm p-5">
									<div class="flex items-start gap-3">
										<div class="flex-shrink-0 mt-0.5">
											{#if r.is_correct}
												<Check size="18" class="text-green-500" />
											{:else}
												<X size="18" class="text-red-500" />
											{/if}
										</div>
										<div class="flex-1 min-w-0">
											<p class="text-xs text-gray-400 mb-1">Q{index + 1}</p>
											<p class="text-sm font-medium text-gray-800 mb-2">{r.question?.question_text}</p>
											<p class="text-sm {r.is_correct ? 'text-green-700' : 'text-red-700'}">
												Your answer: {r.selectedOption?.option_text ?? 'No answer'}
											</p>
											{#if !r.is_correct && r.correctOption && lastResult.show_correct_answers}
												<p class="text-sm text-green-700 mt-1">
													Correct: {r.correctOption.option_text}
												</p>
											{/if}
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<div class="text-center">
						<a
							href="/courses/{courseSlug}"
							class="text-sm text-gray-500 hover:text-gray-700 underline no-underline hover:underline"
						>
							← Back to course
						</a>
					</div>
				</div>

			{:else if !isInstant && displayAttempt}
				<!-- Qualitative quiz status -->
				<div class="bg-white rounded-2xl shadow-sm p-8 text-center">
					{#if displayAttempt.status === 'passed'}
						<CheckCircle size="48" class="text-green-500 mx-auto mb-3" />
						<h2 class="text-2xl font-bold text-green-700 mb-2">Passed</h2>
					{:else if displayAttempt.status === 'failed'}
						<XCircle size="48" class="text-red-500 mx-auto mb-3" />
						<h2 class="text-2xl font-bold text-red-700 mb-2">Not Passed</h2>
					{:else}
						<Clock size="48" class="text-blue-500 mx-auto mb-3" />
						<h2 class="text-2xl font-bold text-gray-700 mb-2">Submitted for Review</h2>
						<p class="text-sm text-gray-500">Your responses have been submitted. You'll be notified when they've been marked.</p>
					{/if}

					{#if displayAttempt.overall_feedback}
						<div class="mt-5 bg-gray-50 rounded-xl p-4 text-sm text-gray-700 text-left">
							<p class="font-semibold text-gray-600 mb-1">Feedback</p>
							<p>{displayAttempt.overall_feedback}</p>
						</div>
					{/if}

					<a
						href="/courses/{courseSlug}"
						class="mt-6 inline-block px-6 py-2.5 text-white font-semibold rounded-xl hover:opacity-90 transition text-sm no-underline"
						style="background-color: var(--course-accent-dark, #334642);"
					>
						Back to Course
					</a>
				</div>

				<!-- Show submitted responses if marked -->
				{#if ['passed', 'failed'].includes(displayAttempt.status) && displayAttempt.responses?.length > 0}
					<div class="space-y-3 mt-4">
						{#each displayAttempt.responses as r}
							{@const question = quiz.questions.find((q: any) => q.id === r.question_id)}
							<div class="bg-white rounded-2xl shadow-sm p-5">
								{#if question?.image_url}
								<img src={question.image_url} alt="Question image" class="rounded-lg max-h-32 object-contain mb-2" />
							{/if}
							<div class="prose prose-sm text-gray-800 mb-2 font-medium">{@html renderMarkdown(question?.question_text)}</div>
								<div class="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mb-2">
									{r.response_text || '(No answer)'}
								</div>
								{#if r.feedback}
									<div class="border-l-2 border-blue-300 pl-3 text-sm text-gray-600">
										<span class="font-medium text-blue-700">Feedback:</span> {r.feedback}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		{/if}
	</div>
</div>

<ConfirmationModal
	show={showUnansweredConfirm}
	onConfirm={doSubmit}
	onCancel={() => { showUnansweredConfirm = false; pendingSubmit = false; }}
>
	<p class="text-gray-700">
		{quiz?.questions.filter((q: any) => !responses[q.id]).length ?? 0} question{(quiz?.questions.filter((q: any) => !responses[q.id]).length ?? 0) !== 1 ? 's are' : ' is'} unanswered. Submit anyway?
	</p>
</ConfirmationModal>

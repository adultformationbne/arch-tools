<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		CheckCircle, XCircle, Clock, User, Calendar, Filter, X,
		Zap, PenTool, ChevronDown, ChevronUp
	} from '$lib/icons';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';
	import ParticipantSearch from '$lib/components/ParticipantSearch.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import { renderMarkdown } from '$lib/utils/markdown.js';

	let { data } = $props();

	const courseSlug = $derived(data.courseSlug);
	const currentUserId = $derived(data.currentUserId);
	const currentUserName = $derived(data.currentUserName);

	let attempts = $state(data.quizAttempts ?? []);
	let quizzes = $state(data.quizzes ?? []);
	let cohorts = $state(data.cohorts ?? []);

	$effect(() => {
		attempts = data.quizAttempts ?? [];
		quizzes = data.quizzes ?? [];
		cohorts = data.cohorts ?? [];
	});

	// Tabs: 'marking' (qualitative) | 'results' (instant)
	let activeTab = $state('marking');
	let selectedQuizFilter = $state('all');
	let selectedStatusFilter = $state('pending');
	let selectedCohort = $state('all');
	let selectedParticipant = $state('all');

	// Marking modal state
	let showMarkingModal = $state(false);
	let selectedAttempt = $state<any>(null);
	let markingForm = $state({
		result: 'passed',
		overall_feedback: '',
		response_markings: [] as { response_id: string; feedback: string }[]
	});
	let isSaving = $state(false);
	let isClaiming = $state(false);
	let showReopenConfirm = $state(false);
	let attemptPendingReopen = $state<any>(null);

	// Results: expand attempt detail
	let expandedAttemptId = $state<string | null>(null);
	let expandedStatsQuizId = $state<string | null>(null);
	const questionStats = $derived(data.questionStats ?? {});

	// Feedback snippets for the currently selected attempt's quiz
	const overallSnippets = $derived<Array<{ id: string; text: string }>>(
		(selectedAttempt?.quiz?.quiz_feedback_snippets ?? []) as Array<{ id: string; text: string }>
	);

	// Build question lookup map from quiz data
	const questionsByQuizId = $derived.by(() => {
		const map = new Map<string, Map<string, any>>();
		for (const q of data.quizzes ?? []) {
			const qMap = new Map<string, any>();
			for (const question of (q.questions as any[]) ?? []) {
				qMap.set(question.id, question);
			}
			map.set(q.id, qMap);
		}
		return map;
	});

	// Derived
	const qualitativeQuizIds = $derived(new Set(quizzes.filter(q => q.mode === 'qualitative').map(q => q.id)));
	const instantQuizIds = $derived(new Set(quizzes.filter(q => q.mode === 'instant').map(q => q.id)));

	const hasQualitative = $derived(qualitativeQuizIds.size > 0);
	const hasInstant = $derived(instantQuizIds.size > 0);

	// Poll for updates every 30s (only while modal is closed)
	$effect(() => {
		const interval = setInterval(() => {
			if (!showMarkingModal) invalidateAll();
		}, 30000);
		return () => clearInterval(interval);
	});

	// ── Filtered marking attempts ─────────────────────────────────────────────
	const markingAttempts = $derived.by(() => {
		let filtered = attempts.filter(a => qualitativeQuizIds.has(a.quiz_id));

		if (selectedStatusFilter === 'pending') {
			filtered = filtered.filter(a => a.status === 'pending_review' || a.status === 'reviewing');
		} else if (selectedStatusFilter === 'marked') {
			filtered = filtered.filter(a => a.status === 'passed' || a.status === 'failed');
		}

		if (selectedQuizFilter !== 'all') {
			filtered = filtered.filter(a => a.quiz_id === selectedQuizFilter);
		}

		if (selectedCohort !== 'all') {
			filtered = filtered.filter(a => (a.enrollment as any)?.cohort?.id === selectedCohort);
		}

		if (selectedParticipant !== 'all') {
			filtered = filtered.filter(a => (a.enrollment as any)?.id === selectedParticipant);
		}

		return filtered;
	});

	// ── Filtered results attempts ─────────────────────────────────────────────
	const resultsAttempts = $derived.by(() => {
		let filtered = attempts.filter(a => instantQuizIds.has(a.quiz_id));

		if (selectedQuizFilter !== 'all') {
			filtered = filtered.filter(a => a.quiz_id === selectedQuizFilter);
		}

		if (selectedCohort !== 'all') {
			filtered = filtered.filter(a => (a.enrollment as any)?.cohort?.id === selectedCohort);
		}

		if (selectedParticipant !== 'all') {
			filtered = filtered.filter(a => (a.enrollment as any)?.id === selectedParticipant);
		}

		return filtered;
	});

	// ── Participants for filter ───────────────────────────────────────────────
	const participants = $derived.by(() => {
		const map = new Map();
		const source = activeTab === 'marking' ? markingAttempts : resultsAttempts;
		for (const a of source) {
			const enr = a.enrollment as any;
			if (enr?.id && !map.has(enr.id)) {
				map.set(enr.id, { id: enr.id, name: enr.full_name, email: enr.email });
			}
		}
		return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
	});

	// ── Marking queue counts ──────────────────────────────────────────────────
	const pendingCount = $derived(attempts.filter(a =>
		qualitativeQuizIds.has(a.quiz_id) &&
		(a.status === 'pending_review' || a.status === 'reviewing')
	).length);

	const markedCount = $derived(attempts.filter(a =>
		qualitativeQuizIds.has(a.quiz_id) &&
		(a.status === 'passed' || a.status === 'failed')
	).length);

	// ── Instant quiz stats ────────────────────────────────────────────────────
	const instantStats = $derived.by(() => {
		const byQuiz: Record<string, { attempts: number; passed: number; scoreSum: number }> = {};
		for (const a of attempts.filter(a => instantQuizIds.has(a.quiz_id))) {
			if (!byQuiz[a.quiz_id]) byQuiz[a.quiz_id] = { attempts: 0, passed: 0, scoreSum: 0 };
			byQuiz[a.quiz_id].attempts++;
			if (a.status === 'passed') byQuiz[a.quiz_id].passed++;
			if (a.score !== null) byQuiz[a.quiz_id].scoreSum += a.score;
		}
		return byQuiz;
	});

	// ── Status helpers ────────────────────────────────────────────────────────
	const getStatusLabel = (status: string) => ({
		pending_review: 'Pending Review',
		reviewing: 'Reviewing',
		passed: 'Passed',
		failed: 'Failed'
	}[status] ?? status);

	const getStatusClass = (status: string) => {
		if (status === 'passed') return 'bg-green-100 text-green-800';
		if (status === 'failed') return 'bg-red-100 text-red-800';
		if (status === 'reviewing') return 'bg-amber-100 text-amber-800';
		return 'bg-blue-100 text-blue-800';
	};

	const formatDate = (d: string | null) => {
		if (!d) return '—';
		return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	};

	// ── Open marking modal ────────────────────────────────────────────────────
	async function openMarkingModal(attempt: any) {
		isClaiming = true;
		try {
			const res = await fetch(`/admin/courses/${courseSlug}/quiz-attempts/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ attempt_id: attempt.id })
			});
			const result = await res.json();

			if (result.claimed_by_other) {
				toastError(`This attempt is being reviewed by someone else (${Math.round(result.claim_expires_in_minutes)} min remaining)`);
				return;
			}

			if (result.already_marked) {
				attemptPendingReopen = attempt;
				showReopenConfirm = true;
				return;
			}

			selectedAttempt = attempt;
			markingForm = {
				result: 'passed',
				overall_feedback: '',
				response_markings: (attempt.responses ?? []).map((r: any) => ({
					response_id: r.id,
					feedback: r.feedback ?? ''
				}))
			};
			showMarkingModal = true;
		} catch (e) {
			toastError('Failed to claim attempt');
		} finally {
			isClaiming = false;
		}
	}

	async function confirmReopen() {
		if (!attemptPendingReopen) return;
		showReopenConfirm = false;
		isClaiming = true;
		try {
			const res = await fetch(`/admin/courses/${courseSlug}/quiz-attempts/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ attempt_id: attemptPendingReopen.id, force: true })
			});
			const result = await res.json();
			if (!result.attempt) { toastError('Failed to reopen attempt'); return; }
			selectedAttempt = attemptPendingReopen;
			markingForm = {
				result: 'passed',
				overall_feedback: attemptPendingReopen.overall_feedback ?? '',
				response_markings: (attemptPendingReopen.responses ?? []).map((r: any) => ({
					response_id: r.id,
					feedback: r.feedback ?? ''
				}))
			};
			showMarkingModal = true;
		} catch {
			toastError('Failed to reopen attempt');
		} finally {
			isClaiming = false;
			attemptPendingReopen = null;
		}
	}

	async function closeMarkingModal() {
		if (selectedAttempt) {
			await fetch(`/admin/courses/${courseSlug}/quiz-attempts/api`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ attempt_id: selectedAttempt.id })
			});
		}
		showMarkingModal = false;
		selectedAttempt = null;
		await invalidateAll();
	}

	async function saveDraft() {
		if (!selectedAttempt) return;
		isSaving = true;
		try {
			await fetch(`/admin/courses/${courseSlug}/quiz-attempts/api`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					attempt_id: selectedAttempt.id,
					overall_feedback: markingForm.overall_feedback,
					response_markings: markingForm.response_markings,
					draft: true
				})
			});
			toastSuccess('Draft saved');
		} catch (e) {
			toastError('Failed to save draft');
		} finally {
			isSaving = false;
		}
	}

	// Keyboard shortcuts in marking modal
	$effect(() => {
		if (!showMarkingModal) return;
		const handler = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement;
			if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
			if (e.key === 'p') { markingForm.result = 'passed'; e.preventDefault(); }
			if (e.key === 'f') { markingForm.result = 'failed'; e.preventDefault(); }
			if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { submitMarking(); e.preventDefault(); }
		};
		document.addEventListener('keydown', handler);
		return () => document.removeEventListener('keydown', handler);
	});

	async function submitMarking() {
		if (!selectedAttempt) return;
		isSaving = true;
		try {
			const res = await fetch(`/admin/courses/${courseSlug}/quiz-attempts/api`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					attempt_id: selectedAttempt.id,
					result: markingForm.result,
					overall_feedback: markingForm.overall_feedback,
					response_markings: markingForm.response_markings
				})
			});
			if (!res.ok) throw new Error('Failed to submit marking');
			showMarkingModal = false;
			selectedAttempt = null;
			toastSuccess('Marking submitted');
			await invalidateAll();
			attempts = data.quizAttempts ?? [];
		} catch (e) {
			toastError('Failed to submit marking');
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="bg-white min-h-screen">
	<!-- Page header -->
	<div class="bg-white border-b px-6 py-5">
		<h1 class="text-2xl font-bold text-gray-800">Quizzes</h1>
		<p class="text-sm text-gray-500 mt-0.5">Marking queue and results overview</p>
	</div>

	{#if !hasQualitative && !hasInstant}
		<div class="flex flex-col items-center justify-center py-24 text-center px-6">
			<Zap size="48" class="text-gray-300 mb-4" />
			<p class="text-xl font-bold text-gray-400 mb-2">No Quizzes</p>
			<p class="text-sm text-gray-400">Add quizzes to sessions in the Sessions editor.</p>
		</div>
	{:else}
		<!-- Tabs -->
		<div class="border-b px-6 flex gap-6">
			{#if hasQualitative}
				<button
					onclick={() => { activeTab = 'marking'; selectedQuizFilter = 'all'; }}
					class="py-3 text-sm font-medium border-b-2 transition
						{activeTab === 'marking'
							? 'border-gray-800 text-gray-800'
							: 'border-transparent text-gray-500 hover:text-gray-700'}"
				>
					Marking Queue
					{#if pendingCount > 0}
						<span class="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">{pendingCount}</span>
					{/if}
				</button>
			{/if}
			{#if hasInstant}
				<button
					onclick={() => { activeTab = 'results'; selectedQuizFilter = 'all'; }}
					class="py-3 text-sm font-medium border-b-2 transition
						{activeTab === 'results'
							? 'border-gray-800 text-gray-800'
							: 'border-transparent text-gray-500 hover:text-gray-700'}"
				>
					Quiz Results
				</button>
			{/if}
		</div>

		<!-- Filters -->
		<div class="px-6 py-3 border-b bg-gray-50 flex flex-wrap gap-3 items-center">
			<!-- Quiz selector -->
			<select
				bind:value={selectedQuizFilter}
				class="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
			>
				<option value="all">All Quizzes</option>
				{#each quizzes.filter(q => activeTab === 'marking' ? q.mode === 'qualitative' : q.mode === 'instant') as q}
					<option value={q.id}>
						Session {q.session_number}{q.title ? ` — ${q.title}` : ''}
					</option>
				{/each}
			</select>

			{#if cohorts.length > 1}
				<select
					bind:value={selectedCohort}
					class="text-sm border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
				>
					<option value="all">All Cohorts</option>
					{#each cohorts as c}
						<option value={c.id}>{c.name}</option>
					{/each}
				</select>
			{/if}

			{#if activeTab === 'marking'}
				<div class="flex gap-1">
					{#each [['pending', 'Pending', pendingCount], ['marked', 'Marked', markedCount], ['all', 'All', null]] as [val, label, count]}
						<button
							onclick={() => selectedStatusFilter = val}
							class="px-3 py-1.5 text-xs rounded-full font-medium transition
								{selectedStatusFilter === val
									? 'bg-gray-800 text-white'
									: 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}"
						>
							{label}{count !== null && count > 0 ? ` (${count})` : ''}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- ── MARKING QUEUE ──────────────────────────────────────────────── -->
		{#if activeTab === 'marking'}
			{#if markingAttempts.length === 0}
				<div class="flex flex-col items-center py-16 text-center">
					<CheckCircle size="40" class="text-gray-300 mb-3" />
					<p class="text-gray-400 font-medium">No attempts matching filter</p>
				</div>
			{:else}
				<div class="divide-y">
					{#each markingAttempts as attempt (attempt.id)}
						{@const enr = attempt.enrollment as any}
						{@const quiz = attempt.quiz}
						<div class="px-6 py-4 hover:bg-gray-50 transition flex items-center gap-4">
							<div class="flex-1 min-w-0">
								<div class="flex items-center gap-2 mb-0.5">
									<p class="font-semibold text-gray-800 text-sm">{enr?.full_name ?? 'Unknown'}</p>
									{#if enr?.hub?.name}
										<span class="text-xs text-gray-400">· {enr.hub.name}</span>
									{/if}
								</div>
								<p class="text-xs text-gray-500">
									Session {quiz?.session_number} quiz
									{quiz?.title ? `— ${quiz.title}` : ''}
									· Attempt {attempt.attempt_number}
									· {formatDate(attempt.submitted_at)}
								</p>
								{#if enr?.cohort?.name}
									<p class="text-xs text-gray-400 mt-0.5">{enr.cohort.name}</p>
								{/if}
							</div>
							<span class="px-2.5 py-1 text-xs font-medium rounded-full {getStatusClass(attempt.status)}">
								{getStatusLabel(attempt.status)}
							</span>
							{#if attempt.status === 'pending_review' || attempt.status === 'reviewing'}
								<button
									onclick={() => openMarkingModal(attempt)}
									disabled={isClaiming}
									class="px-4 py-1.5 text-sm font-medium text-white rounded-lg hover:opacity-90 transition disabled:opacity-50"
									style="background-color: #334642;"
								>
									Mark
								</button>
							{:else}
								<button
									onclick={() => openMarkingModal(attempt)}
									class="px-4 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
								>
									View
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

		<!-- ── RESULTS ────────────────────────────────────────────────────── -->
		{:else if activeTab === 'results'}
			{#if resultsAttempts.length === 0}
				<div class="flex flex-col items-center py-16 text-center">
					<Zap size="40" class="text-gray-300 mb-3" />
					<p class="text-gray-400 font-medium">No attempts yet</p>
				</div>
			{:else}
				<!-- Stats per quiz -->
				{#each quizzes.filter(q => q.mode === 'instant' && (selectedQuizFilter === 'all' || selectedQuizFilter === q.id)) as quiz}
					{@const stats = instantStats[quiz.id] ?? { attempts: 0, passed: 0, scoreSum: 0 }}
					{@const avgScore = stats.attempts > 0 ? Math.round(stats.scoreSum / stats.attempts) : null}
					{@const passRate = stats.attempts > 0 ? Math.round((stats.passed / stats.attempts) * 100) : null}
					<div class="px-6 py-4 border-b bg-gray-50">
						<div class="flex items-center gap-3">
							<Zap size="16" class="text-amber-500" />
							<span class="font-semibold text-gray-700 text-sm">
								Session {quiz.session_number}{quiz.title ? ` — ${quiz.title}` : ''}
							</span>
							<div class="flex gap-4 text-xs text-gray-500 ml-auto">
								<span>{stats.attempts} attempt{stats.attempts !== 1 ? 's' : ''}</span>
								{#if passRate !== null}<span class="text-green-600">{passRate}% pass rate</span>{/if}
								{#if avgScore !== null}<span>Avg: {avgScore}%</span>{/if}
							</div>
						</div>
					</div>

					<!-- Attempts for this quiz -->
					{#each resultsAttempts.filter(a => a.quiz_id === quiz.id) as attempt (attempt.id)}
						{@const enr = attempt.enrollment as any}
						<div class="border-b">
							<button
								onclick={() => expandedAttemptId = expandedAttemptId === attempt.id ? null : attempt.id}
								class="w-full px-6 py-3 flex items-center gap-4 hover:bg-gray-50 transition text-left"
							>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-gray-800">{enr?.full_name ?? 'Unknown'}</p>
									<p class="text-xs text-gray-400">
										Attempt {attempt.attempt_number} · {formatDate(attempt.submitted_at)}
									</p>
								</div>
								<span class="text-sm font-bold {attempt.status === 'passed' ? 'text-green-600' : 'text-red-600'}">
									{attempt.score ?? '—'}%
								</span>
								<span class="px-2 py-0.5 text-xs font-medium rounded-full {getStatusClass(attempt.status)}">
									{getStatusLabel(attempt.status)}
								</span>
								{#if expandedAttemptId === attempt.id}
									<ChevronUp size="16" class="text-gray-400 flex-shrink-0" />
								{:else}
									<ChevronDown size="16" class="text-gray-400 flex-shrink-0" />
								{/if}
							</button>

							{#if expandedAttemptId === attempt.id}
								<div class="px-6 pb-4 space-y-2 border-t border-gray-100 bg-gray-50">
									<p class="text-xs text-gray-500 pt-3">
										{attempt.points_earned ?? '—'} / {attempt.points_possible ?? '—'} points
									</p>
									{#each (attempt.responses ?? []) as r}
										<div class="flex items-start gap-2 py-1">
											{#if r.is_correct}
												<CheckCircle size="14" class="text-green-500 mt-0.5 flex-shrink-0" />
											{:else}
												<XCircle size="14" class="text-red-500 mt-0.5 flex-shrink-0" />
											{/if}
											<span class="text-xs text-gray-600">Q· {r.question_id.slice(0, 8)}…</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				{/each}
			{/if}
		{/if}
	{/if}
</div>

<!-- ── Marking Modal ───────────────────────────────────────────────────────── -->
{#if showMarkingModal && selectedAttempt}
	{@const enr = selectedAttempt.enrollment as any}
	{@const quiz = selectedAttempt.quiz}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex items-start justify-between p-6 border-b sticky top-0 bg-white z-10">
				<div>
					<h2 class="text-xl font-bold text-gray-800">
						Marking: {enr?.full_name}
					</h2>
					<p class="text-sm text-gray-500 mt-0.5">
						Session {quiz?.session_number} Quiz
						{quiz?.title ? `— ${quiz.title}` : ''}
						· Attempt {selectedAttempt.attempt_number}
						· Submitted {formatDate(selectedAttempt.submitted_at)}
					</p>
				</div>
				<button onclick={closeMarkingModal} class="p-2 text-gray-400 hover:text-gray-700 rounded">
					<X size="20" />
				</button>
			</div>

			<div class="p-6 space-y-6">
				<!-- Per-question responses -->
				<!-- Previous attempts collapsible -->
				{#if selectedAttempt.previous_attempts?.length > 0}
					<details class="border rounded-xl p-4">
						<summary class="text-sm font-medium text-gray-700 cursor-pointer">
							Previous attempt{selectedAttempt.previous_attempts.length > 1 ? 's' : ''} ({selectedAttempt.previous_attempts.length})
						</summary>
						{#each selectedAttempt.previous_attempts as prev}
							<div class="mt-3 border-t pt-3 first:border-0 first:pt-0">
								<p class="text-xs text-gray-500 mb-2">
									Attempt {prev.attempt_number} · {formatDate(prev.submitted_at)}
									{#if prev.status === 'passed'} · <span class="text-green-600">Passed</span>
									{:else if prev.status === 'failed'} · <span class="text-red-600">Failed</span>{/if}
								</p>
								{#each (prev.responses ?? []) as pr, pi}
									{@const prevQ = questionsByQuizId.get(selectedAttempt.quiz_id)?.get(pr.question_id)}
									<div class="mb-2">
										<p class="text-xs font-medium text-gray-500">Q{pi + 1}{prevQ ? `: ${prevQ.question_text.slice(0, 60)}${prevQ.question_text.length > 60 ? '…' : ''}` : ''}</p>
										<p class="text-xs text-gray-700 bg-gray-50 rounded p-2 mt-1">{pr.response_text || '(No answer)'}</p>
										{#if pr.feedback}
											<p class="text-xs text-blue-600 mt-1">Feedback: {pr.feedback}</p>
										{/if}
									</div>
								{/each}
							</div>
						{/each}
					</details>
				{/if}

				{#each (selectedAttempt.responses ?? []) as response, index}
					{@const rm = markingForm.response_markings[index]}
					{@const q = questionsByQuizId.get(selectedAttempt.quiz_id)?.get(response.question_id)}
					{@const snippets = (selectedAttempt.quiz?.quiz_feedback_snippets ?? []) as Array<{ id: string; text: string }>}
					<div class="border-b pb-5">
						<p class="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Q{index + 1}</p>
						{#if q}
							{#if q.image_url}
								<img src={q.image_url} alt="Question image" class="rounded-lg max-h-32 object-contain mb-2" />
							{/if}
							<div class="prose prose-sm text-gray-700 mb-2 font-medium">{@html renderMarkdown(q.question_text)}</div>
						{/if}

						<!-- Participant's response -->
						<div class="bg-gray-50 rounded-xl p-4 text-sm text-gray-800 mb-3 leading-relaxed">
							{response.response_text || '(No answer)'}
						</div>

						<!-- Per-question feedback -->
						<label class="block text-xs font-medium text-gray-600 mb-1">
							Feedback for this question (optional)
						</label>
						{#if snippets.length > 0}
							<div class="flex flex-wrap gap-1.5 mb-2">
								{#each snippets as snippet (snippet.id)}
									<button
										type="button"
										onclick={() => { rm.feedback = rm.feedback ? rm.feedback + ' ' + snippet.text : snippet.text; }}
										class="px-2 py-0.5 text-xs rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
									>
										{snippet.text}
									</button>
								{/each}
							</div>
						{/if}
						<textarea
							bind:value={rm.feedback}
							rows="2"
							placeholder="Write feedback..."
							class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
						></textarea>
					</div>
				{/each}

				<!-- Overall feedback -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1">Overall Feedback (optional)</label>
					{#if overallSnippets.length > 0}
						<div class="flex flex-wrap gap-1.5 mb-2">
							{#each overallSnippets as snippet (snippet.id)}
								<button
									type="button"
									onclick={() => { markingForm.overall_feedback = markingForm.overall_feedback ? markingForm.overall_feedback + ' ' + snippet.text : snippet.text; }}
									class="px-2 py-0.5 text-xs rounded-full border border-gray-300 text-gray-600 hover:bg-gray-100 transition"
								>
									{snippet.text}
								</button>
							{/each}
						</div>
					{/if}
					<textarea
						bind:value={markingForm.overall_feedback}
						rows="3"
						placeholder="Write overall feedback..."
						class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 resize-none"
					></textarea>
				</div>

				<!-- Result -->
				<div>
					<p class="text-sm font-medium text-gray-700 mb-2">Result</p>
					<div class="flex gap-3">
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="radio" bind:group={markingForm.result} value="passed" />
							<span class="text-sm font-medium text-green-700">Pass</span>
						</label>
						<label class="flex items-center gap-2 cursor-pointer">
							<input type="radio" bind:group={markingForm.result} value="failed" />
							<span class="text-sm font-medium text-red-700">Fail</span>
						</label>
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-2 px-6 pb-6 sticky bottom-0 bg-white border-t pt-4">
				<button
					onclick={saveDraft}
					disabled={isSaving}
					class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
				>
					Save Draft
				</button>
				<button
					onclick={closeMarkingModal}
					class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
				>
					Cancel
				</button>
				<button
					onclick={submitMarking}
					disabled={isSaving}
					class="px-5 py-2 text-sm text-white rounded-lg font-medium hover:opacity-90 transition disabled:opacity-50"
					style="background-color: #334642;"
				>
					{isSaving ? 'Submitting...' : 'Submit Marking'}
				</button>
			</div>
		</div>
	</div>
{/if}

<ConfirmationModal
	show={showReopenConfirm}
	onConfirm={confirmReopen}
	onCancel={() => { showReopenConfirm = false; attemptPendingReopen = null; }}
>
	<p class="text-gray-700">
		This attempt has already been marked as <strong>{attemptPendingReopen?.status}</strong>.
		Reopen it for re-marking? The participant's status will change back to "Reviewing".
	</p>
</ConfirmationModal>

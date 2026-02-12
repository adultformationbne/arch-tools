<script>
	import { Mail, FileText, Pencil, Send, Loader2, TestTube, X, Save, Eye, Users, ChevronDown, ChevronLeft, ChevronRight, Check, Square, CheckSquare, AlertTriangle } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { apiPost, apiPut, apiGet } from '$lib/utils/api-handler.js';
	import EmailBodyEditor from './EmailBodyEditor.svelte';
	import EmailPreviewFrame from './EmailPreviewFrame.svelte';
	import TestEmailPanel from './TestEmailPanel.svelte';
	import ConfirmationModal from './ConfirmationModal.svelte';
	import SubjectInputWithVariables from './SubjectInputWithVariables.svelte';
	import { COURSE_VARIABLES, buildCourseVariablesFromEnrollment, substituteVariables as substituteVars } from '$lib/email/context-config';

	let {
		course,
		courseSlug,
		templates = [],
		cohorts = [],
		hubs = [],
		hubCountsByCohort = {},
		initialMode = 'choose',
		currentUserEmail = '',
		// New props for embedded/modal usage
		preselectedRecipients = null,
		initialTemplateSlug = '',
		cohortId = null,
		variant = 'page',
		onSent = null,
		onClose = null
	} = $props();

	const isEmbedded = $derived(variant === 'embedded');

	// Internal templates state (starts from prop, can be loaded via API)
	let allTemplates = $state([]);
	let loadingTemplates = $state(false);

	// Sync templates from prop
	$effect(() => {
		if (templates.length > 0) {
			allTemplates = templates;
		}
	});

	// Auto-load templates if not provided (guarded against double-fire)
	$effect(() => {
		if (allTemplates.length === 0 && courseSlug && !loadingTemplates) {
			loadTemplatesFromApi();
		}
	});

	async function loadTemplatesFromApi() {
		loadingTemplates = true;
		try {
			const result = await apiGet(`/api/courses/${courseSlug}/emails`, { showToast: false });
			if (result?.templates) {
				allTemplates = [...(result.templates.system || []), ...(result.templates.custom || [])];
			}
		} catch (err) {
			console.error('Failed to load templates:', err);
			toastError('Failed to load email templates');
		} finally {
			loadingTemplates = false;
		}
	}

	// Main state (initialized from prop, then managed locally)
	// When initialTemplateSlug is provided, start in 'template' mode to avoid flashing the choose cards
	let mode = $state(initialTemplateSlug ? 'template' : initialMode);

	// Template mode state
	let selectedTemplateId = $state('');
	let isEditing = $state(false);
	let editedSubject = $state('');
	let editedBody = $state('');

	// Quick email state
	let quickSubject = $state('');
	let quickBody = $state('');

	// Recipient filter state (only used in page mode)
	let selectedCohortId = $state('');
	let additionalFilter = $state('none');
	let selectedHubId = $state('');
	let selectedSessionNumber = $state('');
	let recipients = $state([]);
	let loadingRecipients = $state(false);
	let hasLoadedRecipients = $state(false);

	// Recipients panel state
	let showRecipientsPanel = $state(false);
	let excludedRecipientIds = $state(/** @type {Set<string>} */ (new Set()));

	// Preview state - now stores the recipient ID
	let previewRecipientId = $state(null);

	// Sending state
	let sending = $state(false);
	let showTestEmailPanel = $state(false);
	let showSendConfirm = $state(false);

	// Sync preselected recipients when provided
	$effect(() => {
		if (preselectedRecipients) {
			recipients = preselectedRecipients;
			hasLoadedRecipients = true;
			excludedRecipientIds = new Set();
			previewRecipientId = preselectedRecipients[0]?.id || null;
		}
	});

	// Auto-select template by slug when templates are loaded
	$effect(() => {
		if (initialTemplateSlug && allTemplates.length > 0 && !selectedTemplateId) {
			const t = allTemplates.find(t => t.template_key === initialTemplateSlug);
			if (t) {
				selectedTemplateId = t.id;
				mode = 'template';
			}
		}
	});

	// Course colors
	const courseColors = $derived({
		accentDark: course?.accent_dark || '#334642',
		accentLight: course?.accent_light || '#eae2d9',
		accentDarkest: course?.accent_darkest || '#1e2322'
	});

	// Get selected template
	const selectedTemplate = $derived(allTemplates.find(t => t.id === selectedTemplateId));
	const selectedCohort = $derived(cohorts.find(c => c.id === selectedCohortId));
	const maxSession = $derived(selectedCohort?.current_session || 8);

	// Filter hubs to only show those with enrollments in the selected cohort
	const filteredHubs = $derived.by(() => {
		if (!selectedCohortId) return [];
		const cohortHubCounts = hubCountsByCohort[selectedCohortId] || {};
		return hubs
			.filter(hub => cohortHubCounts[hub.id] > 0)
			.map(hub => ({
				...hub,
				enrollment_count: cohortHubCounts[hub.id] || 0
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	});

	// Enabled recipients (not excluded)
	const enabledRecipients = $derived(recipients.filter(r => !excludedRecipientIds.has(r.id)));

	// Get preview recipient - find by ID or default to first enabled
	const previewRecipient = $derived(
		previewRecipientId
			? recipients.find(r => r.id === previewRecipientId)
			: enabledRecipients[0] || recipients[0]
	);

	// Available variables (from SSOT in context-config)
	const availableVariables = COURSE_VARIABLES;

	function substituteVariables(template, recipient) {
		if (!template || !recipient) return template;
		const origin = typeof window !== 'undefined' ? window.location.origin : '';
		const variables = buildCourseVariablesFromEnrollment(recipient, course, cohorts, origin);
		return substituteVars(template, variables);
	}

	// Get current subject/body (for display/send)
	function getCurrentSubject() {
		if (mode === 'quick') return quickSubject;
		if (isEditing) return editedSubject;
		return selectedTemplate?.subject_template || '';
	}

	function getCurrentBody() {
		if (mode === 'quick') return quickBody;
		if (isEditing) return editedBody;
		return selectedTemplate?.body_template || '';
	}

	// Load recipients when filters change (page mode only)
	$effect(() => {
		if (!preselectedRecipients && selectedCohortId) {
			loadRecipients();
		} else if (!preselectedRecipients && !selectedCohortId) {
			recipients = [];
			hasLoadedRecipients = false;
			excludedRecipientIds = new Set();
			previewRecipientId = null;
		}
	});

	async function loadRecipients() {
		if (!selectedCohortId) return;

		loadingRecipients = true;
		try {
			const params = new URLSearchParams();
			params.set('cohort_id', selectedCohortId);
			// Default to 'all' (active + pending), but allow specific filters
			params.set('status', 'all');

			if (additionalFilter === 'hub' && selectedHubId) {
				params.set('hub_id', selectedHubId);
			} else if (additionalFilter === 'coordinators') {
				params.set('role', 'coordinator');
				// Also filter by hub if one is selected
				if (selectedHubId) {
					params.set('hub_id', selectedHubId);
				}
			} else if (additionalFilter === 'session' && selectedSessionNumber) {
				params.set('current_session', selectedSessionNumber);
			} else if (additionalFilter === 'pending_reflections') {
				params.set('has_pending_reflections', 'true');
			} else if (additionalFilter === 'not_signed_up') {
				// Filter to only pending/invited users who haven't signed up yet
				params.set('status', 'pending');
			}

			const result = await apiGet(`/api/courses/${courseSlug}/enrollments?${params.toString()}`, {
				showToast: false
			});

			recipients = result?.enrollments || [];
			hasLoadedRecipients = true;
			// Reset exclusions and preview when recipients change
			excludedRecipientIds = new Set();
			previewRecipientId = recipients[0]?.id || null;
		} catch (err) {
			console.error('Failed to load recipients:', err);
			recipients = [];
		} finally {
			loadingRecipients = false;
		}
	}

	// Toggle recipient inclusion
	function toggleRecipient(recipientId) {
		const newExcluded = new Set(excludedRecipientIds);
		if (newExcluded.has(recipientId)) {
			newExcluded.delete(recipientId);
		} else {
			newExcluded.add(recipientId);
			// If we excluded the preview person, reset preview
			if (previewRecipientId === recipientId) {
				const stillEnabled = recipients.find(r => !newExcluded.has(r.id));
				previewRecipientId = stillEnabled?.id || null;
			}
		}
		excludedRecipientIds = newExcluded;
	}

	// Select all / deselect all
	function selectAllRecipients() {
		excludedRecipientIds = new Set();
	}

	function deselectAllRecipients() {
		excludedRecipientIds = new Set(recipients.map(r => r.id));
		previewRecipientId = null;
	}

	// Set preview recipient
	function setPreviewRecipient(recipientId) {
		previewRecipientId = recipientId;
	}

	function handleCohortChange(e) {
		selectedCohortId = e.target.value;
		additionalFilter = 'none';
		selectedHubId = '';
		selectedSessionNumber = '';
	}

	function handleAdditionalFilterChange(e) {
		additionalFilter = e.target.value;
		selectedHubId = '';
		selectedSessionNumber = '';
		if (selectedCohortId) loadRecipients();
	}

	function handleSubFilterChange() {
		if (selectedCohortId) loadRecipients();
	}

	function handleModeSelect(newMode) {
		mode = newMode;
		if (newMode === 'quick') {
			selectedTemplateId = '';
			isEditing = true; // Quick email is always in edit mode
		} else if (newMode === 'template') {
			quickSubject = '';
			quickBody = '';
			isEditing = false;
			if (allTemplates.length > 0 && !selectedTemplateId) {
				selectedTemplateId = allTemplates[0].id;
			}
		}
	}

	function handleBack() {
		mode = 'choose';
		isEditing = false;
	}

	function startEditing() {
		editedSubject = selectedTemplate?.subject_template || '';
		editedBody = selectedTemplate?.body_template || '';
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
		editedSubject = '';
		editedBody = '';
	}

	async function saveToTemplate() {
		if (!selectedTemplate) return;

		sending = true;
		try {
			await apiPut(`/api/courses/${courseSlug}/emails`, {
				template_id: selectedTemplate.id,
				subject_template: editedSubject,
				body_template: editedBody
			}, { successMessage: 'Template saved' });

			// Update local template
			const idx = allTemplates.findIndex(t => t.id === selectedTemplate.id);
			if (idx >= 0) {
				allTemplates[idx] = { ...allTemplates[idx], subject_template: editedSubject, body_template: editedBody };
				allTemplates = [...allTemplates];
			}
			isEditing = false;
		} catch (err) {
			// Error handled by apiPut
		} finally {
			sending = false;
		}
	}

	function handleSend() {
		if (enabledRecipients.length === 0) {
			toastError('Please select at least one recipient');
			return;
		}

		const subject = getCurrentSubject();
		const body = getCurrentBody();

		if (!subject || !body) {
			toastError('Please enter a subject and body');
			return;
		}

		// Show confirmation modal
		showSendConfirm = true;
	}

	async function confirmSend() {
		showSendConfirm = false;
		sending = true;

		try {
			const subject = getCurrentSubject();
			const body = getCurrentBody();

			const payload = {
				recipients: enabledRecipients.map(r => r.id),
				cohort_id: cohortId || enabledRecipients[0]?.cohort_id
			};

			if (mode === 'quick' || isEditing) {
				payload.subject = subject;
				payload.body_html = body;
				payload.email_type = 'quick';
			} else {
				payload.template_id = selectedTemplate.id;
				payload.email_type = selectedTemplate.template_key || 'custom';
			}

			const result = await apiPost(`/api/courses/${courseSlug}/send-email`, payload);

			if (result.success || result.sent > 0) {
				toastSuccess(`Sent ${result.sent} email${result.sent !== 1 ? 's' : ''}${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);

				if (onSent) {
					onSent();
				} else {
					// Default reset for page mode
					if (mode === 'quick') {
						quickSubject = '';
						quickBody = '';
					}
					recipients = [];
					selectedCohortId = '';
					excludedRecipientIds = new Set();
				}
			} else {
				toastError(`Failed to send: ${result.errors?.[0]?.error || 'Unknown error'}`);
			}
		} catch (err) {
			// Error handled by apiPost
		} finally {
			sending = false;
		}
	}

	function handleBodyChange(html) {
		if (mode === 'quick') {
			quickBody = html;
		} else {
			editedBody = html;
		}
	}
</script>

<div class="{isEmbedded ? 'p-4' : 'p-6'} max-w-4xl mx-auto">
	{#if mode === 'choose'}
		<!-- Mode Selection -->
		<h1 class="text-2xl font-bold {isEmbedded ? 'text-gray-900' : 'text-white'} mb-2">Send Email</h1>
		<p class="{isEmbedded ? 'text-gray-500' : 'text-white/70'} mb-6">Choose how you'd like to compose your email</p>

		<div class="grid grid-cols-2 gap-4 max-w-xl">
			<button
				onclick={() => handleModeSelect('quick')}
				class="{isEmbedded ? 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent hover:border-gray-200' : 'bg-white hover:shadow-lg hover:scale-[1.02]'} rounded-xl p-5 text-left transition-all"
			>
				<div class="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style="background-color: color-mix(in srgb, var(--course-accent-light) 30%, white);">
					<Pencil size={20} style="color: var(--course-accent-dark);" />
				</div>
				<h3 class="text-base font-bold text-gray-900 mb-1">Quick Email</h3>
				<p class="text-sm text-gray-600">Write a one-off message directly.</p>
			</button>

			<button
				onclick={() => handleModeSelect('template')}
				class="{isEmbedded ? 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent hover:border-gray-200' : 'bg-white hover:shadow-lg hover:scale-[1.02]'} rounded-xl p-5 text-left transition-all"
			>
				<div class="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style="background-color: color-mix(in srgb, var(--course-accent-light) 30%, white);">
					<FileText size={20} style="color: var(--course-accent-dark);" />
				</div>
				<h3 class="text-base font-bold text-gray-900 mb-1">Use a Template</h3>
				<p class="text-sm text-gray-600">Select from your saved templates.</p>
			</button>
		</div>

		<!-- Preselected Recipients Preview (embedded mode) -->
		{#if isEmbedded && recipients.length === 0 && preselectedRecipients}
			<div class="mt-6 p-4 border border-amber-200 bg-amber-50 rounded-lg flex items-center gap-3">
				<AlertTriangle size={18} class="text-amber-500 flex-shrink-0" />
				<p class="text-sm text-amber-800">No recipients selected. Go back and select participants to email.</p>
			</div>
		{:else if isEmbedded && recipients.length > 0}
			<div class="mt-6">
				<h3 class="text-sm font-semibold text-gray-700 mb-2">Recipients ({recipients.length})</h3>
				<div class="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
					{#each recipients as recipient (recipient.id)}
						{@const isExcluded = excludedRecipientIds.has(recipient.id)}
						<div class="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 {isExcluded ? 'opacity-50' : ''}">
							<button
								onclick={() => toggleRecipient(recipient.id)}
								class="flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors"
								style="border-color: {isExcluded ? '#d1d5db' : courseColors.accentDark}; background-color: {isExcluded ? 'white' : courseColors.accentDark};"
							>
								{#if !isExcluded}
									<Check size={12} class="text-white" />
								{/if}
							</button>
							<div class="flex-1 min-w-0">
								<div class="text-sm font-medium text-gray-900 truncate {isExcluded ? 'line-through' : ''}">{recipient.full_name}</div>
								<div class="text-xs text-gray-500 truncate">{recipient.email}</div>
							</div>
							{#if recipient.courses_hubs?.name}
								<span class="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">{recipient.courses_hubs.name}</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

	{:else}
		<!-- Header -->
		<div class="flex items-center gap-3 mb-4">
			<button
				onclick={handleBack}
				class="p-1.5 rounded-lg transition-colors {isEmbedded ? 'hover:bg-gray-100 text-gray-500' : 'hover:bg-white/10 text-white/70 hover:text-white'}"
			>
				<ChevronLeft size={20} />
			</button>
			<h1 class="text-xl font-bold {isEmbedded ? 'text-gray-900' : 'text-white'}">
				{mode === 'quick' ? 'Quick Email' : 'Send with Template'}
			</h1>
		</div>

		<!-- Recipients Filter Bar (page mode only - loads via API) -->
		{#if !preselectedRecipients}
			<div class="bg-white rounded-xl mb-4 overflow-hidden">
				<div class="p-4">
					<div class="flex items-center gap-4 flex-wrap">
						<div class="flex items-center gap-2">
							<Users size={16} class="text-gray-500" />
							<span class="text-sm font-semibold text-gray-700">To:</span>
						</div>

						<div class="relative">
							<select
								value={selectedCohortId}
								onchange={handleCohortChange}
								class="email-select pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white appearance-none text-sm min-w-[180px]"
							>
								<option value="">Select cohort...</option>
								{#each cohorts as cohort}
									<option value={cohort.id}>{cohort.name} ({cohort.enrollment_count || 0})</option>
								{/each}
							</select>
							<ChevronDown size={14} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
						</div>

						{#if selectedCohortId}
							<div class="relative">
								<select
									value={additionalFilter}
									onchange={handleAdditionalFilterChange}
									class="email-select pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white appearance-none text-sm"
								>
									<option value="none">All participants</option>
									{#if filteredHubs.length > 0}
										<option value="hub">By Hub ({filteredHubs.length})</option>
									{/if}
									<option value="coordinators">Coordinators</option>
									<option value="session">By Session</option>
									<option value="pending_reflections">Pending Reflections</option>
									<option value="not_signed_up">Haven't signed up</option>
								</select>
								<ChevronDown size={14} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
							</div>

							{#if additionalFilter === 'hub' && filteredHubs.length > 0}
								<div class="relative">
									<select bind:value={selectedHubId} onchange={handleSubFilterChange} class="email-select pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white appearance-none text-sm">
										<option value="">Select hub...</option>
										{#each filteredHubs as hub}
											<option value={hub.id}>{hub.name} ({hub.enrollment_count})</option>
										{/each}
									</select>
									<ChevronDown size={14} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
								</div>
							{:else if additionalFilter === 'coordinators' && filteredHubs.length > 0}
								<div class="relative">
									<select bind:value={selectedHubId} onchange={handleSubFilterChange} class="email-select pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white appearance-none text-sm">
										<option value="">All hubs</option>
										{#each filteredHubs as hub}
											<option value={hub.id}>{hub.name} ({hub.enrollment_count})</option>
										{/each}
									</select>
									<ChevronDown size={14} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
								</div>
							{:else if additionalFilter === 'session'}
								<div class="relative">
									<select bind:value={selectedSessionNumber} onchange={handleSubFilterChange} class="email-select pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white appearance-none text-sm">
										<option value="">Session...</option>
										{#each Array(maxSession) as _, i}
											<option value={i + 1}>Session {i + 1}</option>
										{/each}
									</select>
									<ChevronDown size={14} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
								</div>
							{/if}
						{/if}

						<div class="ml-auto flex items-center gap-2">
							{#if loadingRecipients}
								<Loader2 size={14} class="animate-spin text-gray-400" />
							{:else if hasLoadedRecipients && recipients.length > 0}
								<button
									onclick={() => showRecipientsPanel = !showRecipientsPanel}
									class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors hover:bg-gray-100"
									style="color: var(--course-accent-dark);"
								>
									<span class="tabular-nums">
										{enabledRecipients.length}/{recipients.length}
									</span>
									<span>recipient{enabledRecipients.length !== 1 ? 's' : ''}</span>
									<ChevronDown size={14} class="transition-transform {showRecipientsPanel ? 'rotate-180' : ''}" />
								</button>
							{:else if hasLoadedRecipients}
								<span class="text-sm text-gray-500">No recipients match filters</span>
							{/if}
						</div>
					</div>
				</div>

				<!-- Expandable Recipients Panel (page mode) -->
				{#if showRecipientsPanel && recipients.length > 0}
					<div class="border-t border-gray-200 bg-gray-50">
						<!-- Panel Header -->
						<div class="px-4 py-2 flex items-center justify-between border-b border-gray-200 bg-gray-100">
							<div class="flex items-center gap-3">
								<span class="text-xs font-medium text-gray-600 uppercase tracking-wide">Recipients</span>
								{#if excludedRecipientIds.size > 0}
									<span class="text-xs text-orange-600 font-medium">
										({excludedRecipientIds.size} excluded)
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<button
									onclick={selectAllRecipients}
									disabled={excludedRecipientIds.size === 0}
									class="text-xs px-2 py-1 rounded font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-transparent"
								>
									Select All
								</button>
								<button
									onclick={deselectAllRecipients}
									disabled={excludedRecipientIds.size === recipients.length}
									class="text-xs px-2 py-1 rounded font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-40 disabled:hover:bg-transparent"
								>
									Deselect All
								</button>
							</div>
						</div>

						<!-- Recipients List -->
						<div class="max-h-48 overflow-y-auto">
							{#each recipients as recipient (recipient.id)}
								{@const isExcluded = excludedRecipientIds.has(recipient.id)}
								{@const isPreview = previewRecipientId === recipient.id}
								<div class="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-b-0 {isExcluded ? 'opacity-50' : ''}">
									<!-- Checkbox -->
									<button
										onclick={() => toggleRecipient(recipient.id)}
										class="flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors {isExcluded ? 'border-gray-300 bg-white' : 'border-green-500 bg-green-500'}"
									>
										{#if !isExcluded}
											<Check size={12} class="text-white" />
										{/if}
									</button>

									<!-- Name & Email -->
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium text-gray-900 truncate {isExcluded ? 'line-through' : ''}">
											{recipient.full_name}
										</div>
										<div class="text-xs text-gray-500 truncate">{recipient.email}</div>
									</div>

									<!-- Hub -->
									{#if recipient.courses_hubs?.name}
										<span class="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 flex-shrink-0">
											{recipient.courses_hubs.name}
										</span>
									{/if}

									<!-- Preview Eye Icon -->
									<button
										onclick={() => setPreviewRecipient(recipient.id)}
										disabled={isExcluded}
										class="flex-shrink-0 p-1.5 rounded-lg transition-colors {isPreview ? 'bg-blue-100 text-blue-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'} disabled:opacity-30 disabled:hover:bg-transparent"
										title={isPreview ? 'Previewing as this recipient' : 'Preview as this recipient'}
									>
										<Eye size={14} />
									</button>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Preselected Recipients Panel (embedded mode) -->
		{#if preselectedRecipients}
			<div class="bg-white rounded-xl mb-4 overflow-hidden">
				<details class="group">
					<summary class="px-4 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-50 transition-colors">
						<div class="flex items-center gap-2">
							<Users size={16} class="text-gray-500" />
							<span class="text-sm font-medium text-gray-700">
								Recipients: {enabledRecipients.length}/{recipients.length}
								{#if excludedRecipientIds.size > 0}
									<span class="text-orange-600">({excludedRecipientIds.size} excluded)</span>
								{/if}
							</span>
						</div>
						<ChevronDown size={16} class="text-gray-400 transition-transform group-open:rotate-180" />
					</summary>
					<div class="max-h-40 overflow-y-auto border-t border-gray-200">
						{#each recipients as recipient (recipient.id)}
							{@const isExcluded = excludedRecipientIds.has(recipient.id)}
							{@const isPreview = previewRecipientId === recipient.id}
							<div class="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-0 {isExcluded ? 'opacity-50' : ''}">
								<button
									onclick={() => toggleRecipient(recipient.id)}
									class="flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors"
									style="border-color: {isExcluded ? '#d1d5db' : courseColors.accentDark}; background-color: {isExcluded ? 'white' : courseColors.accentDark};"
								>
									{#if !isExcluded}
										<Check size={12} class="text-white" />
									{/if}
								</button>
								<div class="flex-1 min-w-0">
									<span class="text-sm text-gray-900 {isExcluded ? 'line-through' : ''}">{recipient.full_name}</span>
								</div>
								<button
									onclick={() => setPreviewRecipient(recipient.id)}
									disabled={isExcluded}
									class="p-1 rounded transition-colors disabled:opacity-30"
									class:bg-blue-100={isPreview}
									class:text-blue-600={isPreview}
									class:text-gray-400={!isPreview}
									class:hover:bg-gray-200={!isPreview && !isExcluded}
									title="Preview as this recipient"
								>
									<Eye size={14} />
								</button>
							</div>
						{/each}
					</div>
				</details>
			</div>
		{/if}

		<!-- Template Selector (only in template mode, not editing) -->
		{#if mode === 'template' && !isEditing}
			<div class="bg-white rounded-xl p-4 mb-4">
				<div class="flex items-center gap-3">
					<span class="text-sm font-semibold text-gray-700">Template:</span>
					{#if loadingTemplates}
						<div class="flex items-center gap-2 text-sm text-gray-500">
							<Loader2 size={14} class="animate-spin" />
							Loading templates...
						</div>
					{:else}
						<div class="relative flex-1 max-w-xs">
							<select
								bind:value={selectedTemplateId}
								class="email-select w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white appearance-none text-sm"
							>
								<option value="">Select a template...</option>
								{#each allTemplates as template}
									<option value={template.id}>{template.name}{template.category === 'system' ? ' (System)' : ''}</option>
								{/each}
							</select>
							<ChevronDown size={14} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
						</div>
						{#if selectedTemplate}
							<button onclick={startEditing} class="edit-btn px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-1.5 border">
								<Pencil size={14} />
								Edit
							</button>
						{/if}
					{/if}
				</div>
			</div>
		{/if}

		<!-- Subject Line -->
		<div class="bg-white rounded-t-xl border-b border-gray-200 p-4">
			<div class="flex items-center gap-3">
				<span class="text-sm font-semibold text-gray-700 w-16">Subject:</span>
				{#if isEditing}
					{#if mode === 'quick'}
						<SubjectInputWithVariables
							bind:value={quickSubject}
							placeholder="Enter subject..."
							{availableVariables}
							class="flex-1"
						/>
					{:else}
						<SubjectInputWithVariables
							bind:value={editedSubject}
							placeholder="Enter subject..."
							{availableVariables}
							class="flex-1"
						/>
					{/if}
				{:else}
					<span class="flex-1 text-sm text-gray-900">
						{previewRecipient ? substituteVariables(selectedTemplate?.subject_template || '', previewRecipient) : (selectedTemplate?.subject_template || 'Select a template...')}
					</span>
				{/if}
			</div>
		</div>

		<!-- Email Body Area -->
		{#if isEditing}
			<!-- Edit Mode: Full EmailBodyEditor with sidebar toolbar -->
			<div class="bg-white rounded-b-xl">
				<EmailBodyEditor
					value={mode === 'quick' ? quickBody : editedBody}
					onchange={handleBodyChange}
					placeholder="Write your email message..."
					courseName={course?.name}
					logoUrl={course?.logo_url}
					accentDark={courseColors.accentDark}
					{availableVariables}
					context="course"
					contextId={course?.id}
				/>
			</div>
		{:else}
			<!-- Preview Mode: Show substituted values -->
			{#if previewRecipient}
				<div class="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
					<Eye size={14} class="text-blue-500" />
					<span class="text-sm text-blue-700">
						Previewing as <span class="font-semibold">{previewRecipient.full_name}</span>
					</span>
					<span class="text-xs text-blue-500">({previewRecipient.email})</span>
				</div>
			{/if}
			<EmailPreviewFrame
				courseName={course?.name}
				logoUrl={course?.logo_url}
				accentDark={courseColors.accentDark}
			>
				<div class="p-6 prose prose-sm max-w-none min-h-[200px]">
					{#if selectedTemplate?.body_template && previewRecipient}
						{@html substituteVariables(selectedTemplate.body_template, previewRecipient).replace(/\n/g, '<br>')}
					{:else if selectedTemplate?.body_template}
						{@html selectedTemplate.body_template.replace(/\n/g, '<br>')}
					{:else}
						<p class="text-gray-400 italic">Select a template to preview content...</p>
					{/if}
				</div>
			</EmailPreviewFrame>
		{/if}

		<!-- Actions Bar -->
		<div class="bg-white rounded-b-xl p-4 mt-0 border-t border-gray-200">
			<div class="flex items-center justify-between">
				<!-- Left: Edit actions or Test email -->
				<div class="flex items-center gap-2">
					{#if isEditing && mode === 'template'}
						<button onclick={cancelEditing} class="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
							Cancel
						</button>
						<button onclick={saveToTemplate} disabled={sending} class="save-btn px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-1.5 text-white disabled:opacity-50">
							<Save size={14} />
							Save Template
						</button>
					{:else}
						<!-- Test Email -->
						<button onclick={() => showTestEmailPanel = true} disabled={!getCurrentSubject() || !getCurrentBody()} class="test-btn px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2 border disabled:opacity-50">
							<TestTube size={14} />
							Send Test
						</button>
					{/if}
				</div>

				<!-- Right: Send Button (with optional Cancel for embedded) -->
				<div class="flex items-center gap-3">
					{#if isEmbedded && onClose}
						<button
							onclick={onClose}
							disabled={sending}
							class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
						>
							Cancel
						</button>
					{/if}
					<button
						onclick={handleSend}
						disabled={sending || enabledRecipients.length === 0 || !getCurrentSubject() || !getCurrentBody()}
						class="send-btn px-5 py-2.5 text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50"
					>
						{#if sending}
							<Loader2 size={16} class="animate-spin" />
							Sending...
						{:else}
							<Send size={16} />
							Send to {enabledRecipients.length} recipient{enabledRecipients.length !== 1 ? 's' : ''}
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<!-- Test Email Panel -->
{#if showTestEmailPanel}
	<TestEmailPanel
		context="course"
		contextId={courseSlug}
		contextData={{ course, cohorts }}
		template={{
			subject_template: getCurrentSubject(),
			body_template: getCurrentBody()
		}}
		branding={{
			name: course?.name || 'Course',
			logoUrl: course?.logo_url,
			accentDark: courseColors.accentDark,
			footerText: "You're receiving this because you're enrolled in this course."
		}}
		{currentUserEmail}
		testApiUrl="/api/emails/test"
		onClose={() => showTestEmailPanel = false}
	/>
{/if}

<!-- Send Confirmation Modal -->
<ConfirmationModal
	show={showSendConfirm}
	onConfirm={confirmSend}
	onCancel={() => showSendConfirm = false}
	confirmText="Send {enabledRecipients.length} Email{enabledRecipients.length !== 1 ? 's' : ''}"
	confirmClass="bg-green-600 hover:bg-green-700 text-white"
>
	<div class="flex items-start gap-3">
		<div class="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
			<AlertTriangle class="w-5 h-5 text-amber-400" />
		</div>
		<div class="flex-1">
			<h3 class="text-lg font-semibold text-white mb-2">Confirm Send</h3>
			<p class="text-white/70 mb-4">
				You're about to send an email to <strong class="text-white">{enabledRecipients.length} recipient{enabledRecipients.length !== 1 ? 's' : ''}</strong>.
			</p>

			<div class="bg-white/10 rounded-lg p-3 mb-3">
				<div class="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Subject</div>
				<div class="text-sm text-white font-medium">{getCurrentSubject()}</div>
			</div>

			<div class="text-xs text-white/50">
				<span class="font-medium text-white/70">Recipients:</span>
				{enabledRecipients.slice(0, 3).map(r => r.full_name).join(', ')}{enabledRecipients.length > 3 ? ` and ${enabledRecipients.length - 3} more...` : ''}
			</div>
		</div>
	</div>
</ConfirmationModal>

<style>
	/* Style email buttons in preview to match how they'll look when sent */
	:global(.prose [data-type="email-button"]) {
		display: block;
		text-align: center;
		margin: 1.5rem 0;
	}

	:global(.prose [data-type="email-button"] a),
	:global(.prose .email-button) {
		display: inline-block;
		padding: 12px 32px;
		background-color: var(--course-accent-dark, #334642);
		color: white !important;
		text-decoration: none;
		border-radius: 6px;
		font-size: 16px;
		font-weight: 600;
	}

	.email-select:focus {
		--tw-ring-color: var(--course-accent-light);
		border-color: var(--course-accent-light);
	}

	.edit-btn {
		color: var(--course-accent-dark);
		border-color: var(--course-accent-light);
	}
	.edit-btn:hover {
		background-color: color-mix(in srgb, var(--course-accent-light) 15%, white);
	}

	.save-btn {
		background-color: var(--course-accent-dark);
	}
	.save-btn:hover:not(:disabled) {
		background-color: var(--course-accent-darkest);
	}

	.test-btn {
		color: var(--course-accent-dark);
		border-color: var(--course-accent-light);
	}
	.test-btn:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--course-accent-light) 15%, white);
	}

	.send-btn {
		background-color: var(--course-accent-light);
		color: var(--course-accent-darkest);
	}
	.send-btn:hover:not(:disabled) {
		background-color: var(--course-accent-dark);
		color: white;
	}
</style>

<script>
	import { X, Mail, Send, Loader2, TestTube, Pencil, FileText, ChevronDown, Eye, Check, ChevronLeft, AlertTriangle } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { apiGet, apiPost, apiPut } from '$lib/utils/api-handler.js';
	import EmailBodyEditor from './EmailBodyEditor.svelte';
	import EmailPreviewFrame from './EmailPreviewFrame.svelte';
	import TestEmailPanel from './TestEmailPanel.svelte';
	import ConfirmationModal from './ConfirmationModal.svelte';
	import SubjectInputWithVariables from './SubjectInputWithVariables.svelte';

	let {
		show = false,
		courseSlug = '',
		course = null,
		recipients = [],
		cohortId = null,
		currentUserEmail = '',
		initialTemplateSlug = '',
		onClose = () => {},
		onSent = () => {}
	} = $props();

	// Mode: 'choose' | 'quick' | 'template'
	let mode = $state('choose');

	// Templates
	let templates = $state([]);
	let loadingTemplates = $state(false);
	let selectedTemplateId = $state('');
	let isEditingTemplate = $state(false);
	let editedSubject = $state('');
	let editedBody = $state('');

	// Quick email state
	let quickSubject = $state('');
	let quickBody = $state('');

	// Recipients state
	let excludedIds = $state(new Set());
	let previewRecipientId = $state(null);

	// Sending state
	let sending = $state(false);
	let showTestEmailPanel = $state(false);
	let showSendConfirm = $state(false);

	// Derived
	const selectedTemplate = $derived(templates.find(t => t.id === selectedTemplateId));
	const enabledRecipients = $derived(recipients.filter(r => !excludedIds.has(r.id)));
	const previewRecipient = $derived(
		previewRecipientId
			? recipients.find(r => r.id === previewRecipientId)
			: enabledRecipients[0] || recipients[0]
	);

	const courseColors = $derived({
		accentDark: course?.accent_dark || '#334642',
		accentLight: course?.accent_light || '#eae2d9',
		accentDarkest: course?.accent_darkest || '#1e2322'
	});

	const availableVariables = [
		{ name: 'firstName', description: 'Student first name' },
		{ name: 'lastName', description: 'Student last name' },
		{ name: 'fullName', description: 'Student full name' },
		{ name: 'email', description: 'Student email' },
		{ name: 'hubName', description: 'Hub name' },
		{ name: 'courseName', description: 'Course name' },
		{ name: 'cohortName', description: 'Cohort name' },
		{ name: 'sessionNumber', description: 'Session number' },
		{ name: 'currentSession', description: 'Current session' },
		{ name: 'loginLink', description: 'Login link' },
		{ name: 'dashboardLink', description: 'Dashboard link' },
		{ name: 'materialsLink', description: 'Materials link' },
		{ name: 'reflectionLink', description: 'Reflections link' },
		{ name: 'supportEmail', description: 'Support email' }
	];

	// Load templates when modal opens
	$effect(() => {
		if (show && templates.length === 0) {
			loadTemplates();
		}
		if (show) {
			// Reset state when opening
			mode = initialTemplateSlug ? 'template' : 'choose';
			selectedTemplateId = '';
			excludedIds = new Set();
			previewRecipientId = recipients[0]?.id || null;
			isEditingTemplate = false;
		}
	});

	// Auto-select template when initialTemplateSlug is set and templates are loaded
	$effect(() => {
		if (show && initialTemplateSlug && templates.length > 0 && !selectedTemplateId) {
			const template = templates.find(t => t.template_key === initialTemplateSlug);
			if (template) {
				selectedTemplateId = template.id;
				mode = 'template';
			}
		}
	});

	async function loadTemplates() {
		loadingTemplates = true;
		try {
			const result = await apiGet(`/api/courses/${courseSlug}/emails`, { showToast: false });
			if (result?.templates) {
				templates = [...(result.templates.system || []), ...(result.templates.custom || [])];
			}
		} catch (err) {
			console.error('Failed to load templates:', err);
		} finally {
			loadingTemplates = false;
		}
	}

	function substituteVariables(template, recipient) {
		if (!template || !recipient) return template || '';

		// Get cohort data - could be nested as courses_cohorts or cohort
		const cohortData = recipient.courses_cohorts || recipient.cohort || {};
		const startDateRaw = cohortData.start_date;
		const startDate = startDateRaw ? new Date(startDateRaw).toLocaleDateString('en-AU', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		}) : '';

		const variables = {
			firstName: recipient.full_name?.split(' ')[0] || '',
			lastName: recipient.full_name?.split(' ').slice(1).join(' ') || '',
			fullName: recipient.full_name || '',
			email: recipient.email || '',
			courseName: course?.name || '',
			courseSlug: courseSlug || '',
			cohortName: cohortData.name || '',
			sessionNumber: recipient.current_session || 0,
			currentSession: cohortData.current_session || 0,
			startDate: startDate,
			loginLink: `${typeof window !== 'undefined' ? window.location.origin : ''}/login`,
			dashboardLink: `${typeof window !== 'undefined' ? window.location.origin : ''}/courses/${courseSlug}/dashboard`,
			materialsLink: `${typeof window !== 'undefined' ? window.location.origin : ''}/courses/${courseSlug}/materials`,
			reflectionLink: `${typeof window !== 'undefined' ? window.location.origin : ''}/courses/${courseSlug}/reflections`,
			supportEmail: course?.email_branding_config?.reply_to_email || 'accf@archdiocesanministries.org.au',
			hubName: recipient.courses_hubs?.name || recipient.hub?.name || ''
		};

		let result = template;
		for (const [key, value] of Object.entries(variables)) {
			result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
		}
		return result;
	}

	function getCurrentSubject() {
		if (mode === 'quick') return quickSubject;
		if (isEditingTemplate) return editedSubject;
		return selectedTemplate?.subject_template || '';
	}

	function getCurrentBody() {
		if (mode === 'quick') return quickBody;
		if (isEditingTemplate) return editedBody;
		return selectedTemplate?.body_template || '';
	}

	function handleModeSelect(newMode) {
		mode = newMode;
		if (newMode === 'template' && templates.length > 0 && !selectedTemplateId) {
			selectedTemplateId = templates[0].id;
		}
	}

	function handleBack() {
		mode = 'choose';
		isEditingTemplate = false;
	}

	function startEditingTemplate() {
		editedSubject = selectedTemplate?.subject_template || '';
		editedBody = selectedTemplate?.body_template || '';
		isEditingTemplate = true;
	}

	function cancelEditingTemplate() {
		isEditingTemplate = false;
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
			const idx = templates.findIndex(t => t.id === selectedTemplate.id);
			if (idx >= 0) {
				templates[idx] = { ...templates[idx], subject_template: editedSubject, body_template: editedBody };
				templates = [...templates];
			}
			isEditingTemplate = false;
		} catch (err) {
			// Handled by apiPut
		} finally {
			sending = false;
		}
	}

	function toggleRecipient(id) {
		const newExcluded = new Set(excludedIds);
		if (newExcluded.has(id)) {
			newExcluded.delete(id);
		} else {
			newExcluded.add(id);
			if (previewRecipientId === id) {
				const stillEnabled = recipients.find(r => !newExcluded.has(r.id));
				previewRecipientId = stillEnabled?.id || null;
			}
		}
		excludedIds = newExcluded;
	}

	function setPreviewRecipient(id) {
		previewRecipientId = id;
	}

	function handleBodyChange(html) {
		if (mode === 'quick') {
			quickBody = html;
		} else {
			editedBody = html;
		}
	}

	function handleSend() {
		if (enabledRecipients.length === 0) {
			toastError('No recipients selected');
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

			if (mode === 'quick' || isEditingTemplate) {
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
				onSent();
				onClose();
			} else {
				toastError(`Failed: ${result.errors?.[0]?.error || 'Unknown error'}`);
			}
		} catch (err) {
			// Handled by apiPost
		} finally {
			sending = false;
		}
	}

	function handleClose() {
		if (!sending) {
			onClose();
		}
	}

	// Check if we're in editing mode (quick email or editing a template)
	const isEditing = $derived(mode === 'quick' || isEditingTemplate);
</script>

{#if show}
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b" style="border-color: {courseColors.accentLight};">
				<div class="flex items-center gap-3">
					{#if mode !== 'choose'}
						<button
							onclick={handleBack}
							class="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-500"
						>
							<ChevronLeft size={20} />
						</button>
					{/if}
					<div class="p-2 rounded-lg" style="background-color: color-mix(in srgb, {courseColors.accentLight} 30%, white);">
						<Mail size={20} style="color: {courseColors.accentDark};" />
					</div>
					<div>
						<h2 class="text-lg font-bold" style="color: {courseColors.accentDarkest};">
							{#if mode === 'choose'}
								Send Email
							{:else if mode === 'quick'}
								Quick Email
							{:else}
								Use Template
							{/if}
						</h2>
						<p class="text-sm text-gray-600">
							{enabledRecipients.length} of {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
						</p>
					</div>
				</div>
				<button
					onclick={handleClose}
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors"
					disabled={sending}
				>
					<X size={20} class="text-gray-500" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto">
				{#if mode === 'choose'}
					<!-- Mode Selection -->
					<div class="p-6">
						<p class="text-sm text-gray-600 mb-4">Choose how to compose your email:</p>
						<div class="grid grid-cols-2 gap-4">
							<button
								onclick={() => handleModeSelect('quick')}
								class="bg-gray-50 hover:bg-gray-100 rounded-xl p-5 text-left transition-all border-2 border-transparent hover:border-gray-200"
							>
								<div class="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style="background-color: color-mix(in srgb, {courseColors.accentLight} 30%, white);">
									<Pencil size={20} style="color: {courseColors.accentDark};" />
								</div>
								<h3 class="text-base font-bold text-gray-900 mb-1">Quick Email</h3>
								<p class="text-sm text-gray-600">Write a one-off message.</p>
							</button>

							<button
								onclick={() => handleModeSelect('template')}
								class="bg-gray-50 hover:bg-gray-100 rounded-xl p-5 text-left transition-all border-2 border-transparent hover:border-gray-200"
							>
								<div class="w-10 h-10 rounded-lg flex items-center justify-center mb-3" style="background-color: color-mix(in srgb, {courseColors.accentLight} 30%, white);">
									<FileText size={20} style="color: {courseColors.accentDark};" />
								</div>
								<h3 class="text-base font-bold text-gray-900 mb-1">Use Template</h3>
								<p class="text-sm text-gray-600">Select a saved template.</p>
							</button>
						</div>

						<!-- Recipients Preview -->
						<div class="mt-6">
							<h3 class="text-sm font-semibold text-gray-700 mb-2">Recipients ({recipients.length})</h3>
							<div class="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
								{#each recipients as recipient (recipient.id)}
									{@const isExcluded = excludedIds.has(recipient.id)}
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
					</div>

				{:else}
					<!-- Email Composer -->
					<div class="flex flex-col h-full">
						<!-- Template selector (template mode only, not editing) -->
						{#if mode === 'template' && !isEditingTemplate}
							<div class="px-6 pt-4 pb-2">
								<div class="flex items-center gap-3">
									<span class="text-sm font-semibold text-gray-700">Template:</span>
									<div class="relative flex-1 max-w-xs">
										<select
											bind:value={selectedTemplateId}
											class="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white appearance-none text-sm focus:ring-2 focus:border-transparent"
											style="--tw-ring-color: {courseColors.accentLight};"
										>
											<option value="">Select...</option>
											{#each templates as template}
												<option value={template.id}>{template.name}{template.category === 'system' ? ' (System)' : ''}</option>
											{/each}
										</select>
										<ChevronDown size={14} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
									</div>
									{#if selectedTemplate}
										<button
											onclick={startEditingTemplate}
											class="px-3 py-2 rounded-lg font-medium text-sm flex items-center gap-1.5 border transition-colors hover:bg-gray-50"
											style="color: {courseColors.accentDark}; border-color: {courseColors.accentLight};"
										>
											<Pencil size={14} />
											Edit
										</button>
									{/if}
								</div>
							</div>
						{/if}

						<!-- Subject -->
						<div class="px-6 py-3 border-b border-gray-200">
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

						<!-- Preview indicator -->
						{#if !isEditing && previewRecipient}
							<div class="px-6 py-2 flex items-center gap-2" style="background-color: color-mix(in srgb, {courseColors.accentLight} 20%, white);">
								<Eye size={14} style="color: {courseColors.accentDark};" />
								<span class="text-sm" style="color: {courseColors.accentDark};">
									Previewing as <span class="font-semibold">{previewRecipient.full_name}</span>
								</span>
							</div>
						{/if}

						<!-- Body -->
						<div class="flex-1 min-h-0">
							{#if isEditing}
								<EmailBodyEditor
									value={mode === 'quick' ? quickBody : editedBody}
									onchange={handleBodyChange}
									placeholder="Write your email..."
									courseName={course?.name}
									logoUrl={course?.logo_url}
									accentDark={courseColors.accentDark}
									{availableVariables}
									context="course"
									contextId={course?.id}
								/>
							{:else}
								<EmailPreviewFrame
									courseName={course?.name}
									logoUrl={course?.logo_url}
									accentDark={courseColors.accentDark}
								>
									<div class="p-6 prose prose-sm max-w-none min-h-[200px] email-preview-content">
										{#if selectedTemplate?.body_template && previewRecipient}
											{@html substituteVariables(selectedTemplate.body_template, previewRecipient).replace(/\n/g, '<br>')}
										{:else if selectedTemplate?.body_template}
											{@html selectedTemplate.body_template.replace(/\n/g, '<br>')}
										{:else}
											<p class="text-gray-400 italic">Select a template to preview...</p>
										{/if}
									</div>
								</EmailPreviewFrame>
							{/if}
						</div>

						<!-- Recipients sidebar (collapsible) -->
						<div class="border-t border-gray-200 bg-gray-50">
							<details class="group">
								<summary class="px-6 py-3 cursor-pointer flex items-center justify-between hover:bg-gray-100 transition-colors">
									<span class="text-sm font-medium text-gray-700">
										Recipients: {enabledRecipients.length}/{recipients.length}
										{#if excludedIds.size > 0}
											<span class="text-orange-600">({excludedIds.size} excluded)</span>
										{/if}
									</span>
									<ChevronDown size={16} class="text-gray-400 transition-transform group-open:rotate-180" />
								</summary>
								<div class="max-h-40 overflow-y-auto border-t border-gray-200">
									{#each recipients as recipient (recipient.id)}
										{@const isExcluded = excludedIds.has(recipient.id)}
										{@const isPreview = previewRecipientId === recipient.id}
										<div class="flex items-center gap-3 px-6 py-2 hover:bg-gray-100 border-b border-gray-100 last:border-0 {isExcluded ? 'opacity-50' : ''}">
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
					</div>
				{/if}
			</div>

			<!-- Footer -->
			{#if mode !== 'choose'}
				<div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
					<div class="flex items-center justify-between">
						<!-- Left: Test email or save template -->
						<div class="flex items-center gap-2">
							{#if isEditingTemplate && mode === 'template'}
								<button onclick={cancelEditingTemplate} class="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg">
									Cancel Edit
								</button>
								<button
									onclick={saveToTemplate}
									disabled={sending}
									class="px-3 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50"
									style="background-color: {courseColors.accentDark};"
								>
									Save Template
								</button>
							{:else}
								<button
									onclick={() => showTestEmailPanel = true}
									disabled={!getCurrentSubject() || !getCurrentBody()}
									class="px-3 py-2 text-sm font-medium rounded-lg flex items-center gap-2 border disabled:opacity-50"
									style="color: {courseColors.accentDark}; border-color: {courseColors.accentLight};"
								>
									<TestTube size={14} />
									Send Test
								</button>
							{/if}
						</div>

						<!-- Right: Send -->
						<div class="flex items-center gap-3">
							<button
								onclick={handleClose}
								disabled={sending}
								class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
							>
								Cancel
							</button>
							<button
								onclick={handleSend}
								disabled={sending || enabledRecipients.length === 0 || !getCurrentSubject() || !getCurrentBody()}
								class="px-5 py-2 text-sm font-semibold rounded-lg flex items-center gap-2 disabled:opacity-50 transition-colors"
								style="background-color: {courseColors.accentLight}; color: {courseColors.accentDarkest};"
								onmouseenter={(e) => { if (!e.target.disabled) { e.target.style.backgroundColor = courseColors.accentDark; e.target.style.color = 'white'; }}}
								onmouseleave={(e) => { e.target.style.backgroundColor = courseColors.accentLight; e.target.style.color = courseColors.accentDarkest; }}
							>
								{#if sending}
									<Loader2 size={16} class="animate-spin" />
									Sending...
								{:else}
									<Send size={16} />
									Send to {enabledRecipients.length}
								{/if}
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- Test Email Panel -->
{#if showTestEmailPanel}
	<TestEmailPanel
		context="course"
		contextId={courseSlug}
		contextData={{ course, cohorts: [] }}
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
		<div class="flex-shrink-0 w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
			<AlertTriangle class="w-5 h-5 text-amber-600" />
		</div>
		<div class="flex-1">
			<h3 class="text-lg font-semibold text-white mb-2">Confirm Send</h3>
			<p class="text-white/80 mb-4">
				You're about to send an email to <strong class="text-white">{enabledRecipients.length} recipient{enabledRecipients.length !== 1 ? 's' : ''}</strong>.
			</p>

			<div class="bg-white/10 rounded-lg p-3 mb-3">
				<div class="text-xs font-medium text-white/50 uppercase tracking-wide mb-1">Subject</div>
				<div class="text-sm text-white font-medium">{substituteVariables(getCurrentSubject(), enabledRecipients[0])}</div>
			</div>

			<div class="text-xs text-white/50">
				<span class="font-medium">Recipients:</span>
				{enabledRecipients.slice(0, 3).map(r => r.full_name).join(', ')}{enabledRecipients.length > 3 ? ` and ${enabledRecipients.length - 3} more...` : ''}
			</div>
		</div>
	</div>
</ConfirmationModal>

<style>
	/* Style email buttons in preview to match how they'll look when sent */
	:global(.email-preview-content [data-type="email-button"]) {
		display: block;
		text-align: center;
		margin: 1.5rem 0;
	}

	:global(.email-preview-content [data-type="email-button"] a),
	:global(.email-preview-content .email-button) {
		display: inline-block;
		padding: 12px 32px;
		background-color: var(--course-accent-dark, #334642);
		color: white !important;
		text-decoration: none;
		border-radius: 6px;
		font-size: 16px;
		font-weight: 600;
	}
</style>

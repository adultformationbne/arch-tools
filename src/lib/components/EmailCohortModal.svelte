<script>
	import { X, Mail, Users, Send, Eye, ChevronDown, Loader2, TestTube } from 'lucide-svelte';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { apiGet, apiPost } from '$lib/utils/api-handler.js';

	let {
		show = false,
		courseSlug = '',
		courseName = '',
		cohort = null,
		recipients = [],
		onClose = () => {},
		onSent = () => {}
	} = $props();

	// All state - no derived to avoid loops
	let templates = $state([]);
	let selectedTemplateId = $state('');
	let loadingTemplates = $state(false);
	let hasLoadedTemplates = false; // Not reactive - just a flag
	let sending = $state(false);
	let sendingTest = $state(false);
	let testEmail = $state('');
	let previewRecipientIndex = $state(0);
	let showTestEmailInput = $state(false);

	// Compute these as getters, not derived
	function getSelectedTemplate() {
		return templates.find(t => t.id === selectedTemplateId);
	}

	function getPreviewRecipient() {
		return recipients[previewRecipientIndex] || recipients[0];
	}

	function getPreviewSubject() {
		const template = getSelectedTemplate();
		const recipient = getPreviewRecipient();
		if (!template || !recipient) return '';
		return substituteVariables(template.subject_template, recipient);
	}

	function getPreviewBody() {
		const template = getSelectedTemplate();
		const recipient = getPreviewRecipient();
		if (!template || !recipient) return '';
		return substituteVariables(template.body_template, recipient);
	}

	// Expose open function for parent to call
	export function open() {
		if (!hasLoadedTemplates && courseSlug) {
			hasLoadedTemplates = true;
			loadTemplates();
		}
	}

	async function loadTemplates() {
		loadingTemplates = true;
		try {
			const result = await apiGet(`/api/courses/${courseSlug}/emails`, { showToast: false });
			if (result?.templates) {
				templates = [...(result.templates.system || []), ...(result.templates.custom || [])];
				if (!selectedTemplateId && templates.length > 0) {
					selectedTemplateId = templates[0].id;
				}
			}
		} catch (err) {
			console.error('Failed to load templates:', err);
			toastError('Failed to load email templates');
		} finally {
			loadingTemplates = false;
		}
	}

	function substituteVariables(template, recipient) {
		if (!template || !recipient) return template;

		const variables = {
			firstName: recipient.full_name?.split(' ')[0] || '',
			lastName: recipient.full_name?.split(' ').slice(1).join(' ') || '',
			fullName: recipient.full_name || '',
			email: recipient.email || '',
			courseName: courseName || '',
			courseSlug: courseSlug || '',
			cohortName: cohort?.name || '',
			sessionNumber: recipient.current_session || cohort?.current_session || 0,
			currentSession: cohort?.current_session || 0,
			startDate: cohort?.start_date ? new Date(cohort.start_date).toLocaleDateString() : '',
			loginLink: `${typeof window !== 'undefined' ? window.location.origin : ''}/courses/${courseSlug}`,
			dashboardLink: `${typeof window !== 'undefined' ? window.location.origin : ''}/courses/${courseSlug}/dashboard`,
			materialsLink: `${typeof window !== 'undefined' ? window.location.origin : ''}/courses/${courseSlug}/materials`,
			reflectionLink: `${typeof window !== 'undefined' ? window.location.origin : ''}/courses/${courseSlug}/reflections`,
			supportEmail: 'support@archdiocesanministries.org.au',
			hubName: recipient.courses_hubs?.name || ''
		};

		let result = template;
		for (const [key, value] of Object.entries(variables)) {
			result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
		}
		return result;
	}

	async function handleSendTest() {
		const template = getSelectedTemplate();
		if (!testEmail || !template) {
			toastError('Please enter a test email address and select a template');
			return;
		}

		sendingTest = true;
		try {
			await apiPost(`/api/courses/${courseSlug}/emails/test`, {
				to: testEmail,
				subject: template.subject_template,
				body: template.body_template,
				course_name: courseName
			}, { successMessage: 'Test email sent!' });
			showTestEmailInput = false;
		} catch (err) {
			// Error already handled by apiPost
		} finally {
			sendingTest = false;
		}
	}

	async function handleSend() {
		const template = getSelectedTemplate();
		if (!template || recipients.length === 0) {
			toastError('Please select a template and ensure there are recipients');
			return;
		}

		sending = true;
		try {
			const result = await apiPost(`/api/courses/${courseSlug}/send-email`, {
				recipients: recipients.map(r => r.id),
				template_id: template.id,
				email_type: template.template_key || 'custom',
				cohort_id: cohort?.id
			});

			if (result.success || result.sent > 0) {
				toastSuccess(`Sent ${result.sent} emails${result.failed > 0 ? ` (${result.failed} failed)` : ''}`);
				onSent();
				onClose();
			} else {
				toastError(`Failed to send emails: ${result.errors?.[0]?.error || 'Unknown error'}`);
			}
		} catch (err) {
			// Error already handled by apiPost
		} finally {
			sending = false;
		}
	}

	function handleClose() {
		if (!sending) {
			onClose();
		}
	}
</script>

{#if show}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
		onclick={handleClose}
		onkeydown={(e) => e.key === 'Escape' && handleClose()}
		role="dialog"
		aria-modal="true"
	>
		<!-- Modal -->
		<div
			class="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
			onclick={(e) => e.stopPropagation()}
		>
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b" style="border-color: var(--course-accent-light, #c59a6b);">
				<div class="flex items-center gap-3">
					<div class="p-2 rounded-lg" style="background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 20%, white);">
						<Mail size={20} style="color: var(--course-accent-dark, #334642);" />
					</div>
					<div>
						<h2 class="text-lg font-bold" style="color: var(--course-accent-darkest, #1e2322);">Email Cohort</h2>
						<p class="text-sm" style="color: var(--course-accent-dark, #334642);">{cohort?.name || 'All recipients'}</p>
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
			<div class="flex-1 overflow-y-auto p-6">
				<div class="grid grid-cols-2 gap-6">
					<!-- Left Column: Settings & Recipients -->
					<div class="space-y-6">
						<!-- Template Selector -->
						<div>
							<label class="block text-sm font-semibold text-gray-700 mb-2">
								Email Template
							</label>
							{#if loadingTemplates}
								<div class="flex items-center gap-2 text-gray-500">
									<Loader2 size={16} class="animate-spin" />
									<span class="text-sm">Loading templates...</span>
								</div>
							{:else}
								<div class="relative">
									<select
										bind:value={selectedTemplateId}
										class="email-select w-full px-4 py-2.5 border border-gray-300 rounded-lg appearance-none bg-white pr-10 focus:ring-2 focus:border-transparent"
									>
										<option value="">Select a template...</option>
										{#each templates as template}
											<option value={template.id}>
												{template.name}
												{template.category === 'system' ? ' (System)' : ''}
											</option>
										{/each}
									</select>
									<ChevronDown size={16} class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
								</div>
							{/if}
						</div>

						<!-- Recipients List -->
						<div>
							<div class="flex items-center justify-between mb-2">
								<label class="text-sm font-semibold text-gray-700 flex items-center gap-2">
									<Users size={16} />
									Recipients ({recipients.length})
								</label>
							</div>
							<div class="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
								{#if recipients.length === 0}
									<div class="p-4 text-center text-gray-500 text-sm">
										No recipients selected
									</div>
								{:else}
									{#each recipients as recipient, index}
										<button
											onclick={() => previewRecipientIndex = index}
											class="recipient-row w-full px-4 py-2.5 text-left border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors flex items-center justify-between {previewRecipientIndex === index ? 'selected' : ''}"
										>
											<div>
												<div class="font-medium text-gray-900 text-sm">{recipient.full_name}</div>
												<div class="text-xs text-gray-500">{recipient.email}</div>
											</div>
											{#if previewRecipientIndex === index}
												<Eye size={14} style="color: var(--course-accent-dark, #334642);" />
											{/if}
										</button>
									{/each}
								{/if}
							</div>
							<p class="text-xs text-gray-500 mt-2">
								Click a recipient to preview their personalized email
							</p>
						</div>
					</div>

					<!-- Right Column: Email Preview -->
					<div>
						<label class="block text-sm font-semibold text-gray-700 mb-2">
							Email Preview
							{#if getPreviewRecipient()}
								<span class="font-normal text-gray-500">
									— for {getPreviewRecipient().full_name}
								</span>
							{/if}
						</label>

						{#if getSelectedTemplate() && getPreviewRecipient()}
							<div class="border border-gray-200 rounded-lg overflow-hidden">
								<!-- Email Header Simulation -->
								<div class="bg-gray-100 px-4 py-3 border-b border-gray-200">
									<div class="text-xs text-gray-500 mb-1">Subject:</div>
									<div class="font-medium text-gray-900">{getPreviewSubject()}</div>
								</div>

								<!-- Email Body -->
								<div class="p-4 bg-white max-h-80 overflow-y-auto">
									<div class="prose prose-sm max-w-none">
										{@html getPreviewBody().replace(/\n/g, '<br>')}
									</div>
								</div>
							</div>
						{:else}
							<div class="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
								<Mail size={32} class="mx-auto mb-2 text-gray-300" />
								<p class="text-sm">Select a template to preview the email</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
				<div class="flex items-center justify-between">
					<!-- Test Email -->
					<div class="flex items-center gap-2">
						{#if showTestEmailInput}
							<input
								type="email"
								bind:value={testEmail}
								placeholder="test@example.com"
								class="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48"
							/>
							<button
								onclick={handleSendTest}
								disabled={sendingTest || !testEmail}
								class="test-btn px-3 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
							>
								{#if sendingTest}
									<Loader2 size={14} class="animate-spin" />
								{:else}
									<TestTube size={14} />
								{/if}
								Send Test
							</button>
							<button
								onclick={() => showTestEmailInput = false}
								class="px-2 py-2 text-gray-500 hover:bg-gray-100 rounded-lg"
							>
								<X size={14} />
							</button>
						{:else}
							<button
								onclick={() => showTestEmailInput = true}
								disabled={!getSelectedTemplate()}
								class="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
							>
								<TestTube size={14} />
								Send Test Email
							</button>
						{/if}
					</div>

					<!-- Send Button -->
					<div class="flex items-center gap-3">
						<button
							onclick={handleClose}
							disabled={sending}
							class="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
						>
							Cancel
						</button>
						<button
							onclick={handleSend}
							disabled={sending || !getSelectedTemplate() || recipients.length === 0}
							class="send-btn px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
						>
							{#if sending}
								<Loader2 size={16} class="animate-spin" />
								Sending...
							{:else}
								<Send size={16} />
								Send to {recipients.length} recipient{recipients.length !== 1 ? 's' : ''}
							{/if}
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	.email-select:focus {
		--tw-ring-color: var(--course-accent-light, #c59a6b);
		border-color: var(--course-accent-light, #c59a6b);
	}

	.recipient-row.selected {
		background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 15%, white);
	}

	.recipient-row:hover {
		background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 8%, white);
	}

	.test-btn {
		color: var(--course-accent-dark, #334642);
	}

	.test-btn:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--course-accent-light, #c59a6b) 15%, white);
	}

	.send-btn {
		background-color: var(--course-accent-light, #c59a6b);
		color: var(--course-accent-darkest, #1e2322);
	}

	.send-btn:hover:not(:disabled) {
		background-color: var(--course-accent-dark, #334642);
		color: white;
	}
</style>

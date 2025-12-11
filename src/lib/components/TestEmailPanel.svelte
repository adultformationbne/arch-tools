<script>
	/**
	 * TestEmailPanel - Unified test email component
	 *
	 * Works with any email context (course, dgr, platform).
	 * Loads real recipients, shows live preview with substituted values,
	 * and sends test emails to a custom address.
	 */
	import { onMount } from 'svelte';
	import { Send, Loader2, Eye, ChevronDown, User, Users, X } from 'lucide-svelte';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { apiGet, apiPost } from '$lib/utils/api-handler.js';
	import { getEmailContext } from '$lib/email/context-config';

	/**
	 * @prop context - Email context type ('course', 'dgr', 'platform')
	 * @prop contextId - Context-specific ID (e.g., courseSlug for courses)
	 * @prop contextData - Additional data needed for variable building (course, cohorts, etc.)
	 * @prop template - Template with subject_template and body_template
	 * @prop branding - Branding config { name, logoUrl, accentDark, footerText }
	 * @prop currentUserEmail - Default email for "send to" field
	 * @prop testApiUrl - API endpoint for sending test emails
	 * @prop onClose - Called when panel should close
	 */
	let {
		context = 'course',
		contextId = null,
		contextData = {},
		template = { subject_template: '', body_template: '' },
		branding = {
			name: 'Email',
			logoUrl: null,
			accentDark: '#334642',
			footerText: ''
		},
		currentUserEmail = '',
		testApiUrl = '/api/emails/test',
		onClose = () => {}
	} = $props();

	// Get context config
	const contextConfig = $derived(getEmailContext(context));

	// State
	let recipients = $state([]);
	let loading = $state(true);
	let selectedRecipientId = $state('sample'); // 'sample' or recipient ID
	let sendToEmail = $state(currentUserEmail);
	let sending = $state(false);

	// MJML preview state
	let previewHtml = $state('');
	let previewSubject = $state('');
	let loadingPreview = $state(false);

	// Derived
	const selectedRecipient = $derived(
		selectedRecipientId === 'sample'
			? null
			: recipients.find((r) => r.id === selectedRecipientId)
	);

	const previewDisplayName = $derived(
		selectedRecipientId === 'sample'
			? contextConfig.sampleRecipient.displayName
			: selectedRecipient?.displayName || 'Unknown'
	);

	// Load recipients on mount
	onMount(async () => {
		await loadRecipients();
		await fetchPreview();
	});

	// Refetch preview when recipient changes
	$effect(() => {
		// Track selectedRecipientId to trigger refetch
		const _ = selectedRecipientId;
		fetchPreview();
	});

	async function loadRecipients() {
		loading = true;
		try {
			const url = contextConfig.getRecipientsUrl(contextId || undefined);
			const response = await apiGet(url, { showToast: false });
			recipients = contextConfig.normalizeRecipients(response);
		} catch (err) {
			console.error('Failed to load recipients:', err);
			// Don't show error - sample data still works
		} finally {
			loading = false;
		}
	}

	// Fetch MJML-rendered preview from server
	async function fetchPreview() {
		loadingPreview = true;
		try {
			const response = await apiPost(
				testApiUrl,
				{
					context,
					context_id: contextId,
					recipient_id: selectedRecipientId === 'sample' ? null : selectedRecipientId,
					subject_template: template.subject_template,
					body_template: template.body_template,
					branding: {
						name: branding.name,
						logo_url: branding.logoUrl,
						accent_dark: branding.accentDark
					},
					preview_only: true
				},
				{ showToast: false }
			);

			if (response.html) {
				previewHtml = response.html;
				previewSubject = response.subject || '';
			}
		} catch (err) {
			console.error('Failed to fetch preview:', err);
		} finally {
			loadingPreview = false;
		}
	}

	async function handleSendTest() {
		if (!sendToEmail?.trim()) {
			toastError('Please enter an email address');
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(sendToEmail.trim())) {
			toastError('Please enter a valid email address');
			return;
		}

		sending = true;

		try {
			await apiPost(testApiUrl, {
				context,
				context_id: contextId,
				recipient_id: selectedRecipientId === 'sample' ? null : selectedRecipientId,
				to: sendToEmail.trim(),
				subject_template: template.subject_template,
				body_template: template.body_template,
				branding: {
					name: branding.name,
					logo_url: branding.logoUrl,
					accent_dark: branding.accentDark
				}
			}, { successMessage: `Test email sent to ${sendToEmail}` });

			onClose();
		} catch (err) {
			console.error('Failed to send test email:', err);
		} finally {
			sending = false;
		}
	}

	function handleBackdropClick(e) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}
</script>

<!-- Modal Backdrop -->
<div
	class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
	onclick={handleBackdropClick}
	role="dialog"
	aria-modal="true"
	aria-labelledby="test-email-title"
>
	<!-- Modal Content -->
	<div
		class="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden"
		onclick={(e) => e.stopPropagation()}
	>
		<!-- Header -->
		<div class="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
			<div>
				<h2 id="test-email-title" class="text-xl font-bold text-gray-900">Send Test Email</h2>
				<p class="text-sm text-gray-600 mt-0.5">
					Preview with real data and send to your inbox
				</p>
			</div>
			<button
				onclick={onClose}
				class="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
				aria-label="Close"
			>
				<X size={20} />
			</button>
		</div>

		<!-- Body -->
		<div class="flex-1 overflow-y-auto">
			<!-- Preview As Selection -->
			<div class="px-6 py-4 bg-gray-50 border-b border-gray-200">
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2 text-sm font-medium text-gray-700">
						<Eye size={16} />
						<span>Preview as:</span>
					</div>

					<div class="relative flex-1 max-w-xs">
						<select
							bind:value={selectedRecipientId}
							disabled={loading}
							class="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg bg-white appearance-none text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
						>
							<option value="sample">
								{contextConfig.sampleRecipient.displayName} (Sample)
							</option>

							{#if recipients.length > 0}
								<optgroup label="Real {contextConfig.label} Recipients">
									{#each recipients as recipient}
										<option value={recipient.id}>
											{recipient.displayName} ({recipient.email})
										</option>
									{/each}
								</optgroup>
							{/if}
						</select>
						<ChevronDown size={14} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
					</div>

					{#if loading}
						<Loader2 size={16} class="animate-spin text-gray-400" />
					{:else if recipients.length > 0}
						<span class="text-xs text-gray-500">
							{recipients.length} recipient{recipients.length !== 1 ? 's' : ''} available
						</span>
					{/if}
				</div>

				{#if selectedRecipientId !== 'sample'}
					<div class="mt-2 flex items-center gap-2 text-xs text-blue-600">
						<User size={12} />
						<span>Showing real values for <strong>{previewDisplayName}</strong></span>
					</div>
				{/if}
			</div>

			<!-- Subject Preview -->
			<div class="px-6 py-3 border-b border-gray-200 bg-white">
				<div class="flex items-center gap-3">
					<span class="text-sm font-medium text-gray-500 w-16">Subject:</span>
					<span class="text-sm text-gray-900 font-medium">
						{previewSubject || '(No subject)'}
					</span>
				</div>
			</div>

			<!-- Email Preview - Native MJML rendered in iframe -->
			<div class="bg-gray-100 p-4">
				{#if loadingPreview}
					<div class="flex items-center justify-center h-[400px] bg-white rounded-lg border border-gray-200">
						<div class="flex items-center gap-2 text-gray-500">
							<Loader2 size={20} class="animate-spin" />
							<span>Loading preview...</span>
						</div>
					</div>
				{:else if previewHtml}
					<iframe
						srcdoc={previewHtml}
						title="Email Preview"
						class="w-full h-[500px] bg-white rounded-lg border border-gray-200 shadow-sm"
						sandbox="allow-same-origin"
					></iframe>
				{:else}
					<div class="flex items-center justify-center h-[400px] bg-white rounded-lg border border-gray-200">
						<p class="text-gray-400 italic">No content to preview</p>
					</div>
				{/if}
			</div>
		</div>

		<!-- Footer -->
		<div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex-shrink-0">
			<div class="flex items-center gap-4">
				<div class="flex-1">
					<label class="block text-xs font-medium text-gray-600 mb-1">
						Send test to:
					</label>
					<input
						type="email"
						bind:value={sendToEmail}
						placeholder="your@email.com"
						class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						onkeydown={(e) => {
							if (e.key === 'Enter') handleSendTest();
						}}
					/>
				</div>

				<div class="flex items-center gap-2 pt-5">
					<button
						onclick={onClose}
						class="px-4 py-2 rounded-lg font-medium text-gray-700 hover:bg-gray-200 transition-colors"
					>
						Cancel
					</button>
					<button
						onclick={handleSendTest}
						disabled={sending || !sendToEmail?.trim()}
						class="flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						style="background-color: {branding.accentDark || '#334642'};"
					>
						{#if sending}
							<Loader2 size={16} class="animate-spin" />
							Sending...
						{:else}
							<Send size={16} />
							Send Test
						{/if}
					</button>
				</div>
			</div>

			{#if selectedRecipientId !== 'sample'}
				<p class="text-xs text-gray-500 mt-2">
					Email will be sent to <strong>{sendToEmail}</strong> with {previewDisplayName}'s data
				</p>
			{/if}
		</div>
	</div>
</div>

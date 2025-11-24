<script>
	import { X, Mail, Send, Eye } from 'lucide-svelte';
	import { apiPost } from '$lib/utils/api-handler.js';
	import { toastSuccess, toastError, toastLoading, updateToastStatus } from '$lib/utils/toast-helpers.js';

	let {
		show = false,
		onclose = () => {},
		selectedEnrollments = [],
		courseSlug = '',
		courseName = ''
	} = $props();

	let templates = $state([]);
	let selectedTemplateId = $state('');
	let selectedTemplate = $derived(
		templates.find(t => t.id === selectedTemplateId)
	);
	let isSending = $state(false);
	let showPreview = $state(false);

	// Load templates when modal opens
	$effect(() => {
		if (show) {
			loadTemplates();
		}
	});

	async function loadTemplates() {
		try {
			const response = await fetch(`/api/courses/${courseSlug}/emails`);
			const data = await response.json();

			if (data.success) {
				templates = data.templates.all || [];
			}
		} catch (error) {
			console.error('Failed to load templates:', error);
			toastError('Failed to load email templates', 'Error');
		}
	}

	async function handleSend() {
		if (!selectedTemplateId) {
			toastError('Please select an email template', 'No Template Selected');
			return;
		}

		if (selectedEnrollments.length === 0) {
			toastError('No recipients selected', 'No Recipients');
			return;
		}

		isSending = true;
		const toastId = toastLoading(
			`Sending email to ${selectedEnrollments.length} ${selectedEnrollments.length === 1 ? 'recipient' : 'recipients'}...`,
			'Sending'
		);

		try {
			const response = await apiPost(
				`/api/courses/${courseSlug}/send-email`,
				{
					recipients: selectedEnrollments.map(e => e.id),
					template_id: selectedTemplateId,
					email_type: selectedTemplate.template_key
				},
				{
					showToast: false
				}
			);

			if (response.success) {
				updateToastStatus(
					toastId,
					'success',
					`Successfully sent to ${response.sent} ${response.sent === 1 ? 'recipient' : 'recipients'}`,
					'Success',
					5000
				);

				onclose();
			} else {
				throw new Error(response.message || 'Failed to send emails');
			}
		} catch (error) {
			console.error('Error sending emails:', error);
			updateToastStatus(
				toastId,
				'error',
				error.message || 'Failed to send emails',
				'Error',
				5000
			);
		} finally {
			isSending = false;
		}
	}

	function handleClose() {
		if (!isSending) {
			onclose();
		}
	}
</script>

{#if show}
	<div class="modal-overlay" onclick={handleClose}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<!-- Header -->
			<div class="modal-header">
				<div class="flex items-center gap-3">
					<div class="p-2 bg-blue-100 rounded-lg">
						<Mail size={24} class="text-blue-600" />
					</div>
					<div>
						<h2 class="text-xl font-bold text-gray-900">Send Email</h2>
						<p class="text-sm text-gray-600">
							{selectedEnrollments.length} {selectedEnrollments.length === 1 ? 'recipient' : 'recipients'} selected
						</p>
					</div>
				</div>
				<button
					onclick={handleClose}
					disabled={isSending}
					class="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
				>
					<X size={24} />
				</button>
			</div>

			<!-- Body -->
			<div class="modal-body">
				<!-- Recipients List -->
				<div class="mb-6">
					<label class="block text-sm font-medium text-gray-700 mb-2">
						Recipients ({selectedEnrollments.length})
					</label>
					<div class="max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
						<div class="space-y-1">
							{#each selectedEnrollments as enrollment}
								<div class="text-sm flex items-center gap-2">
									<div class="w-2 h-2 bg-blue-500 rounded-full"></div>
									<span class="font-medium">{enrollment.user_profile?.full_name || 'Unknown'}</span>
									<span class="text-gray-500">({enrollment.user_profile?.email || 'No email'})</span>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<!-- Template Selection -->
				<div class="mb-6">
					<label for="template" class="block text-sm font-medium text-gray-700 mb-2">
						Email Template
					</label>
					<select
						id="template"
						bind:value={selectedTemplateId}
						disabled={isSending}
						class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<option value="">Select a template...</option>
						{#if templates.length > 0}
							<optgroup label="System Templates">
								{#each templates.filter(t => t.category === 'system') as template}
									<option value={template.id}>
										{template.name}
									</option>
								{/each}
							</optgroup>
							{#if templates.filter(t => t.category === 'custom').length > 0}
								<optgroup label="Custom Templates">
									{#each templates.filter(t => t.category === 'custom') as template}
										<option value={template.id}>
											{template.name}
										</option>
									{/each}
								</optgroup>
							{/if}
						{:else}
							<option disabled>Loading templates...</option>
						{/if}
					</select>
				</div>

				<!-- Template Preview (if selected) -->
				{#if selectedTemplate}
					<div class="border border-gray-200 rounded-lg p-4 bg-gray-50">
						<div class="flex items-center justify-between mb-3">
							<h3 class="text-sm font-semibold text-gray-900">Template Preview</h3>
							{#if selectedTemplate.description}
								<span class="text-xs text-gray-500">{selectedTemplate.description}</span>
							{/if}
						</div>
						<div class="space-y-2">
							<div>
								<span class="text-xs font-medium text-gray-600">Subject:</span>
								<p class="text-sm text-gray-900 mt-1">{selectedTemplate.subject_template}</p>
							</div>
							<div>
								<span class="text-xs font-medium text-gray-600">Preview:</span>
								<div class="text-sm text-gray-700 mt-1 line-clamp-3">
									{@html selectedTemplate.body_template?.substring(0, 200) + '...'}
								</div>
							</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="modal-footer">
				<button
					onclick={handleClose}
					disabled={isSending}
					class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					Cancel
				</button>
				<button
					onclick={handleSend}
					disabled={isSending || !selectedTemplateId}
					class="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Send size={18} />
					{isSending ? 'Sending...' : `Send to ${selectedEnrollments.length}`}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 20px;
	}

	.modal-content {
		background-color: white;
		border-radius: 12px;
		width: 100%;
		max-width: 600px;
		max-height: 90vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 24px;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 24px;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		padding: 20px 24px;
		border-top: 1px solid #e5e7eb;
	}

	.line-clamp-3 {
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>

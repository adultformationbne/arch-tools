<script>
	import { Save, Send, RotateCcw } from 'lucide-svelte';
	import { apiPost, apiPut, apiPatch } from '$lib/utils/api-handler.js';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import EmailBodyEditor from './EmailBodyEditor.svelte';
	import ConfirmationModal from './ConfirmationModal.svelte';

	let {
		template = null,
		courseId,
		courseSlug,
		courseName = 'Course Name',
		courseLogoUrl = null,
		courseColors = {
			accentDark: '#334642',
			accentLight: '#eae2d9',
			accentDarkest: '#1e2322'
		},
		onSave = () => {},
		onCancel = () => {}
	} = $props();

	// Generate template_key from name (lowercase, underscores, no special chars)
	function generateTemplateKey(name) {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9\s]/g, '')
			.replace(/\s+/g, '_');
	}

	// Form state
	let formData = $state({
		name: template?.name || '',
		subject_template: template?.subject_template || '',
		body_template: template?.body_template || '',
		available_variables: template?.available_variables || []
	});

	// Auto-generate template_key from name for new templates
	const template_key = $derived(template?.template_key || generateTemplateKey(formData.name));

	let isSubmitting = $state(false);
	let hasUnsavedChanges = $state(false);
	let showTestEmailModal = $state(false);
	let testEmail = $state('');
	let isSendingTest = $state(false);
	let showRestoreConfirm = $state(false);
	let isRestoring = $state(false);

	// Check if this is a system template (can be restored to default)
	const isSystemTemplate = $derived(template?.category === 'system');

	// Sync form data when template prop changes
	$effect(() => {
		formData.name = template?.name || '';
		formData.subject_template = template?.subject_template || '';
		formData.body_template = template?.body_template || '';
		formData.available_variables = template?.available_variables || [];
		hasUnsavedChanges = false;
	});

	// Available variables
	const availableVariables = [
		{ name: 'firstName', description: 'Student first name' },
		{ name: 'lastName', description: 'Student last name' },
		{ name: 'fullName', description: 'Student full name' },
		{ name: 'email', description: 'Student email address' },
		{ name: 'hubName', description: 'Student hub assignment' },
		{ name: 'courseName', description: 'Course name' },
		{ name: 'courseSlug', description: 'Course URL identifier' },
		{ name: 'cohortName', description: 'Cohort name' },
		{ name: 'startDate', description: 'Cohort start date' },
		{ name: 'endDate', description: 'Cohort end date' },
		{ name: 'sessionNumber', description: 'Session number', dynamic: true },
		{ name: 'sessionTitle', description: 'Session title', dynamic: true },
		{ name: 'currentSession', description: 'Current cohort session', dynamic: true },
		{ name: 'loginLink', description: 'Course login page' },
		{ name: 'dashboardLink', description: 'Course dashboard' },
		{ name: 'materialsLink', description: 'Course materials page' },
		{ name: 'reflectionLink', description: 'Reflections page' },
		{ name: 'supportEmail', description: 'Support contact email' }
	];

	async function handleSubmit() {
		if (!formData.name.trim()) {
			toastError('Template name is required');
			return;
		}
		if (!formData.subject_template.trim()) {
			toastError('Subject is required');
			return;
		}
		if (!formData.body_template.trim()) {
			toastError('Body content is required');
			return;
		}

		// Auto-detect variables
		const subjectVars = (formData.subject_template.match(/\{\{(\w+)\}\}/g) || []).map((v) =>
			v.replace(/[{}]/g, '')
		);
		const bodyVars = (formData.body_template.match(/\{\{(\w+)\}\}/g) || []).map((v) =>
			v.replace(/[{}]/g, '')
		);
		const usedVariables = [...new Set([...subjectVars, ...bodyVars])];

		isSubmitting = true;

		try {
			const payload = {
				...formData,
				template_key,
				course_id: courseId,
				category: template?.category || 'custom',
				available_variables: usedVariables
			};

			if (template) {
				await apiPut(
					`/api/courses/${courseSlug}/emails`,
					{ template_id: template.id, ...payload },
					{ successMessage: 'Template saved' }
				);
			} else {
				await apiPost(`/api/courses/${courseSlug}/emails`, payload, {
					successMessage: 'Template created'
				});
			}

			hasUnsavedChanges = false;
			onSave();
		} catch (error) {
			console.error('Error saving template:', error);
		} finally {
			isSubmitting = false;
		}
	}

	function handleBodyChange(html) {
		formData.body_template = html;
		hasUnsavedChanges = true;
	}

	async function handleSendTestEmail() {
		if (!testEmail.trim()) {
			toastError('Please enter an email address');
			return;
		}

		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(testEmail.trim())) {
			toastError('Please enter a valid email address');
			return;
		}

		isSendingTest = true;

		try {
			await apiPost(
				`/api/courses/${courseSlug}/emails/test`,
				{
					to: testEmail.trim(),
					subject: formData.subject_template,
					body: formData.body_template,
					course_name: courseName,
					logo_url: courseLogoUrl,
					colors: courseColors
				},
				{ successMessage: `Test email sent to ${testEmail}` }
			);

			showTestEmailModal = false;
			testEmail = '';
		} catch (error) {
			console.error('Error sending test email:', error);
		} finally {
			isSendingTest = false;
		}
	}

	async function handleRestoreToDefault() {
		if (!template?.template_key) return;

		isRestoring = true;

		try {
			const result = await apiPatch(
				`/api/courses/${courseSlug}/emails`,
				{
					action: 'restore_default',
					template_key: template.template_key
				},
				{ successMessage: 'Template restored to default' }
			);

			if (result?.template) {
				// Update form data with restored values
				formData.name = result.template.name;
				formData.subject_template = result.template.subject_template;
				formData.body_template = result.template.body_template;
				formData.available_variables = result.template.available_variables;
				hasUnsavedChanges = false;
			}

			showRestoreConfirm = false;
			onSave(); // Notify parent to refresh
		} catch (error) {
			console.error('Error restoring template:', error);
		} finally {
			isRestoring = false;
		}
	}
</script>

<div class="max-w-4xl mx-auto space-y-6">
	<!-- Template name (only for new templates) -->
	{#if !template}
		<div>
			<label class="block text-sm font-semibold text-gray-700 mb-1.5">Template Name</label>
			<input
				type="text"
				bind:value={formData.name}
				oninput={() => (hasUnsavedChanges = true)}
				placeholder="Welcome Email"
				class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
			/>
		</div>
	{/if}

	<!-- Subject -->
	<div>
		<label class="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
		<input
			type="text"
			bind:value={formData.subject_template}
			onchange={() => (hasUnsavedChanges = true)}
			placeholder="How to Access {{courseName}}"
			class="w-full px-4 py-3 border border-gray-300 rounded-lg font-medium text-base"
		/>
	</div>

	<!-- Email Body Editor (shared component) -->
	<div>
		<label class="block text-sm font-semibold text-gray-700 mb-3">Email Body</label>
		<EmailBodyEditor
			value={formData.body_template}
			onchange={handleBodyChange}
			placeholder="Click here to start writing..."
			{courseName}
			logoUrl={courseLogoUrl}
			accentDark={courseColors.accentDark}
			{availableVariables}
		/>
	</div>

	<!-- Save and Test Buttons -->
	<div class="flex items-center justify-between pt-4">
		<div class="text-sm">
			{#if hasUnsavedChanges}
				<span class="text-orange-600 font-medium">● Unsaved changes</span>
			{:else}
				<span class="text-gray-500">All changes saved</span>
			{/if}
		</div>
		<div class="flex items-center gap-3">
			{#if isSystemTemplate}
				<button
					type="button"
					onclick={() => (showRestoreConfirm = true)}
					disabled={isRestoring}
					class="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-colors text-gray-600 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-50"
				>
					<RotateCcw size={16} />
					Restore Default
				</button>
			{/if}
			<button
				type="button"
				onclick={() => (showTestEmailModal = true)}
				class="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors bg-white border-2 border-gray-300 text-gray-700 hover:bg-gray-50"
			>
				<Send size={16} />
				Send Test Email
			</button>
			<button
				type="button"
				onclick={handleSubmit}
				disabled={isSubmitting || !hasUnsavedChanges}
				class="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium transition-colors text-white disabled:opacity-50 disabled:cursor-not-allowed"
				style="background-color: var(--course-accent-dark);"
			>
				<Save size={16} />
				{isSubmitting ? 'Saving...' : 'Save Template'}
			</button>
		</div>
	</div>
</div>

<!-- Test Email Modal -->
{#if showTestEmailModal}
	<div
		class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
		onclick={(e) => {
			if (e.target === e.currentTarget) showTestEmailModal = false;
		}}
		role="dialog"
		aria-modal="true"
	>
		<div class="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onclick={(e) => e.stopPropagation()}>
			<div class="p-6 border-b border-gray-200">
				<h2 class="text-xl font-bold text-gray-900">Send Test Email</h2>
				<p class="text-sm text-gray-600 mt-1">
					Enter an email address to receive a test version of this template
				</p>
			</div>

			<div class="p-6">
				<label class="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
				<input
					type="email"
					bind:value={testEmail}
					placeholder="recipient@example.com"
					class="w-full px-4 py-3 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-transparent"
					onkeydown={(e) => {
						if (e.key === 'Enter') handleSendTestEmail();
					}}
				/>
				<p class="text-xs text-gray-500 mt-2">
					Variables will be replaced with placeholder values
				</p>
			</div>

			<div class="p-6 bg-gray-50 rounded-b-xl flex items-center justify-end gap-3">
				<button
					type="button"
					onclick={() => {
						showTestEmailModal = false;
						testEmail = '';
					}}
					class="px-5 py-2.5 rounded-lg font-medium text-gray-700 hover:bg-gray-200 transition-colors"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleSendTestEmail}
					disabled={isSendingTest}
					class="flex items-center gap-2 px-6 py-2.5 rounded-lg font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					style="background-color: var(--course-accent-dark);"
				>
					<Send size={16} />
					{isSendingTest ? 'Sending...' : 'Send Test'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Restore to Default Confirmation Modal -->
<ConfirmationModal
	show={showRestoreConfirm}
	title="Restore to Default"
	loading={isRestoring}
	loadingMessage="Restoring template..."
	confirmText="Restore Default"
	onConfirm={handleRestoreToDefault}
	onCancel={() => (showRestoreConfirm = false)}
>
	<p>This will reset the template to its original default content.</p>
	<p><strong>Any customizations you've made will be lost.</strong></p>
</ConfirmationModal>

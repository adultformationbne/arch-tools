<script>
	import { Save, Send, RotateCcw, ChevronDown } from '$lib/icons';
	import { apiPost, apiPut, apiPatch } from '$lib/utils/api-handler.js';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import EmailBodyEditor from './EmailBodyEditor.svelte';
	import ConfirmationModal from './ConfirmationModal.svelte';
	import TestEmailPanel from './TestEmailPanel.svelte';
	import { createDropdown } from '$lib/utils/dropdown.js';
	import { onDestroy } from 'svelte';

	/**
	 * Unified Email Template Editor
	 * Works with any context (course, dgr, platform)
	 *
	 * @prop {string} context - Template context: 'course', 'dgr', or 'platform'
	 * @prop {string} apiBaseUrl - Base URL for API calls (e.g., '/api/courses/my-course/emails')
	 * @prop {Array} variables - Available template variables
	 * @prop {Object} branding - Brand settings { name, logoUrl, accentDark, footerText }
	 * @prop {Object} contextData - Additional context data for variable building (course, cohorts, etc.)
	 * @prop {string} currentUserEmail - Default email for test sends
	 */
	let {
		template = null,
		// Context configuration
		context = 'course',
		contextId = null,
		apiBaseUrl = null,
		// Branding
		branding = {
			name: 'Email',
			logoUrl: null,
			accentDark: '#334642',
			footerText: "You're receiving this email from our platform."
		},
		// Variables available for this template
		variables = [],
		// Context data for variable building (course, cohorts, etc.)
		contextData = {},
		// Current user email for test sends
		currentUserEmail = '',
		// Event handlers
		onSave = () => {},
		onCancel = () => {},
		// Backwards compatibility with course-specific props
		courseId = null,
		courseSlug = null,
		courseName = null,
		courseLogoUrl = null,
		courseColors = null
	} = $props();

	// Backwards compatibility: derive settings from course props if provided
	const effectiveApiBaseUrl = $derived(
		apiBaseUrl || (courseSlug ? `/api/courses/${courseSlug}/emails` : null)
	);
	const effectiveBranding = $derived({
		name: courseName || branding.name || 'Email',
		logoUrl: courseLogoUrl || branding.logoUrl || null,
		// Course colors take priority over branding defaults
		accentDark: courseColors?.accentDark || branding.accentDark || '#334642',
		footerText: branding.footerText || "You're receiving this because you're enrolled in this course."
	});
	const effectiveContextId = $derived(contextId || courseId);

	// Generate template_key from name (lowercase, underscores, no special chars)
	function generateTemplateKey(name) {
		return name
			.toLowerCase()
			.trim()
			.replace(/[^a-z0-9\s]/g, '')
			.replace(/\s+/g, '_');
	}

	// Form state (initialized from template prop)
	let formData = $state({
		name: '',
		subject_template: '',
		body_template: '',
		available_variables: /** @type {string[]} */ ([])
	});

	// Sync form data when template changes (combines both effects)
	$effect(() => {
		formData.name = template?.name || '';
		formData.subject_template = template?.subject_template || '';
		formData.body_template = template?.body_template || '';
		formData.available_variables = template?.available_variables || [];
		hasUnsavedChanges = false;
	});

	// Auto-generate template_key from name for new templates
	const template_key = $derived(template?.template_key || generateTemplateKey(formData.name));

	let isSubmitting = $state(false);
	let hasUnsavedChanges = $state(false);
	let showTestEmailPanel = $state(false);
	let showRestoreConfirm = $state(false);
	let isRestoring = $state(false);

	// Subject variable picker
	let subjectInputEl = $state(null);
	let subjectVarButtonEl = $state(null);
	let subjectVarMenuEl = $state(null);
	let subjectDropdown = $state(null);

	// Initialize subject dropdown when elements are ready
	$effect(() => {
		if (subjectVarButtonEl && subjectVarMenuEl && !subjectDropdown) {
			subjectDropdown = createDropdown(subjectVarButtonEl, subjectVarMenuEl, {
				placement: 'bottom-end',
				offset: 4
			});
		}
	});

	onDestroy(() => {
		if (subjectDropdown) subjectDropdown.destroy();
	});

	function insertVariableIntoSubject(variableName) {
		if (!subjectInputEl) return;

		const input = subjectInputEl;
		const start = input.selectionStart || 0;
		const end = input.selectionEnd || 0;
		const text = formData.subject_template;
		const varText = `{{${variableName}}}`;

		// Insert at cursor position
		formData.subject_template = text.substring(0, start) + varText + text.substring(end);
		hasUnsavedChanges = true;

		// Close dropdown
		if (subjectDropdown) subjectDropdown.hide();

		// Restore focus and set cursor after inserted variable
		setTimeout(() => {
			input.focus();
			const newPos = start + varText.length;
			input.setSelectionRange(newPos, newPos);
		}, 0);
	}

	// Check if this is a system template (can be restored to default)
	const isSystemTemplate = $derived(template?.category === 'system');

	// Default variables for each context type
	const DEFAULT_COURSE_VARIABLES = [
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
		{ name: 'loginLink', description: 'Smart login link (auto-sends code)' },
		{ name: 'dashboardLink', description: 'Course dashboard' },
		{ name: 'materialsLink', description: 'Course materials page' },
		{ name: 'reflectionLink', description: 'Reflections page' },
		{ name: 'supportEmail', description: 'Support contact email' }
	];

	const DEFAULT_DGR_VARIABLES = [
		{ name: 'contributor_name', description: 'Contributor full name' },
		{ name: 'contributor_first_name', description: 'Contributor first name' },
		{ name: 'contributor_email', description: 'Contributor email address' },
		{ name: 'write_url', description: 'Writing portal URL' },
		{ name: 'write_url_button', description: 'Writing portal button HTML' },
		{ name: 'due_date', description: 'Submission due date' },
		{ name: 'due_date_text', description: 'Due date as text (e.g., "tomorrow")' }
	];

	const DEFAULT_PLATFORM_VARIABLES = [
		{ name: 'userName', description: 'User full name' },
		{ name: 'userEmail', description: 'User email address' },
		{ name: 'platformName', description: 'Platform name' },
		{ name: 'supportEmail', description: 'Support contact email' }
	];

	// Use provided variables or defaults based on context
	const availableVariables = $derived.by(() => {
		if (variables.length > 0) return variables;
		switch (context) {
			case 'dgr':
				return DEFAULT_DGR_VARIABLES;
			case 'platform':
				return DEFAULT_PLATFORM_VARIABLES;
			default:
				return DEFAULT_COURSE_VARIABLES;
		}
	});

	async function handleSubmit() {
		if (!effectiveApiBaseUrl) {
			toastError('API endpoint not configured');
			return;
		}
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
				context,
				context_id: effectiveContextId,
				category: template?.category || 'custom',
				available_variables: usedVariables
			};

			if (template) {
				await apiPut(
					effectiveApiBaseUrl,
					{ template_id: template.id, ...payload },
					{ successMessage: 'Template saved' }
				);
			} else {
				await apiPost(effectiveApiBaseUrl, payload, {
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

	async function handleRestoreToDefault() {
		if (!template?.template_key || !effectiveApiBaseUrl) return;

		isRestoring = true;

		try {
			const result = await apiPatch(
				effectiveApiBaseUrl,
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

<div class="max-w-4xl mx-auto space-y-6 overflow-visible">
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

	<!-- Subject with Variable Picker -->
	<div>
		<label class="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
		<div class="relative">
			<input
				type="text"
				bind:this={subjectInputEl}
				bind:value={formData.subject_template}
				oninput={() => (hasUnsavedChanges = true)}
				placeholder="How to Access {{courseName}}"
				class="w-full px-4 py-3 pr-20 border border-gray-300 rounded-lg font-medium text-base"
			/>
			<!-- Variable Insert Button -->
			<button
				type="button"
				bind:this={subjectVarButtonEl}
				onclick={() => subjectDropdown?.toggle()}
				class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
			>
				<span class="font-mono">{'{}'}</span>
				<ChevronDown size={12} />
			</button>

			<!-- Variable Dropdown Menu (NO hidden class - controlled by dropdown.js) -->
			<div
				bind:this={subjectVarMenuEl}
				style="display: none;"
				class="w-44 bg-white rounded-lg shadow-xl border border-gray-200 py-1 max-h-64 overflow-y-auto"
			>
				{#each availableVariables() as variable}
					<button
						type="button"
						onclick={() => insertVariableIntoSubject(variable.name)}
						class="w-full text-left px-3 py-1.5 hover:bg-gray-100 text-xs"
					>
						<span class="font-medium text-gray-900 font-mono">{variable.name}</span>
					</button>
				{/each}
			</div>
		</div>
	</div>

	<!-- Email Body Editor (shared component) -->
	<div>
		<label class="block text-sm font-semibold text-gray-700 mb-3">Email Body</label>
		<EmailBodyEditor
			value={formData.body_template}
			onchange={handleBodyChange}
			placeholder="Click here to start writing..."
			brandName={effectiveBranding.name}
			logoUrl={effectiveBranding.logoUrl}
			accentDark={effectiveBranding.accentDark}
			footerText={effectiveBranding.footerText}
			availableVariables={availableVariables()}
			{context}
			contextId={effectiveContextId}
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
				onclick={() => (showTestEmailPanel = true)}
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

<!-- Test Email Panel (unified component with real recipient preview) -->
{#if showTestEmailPanel}
	<TestEmailPanel
		{context}
		contextId={effectiveContextId || courseSlug}
		{contextData}
		template={{
			subject_template: formData.subject_template,
			body_template: formData.body_template
		}}
		branding={effectiveBranding}
		{currentUserEmail}
		testApiUrl="/api/emails/test"
		onClose={() => (showTestEmailPanel = false)}
	/>
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

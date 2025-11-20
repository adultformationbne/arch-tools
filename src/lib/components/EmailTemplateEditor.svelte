<script>
	import { Save, Send } from 'lucide-svelte';
	import { apiPost, apiPut } from '$lib/utils/api-handler.js';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import TipTapEmailEditor from './TipTapEmailEditor.svelte';
	import { generateEmailPreview } from '$lib/utils/email-preview.js';
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

	// Form state
	let formData = $state({
		template_key: template?.template_key || '',
		name: template?.name || '',
		description: template?.description || '',
		subject_template: template?.subject_template || '',
		body_template: template?.body_template || '',
		available_variables: template?.available_variables || []
	});

	let isSubmitting = $state(false);
	let hasUnsavedChanges = $state(false);
	let editorComponent;
	let showTestEmailModal = $state(false);
	let testEmail = $state('');
	let isSendingTest = $state(false);

	// Available variables
	const availableVariables = [
		{ name: 'student_name', category: 'Student', description: 'Full name of student' },
		{ name: 'student_email', category: 'Student', description: 'Student email address' },
		{ name: 'course_name', category: 'Course', description: 'Name of course' },
		{ name: 'course_slug', category: 'Course', description: 'Course URL slug' },
		{ name: 'cohort_name', category: 'Cohort', description: 'Name of cohort' },
		{ name: 'session_title', category: 'Session', description: 'Session title' },
		{ name: 'session_date', category: 'Session', description: 'Session date' },
		{ name: 'session_number', category: 'Session', description: 'Session number' },
		{ name: 'hub_name', category: 'Hub', description: 'Hub name' },
		{ name: 'coordinator_name', category: 'Hub', description: 'Hub coordinator name' },
		{ name: 'coordinator_email', category: 'Hub', description: 'Hub coordinator email' },
		{ name: 'materials_url', category: 'Links', description: 'URL to course materials' },
		{ name: 'reflections_url', category: 'Links', description: 'URL to reflections page' },
		{ name: 'dashboard_url', category: 'Links', description: 'URL to course dashboard' },
		{ name: 'login_url', category: 'Links', description: 'URL to login page' },
		{ name: 'site_name', category: 'Site', description: 'Name of platform' },
		{ name: 'site_url', category: 'Site', description: 'URL of platform' },
		{ name: 'current_date', category: 'Date', description: 'Current date' }
	];

	// Live preview HTML - SINGLE SOURCE OF TRUTH for email rendering
	const previewHtml = $derived(() => {
		return generateEmailPreview({
			bodyContent: formData.body_template,
			courseName: courseName,
			logoUrl: courseLogoUrl,
			colors: {
				accentDark: courseColors.accentDark,
				accentLight: courseColors.accentLight,
				accentDarkest: courseColors.accentDarkest
			}
		});
	});

	async function handleSubmit() {
		// Validation
		if (!template && !formData.template_key.trim()) {
			toastError('Template key is required');
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
				course_id: courseId,
				category: template?.category || 'custom',
				available_variables: usedVariables
			};

			if (template) {
				await apiPut(
					`/api/courses/${courseSlug}/emails`,
					{ id: template.id, ...payload },
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

	function handleInsertVariable(variableName) {
		// Access the editor component's insertVariable function
		if (editorComponent?.insertVariable) {
			editorComponent.insertVariable(variableName, variableName);
		}
	}

	async function handleSendTestEmail() {
		if (!testEmail.trim()) {
			toastError('Please enter an email address');
			return;
		}

		// Basic email validation
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
				{
					successMessage: `Test email sent to ${testEmail}`
				}
			);

			showTestEmailModal = false;
			testEmail = '';
		} catch (error) {
			console.error('Error sending test email:', error);
		} finally {
			isSendingTest = false;
		}
	}
</script>

<!-- Single unified view - Editor IS the preview -->
<div class="max-w-4xl mx-auto space-y-6">
	<!-- Template metadata (only for new templates) -->
	{#if !template}
		<div class="grid grid-cols-3 gap-4">
			<div>
				<label class="block text-sm font-semibold text-gray-700 mb-1.5">Template Key</label>
				<input
					type="text"
					bind:value={formData.template_key}
					placeholder="welcome_email"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
				/>
				<p class="text-xs text-gray-500 mt-1">Lowercase, underscores only</p>
			</div>

			<div>
				<label class="block text-sm font-semibold text-gray-700 mb-1.5">Template Name</label>
				<input
					type="text"
					bind:value={formData.name}
					placeholder="Welcome Email"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
				/>
			</div>

			<div>
				<label class="block text-sm font-semibold text-gray-700 mb-1.5">Description</label>
				<input
					type="text"
					bind:value={formData.description}
					placeholder="Sent when students first enroll"
					class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
				/>
			</div>
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

	<!-- Unified Email Preview/Editor -->
	<div>
		<label class="block text-sm font-semibold text-gray-700 mb-3">
			Email Body
		</label>

		<!-- Email client simulation background -->
		<div class="bg-gray-100 rounded-xl p-8 flex justify-center">
			<!-- Email preview wrapper with branded header/footer (600px max like real emails) -->
			<div
				class="w-full max-w-[600px] border border-gray-300 rounded-lg overflow-hidden bg-white shadow-xl"
			>
				<!-- Email header with logo -->
				<div
					class="text-center py-8 px-6 flex flex-col items-center gap-3"
					style="background-color: {courseColors.accentDark};"
				>
					{#if courseLogoUrl}
						<img src={courseLogoUrl} alt="{courseName} logo" class="h-16 w-auto object-contain" />
					{/if}
					<h1 class="text-2xl font-bold text-white">{courseName}</h1>
				</div>

				<!-- Editable email body with toolbar INSIDE but ABOVE content -->
				<div class="bg-white">
					<TipTapEmailEditor
						bind:this={editorComponent}
						value={formData.body_template}
						onchange={handleBodyChange}
						placeholder="Click here to start writing..."
						{availableVariables}
						hideVariablePicker={true}
						showFixedToolbar={true}
					/>
				</div>

				<!-- Email footer -->
				<div class="text-center py-6 px-6" style="background-color: {courseColors.accentDark};">
					<p class="text-white text-sm font-medium">{courseName}</p>
					<p class="text-white/70 text-xs mt-1">
						You're receiving this email because you're enrolled in this course.
					</p>
				</div>
			</div>
		</div>

		<!-- Variable Pills OUTSIDE the email preview -->
		<div class="mt-4 p-4 bg-white border border-gray-300 rounded-lg">
			<p class="text-xs font-semibold text-gray-700 mb-2">Click to insert variable:</p>
			<div class="flex flex-wrap gap-2">
				{#each availableVariables as variable}
					<button
						type="button"
						onclick={() => handleInsertVariable(variable.name)}
						class="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:scale-105 variable-picker-pill"
						title={variable.description}
					>
						{variable.name}
					</button>
				{/each}
			</div>
		</div>
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

<style>
	/* Variable picker pills */
	.variable-picker-pill {
		background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
		color: #374151;
		border: 1px solid #d1d5db;
	}

	.variable-picker-pill:hover {
		background: linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%);
		color: #6b21a8;
		border-color: #a855f7;
	}
</style>

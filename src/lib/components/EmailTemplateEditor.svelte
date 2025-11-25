<script>
	import { Save, Send, Zap, SquareMousePointer } from 'lucide-svelte';
	import { apiPost, apiPut } from '$lib/utils/api-handler.js';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import TipTapEmailEditor from './TipTapEmailEditor.svelte';
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

	// Sync form data when template prop changes
	$effect(() => {
		formData.template_key = template?.template_key || '';
		formData.name = template?.name || '';
		formData.description = template?.description || '';
		formData.subject_template = template?.subject_template || '';
		formData.body_template = template?.body_template || '';
		formData.available_variables = template?.available_variables || [];
		hasUnsavedChanges = false;
	});
	let editorComponent;
	let tiptapEditor;
	let showTestEmailModal = $state(false);
	let testEmail = $state('');
	let isSendingTest = $state(false);

	// Available variables
	// dynamic: true = Only populated when triggered by specific context (e.g., session emails)
	const availableVariables = [
		// Student info (always available)
		{ name: 'firstName', description: 'Student first name' },
		{ name: 'lastName', description: 'Student last name' },
		{ name: 'fullName', description: 'Student full name' },
		{ name: 'email', description: 'Student email address' },
		{ name: 'hubName', description: 'Student hub assignment' },

		// Course/cohort info (always available)
		{ name: 'courseName', description: 'Course name' },
		{ name: 'courseSlug', description: 'Course URL identifier' },
		{ name: 'cohortName', description: 'Cohort name' },
		{ name: 'startDate', description: 'Cohort start date' },
		{ name: 'endDate', description: 'Cohort end date' },

		// Session variables (context-dependent - only when email triggered by session)
		{ name: 'sessionNumber', description: 'Session number', dynamic: true },
		{ name: 'sessionTitle', description: 'Session title', dynamic: true },
		{ name: 'currentSession', description: 'Current cohort session', dynamic: true },

		// Links (always available)
		{ name: 'loginLink', description: 'Course login page' },
		{ name: 'dashboardLink', description: 'Course dashboard' },
		{ name: 'materialsLink', description: 'Course materials page' },
		{ name: 'reflectionLink', description: 'Reflections page' },

		// System (always available)
		{ name: 'supportEmail', description: 'Support contact email' }
	];

	// Note: The editor provides a WYSIWYG preview of the email body.
	// For the exact production preview with MJML compilation, use "Send Test Email".

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

	function handleInsertVariable(variableName) {
		if (!tiptapEditor) return;

		// Insert variable node directly using the editor
		tiptapEditor
			.chain()
			.focus()
			.insertContent([
				{
					type: 'variable',
					attrs: {
						id: variableName,
						label: variableName
					}
				},
				{
					type: 'text',
					text: ' '
				}
			])
			.run();
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

		<!-- Email client simulation background with toolbar on the side -->
		<div class="bg-gray-100 rounded-xl p-8 flex justify-center gap-4">
			<!-- Toolbar Outside -->
			<div class="flex flex-col items-center gap-1 p-2 bg-gray-50 border border-gray-200 rounded-lg w-14 h-fit sticky top-8">
				<!-- Toolbar buttons will be added here via a slot or directly -->
				<button
					type="button"
					onclick={() => tiptapEditor?.chain().focus().toggleBold().run()}
					class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
					title="Bold"
				>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
					</button>
					<button
						type="button"
						onclick={() => tiptapEditor?.chain().focus().toggleItalic().run()}
						class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
						title="Italic"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 4h-9M14 20H5M15 4L9 20"/></svg>
					</button>
					<div class="w-full h-px bg-gray-300 my-1"></div>
					<button
						type="button"
						onclick={() => tiptapEditor?.chain().focus().setParagraph().run()}
						class="px-2 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-xs font-semibold"
						title="Paragraph"
					>
						P
					</button>
					<button
						type="button"
						onclick={() => tiptapEditor?.chain().focus().toggleHeading({ level: 1 }).run()}
						class="px-2 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-xs font-semibold"
						title="Heading 1"
					>
						H1
					</button>
					<button
						type="button"
						onclick={() => tiptapEditor?.chain().focus().toggleHeading({ level: 2 }).run()}
						class="px-2 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-xs font-semibold"
						title="Heading 2"
					>
						H2
					</button>
					<button
						type="button"
						onclick={() => tiptapEditor?.chain().focus().toggleHeading({ level: 3 }).run()}
						class="px-2 py-2 hover:bg-gray-200 rounded transition-colors text-gray-700 text-xs font-semibold"
						title="Heading 3"
					>
						H3
					</button>
					<div class="w-full h-px bg-gray-300 my-1"></div>
					<button
						type="button"
						onclick={() => tiptapEditor?.chain().focus().toggleBulletList().run()}
						class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
						title="Bullet List"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
					</button>
					<button
						type="button"
						onclick={() => tiptapEditor?.chain().focus().toggleOrderedList().run()}
						class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
						title="Numbered List"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
					</button>
					<div class="w-full h-px bg-gray-300 my-1"></div>
					<button
						type="button"
						onclick={(e) => editorComponent?.openLinkModal(e.currentTarget)}
						class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
						title="Add Link"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
					</button>
					<button
						type="button"
						onclick={(e) => editorComponent?.openButtonModal(e.currentTarget)}
						class="p-2 hover:bg-gray-200 rounded transition-colors text-gray-700"
						title="Insert Button"
					>
						<SquareMousePointer size={18} />
					</button>
				</div>

			<!-- Email preview wrapper with branded header/footer (600px max like real emails) -->
			<div
				class="w-full max-w-[600px] border border-gray-300 rounded-lg overflow-hidden bg-white shadow-xl"
			>
				<!-- Email header with logo -->
				<div
					class="text-center py-12 px-8 flex items-center justify-center"
					style="background-color: {courseColors.accentDark};"
				>
					{#if courseLogoUrl}
						<img
							src={courseLogoUrl}
							alt="{courseName} logo"
							class="h-24 w-auto object-contain max-w-[280px]"
						/>
					{:else}
						<h1 class="text-3xl font-bold text-white tracking-tight">{courseName}</h1>
					{/if}
				</div>

				<!-- Editable email body WITHOUT toolbar -->
				<div class="bg-white">
					<TipTapEmailEditor
						bind:this={editorComponent}
						bind:editor={tiptapEditor}
						value={formData.body_template}
						onchange={handleBodyChange}
						placeholder="Click here to start writing..."
						{availableVariables}
						hideVariablePicker={true}
						showFixedToolbar={false}
						verticalToolbar={false}
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
			<p class="text-xs font-semibold text-gray-700 mb-3">
				Click to insert variable
				<span class="ml-2 text-gray-500 font-normal inline-flex items-center gap-1">
					<Zap size={12} class="text-amber-500" /> = Context-dependent (only populated in specific emails)
				</span>
			</p>

			<div class="flex flex-wrap gap-2">
				{#each availableVariables as variable}
					<button
						type="button"
						onclick={() => handleInsertVariable(variable.name)}
						class="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all hover:scale-105"
						class:variable-picker-pill={!variable.dynamic}
						class:variable-picker-pill-dynamic={variable.dynamic}
						title={variable.description}
					>
						{#if variable.dynamic}
							<Zap size={12} class="text-amber-500" />
						{/if}
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
	/* Variable picker pills - always available */
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

	/* Variable picker pills - context-dependent */
	.variable-picker-pill-dynamic {
		background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
		color: #78350f;
		border: 1px solid #fbbf24;
	}

	.variable-picker-pill-dynamic:hover {
		background: linear-gradient(135deg, #fde68a 0%, #fcd34d 100%);
		color: #78350f;
		border-color: #f59e0b;
	}
</style>

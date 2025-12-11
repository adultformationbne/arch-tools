<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import EmailTreeSidebar from '$lib/components/EmailTreeSidebar.svelte';
	import EmailTemplateEditor from '$lib/components/EmailTemplateEditor.svelte';
	import SendEmailView from '$lib/components/SendEmailView.svelte';
	import { Edit, Trash2 } from 'lucide-svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import { apiDelete } from '$lib/utils/api-handler.js';

	let { data } = $props();

	// Get selected view from URL params (default to 'send')
	const selectedView = $derived($page.url.searchParams.get('view') || 'send');

	// Get initial mode for SendEmailView
	const initialMode = $derived($page.url.searchParams.get('mode') || 'choose');

	// Find selected template if viewing one
	const selectedTemplate = $derived.by(() => {
		if (selectedView === 'logs' || selectedView === 'new' || selectedView === 'send') return null;
		return [...(data.systemTemplates || []), ...(data.customTemplates || [])].find(
			(t) => t.id === selectedView
		);
	});

	let showDeleteConfirm = $state(false);
	let templateToDelete = $state(null);

	function handleViewChange(view) {
		const url = new URL($page.url);
		url.searchParams.set('view', view);
		goto(url.toString());
	}

	async function handleSaveTemplate() {
		// Reload the page to get fresh data
		goto($page.url.toString(), { invalidateAll: true });
	}

	function handleDeleteClick(template) {
		templateToDelete = template;
		showDeleteConfirm = true;
	}

	async function confirmDelete() {
		if (!templateToDelete) return;

		try {
			await apiDelete(`/api/courses/${data.courseSlug}/emails?template_id=${templateToDelete.id}`, {
				successMessage: 'Template deleted successfully'
			});

			showDeleteConfirm = false;
			templateToDelete = null;

			// Go back to logs view
			handleViewChange('logs');
		} catch (error) {
			console.error('Error deleting template:', error);
		}
	}
</script>

<div class="flex h-screen" style="background-color: var(--course-accent-dark);">
	<!-- Left Sidebar -->
	<div class="w-64 border-r flex-shrink-0" style="border-color: rgba(255,255,255,0.1);">
		<EmailTreeSidebar
			systemTemplates={data.systemTemplates || []}
			customTemplates={data.customTemplates || []}
			{selectedView}
			onViewChange={handleViewChange}
		/>
	</div>

	<!-- Main Content Area -->
	<div class="flex-1 overflow-y-auto">
		{#if selectedView === 'send'}
			<!-- Send Email View -->
			<SendEmailView
				course={data.course}
				courseSlug={data.courseSlug}
				templates={data.allTemplates || []}
				cohorts={data.cohorts || []}
				hubs={data.hubs || []}
				{initialMode}
				currentUserEmail={data.currentUserEmail}
			/>

		{:else if selectedView === 'logs'}
			<!-- Email Logs View -->
			<div class="p-8">
				<h1 class="text-3xl font-bold text-white mb-2">Email Logs</h1>
				<p class="text-white/70 mb-8">View history of all sent emails for this course</p>

				<div class="bg-white rounded-lg overflow-hidden">
					{#if (data.emailLogs || []).length === 0}
						<div class="p-12 text-center">
							<p class="text-gray-500">No emails sent yet</p>
							<p class="text-sm text-gray-400 mt-2">Emails sent to students will appear here</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead>
									<tr class="border-b border-gray-200">
										<th
											class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider"
											style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
										>
											Date & Time
										</th>
										<th
											class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider"
											style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
										>
											Recipient
										</th>
										<th
											class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider"
											style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
										>
											Subject
										</th>
										<th
											class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider"
											style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
										>
											Template
										</th>
										<th
											class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider"
											style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
										>
											Status
										</th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-200">
									{#each data.emailLogs || [] as log}
										<tr class="hover:bg-gray-50 transition-colors">
											<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
												{new Date(log.sent_at).toLocaleString('en-US', {
													month: 'short',
													day: 'numeric',
													year: 'numeric',
													hour: 'numeric',
													minute: '2-digit'
												})}
											</td>
											<td class="px-6 py-4 text-sm text-gray-900">
												{log.recipient_email}
											</td>
											<td class="px-6 py-4 text-sm text-gray-900">
												<div class="max-w-md truncate" title={log.subject}>
													{log.subject}
												</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm">
												{#if log.email_templates?.name}
													<span
														class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
													>
														{log.email_templates.name}
													</span>
												{:else}
													<span class="text-gray-400 italic">No template</span>
												{/if}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm">
												{#if log.status === 'sent'}
													<span
														class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
													>
														Sent
													</span>
												{:else if log.status === 'failed'}
													<span
														class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"
														title={log.error_message || 'Unknown error'}
													>
														Failed
													</span>
												{:else if log.status === 'pending'}
													<span
														class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"
													>
														Pending
													</span>
												{:else}
													<span class="text-gray-400 italic">{log.status || 'Unknown'}</span>
												{/if}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>

						<!-- Pagination info -->
						<div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
							<p class="text-sm text-gray-600">
								Showing {(data.emailLogs || []).length} most recent email{(data.emailLogs || []).length === 1 ? '' : 's'}
							</p>
						</div>
					{/if}
				</div>
			</div>

		{:else if selectedView === 'new'}
			<!-- Create New Template View -->
			<div class="p-8">
				<h1 class="text-3xl font-bold text-white mb-2">Create Template</h1>
				<p class="text-white/70 mb-8">Create a new custom email template</p>

				<div class="bg-white rounded-lg p-8">
					<EmailTemplateEditor
						context="course"
						courseId={data.course.id}
						courseSlug={data.courseSlug}
						courseName={data.course.name}
						courseLogoUrl={data.course.logo_url}
						courseColors={{
							accentDark: data.course.accent_dark || '#334642',
							accentLight: data.course.accent_light || '#eae2d9',
							accentDarkest: data.course.accent_darkest || '#1e2322'
						}}
						contextData={{ course: data.course, cohorts: data.cohorts }}
						currentUserEmail={data.currentUserEmail}
						onSave={handleSaveTemplate}
						onCancel={() => handleViewChange('logs')}
					/>
				</div>
			</div>

		{:else if selectedTemplate}
			<!-- Template Editor (Immediate Edit) -->
			<div class="p-8">
				<div class="flex items-center justify-between mb-6">
					<div>
						<div class="flex items-center gap-2 mb-2">
							<h1 class="text-3xl font-bold text-white">{selectedTemplate.name}</h1>
							{#if selectedTemplate.category === 'system'}
								<span
									class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
									style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
								>
									System
								</span>
							{/if}
						</div>
						{#if selectedTemplate.description}
							<p class="text-white/70">{selectedTemplate.description}</p>
						{/if}
					</div>
					<div class="flex gap-2">
						{#if selectedTemplate.category === 'custom'}
							<button
								onclick={() => handleDeleteClick(selectedTemplate)}
								class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors border border-red-300 text-red-600 bg-white hover:bg-red-50"
							>
								<Trash2 size={16} />
								Delete
							</button>
						{/if}
					</div>
				</div>

				<!-- Simplified Editor (always in edit mode) -->
				<div class="bg-white rounded-lg p-8">
					<EmailTemplateEditor
						template={selectedTemplate}
						context="course"
						courseId={data.course.id}
						courseSlug={data.courseSlug}
						courseName={data.course.name}
						courseLogoUrl={data.course.logo_url}
						courseColors={{
							accentDark: data.course.accent_dark || '#334642',
							accentLight: data.course.accent_light || '#eae2d9',
							accentDarkest: data.course.accent_darkest || '#1e2322'
						}}
						contextData={{ course: data.course, cohorts: data.cohorts }}
						currentUserEmail={data.currentUserEmail}
						onSave={handleSaveTemplate}
						onCancel={() => handleViewChange('logs')}
					/>
				</div>
			</div>

		{:else}
			<!-- Fallback -->
			<div class="p-8">
				<div class="bg-white rounded-lg p-12 text-center">
					<p class="text-gray-500">Template not found</p>
				</div>
			</div>
		{/if}
	</div>
</div>

<!-- Delete Confirmation Modal -->
<ConfirmationModal
	show={showDeleteConfirm}
	onConfirm={confirmDelete}
	onCancel={() => {
		showDeleteConfirm = false;
		templateToDelete = null;
	}}
>
	<p class="text-gray-700">
		Are you sure you want to delete the template
		<strong class="text-gray-900">{templateToDelete?.name}</strong>?
	</p>
	<p class="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
</ConfirmationModal>

<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { Mail, ChevronRight, History } from '$lib/icons';
	import EmailTemplateEditor from '$lib/components/EmailTemplateEditor.svelte';

	let { data } = $props();

	// DGR branding - use platform logo
	const DGR_BRANDING = $derived({
		name: 'Daily Gospel Reflections',
		logoUrl: data.platformLogo,
		accentDark: '#009199',
		footerText: "You're receiving this because you're a DGR contributor."
	});

	// Get selected view from URL params
	const selectedView = $derived($page.url.searchParams.get('view') || '');

	// Find selected template (if not viewing logs)
	const selectedTemplate = $derived(
		selectedView && selectedView !== 'logs'
			? data.templates.find((t) => t.id === selectedView)
			: null
	);

	function selectView(view) {
		const url = new URL($page.url);
		if (view) {
			url.searchParams.set('view', view);
		} else {
			url.searchParams.delete('view');
		}
		goto(url.toString());
	}

	function clearSelection() {
		const url = new URL($page.url);
		url.searchParams.delete('view');
		goto(url.toString());
	}

	async function handleSave() {
		// Refresh page data after save
		goto($page.url.toString(), { invalidateAll: true });
	}

	// Template info helper
	function getTemplateInfo(templateKey) {
		switch (templateKey) {
			case 'welcome':
				return {
					description: 'Sent to new contributors with their personal writing portal link',
					usedBy: 'Contributors page → Send Welcome Email'
				};
			case 'reminder':
				return {
					description: 'Sent to remind contributors of upcoming reflection due dates',
					usedBy: 'Schedule page → Send Reminder'
				};
			default:
				return {
					description: 'Custom email template',
					usedBy: 'Manual sending'
				};
		}
	}
</script>

<svelte:head>
	<title>Email Templates | DGR Admin</title>
</svelte:head>

<!-- Apply DGR accent color CSS variable -->
<div class="h-screen flex bg-gray-50" style="--course-accent-dark: {DGR_BRANDING.accentDark};">
	<!-- Left Sidebar - Template List -->
	<div class="w-72 border-r flex-shrink-0 bg-white">
		<div class="p-4">
			<div class="flex items-center gap-3 mb-6 px-2">
				<div class="flex h-10 w-10 items-center justify-center rounded-full" style="background-color: {DGR_BRANDING.accentDark};">
					<Mail class="h-5 w-5 text-white" />
				</div>
				<div>
					<h1 class="text-lg font-bold text-gray-900">Email Templates</h1>
					<p class="text-xs text-gray-500">DGR Contributors</p>
				</div>
			</div>

			<!-- Logs Link -->
			<button
				onclick={() => selectView('logs')}
				class="w-full text-left px-3 py-3 rounded-lg transition-all mb-4 {selectedView === 'logs'
					? 'bg-teal-50 text-teal-900 border border-teal-200'
					: 'text-gray-700 hover:bg-gray-100'}"
			>
				<div class="flex items-center gap-2">
					<History class="h-4 w-4" />
					<span class="font-medium">Email Logs</span>
				</div>
			</button>

			<div class="border-t border-gray-200 pt-4 mb-2">
				<div class="px-2 text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Templates</div>
			</div>

			<!-- Template List -->
			<div class="space-y-1">
				{#each data.templates as template}
					{@const isSelected = selectedView === template.id}
					<button
						onclick={() => selectView(template.id)}
						class="w-full text-left px-3 py-3 rounded-lg transition-all {isSelected
							? 'bg-teal-50 text-teal-900 border border-teal-200'
							: 'text-gray-700 hover:bg-gray-100'}"
					>
						<div class="flex items-center justify-between">
							<div class="flex-1 min-w-0">
								<div class="font-medium truncate">{template.name}</div>
								<div class="text-xs mt-0.5 truncate {isSelected ? 'text-teal-600' : 'text-gray-500'}">
									{getTemplateInfo(template.template_key).description.slice(0, 40)}...
								</div>
							</div>
							<ChevronRight class="h-4 w-4 flex-shrink-0 {isSelected ? 'text-teal-500' : 'text-gray-400'}" />
						</div>
					</button>
				{:else}
					<div class="px-3 py-6 text-center text-gray-500 text-sm">
						No email templates found
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Main Content Area -->
	<div class="flex-1 overflow-y-auto">
		{#if selectedView === 'logs'}
			<!-- Email Logs View -->
			<div class="p-8">
				<h2 class="text-2xl font-bold text-gray-900 mb-2">Email Logs</h2>
				<p class="text-gray-600 mb-6">History of all DGR emails sent to contributors</p>

				<div class="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-200">
					{#if (data.emailLogs || []).length === 0}
						<div class="p-12 text-center">
							<History class="h-12 w-12 text-gray-300 mx-auto mb-4" />
							<p class="text-gray-500">No emails sent yet</p>
							<p class="text-sm text-gray-400 mt-2">Emails sent to contributors will appear here</p>
						</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="w-full">
								<thead>
									<tr class="border-b border-gray-200 bg-teal-50">
										<th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-900">
											Date & Time
										</th>
										<th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-900">
											Recipient
										</th>
										<th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-900">
											Subject
										</th>
										<th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-900">
											Template
										</th>
										<th class="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-teal-900">
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
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
														{log.email_templates.name}
													</span>
												{:else}
													<span class="text-gray-400 italic">No template</span>
												{/if}
											</td>
											<td class="px-6 py-4 whitespace-nowrap text-sm">
												{#if log.status === 'sent'}
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
														Sent
													</span>
												{:else if log.status === 'failed'}
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800" title={log.error_message || 'Unknown error'}>
														Failed
													</span>
												{:else if log.status === 'pending'}
													<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
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
		{:else if selectedTemplate}
			<!-- Template Editor -->
			<div class="p-8">
				<div class="mb-6">
					<h2 class="text-2xl font-bold text-gray-900 mb-1">{selectedTemplate.name}</h2>
					<p class="text-gray-600">{getTemplateInfo(selectedTemplate.template_key).description}</p>
					<p class="text-xs text-gray-500 mt-2">
						Used by: {getTemplateInfo(selectedTemplate.template_key).usedBy}
					</p>
				</div>

				<div class="bg-white rounded-xl p-8 shadow-sm border border-gray-200 overflow-visible">
					<EmailTemplateEditor
						template={selectedTemplate}
						context="dgr"
						apiBaseUrl="/api/dgr/templates"
						branding={DGR_BRANDING}
						currentUserEmail={data.currentUserEmail}
						onSave={handleSave}
						onCancel={clearSelection}
					/>
				</div>
			</div>
		{:else}
			<!-- No template selected - show overview -->
			<div class="p-8">
				<div class="mb-8">
					<h2 class="text-2xl font-bold text-gray-900 mb-2">DGR Email Templates</h2>
					<p class="text-gray-600">
						Select a template from the sidebar to edit. These emails are sent to DGR contributors.
					</p>
				</div>

				<!-- Template Cards -->
				<div class="grid gap-4">
					{#each data.templates as template}
						{@const info = getTemplateInfo(template.template_key)}
						<button
							onclick={() => selectTemplate(template.id)}
							class="bg-white rounded-xl p-6 text-left hover:shadow-lg transition-shadow"
						>
							<div class="flex items-start justify-between">
								<div class="flex-1">
									<div class="flex items-center gap-3 mb-2">
										<h3 class="text-lg font-semibold text-gray-900">{template.name}</h3>
										{#if template.is_active}
											<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
												Active
											</span>
										{/if}
									</div>
									<p class="text-gray-600 text-sm mb-3">{info.description}</p>
									<div class="text-xs text-gray-500">
										<span class="font-medium">Used by:</span> {info.usedBy}
									</div>
								</div>
								<ChevronRight class="h-5 w-5 text-gray-400 flex-shrink-0" />
							</div>

							<!-- Subject preview -->
							<div class="mt-4 pt-4 border-t border-gray-100">
								<div class="text-xs font-medium text-gray-500 mb-1">Subject Line:</div>
								<div class="text-sm text-gray-700 font-mono bg-gray-50 px-3 py-2 rounded truncate">
									{template.subject_template || '(No subject set)'}
								</div>
							</div>
						</button>
					{:else}
						<div class="bg-white rounded-xl p-12 text-center">
							<Mail class="h-12 w-12 text-gray-300 mx-auto mb-4" />
							<h3 class="text-lg font-medium text-gray-900 mb-2">No email templates</h3>
							<p class="text-gray-500">DGR email templates haven't been created yet.</p>
						</div>
					{/each}
				</div>

				<!-- Variables Reference -->
				<div class="mt-8 bg-white rounded-xl p-6 border border-gray-200">
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Available Variables</h3>
					<p class="text-sm text-gray-600 mb-4">
						Use these variables in your templates with double curly braces: <code class="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800">{'{{variable_name}}'}</code>
					</p>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
						{#each [
							{ key: 'contributor_name', desc: 'Full name' },
							{ key: 'contributor_first_name', desc: 'First name only' },
							{ key: 'contributor_email', desc: 'Email address' },
							{ key: 'write_url', desc: 'Personal portal link' },
							{ key: 'write_url_button', desc: 'Styled button HTML' },
							{ key: 'due_date', desc: 'Formatted due date' },
							{ key: 'due_date_text', desc: '"tomorrow", "in 3 days"' }
						] as variable}
							<div class="flex items-center gap-2">
								<code class="text-teal-700 font-mono text-sm bg-teal-50 px-2 py-0.5 rounded">{variable.key}</code>
								<span class="text-sm text-gray-600">{variable.desc}</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

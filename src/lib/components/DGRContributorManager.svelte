<script>
	import { toast } from '$lib/stores/toast.svelte.js';
	import { Copy, ExternalLink, RefreshCw, Plus, ChevronDown, ChevronUp, Upload, Mail, MailCheck, Eye, Send, AlertCircle, Loader2, Settings } from 'lucide-svelte';
	import DGRContributorsCsvUpload from './DGRContributorsCsvUpload.svelte';
	import ConfirmationModal from './ConfirmationModal.svelte';
	import DGRTemplateEditorModal from './DGRTemplateEditorModal.svelte';

	let {
		contributors = [],
		dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
		onAddContributor = () => {},
		onUpdateContributor = () => {},
		onBulkImport = () => {},
		onRefresh = () => {}
	} = $props();

	let showImportModal = $state(false);
	let sendingWelcomeIds = $state(new Set()); // Track which contributors are being sent to
	let showBulkWelcomeConfirm = $state(false);
	let selectedForWelcome = $state([]);
	let showSingleWelcomeConfirm = $state(false);
	let singleWelcomeTarget = $state(null); // For single send confirmation
	let isResend = $state(false); // Track if this is a resend
	let showTemplateEditor = $state(false);
	let welcomeTemplate = $state(null);
	let loadingTemplate = $state(false);

	let newContributor = $state({
		name: '',
		email: '',
		schedule_pattern: null,
		pattern_value: null,
		notes: ''
	});

	let formExpanded = $state(false);

	async function handleAddContributor() {
		if (!newContributor.name || !newContributor.email) {
			toast.error({
				title: 'Missing Information',
				message: 'Please provide both name and email',
				duration: 3000
			});
			return;
		}

		// Build schedule_pattern JSON if pattern is selected
		let schedule_pattern = null;
		if (newContributor.schedule_pattern === 'day_of_month' && newContributor.pattern_value) {
			schedule_pattern = { type: 'day_of_month', value: parseInt(newContributor.pattern_value) };
		} else if (newContributor.schedule_pattern === 'day_of_week' && newContributor.pattern_value !== null) {
			schedule_pattern = { type: 'day_of_week', value: parseInt(newContributor.pattern_value) };
		}

		await onAddContributor({ ...newContributor, schedule_pattern });

		// Reset form and collapse
		newContributor = {
			name: '',
			email: '',
			schedule_pattern: null,
			pattern_value: null,
			notes: ''
		};
		formExpanded = false;
	}

	async function handlePatternChange(contributor, patternType, patternValue) {
		let schedule_pattern = null;
		if (patternType === 'day_of_month' && patternValue) {
			schedule_pattern = { type: 'day_of_month', value: parseInt(patternValue) };
		} else if (patternType === 'day_of_week' && patternValue !== null) {
			schedule_pattern = { type: 'day_of_week', value: parseInt(patternValue) };
		}
		await onUpdateContributor(contributor.id, { schedule_pattern });
	}

	function getContributorLink(contributor) {
		if (!contributor.access_token) return null;
		return `${window.location.origin}/dgr/write/${contributor.access_token}`;
	}

	function copyLink(contributor) {
		const link = getContributorLink(contributor);
		if (link) {
			navigator.clipboard.writeText(link).then(() => {
				toast.success({
					title: 'Link Copied!',
					message: 'Contributor link copied to clipboard',
					duration: 2000
				});
			});
		}
	}

	function getPatternDescription(pattern) {
		if (!pattern) return 'Manual assignment only';
		if (pattern.type === 'day_of_month') return `Every ${pattern.value}${getOrdinalSuffix(pattern.value)} of month`;
		if (pattern.type === 'day_of_week') return `Every ${dayNames[pattern.value]}`;
		return 'Manual assignment';
	}

	function getOrdinalSuffix(num) {
		const j = num % 10;
		const k = num % 100;
		if (j === 1 && k !== 11) return 'st';
		if (j === 2 && k !== 12) return 'nd';
		if (j === 3 && k !== 13) return 'rd';
		return 'th';
	}

	async function handleBulkImport(contributorsData) {
		try {
			const response = await fetch('/api/dgr-admin/contributors', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'bulk_import',
					contributors: contributorsData
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			showImportModal = false;

			if (data.results.successful > 0) {
				toast.success({
					title: 'Import Complete',
					message: `${data.results.successful} contributor(s) added successfully${data.results.failed > 0 ? `, ${data.results.failed} skipped` : ''}`,
					duration: 4000
				});
			}

			if (data.results.failed > 0 && data.results.successful === 0) {
				toast.error({
					title: 'Import Failed',
					message: `All ${data.results.failed} entries failed. Check for duplicates.`,
					duration: 4000
				});
			}

			await onBulkImport();
		} catch (error) {
			toast.error({
				title: 'Import Failed',
				message: error.message,
				duration: 4000
			});
		}
	}

	// Welcome email functions
	async function sendWelcomeEmail(contributorIds, contributorName = null) {
		// Add IDs to sending set
		contributorIds.forEach(id => {
			sendingWelcomeIds = new Set([...sendingWelcomeIds, id]);
		});

		try {
			const response = await fetch('/api/dgr/welcome', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ contributorIds })
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			if (data.results.sent > 0) {
				// For single sends, show the contributor's name
				const message = contributorName
					? `Welcome email sent to ${contributorName}`
					: `${data.results.sent} email(s) sent successfully`;
				toast.success({
					title: isResend ? 'Welcome Email Resent' : 'Welcome Email Sent',
					message,
					duration: 4000
				});
			}

			if (data.results.skipped > 0) {
				toast.warning({
					title: 'Some Skipped',
					message: `${data.results.skipped} contributor(s) skipped (no access token)`,
					duration: 4000
				});
			}

			if (data.results.failed > 0) {
				toast.error({
					title: 'Some Failed',
					message: `${data.results.failed} email(s) failed to send`,
					duration: 4000
				});
			}

			// Refresh contributor list to show updated status
			await onRefresh();
		} catch (error) {
			toast.error({
				title: 'Send Failed',
				message: error.message,
				duration: 4000
			});
		} finally {
			// Remove IDs from sending set
			const newSet = new Set(sendingWelcomeIds);
			contributorIds.forEach(id => newSet.delete(id));
			sendingWelcomeIds = newSet;

			showBulkWelcomeConfirm = false;
			showSingleWelcomeConfirm = false;
			selectedForWelcome = [];
			singleWelcomeTarget = null;
			isResend = false;
		}
	}

	function handleSendSingleWelcome(contributor, resend = false) {
		singleWelcomeTarget = contributor;
		isResend = resend;
		showSingleWelcomeConfirm = true;
	}

	function confirmSingleWelcome() {
		if (singleWelcomeTarget) {
			sendWelcomeEmail([singleWelcomeTarget.id], singleWelcomeTarget.name);
		}
	}

	function handleBulkWelcomeClick() {
		// Get all contributors who haven't received a welcome email
		selectedForWelcome = contributors
			.filter(c => c.active && c.access_token && !c.welcome_email_sent_at)
			.map(c => c.id);

		if (selectedForWelcome.length === 0) {
			toast.warning({
				title: 'No Recipients',
				message: 'All active contributors have already received welcome emails',
				duration: 3000
			});
			return;
		}

		showBulkWelcomeConfirm = true;
	}

	function confirmBulkWelcome() {
		sendWelcomeEmail(selectedForWelcome);
	}

	function formatDate(dateStr) {
		if (!dateStr) return null;
		const date = new Date(dateStr);
		return date.toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short'
		});
	}

	function formatRelativeTime(dateStr) {
		if (!dateStr) return null;
		const date = new Date(dateStr);
		const now = new Date();
		const diffMs = now - date;
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffMinutes = Math.floor(diffMs / (1000 * 60));

		if (diffMinutes < 1) return 'Just now';
		if (diffMinutes < 60) return `${diffMinutes}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
		return formatDate(dateStr);
	}

	// Helper to check if contributor needs follow-up (welcomed but never visited)
	function needsFollowUp(contributor) {
		if (!contributor.welcome_email_sent_at) return false;
		if (contributor.last_visited_at) return false;
		// If welcomed more than 3 days ago and never visited
		const welcomedDate = new Date(contributor.welcome_email_sent_at);
		const daysSinceWelcome = (new Date() - welcomedDate) / (1000 * 60 * 60 * 24);
		return daysSinceWelcome > 3;
	}

	// Derived values
	let unwelcomedCount = $derived(
		contributors.filter(c => c.active && c.access_token && !c.welcome_email_sent_at).length
	);

	let welcomedCount = $derived(
		contributors.filter(c => c.welcome_email_sent_at).length
	);

	let visitedCount = $derived(
		contributors.filter(c => c.last_visited_at).length
	);

	let needsFollowUpCount = $derived(
		contributors.filter(c => needsFollowUp(c)).length
	);

	// Check if any sends are in progress
	let isSending = $derived(sendingWelcomeIds.size > 0);

	// Template editor functions
	async function openTemplateEditor() {
		loadingTemplate = true;
		try {
			const response = await fetch('/api/dgr/templates?key=welcome');
			const data = await response.json();

			if (data.error) throw new Error(data.error);

			welcomeTemplate = data.template;
			showTemplateEditor = true;
		} catch (error) {
			toast.error({
				title: 'Failed to load template',
				message: error.message,
				duration: 4000
			});
		} finally {
			loadingTemplate = false;
		}
	}

	function handleTemplateSave(updatedTemplate) {
		welcomeTemplate = updatedTemplate;
	}
</script>

<div class="space-y-6">
	<!-- Action Buttons -->
	<div class="flex gap-3 flex-wrap">
		<button
			onclick={() => (formExpanded = !formExpanded)}
			class="flex flex-1 min-w-[200px] items-center gap-3 rounded-lg bg-white p-4 shadow-sm hover:bg-gray-50 transition-colors"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
				<Plus class="h-5 w-5 text-green-600" />
			</div>
			<div class="text-left">
				<h2 class="font-semibold text-gray-900">Add Single</h2>
				<p class="text-sm text-gray-500">Add one contributor</p>
			</div>
		</button>

		<button
			onclick={() => (showImportModal = true)}
			class="flex flex-1 min-w-[200px] items-center gap-3 rounded-lg bg-white p-4 shadow-sm hover:bg-gray-50 transition-colors"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
				<Upload class="h-5 w-5 text-blue-600" />
			</div>
			<div class="text-left">
				<h2 class="font-semibold text-gray-900">Bulk Import</h2>
				<p class="text-sm text-gray-500">Import from CSV</p>
			</div>
		</button>

		<button
			onclick={handleBulkWelcomeClick}
			disabled={isSending || unwelcomedCount === 0}
			class="flex flex-1 min-w-[200px] items-center gap-3 rounded-lg bg-white p-4 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
				{#if isSending}
					<Loader2 class="h-5 w-5 text-purple-600 animate-spin" />
				{:else}
					<Send class="h-5 w-5 text-purple-600" />
				{/if}
			</div>
			<div class="text-left">
				<h2 class="font-semibold text-gray-900">Send Welcome Emails</h2>
				<p class="text-sm text-gray-500">
					{#if isSending}
						Sending...
					{:else if unwelcomedCount > 0}
						{unwelcomedCount} pending
					{:else}
						All sent
					{/if}
				</p>
			</div>
		</button>

		<button
			onclick={openTemplateEditor}
			disabled={loadingTemplate}
			class="flex flex-1 min-w-[200px] items-center gap-3 rounded-lg bg-white p-4 shadow-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
		>
			<div class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
				{#if loadingTemplate}
					<Loader2 class="h-5 w-5 text-gray-600 animate-spin" />
				{:else}
					<Settings class="h-5 w-5 text-gray-600" />
				{/if}
			</div>
			<div class="text-left">
				<h2 class="font-semibold text-gray-900">Edit Template</h2>
				<p class="text-sm text-gray-500">Customize welcome email</p>
			</div>
		</button>
	</div>

	<!-- Stats Summary -->
	{#if contributors.length > 0}
		<div class="flex flex-wrap gap-4 text-sm">
			<div class="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1">
				<span class="font-medium text-gray-700">{contributors.length}</span>
				<span class="text-gray-500">total</span>
			</div>
			<div class="flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1">
				<MailCheck class="h-3.5 w-3.5 text-purple-600" />
				<span class="font-medium text-purple-700">{welcomedCount}</span>
				<span class="text-purple-600">welcomed</span>
			</div>
			<div class="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1">
				<Eye class="h-3.5 w-3.5 text-blue-600" />
				<span class="font-medium text-blue-700">{visitedCount}</span>
				<span class="text-blue-600">visited</span>
			</div>
			{#if needsFollowUpCount > 0}
				<div class="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1">
					<AlertCircle class="h-3.5 w-3.5 text-amber-600" />
					<span class="font-medium text-amber-700">{needsFollowUpCount}</span>
					<span class="text-amber-600">need follow-up</span>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Add Contributor Form -->
	<div class="rounded-lg bg-white shadow-sm {formExpanded ? '' : 'hidden'}">
		<div class="flex items-center justify-between border-b border-gray-200 p-4">
			<h3 class="font-semibold text-gray-900">Add New Contributor</h3>
			<button onclick={() => (formExpanded = false)} class="text-gray-400 hover:text-gray-600">
				<ChevronUp class="h-5 w-5" />
			</button>
		</div>

		<div class="p-6">
			<div class="space-y-4">
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label for="contributor-name" class="mb-1 block text-sm font-medium text-gray-700">Name</label>
							<input
								id="contributor-name"
								type="text"
								bind:value={newContributor.name}
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								placeholder="Sr. Mary Catherine"
							/>
						</div>
						<div>
							<label for="contributor-email" class="mb-1 block text-sm font-medium text-gray-700">Email</label>
							<input
								id="contributor-email"
								type="email"
								bind:value={newContributor.email}
								class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								placeholder="contributor@example.com"
							/>
						</div>
					</div>

					<div>
						<label for="pattern-type" class="mb-1 block text-sm font-medium text-gray-700">
							Schedule Pattern
						</label>
						<div class="grid grid-cols-2 gap-4">
							<select
								id="pattern-type"
								bind:value={newContributor.schedule_pattern}
								class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								<option value={null}>Manual assignment only</option>
								<option value="day_of_month">Day of Month</option>
								<option value="day_of_week">Day of Week</option>
							</select>

							{#if newContributor.schedule_pattern === 'day_of_month'}
								<select
									bind:value={newContributor.pattern_value}
									class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								>
									<option value={null}>Select day...</option>
									{#each Array.from({ length: 31 }, (_, i) => i + 1) as day}
										<option value={day}>{day}{getOrdinalSuffix(day)}</option>
									{/each}
								</select>
							{:else if newContributor.schedule_pattern === 'day_of_week'}
								<select
									bind:value={newContributor.pattern_value}
									class="rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								>
									<option value={null}>Select day...</option>
									{#each dayNames as day, index}
										<option value={index}>{day}</option>
									{/each}
								</select>
							{/if}
						</div>
						<p class="mt-1 text-xs text-gray-500">
							Set a recurring schedule pattern, or leave as manual for ad-hoc assignments
						</p>
					</div>

					<div>
						<label for="contributor-notes" class="mb-1 block text-sm font-medium text-gray-700">Notes</label>
						<textarea
							id="contributor-notes"
							bind:value={newContributor.notes}
							rows="2"
							class="w-full rounded-md border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							placeholder="Any additional notes or preferences..."
						></textarea>
					</div>

					<button
						onclick={handleAddContributor}
						class="rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:outline-none"
					>
						Add Contributor
					</button>
				</div>
			</div>
	</div>

	<!-- Contributors List -->
	<div class="overflow-hidden rounded-lg bg-white shadow-sm">
		<div class="border-b border-gray-200 px-6 py-4">
			<h2 class="text-lg font-semibold">Contributors</h2>
		</div>

		{#if contributors.length === 0}
			<div class="px-6 py-8 text-center text-gray-500">
				No contributors found. Add some contributors to get started.
			</div>
		{:else}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Name
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Email
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Pattern
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Welcome Email
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Last Visit
							</th>
							<th class="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-200 bg-white">
						{#each contributors as contributor (contributor.id)}
							{@const isSendingThis = sendingWelcomeIds.has(contributor.id)}
							{@const followUp = needsFollowUp(contributor)}
							<tr class="{!contributor.active ? 'bg-gray-50 opacity-60' : ''} {followUp ? 'bg-amber-50/50' : ''}">
								<td class="px-4 py-3 whitespace-nowrap">
									<div class="flex items-center gap-2">
										<div class="text-sm font-medium text-gray-900">{contributor.name}</div>
										{#if !contributor.active}
											<span class="inline-flex rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
												Inactive
											</span>
										{/if}
										{#if followUp}
											<span class="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700" title="Welcomed but never visited - may need follow-up">
												<AlertCircle class="h-2.5 w-2.5" />
												Follow up
											</span>
										{/if}
									</div>
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									<div class="text-sm text-gray-500">{contributor.email}</div>
								</td>
								<td class="px-4 py-3">
									<div class="text-xs text-gray-600">
										{getPatternDescription(contributor.schedule_pattern)}
									</div>
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									{#if isSendingThis}
										<div class="flex items-center gap-1.5 text-purple-600">
											<Loader2 class="h-4 w-4 animate-spin" />
											<span class="text-xs">Sending...</span>
										</div>
									{:else if contributor.welcome_email_sent_at}
										<div class="group flex items-center gap-1.5">
											<div class="flex items-center gap-1.5 text-green-600" title={`Sent ${formatDate(contributor.welcome_email_sent_at)}`}>
												<MailCheck class="h-4 w-4" />
												<span class="text-xs">{formatRelativeTime(contributor.welcome_email_sent_at)}</span>
											</div>
											<button
												onclick={() => handleSendSingleWelcome(contributor, true)}
												class="ml-1 rounded p-0.5 text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
												title="Resend welcome email"
											>
												<RefreshCw class="h-3 w-3" />
											</button>
										</div>
									{:else if contributor.access_token}
										<button
											onclick={() => handleSendSingleWelcome(contributor, false)}
											disabled={isSending}
											class="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 disabled:opacity-50"
										>
											<Mail class="h-3 w-3" />
											Send
										</button>
									{:else}
										<span class="text-xs text-gray-400">No token</span>
									{/if}
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									{#if contributor.last_visited_at}
										<div class="flex items-center gap-1.5 text-blue-600" title={`Last visit: ${formatDate(contributor.last_visited_at)}`}>
											<Eye class="h-4 w-4" />
											<div>
												<div class="text-xs">{formatRelativeTime(contributor.last_visited_at)}</div>
												{#if contributor.visit_count > 1}
													<div class="text-[10px] text-gray-500">{contributor.visit_count} visits</div>
												{/if}
											</div>
										</div>
									{:else}
										<span class="text-xs text-gray-400">Never</span>
									{/if}
								</td>
								<td class="px-4 py-3 whitespace-nowrap">
									{#if contributor.access_token}
										<div class="flex items-center gap-2">
											<button
												onclick={() => copyLink(contributor)}
												class="inline-flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
												title="Copy contributor link"
											>
												<Copy class="h-3 w-3" />
												Copy
											</button>
											<a
												href={getContributorLink(contributor)}
												target="_blank"
												class="inline-flex items-center rounded bg-gray-50 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100"
												title="Open link"
											>
												<ExternalLink class="h-3 w-3" />
											</a>
										</div>
									{:else}
										<span class="text-xs text-gray-400">-</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>

<!-- Import Modal -->
{#if showImportModal}
	<DGRContributorsCsvUpload
		onUpload={handleBulkImport}
		onClose={() => (showImportModal = false)}
	/>
{/if}

<!-- Single Welcome Email Confirmation -->
<ConfirmationModal
	show={showSingleWelcomeConfirm}
	onConfirm={confirmSingleWelcome}
	onCancel={() => { showSingleWelcomeConfirm = false; singleWelcomeTarget = null; isResend = false; }}
	confirmText={isSending ? 'Sending...' : (isResend ? 'Resend Email' : 'Send Email')}
	confirmDisabled={isSending}
	title={isResend ? 'Resend Welcome Email' : 'Send Welcome Email'}
>
	{#if singleWelcomeTarget}
		<p class="text-gray-600">
			{#if isResend}
				Resend the welcome email to <strong>{singleWelcomeTarget.name}</strong>?
			{:else}
				Send a welcome email to <strong>{singleWelcomeTarget.name}</strong> ({singleWelcomeTarget.email})?
			{/if}
		</p>
		{#if isResend}
			<p class="mt-2 text-sm text-gray-500">
				They were previously sent a welcome email {formatRelativeTime(singleWelcomeTarget.welcome_email_sent_at)}.
				{#if !singleWelcomeTarget.last_visited_at}
					They haven't visited their page yet.
				{/if}
			</p>
		{:else}
			<p class="mt-2 text-sm text-gray-500">
				The email includes their personal link to view assigned dates and submit reflections.
			</p>
		{/if}
	{/if}
</ConfirmationModal>

<!-- Bulk Welcome Email Confirmation -->
<ConfirmationModal
	show={showBulkWelcomeConfirm}
	onConfirm={confirmBulkWelcome}
	onCancel={() => { showBulkWelcomeConfirm = false; selectedForWelcome = []; }}
	confirmText={isSending ? 'Sending...' : 'Send Emails'}
	confirmDisabled={isSending}
	title="Send Welcome Emails"
>
	<p class="text-gray-600">
		This will send welcome emails to <strong>{selectedForWelcome.length}</strong> contributor{selectedForWelcome.length !== 1 ? 's' : ''} who haven't received one yet.
	</p>
	<p class="mt-2 text-sm text-gray-500">
		Each email includes their personal link to view assigned dates and submit reflections.
	</p>
</ConfirmationModal>

<!-- Template Editor Modal -->
<DGRTemplateEditorModal
	show={showTemplateEditor}
	template={welcomeTemplate}
	onClose={() => showTemplateEditor = false}
	onSave={handleTemplateSave}
/>
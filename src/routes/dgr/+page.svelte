<script>
	import { toast, DURATIONS } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGRReviewModal from '$lib/components/DGRReviewModal.svelte';
	import DGRScheduleTable from '$lib/components/DGRScheduleTable.svelte';
	import DGRContributorManager from '$lib/components/DGRContributorManager.svelte';
	import DGRPromoTilesEditor from '$lib/components/DGRPromoTilesEditor.svelte';
	import DGRAssignmentRules from '$lib/components/DGRAssignmentRules.svelte';
	import DGREditor from '$lib/components/DGREditor.svelte';
	import DGRNavigation from '$lib/components/DGRNavigation.svelte';
	import ContextualHelp from '$lib/components/ContextualHelp.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import { decodeHtmlEntities } from '$lib/utils/html.js';
	import { getHelpForPage, getPageTitle } from '$lib/data/help-content.js';
	import { getInitialDGRFormData, generateDGRHTML, cleanGospelText } from '$lib/utils/dgr-utils.js';
	import { formatContributorName } from '$lib/utils/dgr-helpers';
	import PreviewPanel from '$lib/components/PreviewPanel.svelte';
	import { Eye, Send, ExternalLink, Trash2, PlusCircle, Calendar } from '$lib/icons';

	let schedule = $state([]);
	let contributors = $state([]);
	let assignmentRules = $state([]);
	let loading = $state(true);
	let activeSection = $state('schedule');
	let activeSubSection = $state('schedule');
	let reviewModalOpen = $state(false);
	let selectedReflection = $state(null);
	let confirmDeleteModal = $state({ open: false, entry: null });
	let editReadingsModal = $state({
		open: false,
		entry: null,
		firstReading: '',
		psalm: '',
		secondReading: '',
		gospel: ''
	});
	let sendReminderConfirmModal = $state({ open: false, entry: null, message: '' });

	// Quick Add modal state
	let quickAddModalOpen = $state(false);
	let quickAddEntry = $state(null);
	let quickAddFormData = $state(getInitialDGRFormData());
	let quickAddSaving = $state(false);
	let quickAddResult = $state(null);
	let quickAddUseNewDesign = $state(true);
	let quickAddFetchingGospel = $state(false);
	let quickAddGospelFullText = $state('');
	let quickAddGospelReference = $state('');
	let quickAddPromoTiles = $state([]);
	let quickAddPreviewHtml = $state('');

	// Preview modal state
	let previewModalOpen = $state(false);
	let previewEntry = $state(null);
	let previewHtml = $state('');
	let previewLoading = $state(false);

	// Promo tiles state - start with 1 tile, can add up to 3
	let promoTiles = $state([
		{ position: 1, image_url: '', title: '', link_url: '' }
	]);
	let savingTiles = $state(false);

	// Filter state: 'all', 'needs_review', 'approved', 'published', 'unassigned'
	let scheduleFilter = $state('all');
	let scheduleDays = $state(90); // Show 90 days by default

	// Form states
	let newContributor = $state({
		name: '',
		email: '',
		preferred_days: [],
		day_of_month: null,
		notes: ''
	});

	const statusColors = {
		pending: 'bg-yellow-100 text-yellow-800',
		submitted: 'bg-blue-100 text-blue-800',
		approved: 'bg-green-100 text-green-800',
		published: 'bg-purple-100 text-purple-800'
	};

	const statusOptions = [
		{ value: 'pending', label: 'Pending' },
		{ value: 'submitted', label: 'Needs Approval' },
		{ value: 'approved', label: 'Approved' },
		{ value: 'published', label: 'Published' }
	];

	$effect(() => {
		(async () => {
			await Promise.all([loadSchedule(), loadContributors(), loadPromoTiles(), loadAssignmentRules()]);
			loading = false;
		})();
	});

	async function loadSchedule() {
		try {
			const response = await fetch(`/api/dgr-admin/schedule?days=${scheduleDays}`);
			const data = await response.json();

			if (data.error) throw new Error(data.error);

			// Transform calendar response into flat schedule array for the table
			schedule = (data.calendar || []).map((cal) => {
				const base = {
					date: cal.date,
					liturgical_season: cal.liturgical_season,
					liturgical_week: cal.liturgical_week,
					liturgical_name: cal.liturgical_day,
					liturgical_rank: cal.liturgical_rank,
					readings: cal.readings
				};

				if (cal.schedule) {
					// Has actual schedule row
					return {
						...cal.schedule,
						...base,
						from_pattern: false
					};
				} else if (cal.pattern_contributor) {
					// Pattern-based (virtual)
					return {
						...base,
						contributor_id: cal.pattern_contributor.id,
						contributor: {
							name: cal.pattern_contributor.name,
							title: cal.pattern_contributor.title,
							email: cal.pattern_contributor.email,
							access_token: cal.pattern_contributor.access_token
						},
						from_pattern: true
					};
				} else {
					// Unassigned date
					return {
						...base,
						contributor_id: null,
						contributor: null,
						from_pattern: false
					};
				}
			});
		} catch (error) {
			toast.error({
				title: 'Failed to load schedule',
				message: error.message,
				duration: DURATIONS.medium
			});
		}
	}

	// Computed filtered schedule based on filter selection
	let filteredSchedule = $derived.by(() => {
		switch (scheduleFilter) {
			case 'needs_review':
				return schedule.filter(e => e.status === 'submitted');
			case 'approved':
				return schedule.filter(e => e.status === 'approved');
			case 'published':
				return schedule.filter(e => e.status === 'published');
			case 'unassigned':
				return schedule.filter(e => !e.contributor_id);
			default:
				return schedule;
		}
	});

	// Filter counts for badges
	let filterCounts = $derived({
		all: schedule.length,
		needs_review: schedule.filter(e => e.status === 'submitted').length,
		approved: schedule.filter(e => e.status === 'approved').length,
		published: schedule.filter(e => e.status === 'published').length,
		unassigned: schedule.filter(e => !e.contributor_id).length
	});

	async function loadContributors() {
		try {
			const response = await fetch('/api/dgr-admin/contributors');
			const data = await response.json();

			if (data.error) throw new Error(data.error);
			contributors = data.contributors || [];
		} catch (error) {
			toast.error({
				title: 'Failed to load contributors',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function loadPromoTiles() {
		try {
			const response = await fetch('/api/dgr-admin/promo-tiles');
			const data = await response.json();

			if (data.error) throw new Error(data.error);

			// Update the promoTiles array with fetched data
			if (data.tiles && data.tiles.length > 0) {
				// Only include tiles that have image URLs (not empty ones)
				const activeTiles = data.tiles.filter(tile => tile.image_url);
				if (activeTiles.length > 0) {
					promoTiles = activeTiles.map(tile => ({
						position: tile.position,
						image_url: tile.image_url || '',
						title: tile.title || '',
						link_url: tile.link_url || ''
					}));
				} else {
					// No active tiles, start with one empty tile
					promoTiles = [{ position: 1, image_url: '', title: '', link_url: '' }];
				}
			}
		} catch (error) {
			console.error('Failed to load promo tiles:', error);
		}
	}

	async function loadAssignmentRules() {
		try {
			const response = await fetch('/api/dgr-admin/assignment-rules');
			const data = await response.json();

			if (data.error) throw new Error(data.error);
			assignmentRules = data.rules || [];
		} catch (error) {
			console.error('Failed to load assignment rules:', error);
			toast.error({
				title: 'Failed to load rules',
				message: error.message,
				duration: 3000
			});
		}
	}

	async function savePromoTiles() {
		savingTiles = true;
		const loadingId = toast.loading({
			title: 'Saving promo tiles...',
			message: 'Updating promotional content'
		});

		try {
			// Only save tiles that have image URLs, reposition them as 1, 2, 3
			const tilesToSave = promoTiles
				.filter(tile => tile.image_url && tile.image_url.trim())
				.map((tile, index) => ({
					...tile,
					position: index + 1
				}));

			const response = await fetch('/api/dgr-admin/promo-tiles', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ tiles: tilesToSave })
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.dismiss(loadingId);
			toast.success({
				title: 'Promo tiles saved',
				message: `${tilesToSave.length} promotional tile${tilesToSave.length !== 1 ? 's' : ''} updated`,
				duration: 3000
			});

			// Reload to refresh positions
			await loadPromoTiles();
		} catch (error) {
			toast.dismiss(loadingId);
			toast.error({
				title: 'Failed to save promo tiles',
				message: error.message,
				duration: 5000
			});
		} finally {
			savingTiles = false;
		}
	}

	function addTile() {
		if (promoTiles.length < 3) {
			promoTiles.push({
				position: promoTiles.length + 1,
				image_url: '',
				title: '',
				link_url: ''
			});
		}
	}

	function removeTile(index) {
		if (promoTiles.length > 1) {
			promoTiles.splice(index, 1);
			// Update positions
			promoTiles.forEach((tile, idx) => {
				tile.position = idx + 1;
			});
		}
	}

	async function updateAssignment(entry, contributorId) {
		try {
			// Determine if this is an existing schedule entry or a new assignment
			const isNewAssignment = !entry.id || entry.from_pattern;

			const requestBody = isNewAssignment
				? {
					action: 'assign_contributor',
					date: entry.date,
					contributorId
				}
				: {
					action: 'update_assignment',
					scheduleId: entry.id,
					contributorId
				};

			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: isNewAssignment ? 'Contributor assigned' : 'Assignment updated',
				message: isNewAssignment
					? 'Schedule entry created with contributor assignment'
					: 'Contributor assignment changed successfully',
				duration: DURATIONS.short
			});

			await loadSchedule();
		} catch (error) {
			toast.error({
				title: 'Update failed',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function approveReflection(scheduleId) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'approve_reflection',
					scheduleId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Reflection approved',
				message: 'Reflection has been approved and is ready for publishing',
				duration: DURATIONS.short
			});

			await loadSchedule();
		} catch (error) {
			toast.error({
				title: 'Approval failed',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function updateStatus(entry, newStatus) {
		try {
			// For pattern entries, we need to create a schedule row first
			const isPatternEntry = entry.from_pattern || !entry.id;

			const requestBody = isPatternEntry
				? {
					action: 'create_with_status',
					date: entry.date,
					contributorId: entry.contributor_id,
					status: newStatus
				}
				: {
					action: 'update_status',
					scheduleId: entry.id,
					status: newStatus
				};

			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			const statusLabels = {
				pending: 'set to Pending',
				submitted: 'marked as Needs Approval',
				approved: 'approved',
				published: 'marked as Published'
			};

			toast.success({
				title: 'Status updated',
				message: `Reflection ${statusLabels[newStatus]}`,
				duration: DURATIONS.short
			});

			await loadSchedule();
		} catch (error) {
			toast.error({
				title: 'Status update failed',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function addContributor() {
		if (!newContributor.name || !newContributor.email) {
			toast.warning({
				title: 'Missing information',
				message: 'Name and email are required',
				duration: DURATIONS.short
			});
			return;
		}

		try {
			const response = await fetch('/api/dgr-admin/contributors', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newContributor)
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Contributor added',
				message: `${newContributor.name} has been added successfully`,
				duration: DURATIONS.short
			});

			newContributor = { name: '', email: '', preferred_days: [], day_of_month: null, notes: '' };
			await loadContributors();
		} catch (error) {
			toast.error({
				title: 'Failed to add contributor',
				message: error.message,
				duration: 5000
			});
		}
	}

	async function saveReflection(reflectionData) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'save_reflection',
					...reflectionData
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			await loadSchedule();
			return data.schedule;
		} catch (error) {
			throw error;
		}
	}

	async function sendToWordPress(scheduleId) {
		const loadingId = toast.loading({
			title: 'Sending to WordPress...',
			message: 'Publishing reflection to WordPress'
		});

		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'send_to_wordpress',
					scheduleId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Published to WordPress!',
				message: 'Reflection has been published successfully',
				type: 'success',
				duration: 4000
			});

			await loadSchedule();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Publishing failed',
				message: error.message,
				type: 'error',
				duration: 5000
			});
		}
	}

	let bulkPublishing = $state(false);
	let bulkPublishCancelled = $state(false);
	let bulkPublishProgress = $state({ current: 0, total: 0, successes: 0, failures: [] });

	// Bulk reminder state
	let bulkReminderSending = $state(false);
	let bulkReminderConfirmModal = $state({ open: false, entries: [] });

	async function bulkPublishApproved() {
		// Get all approved entries with content
		const approvedEntries = schedule.filter(
			entry => entry.status === 'approved' &&
			entry.reflection_content &&
			entry.reflection_title
		);

		if (approvedEntries.length === 0) {
			toast.warning({
				title: 'No entries to publish',
				message: 'There are no approved reflections ready to publish',
				duration: 4000
			});
			return;
		}

		bulkPublishing = true;
		bulkPublishCancelled = false;
		bulkPublishProgress = { current: 0, total: approvedEntries.length, successes: 0, failures: [] };

		const progressId = toast.loading({
			title: `Publishing 0/${approvedEntries.length}...`,
			message: 'Starting bulk publish to WordPress'
		});

		for (let i = 0; i < approvedEntries.length; i++) {
			// Check for cancellation
			if (bulkPublishCancelled) {
				toast.updateToast(progressId, {
					title: 'Bulk publish cancelled',
					message: `Stopped after ${bulkPublishProgress.successes} of ${approvedEntries.length} published`,
					type: 'warning',
					duration: 5000
				});
				bulkPublishing = false;
				await loadSchedule();
				return;
			}

			const entry = approvedEntries[i];
			bulkPublishProgress.current = i + 1;

			toast.updateToast(progressId, {
				title: `Publishing ${i + 1}/${approvedEntries.length}...`,
				message: `${entry.date}: ${entry.reflection_title}`,
				type: 'loading'
			});

			try {
				const response = await fetch('/api/dgr-admin/schedule', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'send_to_wordpress',
						scheduleId: entry.id
					})
				});

				const data = await response.json();

				if (data.error) throw new Error(data.error);

				bulkPublishProgress.successes++;
			} catch (error) {
				bulkPublishProgress.failures.push({
					date: entry.date,
					title: entry.reflection_title,
					error: error.message
				});
			}

			// Delay between publishes to avoid rate limits (2.5 seconds)
			if (i < approvedEntries.length - 1) {
				await new Promise(resolve => setTimeout(resolve, 2500));
			}
		}

		bulkPublishing = false;

		// Final summary
		if (bulkPublishProgress.failures.length === 0) {
			toast.updateToast(progressId, {
				title: 'Bulk publish complete!',
				message: `Successfully published ${bulkPublishProgress.successes} reflections`,
				type: 'success',
				duration: 5000
			});
		} else {
			toast.updateToast(progressId, {
				title: 'Bulk publish finished with errors',
				message: `${bulkPublishProgress.successes} succeeded, ${bulkPublishProgress.failures.length} failed`,
				type: 'warning',
				duration: 8000
			});
			// Log failures
			console.error('Bulk publish failures:', bulkPublishProgress.failures);
		}

		await loadSchedule();
	}

	// Get pending entries due within 10 days that can receive reminders
	let pendingReminderEntries = $derived.by(() => {
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const tenDaysFromNow = new Date(today);
		tenDaysFromNow.setDate(tenDaysFromNow.getDate() + 10);

		return schedule.filter(entry => {
			if (!entry.contributor_id || !entry.contributor?.access_token) return false;
			if (entry.status && entry.status !== 'pending') return false;
			if (entry.reflection_content) return false;

			// Check if due date is within 10 days
			const dueDate = new Date(entry.date + 'T00:00:00');
			return dueDate >= today && dueDate <= tenDaysFromNow;
		});
	});

	function openBulkReminderConfirm() {
		if (pendingReminderEntries.length === 0) {
			toast.warning({
				title: 'No reminders to send',
				message: 'No pending reflections due in the next 10 days',
				duration: 4000
			});
			return;
		}
		bulkReminderConfirmModal = { open: true, entries: pendingReminderEntries };
	}

	async function sendBulkReminders() {
		const entries = bulkReminderConfirmModal.entries;
		bulkReminderConfirmModal = { open: false, entries: [] };

		if (entries.length === 0) return;

		bulkReminderSending = true;

		const loadingId = toast.loading({
			title: `Sending ${entries.length} reminders...`,
			message: 'Using batch API for fast delivery'
		});

		try {
			// Build reminder payload for batch API
			const reminders = entries.map(entry => ({
				contributorId: entry.contributor_id,
				date: entry.date,
				scheduleId: entry.id || null
			}));

			const response = await fetch('/api/dgr/reminder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reminders })
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			const results = data.results || {};

			if (results.failed === 0) {
				toast.updateToast(loadingId, {
					title: 'All reminders sent!',
					message: `Successfully sent ${results.sent} reminder${results.sent !== 1 ? 's' : ''}`,
					type: 'success',
					duration: 5000
				});
			} else {
				toast.updateToast(loadingId, {
					title: 'Reminders sent with some errors',
					message: `${results.sent} sent, ${results.failed} failed, ${results.skipped || 0} skipped`,
					type: 'warning',
					duration: 6000
				});
			}

			await loadSchedule();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Failed to send reminders',
				message: error.message,
				type: 'error',
				duration: 5000
			});
		} finally {
			bulkReminderSending = false;
		}
	}

	function openReviewModal(entry) {
		selectedReflection = entry;
		reviewModalOpen = true;
	}

	async function getReadingsForSchedule(entry) {
		const loadingId = toast.loading({
			title: 'Fetching readings...',
			message: 'Loading liturgical readings for ' + formatDate(entry.date)
		});

		try {
			const requestBody = {
				date: entry.date
			};

			// For existing entries, pass schedule_id
			if (entry.id) {
				requestBody.schedule_id = entry.id;
			}

			// For pattern-based entries, pass contributor_id to create new entry
			if (entry.from_pattern && entry.contributor_id) {
				requestBody.contributor_id = entry.contributor_id;
			}

			const response = await fetch('/api/dgr/readings', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Readings loaded!',
				message: `${data.readings.liturgical_name || data.readings.liturgical_day || 'Readings'} fetched successfully`,
				type: 'success',
				duration: 3000
			});

			// Reload schedule to show updated readings
			await loadSchedule();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Failed to fetch readings',
				message: error.message,
				type: 'error',
				duration: 5000
			});
		}
	}

	function getSubmissionUrl(token) {
		return `${window.location.origin}/dgr/write/${token}`;
	}

	function copySubmissionUrl(token) {
		const url = getSubmissionUrl(token);
		navigator.clipboard.writeText(url).then(() => {
			toast.success({
				title: 'Copied!',
				message: 'Contributor link copied to clipboard',
				duration: DURATIONS.short
			});
		}).catch(() => {
			toast.error({
				title: 'Copy Failed',
				message: 'Could not access clipboard',
				duration: DURATIONS.short
			});
		});
	}

	function formatDate(dateStr) {
		return new Date(dateStr).toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function togglePreferredDay(day) {
		if (newContributor.preferred_days.includes(day)) {
			newContributor.preferred_days = newContributor.preferred_days.filter((d) => d !== day);
		} else {
			newContributor.preferred_days = [...newContributor.preferred_days, day];
		}
	}

	function hasScheduleData(entry) {
		return entry.reflection_title || entry.reflection_content || entry.status !== 'pending';
	}

	function openDeleteConfirm(entry) {
		confirmDeleteModal = { open: true, entry };
	}

	function closeDeleteConfirm() {
		confirmDeleteModal = { open: false, entry: null };
	}

	function openEditReadings(entry) {
		// Extract readings from readings_data if available
		const readingsData = entry.readings_data || {};

		editReadingsModal = {
			open: true,
			entry,
			firstReading: readingsData.first_reading?.source || '',
			psalm: readingsData.psalm?.source || '',
			secondReading: readingsData.second_reading?.source || '',
			gospel: readingsData.gospel?.source || entry.gospel_reference || ''
		};
	}

	function closeEditReadings() {
		editReadingsModal = {
			open: false,
			entry: null,
			firstReading: '',
			psalm: '',
			secondReading: '',
			gospel: ''
		};
	}

	async function saveReadings() {
		if (!editReadingsModal.entry) {
			return;
		}

		// At least gospel is usually required
		if (!editReadingsModal.gospel.trim()) {
			toast.warning({
				title: 'Gospel required',
				message: 'Please enter at least the gospel reading',
				duration: DURATIONS.short
			});
			return;
		}

		const loadingId = toast.loading({
			title: 'Updating readings...',
			message: 'Saving liturgical readings'
		});

		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_readings',
					scheduleId: editReadingsModal.entry.id,
					readings: {
						firstReading: editReadingsModal.firstReading.trim(),
						psalm: editReadingsModal.psalm.trim(),
						secondReading: editReadingsModal.secondReading.trim(),
						gospel: editReadingsModal.gospel.trim()
					}
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Readings updated!',
				message: 'Liturgical readings saved successfully',
				type: 'success',
				duration: DURATIONS.short
			});

			await loadSchedule();
			closeEditReadings();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Update failed',
				message: error.message,
				type: 'error',
				duration: DURATIONS.medium
			});
		}
	}

	async function deleteScheduleEntry(scheduleId) {
		// Optimistically remove from UI
		const originalSchedule = [...schedule];
		const deletedEntry = schedule.find(entry => entry.id === scheduleId);
		schedule = schedule.filter(entry => entry.id !== scheduleId);

		const loadingId = toast.loading({
			title: 'Removing entry...',
			message: 'Deleting schedule entry'
		});

		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_schedule',
					scheduleId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Removed!',
				message: `Entry for ${formatDate(deletedEntry.date)} deleted`,
				type: 'success',
				duration: DURATIONS.short
			});
		} catch (error) {
			// Revert optimistic update on error
			schedule = originalSchedule;
			toast.updateToast(loadingId, {
				title: 'Delete Failed',
				message: error.message,
				type: 'error',
				duration: DURATIONS.medium
			});
		}

		closeDeleteConfirm();
	}

	async function clearReflection(entry) {
		if (!entry?.id) return;

		const loadingId = toast.loading({
			title: 'Clearing reflection...',
			message: 'Removing reflection content'
		});

		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'clear_reflection',
					scheduleId: entry.id
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			// Update local schedule with cleared entry
			schedule = schedule.map(e =>
				e.id === entry.id
					? { ...e, ...data.schedule, reflection_title: null, reflection_content: null, gospel_quote: null, status: 'pending' }
					: e
			);

			toast.updateToast(loadingId, {
				title: 'Cleared!',
				message: `Reflection for ${formatDate(entry.date)} has been cleared`,
				type: 'success',
				duration: DURATIONS.short
			});
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Clear Failed',
				message: error.message,
				type: 'error',
				duration: DURATIONS.medium
			});
		}
	}

	async function openQuickAddModal(entry) {
		quickAddEntry = entry;

		// Build readings string from readings_data or fall back to readings string
		let readingsStr = '';
		let liturgicalDate = entry.liturgical_name || '';

		if (entry.readings_data) {
			readingsStr = [
				entry.readings_data.first_reading?.source,
				entry.readings_data.psalm?.source,
				entry.readings_data.second_reading?.source,
				entry.readings_data.gospel?.source
			].filter(Boolean).join('; ');
		} else if (entry.readings) {
			// Use the combined readings string from calendar
			readingsStr = entry.readings;
		}

		// If no readings yet, fetch them from the API
		if (!readingsStr && entry.date) {
			try {
				const response = await fetch('/api/dgr/readings', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ date: entry.date })
				});
				const data = await response.json();

				if (data.readings) {
					readingsStr = data.readings.combined_sources || '';
					liturgicalDate = data.readings.liturgical_name || data.readings.liturgical_day || liturgicalDate;
				}
			} catch (err) {
				console.error('Failed to fetch readings for quick add:', err);
			}
		}

		// Pre-populate the form with date, readings, and contributor info
		quickAddFormData = {
			...getInitialDGRFormData(),
			date: entry.date,
			liturgicalDate,
			readings: readingsStr,
			title: entry.reflection_title || '',
			gospelQuote: entry.gospel_quote || '',
			reflectionText: entry.reflection_content || '',
			authorName: formatContributorName(entry.contributor)
		};

		quickAddModalOpen = true;
	}

	function closeQuickAddModal() {
		quickAddModalOpen = false;
		quickAddEntry = null;
		quickAddFormData = getInitialDGRFormData();
		quickAddResult = null;
		quickAddGospelFullText = '';
		quickAddGospelReference = '';
		quickAddPromoTiles = [];
		quickAddPreviewHtml = '';
	}

	async function openPreviewModal(entry) {
		previewEntry = entry;
		previewModalOpen = true;
		previewLoading = true;
		previewHtml = '';

		try {
			// Build form data from schedule entry
			const formData = {
				date: entry.date,
				liturgicalDate: entry.liturgical_date || entry.liturgical_name || '',
				readings: entry.readings_data ?
					[
						entry.readings_data.first_reading?.source,
						entry.readings_data.psalm?.source,
						entry.readings_data.second_reading?.source,
						entry.readings_data.gospel?.source
					].filter(Boolean).join('; ') : '',
				title: entry.reflection_title || '',
				gospelQuote: entry.gospel_quote || '',
				reflectionText: entry.reflection_content || '',
				authorName: formatContributorName(entry.contributor)
			};

			// Fetch gospel text by reference if available
			let gospelFullText = '';
			let gospelReference = entry.gospel_reference || entry.readings_data?.gospel?.source || '';

			if (gospelReference) {
				try {
					const response = await fetch(`/api/scripture?passage=${encodeURIComponent(gospelReference)}&version=NRSVAE`);
					if (response.ok) {
						const data = await response.json();
						if (data.success && data.content) {
							gospelFullText = cleanGospelText(data.content);
						}
					}
				} catch (err) {
					console.error('Error fetching gospel for preview:', err);
				}
			}

			// Generate preview HTML
			previewHtml = await generateDGRHTML(formData, {
				useNewDesign: true,
				gospelFullText,
				gospelReference,
				includeWordPressCSS: false,
				promoTiles
			});
		} catch (err) {
			console.error('Error generating preview:', err);
			previewHtml = '<div class="p-4 text-red-500">Error generating preview</div>';
		} finally {
			previewLoading = false;
		}
	}

	function closePreviewModal() {
		previewModalOpen = false;
		previewEntry = null;
		previewHtml = '';
	}

	async function saveQuickAddReflection() {
		// Form validation
		if (!quickAddFormData.date || !quickAddFormData.liturgicalDate || !quickAddFormData.readings ||
			!quickAddFormData.title || !quickAddFormData.gospelQuote || !quickAddFormData.reflectionText ||
			!quickAddFormData.authorName) {
			toast.error({
				title: 'Form incomplete',
				message: 'Please fill in all required fields',
				duration: 4000
			});
			return;
		}

		quickAddSaving = true;

		const loadingId = toast.loading({
			title: 'Saving reflection...',
			message: 'Creating approved reflection'
		});

		try {
			const requestBody = {
				action: 'save_reflection',
				date: quickAddFormData.date,
				liturgicalDate: quickAddFormData.liturgicalDate,
				readings: quickAddFormData.readings,
				title: quickAddFormData.title,
				gospelQuote: quickAddFormData.gospelQuote,
				content: quickAddFormData.reflectionText,
				authorName: quickAddFormData.authorName,
				status: 'approved' // Save as approved, not published
			};

			// For existing entries, pass schedule_id
			if (quickAddEntry?.id) {
				requestBody.scheduleId = quickAddEntry.id;
			}

			// For pattern-based entries without id, pass contributor_id to create new entry
			if (quickAddEntry?.from_pattern && quickAddEntry?.contributor_id) {
				requestBody.contributorId = quickAddEntry.contributor_id;
			}

			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Reflection saved!',
				message: 'Reflection has been approved and is ready for publishing',
				type: 'success',
				duration: DURATIONS.short
			});

			await loadSchedule();
			closeQuickAddModal();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Save failed',
				message: error.message,
				type: 'error',
				duration: DURATIONS.medium
			});
		} finally {
			quickAddSaving = false;
		}
	}

	function confirmSendReminder(entry) {
		// Build confirmation message
		const contributor = entry.contributor || contributors.find(c => c.id === entry.contributor_id);
		const daysUntil = Math.ceil((new Date(entry.date) - new Date()) / (1000 * 60 * 60 * 24));
		const daysText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
		const reminderCount = entry.reminder_history?.length || 0;

		const confirmMessage = entry.from_pattern
			? `Send reminder email to ${formatContributorName(contributor)} (${contributor?.email})?\n\nReflection due ${daysText}.\n\nNote: This will create a schedule entry for this date.`
			: reminderCount > 0
			? `Send another reminder email to ${formatContributorName(contributor)} (${contributor?.email})?\n\nReflection due ${daysText}.\n${reminderCount} reminder${reminderCount > 1 ? 's' : ''} already sent.`
			: `Send reminder email to ${formatContributorName(contributor)} (${contributor?.email})?\n\nReflection due ${daysText}.`;

		sendReminderConfirmModal = { open: true, entry, message: confirmMessage };
	}

	async function sendReminderEmail() {
		const entry = sendReminderConfirmModal.entry;
		sendReminderConfirmModal = { open: false, entry: null, message: '' };

		if (!entry) return;

		const contributor = entry.contributor || contributors.find(c => c.id === entry.contributor_id);

		const loadingId = toast.loading({
			title: 'Sending reminder...',
			message: `Emailing ${formatContributorName(contributor)}`
		});

		try {
			const response = await fetch('/api/dgr/reminder', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					scheduleId: entry.id || null, // null for pattern entries
					contributorId: entry.contributor_id,
					date: entry.date
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			const message = entry.from_pattern
				? `Reminder sent and schedule entry created!`
				: data.reminderCount > 1
				? `Reminder ${data.reminderCount} sent to ${formatContributorName(contributor)}`
				: `Reminder sent to ${formatContributorName(contributor)}`;

			toast.updateToast(loadingId, {
				title: 'Reminder sent!',
				message,
				type: 'success',
				duration: DURATIONS.short
			});

			// Reload schedule to show updated reminder history or new entry
			await loadSchedule();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Failed to send reminder',
				message: error.message,
				type: 'error',
				duration: DURATIONS.medium
			});
		}
	}

</script>

<div class="mx-auto max-w-7xl p-4 sm:p-6">
	<div class="mb-6 sm:mb-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
		<div>
			<h1 class="text-3xl font-bold text-gray-900">Schedule Management</h1>
			<p class="mt-1 text-sm text-gray-600">Manage daily assignments, submissions, and reflections</p>
		</div>
	</div>

	{#if loading}
		<div class="flex justify-center py-12">
			<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
		</div>
	{:else}
		<!-- Schedule View -->
		<div class="space-y-6">
			<!-- Filters -->
			<div class="rounded-lg bg-white p-4 sm:p-6 shadow-sm">
					<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 sm:gap-6">
						<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
							<span class="text-sm font-medium text-gray-700 hidden sm:inline">Filter:</span>
							<div class="flex flex-wrap gap-2">
								<button
									onclick={() => (scheduleFilter = 'all')}
									class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {scheduleFilter === 'all'
										? 'bg-gray-800 text-white'
										: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
								>
									All <span class="text-xs opacity-70">({filterCounts.all})</span>
								</button>
								{#if filterCounts.needs_review > 0}
									<button
										onclick={() => (scheduleFilter = 'needs_review')}
										class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {scheduleFilter === 'needs_review'
											? 'bg-blue-600 text-white'
											: 'bg-blue-50 text-blue-700 hover:bg-blue-100'}"
									>
										Needs Review <span class="rounded-full bg-blue-200 text-blue-800 px-1.5 text-xs font-bold">{filterCounts.needs_review}</span>
									</button>
								{/if}
								{#if filterCounts.approved > 0}
									<button
										onclick={() => (scheduleFilter = 'approved')}
										class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {scheduleFilter === 'approved'
											? 'bg-green-600 text-white'
											: 'bg-green-50 text-green-700 hover:bg-green-100'}"
									>
										Approved <span class="text-xs opacity-70">({filterCounts.approved})</span>
									</button>
								{/if}
								{#if filterCounts.published > 0}
									<button
										onclick={() => (scheduleFilter = 'published')}
										class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {scheduleFilter === 'published'
											? 'bg-purple-600 text-white'
											: 'bg-purple-50 text-purple-700 hover:bg-purple-100'}"
									>
										Published <span class="text-xs opacity-70">({filterCounts.published})</span>
									</button>
								{/if}
								{#if filterCounts.unassigned > 0}
									<button
										onclick={() => (scheduleFilter = 'unassigned')}
										class="rounded-lg px-3 py-1.5 text-sm font-medium transition-colors {scheduleFilter === 'unassigned'
											? 'bg-amber-600 text-white'
											: 'bg-amber-50 text-amber-700 hover:bg-amber-100'}"
									>
										Unassigned <span class="text-xs opacity-70">({filterCounts.unassigned})</span>
									</button>
								{/if}
							</div>
						</div>

						<div class="flex items-center gap-2">
							<label for="days-range" class="text-sm font-medium text-gray-700 whitespace-nowrap">Days Ahead:</label>
							<select
								id="days-range"
								bind:value={scheduleDays}
								onchange={loadSchedule}
								class="flex-1 sm:flex-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								<option value={30}>30 days</option>
								<option value={60}>60 days</option>
								<option value={90}>90 days</option>
								<option value={180}>180 days</option>
								<option value={365}>1 year</option>
							</select>
						</div>

						<!-- Bulk Action Buttons -->
						<div class="flex items-center gap-2">
							<!-- Send Reminders Button -->
							{#if pendingReminderEntries.length > 0 || bulkReminderSending}
								{#if bulkReminderSending}
									<span class="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white">
										<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
											<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
											<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
										</svg>
										Sending...
									</span>
								{:else}
									<button
										onclick={openBulkReminderConfirm}
										class="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
										title="Send reminder emails to pending contributors with reflections due in the next 10 days"
									>
										<Send class="h-4 w-4" />
										Remind Due Soon ({pendingReminderEntries.length})
									</button>
								{/if}
							{/if}

							<!-- Publish All Approved Button -->
							{#if schedule.filter(e => e.status === 'approved' && e.reflection_content).length > 0 || bulkPublishing}
								{#if bulkPublishing}
									<div class="flex items-center gap-2">
										<span class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white">
											<svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
												<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
												<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
											</svg>
											{bulkPublishProgress.current}/{bulkPublishProgress.total}
										</span>
										<button
											onclick={() => bulkPublishCancelled = true}
											class="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 transition-colors"
										>
											Cancel
										</button>
									</div>
								{:else}
									<button
										onclick={bulkPublishApproved}
										class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
										title="Publish all approved reflections to WordPress (with rate limiting)"
									>
										Publish All Approved ({schedule.filter(e => e.status === 'approved' && e.reflection_content).length})
									</button>
								{/if}
							{/if}
						</div>
					</div>
				</div>

				<DGRScheduleTable
					schedule={filteredSchedule}
					{contributors}
					{statusColors}
					{statusOptions}
					onUpdateAssignment={updateAssignment}
					onUpdateStatus={updateStatus}
					onOpenReviewModal={openReviewModal}
					onSendToWordPress={sendToWordPress}
					onClearReflection={clearReflection}
					onCopySubmissionUrl={copySubmissionUrl}
					onGetReadings={getReadingsForSchedule}
					onEditReadings={openEditReadings}
					onApproveReflection={approveReflection}
					onQuickAddReflection={openQuickAddModal}
					onSendReminder={confirmSendReminder}
					onPreview={openPreviewModal}
				/>
		</div>
	{/if}
</div>

<!-- Review Modal -->
<DGRReviewModal
	bind:isOpen={reviewModalOpen}
	bind:reflection={selectedReflection}
	submissions={schedule}
	onSave={saveReflection}
	onApprove={approveReflection}
	onSendToWordPress={sendToWordPress}
	onSelectSubmission={(s) => selectedReflection = s}
/>

<!-- Delete Confirmation Modal -->
<Modal
	isOpen={confirmDeleteModal.open}
	title="Remove Schedule Entry"
	onClose={closeDeleteConfirm}
	size="sm"
>
	{#if confirmDeleteModal.entry}
		<div class="flex items-start gap-4">
			<div class="flex-shrink-0">
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
					<Trash2 class="h-5 w-5 text-red-600" />
				</div>
			</div>
			<div class="flex-1">
				<p class="text-sm text-gray-500">
					Are you sure you want to remove the schedule entry for
					<strong>{formatDate(confirmDeleteModal.entry.date)}</strong>?
				</p>

				{#if hasScheduleData(confirmDeleteModal.entry)}
					<div class="mt-3 rounded-md bg-yellow-50 p-3">
						<div class="flex">
							<div class="ml-3">
								<h3 class="text-sm font-medium text-yellow-800">
									This entry contains data
								</h3>
								<div class="mt-1 text-sm text-yellow-700">
									<p>This schedule entry has reflection content or has been submitted. Removing it will permanently delete this data.</p>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<p class="mt-3 text-sm text-gray-400">
					This action cannot be undone. You can regenerate the schedule entry later.
				</p>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex gap-3">
			<button
				onclick={closeDeleteConfirm}
				class="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
			>
				Cancel
			</button>
			<button
				onclick={() => deleteScheduleEntry(confirmDeleteModal.entry.id)}
				class="flex-1 rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-500"
			>
				Remove Entry
			</button>
		</div>
	{/snippet}
</Modal>

<!-- Edit Readings Modal -->
<Modal
	isOpen={editReadingsModal.open}
	title="Edit Liturgical Readings"
	onClose={closeEditReadings}
	size="lg"
>
	{#if editReadingsModal.entry}
		<div class="space-y-4">
			<p class="text-sm text-gray-600">
				Edit the liturgical readings for <strong>{formatDate(editReadingsModal.entry.date)}</strong>
			</p>

			<div class="grid gap-4">
				<!-- First Reading -->
				<div>
					<label for="first-reading" class="mb-2 block text-sm font-semibold text-gray-700">
						First Reading
					</label>
					<input
						id="first-reading"
						type="text"
						bind:value={editReadingsModal.firstReading}
						placeholder="e.g., Genesis 1:1-5"
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</div>

				<!-- Responsorial Psalm -->
				<div>
					<label for="psalm" class="mb-2 block text-sm font-semibold text-gray-700">
						Responsorial Psalm
					</label>
					<input
						id="psalm"
						type="text"
						bind:value={editReadingsModal.psalm}
						placeholder="e.g., Psalm 19:2-5"
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</div>

				<!-- Second Reading (Optional) -->
				<div>
					<label for="second-reading" class="mb-2 block text-sm font-medium text-gray-700">
						Second Reading <span class="text-xs text-gray-500">(Optional - Sundays/Solemnities)</span>
					</label>
					<input
						id="second-reading"
						type="text"
						bind:value={editReadingsModal.secondReading}
						placeholder="e.g., 1 Corinthians 12:4-11"
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
				</div>

				<!-- Gospel -->
				<div>
					<label for="gospel" class="mb-2 block text-sm font-semibold text-gray-700">
						Gospel <span class="text-red-500">*</span>
					</label>
					<input
						id="gospel"
						type="text"
						bind:value={editReadingsModal.gospel}
						placeholder="e.g., Mark 1:14-20"
						class="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
					/>
					<p class="mt-1.5 text-xs text-gray-500">
						Gospel reading is required for all dates
					</p>
				</div>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex gap-3">
			<button
				onclick={closeEditReadings}
				class="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
			>
				Cancel
			</button>
			<button
				onclick={saveReadings}
				class="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"
			>
				Save Readings
			</button>
		</div>
	{/snippet}
</Modal>

<!-- Quick Add Reflection Modal -->
<Modal
	isOpen={quickAddModalOpen}
	title="Quick Add Reflection"
	onClose={closeQuickAddModal}
	size="xl"
>
	{#if quickAddEntry}
		<div class="space-y-4">
			<p class="text-sm text-gray-600">
				Manually add a reflection for <strong>{formatDate(quickAddEntry.date)}</strong>
			</p>

			<div class="max-h-[calc(100vh-300px)] overflow-y-auto">
				<DGREditor
					bind:formData={quickAddFormData}
					bind:publishing={quickAddSaving}
					bind:result={quickAddResult}
					bind:useNewDesign={quickAddUseNewDesign}
					bind:fetchingGospel={quickAddFetchingGospel}
					bind:gospelFullText={quickAddGospelFullText}
					bind:gospelReference={quickAddGospelReference}
					bind:promoTiles={quickAddPromoTiles}
					bind:previewHtml={quickAddPreviewHtml}
					showPreview={false}
				/>
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex gap-3">
			<button
				onclick={closeQuickAddModal}
				class="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
			>
				Cancel
			</button>
			<button
				onclick={saveQuickAddReflection}
				disabled={quickAddSaving}
				class="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{quickAddSaving ? 'Saving...' : 'Save as Approved'}
			</button>
		</div>
	{/snippet}
</Modal>

<!-- Preview Output Modal -->
<Modal
	isOpen={previewModalOpen}
	title="Preview Output"
	onClose={closePreviewModal}
	size="full"
>
	{#if previewEntry}
		<div class="flex flex-col h-full">
			<div class="mb-4 flex items-center justify-between">
				<div>
					<p class="text-sm text-gray-600">
						Preview for <strong>{formatDate(previewEntry.date)}</strong>
					</p>
					{#if previewEntry.reflection_title}
						<p class="text-lg font-semibold text-gray-900">{previewEntry.reflection_title}</p>
					{/if}
				</div>
				{#if previewEntry.status}
					<span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium {statusColors[previewEntry.status]}">
						{statusOptions.find(o => o.value === previewEntry.status)?.label || previewEntry.status}
					</span>
				{/if}
			</div>

			<div class="flex-1 min-h-0 -mx-6 -mb-6">
				{#if previewLoading}
					<div class="flex items-center justify-center h-full">
						<div class="text-center">
							<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-purple-600 mx-auto mb-2"></div>
							<p class="text-sm text-gray-500">Generating preview...</p>
						</div>
					</div>
				{:else}
					<PreviewPanel
						{previewHtml}
						isReady={!!previewHtml}
					/>
				{/if}
			</div>
		</div>
	{/if}

	{#snippet footer()}
		<div class="flex gap-3">
			<button
				onclick={closePreviewModal}
				class="flex-1 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
			>
				Close
			</button>
			{#if previewEntry?.status === 'approved'}
				<button
					onclick={() => {
						sendToWordPress(previewEntry.id);
						closePreviewModal();
					}}
					class="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500"
				>
					Publish to WordPress
				</button>
			{/if}
		</div>
	{/snippet}
</Modal>

<!-- Contextual Help -->
<ContextualHelp
	helpContent={getHelpForPage('/dgr')}
	pageTitle={getPageTitle('/dgr')}
	mode="sidebar"
	position="right"
	autoShow={true}
/>

<!-- Send Reminder Confirmation Modal (Single) -->
<ConfirmationModal
	show={sendReminderConfirmModal.open}
	title="Send Reminder Email"
	confirmText="Send"
	cancelText="Cancel"
	onConfirm={sendReminderEmail}
	onCancel={() => sendReminderConfirmModal = { open: false, entry: null, message: '' }}
>
	<p class="whitespace-pre-line">{sendReminderConfirmModal.message}</p>
</ConfirmationModal>

<!-- Bulk Send Reminders Confirmation Modal -->
<ConfirmationModal
	show={bulkReminderConfirmModal.open}
	title="Send Bulk Reminders"
	confirmText="Send All"
	cancelText="Cancel"
	variant="warning"
	onConfirm={sendBulkReminders}
	onCancel={() => bulkReminderConfirmModal = { open: false, entries: [] }}
>
	<div class="space-y-3">
		<p class="text-sm text-gray-700">
			Send reminder emails to <strong>{bulkReminderConfirmModal.entries.length}</strong> contributor{bulkReminderConfirmModal.entries.length !== 1 ? 's' : ''} with reflections due in the next 10 days?
		</p>

		{#if bulkReminderConfirmModal.entries.length > 0}
			<div class="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
				<p class="text-xs font-medium text-gray-500 mb-2">Recipients:</p>
				<ul class="space-y-1 text-sm text-gray-600">
					{#each bulkReminderConfirmModal.entries.slice(0, 10) as entry}
						<li class="flex items-center gap-2">
							<span class="font-medium">{formatContributorName(entry.contributor)}</span>
							<span class="text-gray-400">·</span>
							<span class="text-xs text-gray-500">{entry.date}</span>
						</li>
					{/each}
					{#if bulkReminderConfirmModal.entries.length > 10}
						<li class="text-xs text-gray-400 italic">
							...and {bulkReminderConfirmModal.entries.length - 10} more
						</li>
					{/if}
				</ul>
			</div>
		{/if}

		<p class="text-xs text-gray-500">
			This will use the batch API to send all emails efficiently.
		</p>
	</div>
</ConfirmationModal>

<ToastContainer />

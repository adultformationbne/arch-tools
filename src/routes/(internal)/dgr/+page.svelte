<script>
	import { toast, DURATIONS } from '$lib/stores/toast.svelte.js';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DGRReviewModal from '$lib/components/DGRReviewModal.svelte';
	import DGRScheduleTable from '$lib/components/DGRScheduleTable.svelte';
	import DGRContributorManager from '$lib/components/DGRContributorManager.svelte';
	import DGRPromoTilesEditor from '$lib/components/DGRPromoTilesEditor.svelte';
	import DGRAssignmentRules from '$lib/components/DGRAssignmentRules.svelte';
	import DGRForm from '$lib/components/DGRForm.svelte';
	import DGRNavigation from '$lib/components/DGRNavigation.svelte';
	import ContextualHelp from '$lib/components/ContextualHelp.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import { decodeHtmlEntities } from '$lib/utils/html.js';
	import { getHelpForPage, getPageTitle } from '$lib/data/help-content.js';
	import { getInitialDGRFormData } from '$lib/utils/dgr-utils.js';
	import { fetchGospelTextForDate, extractGospelReference } from '$lib/utils/scripture.js';
	import { Eye, Send, ExternalLink, Trash2, PlusCircle, Calendar } from 'lucide-svelte';

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

	// Promo tiles state - start with 1 tile, can add up to 3
	let promoTiles = $state([
		{ position: 1, image_url: '', title: '', link_url: '' }
	]);
	let savingTiles = $state(false);

	// Filter state
	let scheduleFilter = $state('all'); // 'all' or 'submissions'
	let scheduleDays = $state(90); // Show 90 days by default

	// Form states
	let generateForm = $state({
		startDate: new Date().toISOString().split('T')[0],
		days: 30
	});

	let newContributor = $state({
		name: '',
		email: '',
		preferred_days: [],
		day_of_month: null,
		notes: ''
	});

	const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
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
			schedule = data.schedule || [];
		} catch (error) {
			toast.error({
				title: 'Failed to load schedule',
				message: error.message,
				duration: DURATIONS.medium
			});
		}
	}

	// Computed filtered schedule based on filter selection
	let filteredSchedule = $derived(
		scheduleFilter === 'submissions'
			? schedule.filter(
					(entry) =>
						entry.reflection_content || entry.status === 'submitted' || entry.status === 'approved' || entry.status === 'published'
				)
			: schedule
	);

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

	async function generateSchedule() {
		const loadingId = toast.loading({
			title: 'Generating schedule...',
			message: 'Creating assignments for the next ' + generateForm.days + ' days'
		});

		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'generate_schedule',
					startDate: generateForm.startDate,
					days: generateForm.days
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.updateToast(loadingId, {
				title: 'Schedule generated!',
				message: data.message,
				type: 'success',
				duration: 4000
			});

			await loadSchedule();
		} catch (error) {
			toast.updateToast(loadingId, {
				title: 'Generation failed',
				message: error.message,
				type: 'error',
				duration: 5000
			});
		}
	}

	async function updateAssignment(scheduleId, contributorId) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_assignment',
					scheduleId,
					contributorId
				})
			});

			const data = await response.json();

			if (data.error) throw new Error(data.error);

			toast.success({
				title: 'Assignment updated',
				message: 'Contributor assignment changed successfully',
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

	async function updateStatus(scheduleId, newStatus) {
		try {
			const response = await fetch('/api/dgr-admin/schedule', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_status',
					scheduleId,
					status: newStatus
				})
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

	function openQuickAddModal(entry) {
		quickAddEntry = entry;

		// Pre-populate the form with date and any existing readings
		quickAddFormData = {
			...getInitialDGRFormData(),
			date: entry.date,
			liturgicalDate: entry.liturgical_name || '',
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
			authorName: ''
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
	}

	async function pasteFromWordQuickAdd() {
		const loadingId = toast.loading({
			title: 'Reading clipboard...',
			message: 'Getting text from clipboard'
		});

		try {
			// Check for clipboard permission first
			if (navigator.permissions) {
				const permission = await navigator.permissions.query({ name: 'clipboard-read' });
				if (permission.state === 'denied') {
					toast.dismiss(loadingId);
					toast.error({
						title: 'Clipboard access denied',
						message: 'Please enable clipboard permissions in your browser settings',
						duration: 5000
					});
					return;
				}
			}

			const text = await navigator.clipboard.readText();
			toast.dismiss(loadingId);

			if (!text || text.trim().length === 0) {
				toast.warning({
					title: 'Clipboard is empty',
					message: 'Please copy the text from Word first',
					duration: 4000
				});
				return;
			}

			parseWordDocumentQuickAdd(text);

			toast.success({
				title: 'Content pasted!',
				message: 'Form fields have been populated',
				duration: 3000
			});
		} catch (err) {
			console.error('Clipboard error:', err);
			toast.dismiss(loadingId);
			toast.error({
				title: 'Clipboard access denied',
				message: 'Please allow clipboard access or paste manually',
				duration: 5000
			});
		}
	}

	function parseWordDocumentQuickAdd(text) {
		const lines = text.split('\n').filter((line) => line.length > 0);

		const sections = {};
		let reflectionStartIndex = -1;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();

			if (line.endsWith(':')) {
				const label = line.slice(0, -1).trim();
				const nextLine = i + 1 < lines.length ? lines[i + 1].trim() : '';

				switch (label) {
					case 'Date':
						if (line.includes(':\t') || line.match(/Date:\s+\S/)) {
							const parts = lines[i].split(/Date:\s*/);
							sections.date = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.date = nextLine;
						}
						break;

					case 'Liturgical Date':
						if (line.includes(':\t') || line.match(/Liturgical Date:\s+\S/)) {
							const parts = lines[i].split(/Liturgical Date:\s*/);
							sections.liturgicalDate = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.liturgicalDate = nextLine;
						}
						break;

					case 'Readings':
						if (line.includes(':\t') || line.match(/Readings:\s+\S/)) {
							const parts = lines[i].split(/Readings:\s*/);
							sections.readings = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.readings = nextLine;
						}
						break;

					case 'Title':
						if (line.includes(':\t') || line.match(/Title:\s+\S/)) {
							const parts = lines[i].split(/Title:\s*/);
							sections.title = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.title = nextLine;
						}
						break;

					case 'Gospel quote':
					case 'Gospel Quote':
						if (line.includes(':\t') || line.match(/Gospel [Qq]uote:\s+\S/)) {
							const parts = lines[i].split(/Gospel [Qq]uote:\s*/);
							sections.gospelQuote = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.gospelQuote = nextLine;
						}
						break;

					case 'Reflection written by':
						if (line.includes(':\t') || line.match(/Reflection written by:\s+\S/)) {
							const parts = lines[i].split(/Reflection written by:\s*/);
							sections.author = parts[1]?.trim() || '';
						} else if (nextLine && !nextLine.endsWith(':')) {
							sections.author = nextLine;
						}
						reflectionStartIndex = sections.author && nextLine === sections.author ? i + 2 : i + 1;
						break;
				}
			} else if (line.startsWith('By ') && i > lines.length - 5) {
				sections.author = line.substring(3).trim();
			}
		}

		// Find reflection text
		if (reflectionStartIndex > 0 && reflectionStartIndex < lines.length) {
			const reflectionLines = [];
			let inReflection = true;

			for (let i = reflectionStartIndex; i < lines.length && inReflection; i++) {
				const line = lines[i].trim();

				if (line.startsWith('By ') && i > reflectionStartIndex + 3) {
					inReflection = false;
					continue;
				}

				if (line === '') {
					if (reflectionLines.length > 0 && reflectionLines[reflectionLines.length - 1] !== '') {
						reflectionLines.push('');
					}
					continue;
				}

				reflectionLines.push(line);
			}

			sections.reflection = reflectionLines
				.join('\n')
				.split(/\n\n+/)
				.filter(para => para.trim())
				.join('\n\n');
		}

		// Parse the date
		if (sections.date) {
			const dateMatch = sections.date.match(/\w+\s+(\d+)\w*\s+(\w+)/);
			if (dateMatch) {
				const day = dateMatch[1];
				const month = dateMatch[2];
				const year = new Date().getFullYear();
				const dateStr = `${month} ${day}, ${year}`;
				const dateObj = new Date(dateStr + ' UTC');
				if (!isNaN(dateObj)) {
					const utcYear = dateObj.getUTCFullYear();
					const utcMonth = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
					const utcDay = String(dateObj.getUTCDate()).padStart(2, '0');
					quickAddFormData.date = `${utcYear}-${utcMonth}-${utcDay}`;
				}
			}
		}

		// Update form data
		quickAddFormData.liturgicalDate = sections.liturgicalDate || quickAddFormData.liturgicalDate;
		quickAddFormData.readings = sections.readings || quickAddFormData.readings;
		quickAddFormData.title = sections.title || '';
		quickAddFormData.gospelQuote = sections.gospelQuote || '';
		quickAddFormData.reflectionText = sections.reflection || '';
		quickAddFormData.authorName = sections.author || '';

		// Extract gospel reference from readings
		if (quickAddFormData.readings) {
			quickAddGospelReference = extractGospelReference(quickAddFormData.readings);
		}
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

	async function sendReminderEmail(entry) {
		// Confirmation dialog
		const contributor = entry.contributor || contributors.find(c => c.id === entry.contributor_id);
		const daysUntil = Math.ceil((new Date(entry.date) - new Date()) / (1000 * 60 * 60 * 24));
		const daysText = daysUntil === 0 ? 'today' : daysUntil === 1 ? 'tomorrow' : `in ${daysUntil} days`;
		const reminderCount = entry.reminder_history?.length || 0;

		const confirmMessage = entry.from_pattern
			? `Send reminder email to ${contributor?.name} (${contributor?.email})?\n\nReflection due ${daysText}.\n\nNote: This will create a schedule entry for this date.`
			: reminderCount > 0
			? `Send another reminder email to ${contributor?.name} (${contributor?.email})?\n\nReflection due ${daysText}.\n${reminderCount} reminder${reminderCount > 1 ? 's' : ''} already sent.`
			: `Send reminder email to ${contributor?.name} (${contributor?.email})?\n\nReflection due ${daysText}.`;

		const confirmed = confirm(confirmMessage);

		if (!confirmed) return;

		const loadingId = toast.loading({
			title: 'Sending reminder...',
			message: `Emailing ${contributor?.name}`
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
				? `Reminder ${data.reminderCount} sent to ${contributor?.name}`
				: `Reminder sent to ${contributor?.name}`;

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

<div class="mx-auto max-w-7xl p-6">
	<div class="mb-8 flex items-center justify-between">
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
			<div class="rounded-lg bg-white p-4 shadow-sm">
					<div class="flex items-center gap-6">
						<div class="flex items-center gap-4">
							<span class="text-sm font-medium text-gray-700">View:</span>
							<div class="flex gap-2">
								<button
									onclick={() => (scheduleFilter = 'all')}
									class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {scheduleFilter === 'all'
										? 'bg-blue-600 text-white'
										: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
								>
									All Dates ({schedule.length})
								</button>
								<button
									onclick={() => (scheduleFilter = 'submissions')}
									class="rounded-lg px-4 py-2 text-sm font-medium transition-colors {scheduleFilter === 'submissions'
										? 'bg-blue-600 text-white'
										: 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
								>
									Submissions Only ({schedule.filter(
										(e) =>
											e.reflection_content ||
											e.status === 'submitted' ||
											e.status === 'approved' ||
											e.status === 'published'
									).length})
								</button>
							</div>
						</div>

						<div class="flex items-center gap-2">
							<label for="days-range" class="text-sm font-medium text-gray-700">Days Ahead:</label>
							<select
								id="days-range"
								bind:value={scheduleDays}
								onchange={loadSchedule}
								class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
							>
								<option value={30}>30 days</option>
								<option value={60}>60 days</option>
								<option value={90}>90 days</option>
								<option value={180}>180 days</option>
								<option value={365}>1 year</option>
							</select>
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
					onOpenDeleteConfirm={openDeleteConfirm}
					onCopySubmissionUrl={copySubmissionUrl}
					onGetReadings={getReadingsForSchedule}
					onEditReadings={openEditReadings}
					onApproveReflection={approveReflection}
					onQuickAddReflection={openQuickAddModal}
					onSendReminder={sendReminderEmail}
				/>
		</div>
	{/if}
</div>

<!-- Review Modal -->
<DGRReviewModal
	bind:isOpen={reviewModalOpen}
	bind:reflection={selectedReflection}
	onSave={saveReflection}
	onApprove={approveReflection}
	onSendToWordPress={sendToWordPress}
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
				<DGRForm
					bind:formData={quickAddFormData}
					bind:publishing={quickAddSaving}
					bind:result={quickAddResult}
					bind:useNewDesign={quickAddUseNewDesign}
					bind:fetchingGospel={quickAddFetchingGospel}
					bind:gospelFullText={quickAddGospelFullText}
					bind:gospelReference={quickAddGospelReference}
					onPasteFromWord={pasteFromWordQuickAdd}
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

<!-- Contextual Help -->
<ContextualHelp
	helpContent={getHelpForPage('/dgr')}
	pageTitle={getPageTitle('/dgr')}
	mode="sidebar"
	position="right"
	autoShow={true}
/>

<ToastContainer />

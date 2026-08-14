<script>
	import { goto, invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { getContext } from 'svelte';
	import { AlertTriangle, Home, Loader2, Search, Mail, ArrowRight, Trash2, MapPin, UserMinus, Users, Plus, Settings, UserPlus, Download, X, ChevronDown } from '$lib/icons';

	// Get modal opener from layout context
	const openCohortWizard = getContext('openCohortWizard');
	import CohortAdminSidebar from '$lib/components/CohortAdminSidebar.svelte';
	import FilterSelect from '$lib/components/FilterSelect.svelte';
	import FiltersPanel from '$lib/components/FiltersPanel.svelte';
	import CohortSettingsModal from '$lib/components/CohortSettingsModal.svelte';
	import ParticipantEnrollmentModal from '$lib/components/ParticipantEnrollmentModal.svelte';
	import ParticipantDetailModal from '$lib/components/ParticipantDetailModal.svelte';
	import StudentAdvancementModal from '$lib/components/StudentAdvancementModal.svelte';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import EmailSenderModal from '$lib/components/EmailSenderModal.svelte';
	import {
		getUserReflectionStatus,
		fetchReflectionsByCohort
	} from '$lib/utils/reflection-status.js';
	import { toastError, toastSuccess, toastWarning } from '$lib/utils/toast-helpers.js';
	import { formatRelativeTime } from '$lib/utils/dgr-helpers';
	import { emailDisplayName } from '$lib/utils/email-labels';
	import { getTotalSessions } from '$lib/utils/cohort-status';

	let { data } = $props();

	const courseSlug = $derived(data.courseSlug);
	let modules = $derived(data.modules || []);
	let cohorts = $derived(data.cohorts || []);
	const courseFeatures = $derived(data.courseFeatures || {});
	const courseHubs = $derived(data.courseHubs || []);
	const cohortHubMap = $derived(data.cohortHubMap || {});

	// Modal state
	let showCohortSettings = $state(false);
	let showStudentEnrollment = $state(false);
	let showAdvancementModal = $state(false);
	let advancementInitialIds = $state([]);
	let showDeleteConfirm = $state(false);
	let deleteLoading = $state(false);
	let deleteLoadingMessage = $state('');
	let showEmailModal = $state(false);
	let showHubAssignModal = $state(false);
	let showParticipantDetail = $state(false);
	let selectedParticipantForDetail = $state(null);
	let emailRecipients = $state([]);
	let initialTemplateSlug = $state('');
	let selectedHubId = $state('');

	// Participants state
	let participants = $state([]);
	let hubs = $state([]);
	let loadingParticipants = $state(false);
	let selectedParticipants = $state(new Set());
	let filterBarHeight = $state(0);
	let reflectionsHeaderHeight = $state(0);
	let searchQuery = $state('');
	let filterHub = $state('all');
	let filterStatus = $state('all');
	let filterSession = $state('all');
	let filterReflections = $state('all');
	let filterAttendance = $state('all');

	// Get selected cohort from URL params (must be declared before derived options that use it)
	const selectedCohortId = $derived($page.url.searchParams.get('cohort'));
	const archivedCohorts = $derived(data.archivedCohorts || []);
	const allCohorts = $derived([...cohorts, ...archivedCohorts]);
	const selectedCohort = $derived(allCohorts.find(c => c.id === selectedCohortId));

	const hubOptions = $derived([
		{ value: 'all', label: 'All Hubs' },
		{ value: 'none', label: 'No Hub' },
		...hubs.map(h => ({ value: h.id, label: h.name }))
	]);
	const statusOptions = $derived.by(() => {
		const all = [{ value: 'all', label: 'All Statuses' }];
		const opts = [
			{ value: 'not_invited', label: 'Not Invited' },
			{ value: 'invited', label: 'Invited' },
			{ value: 'pending', label: 'Pending' },
			{ value: 'active', label: 'Active' },
			{ value: 'held', label: 'On Hold' },
			{ value: 'withdrawn', label: 'Withdrawn' },
			{ value: 'completed', label: 'Completed' }
		];
		if (!participants.length) return [...all, ...opts];
		return [...all, ...opts.filter(o => participants.some(p => getStatusKey(p) === o.value))];
	});
	const sessionOptions = $derived.by(() => {
		const all = [{ value: 'all', label: 'All Sessions' }];
		const cohortSess = selectedCohort?.current_session || 0;
		if (!participants.length || cohortSess === 0) return all;
		const opts = [
			{ value: 'behind', label: 'Behind', fn: p => p.current_session < cohortSess },
			{ value: 'on_track', label: 'On Track', fn: p => p.current_session === cohortSess },
			{ value: 'ahead', label: 'Ahead', fn: p => p.current_session > cohortSess }
		];
		return [...all, ...opts.filter(o => participants.some(o.fn)).map(({ value, label }) => ({ value, label }))];
	});
	const attendanceOptions = $derived.by(() => {
		const all = [{ value: 'all', label: 'All Attendance' }];
		const cohortSess = selectedCohort?.current_session || 0;
		if (!participants.length || cohortSess === 0) return all;
		const opts = [
			{ value: 'complete', label: 'Perfect' },
			{ value: 'on_track', label: 'Missed 1' },
			{ value: 'behind', label: 'Missed 2+' }
		];
		return [...all, ...opts.filter(o => participants.some(p => p.attendanceStatus === o.value))];
	});
	const reflectionOptions = $derived.by(() => {
		const all = [{ value: 'all', label: 'All Reflections' }];
		const cohortSess = selectedCohort?.current_session || 0;
		if (!participants.length || cohortSess === 0) return all;
		const opts = [
			{ value: 'complete', label: 'Complete' },
			{ value: 'on_track', label: 'On Track' },
			{ value: 'behind', label: 'Behind' }
		];
		return [...all, ...opts.filter(o => participants.some(p => p.reflectionStatus?.status === o.value))];
	});
	const anyFilterActive = $derived(
		filterHub !== 'all' || filterStatus !== 'all' ||
		filterSession !== 'all' || filterAttendance !== 'all' || filterReflections !== 'all'
	);

	// Auto-reset filter when its option no longer exists in the data
	$effect(() => { if (filterStatus !== 'all' && !statusOptions.some(o => o.value === filterStatus)) filterStatus = 'all'; });
	$effect(() => { if (filterSession !== 'all' && !sessionOptions.some(o => o.value === filterSession)) filterSession = 'all'; });
	$effect(() => { if (filterAttendance !== 'all' && !attendanceOptions.some(o => o.value === filterAttendance)) filterAttendance = 'all'; });
	$effect(() => { if (filterReflections !== 'all' && !reflectionOptions.some(o => o.value === filterReflections)) filterReflections = 'all'; });

	function clearAllFilters() {
		filterHub = 'all';
		filterStatus = 'all';
		filterSession = 'all';
		filterAttendance = 'all';
		filterReflections = 'all';
		searchQuery = '';
	}
	let sortColumn = $state('name');
	let sortDirection = $state('asc');
	// Collapsed by default: the four reflection columns are detail most of the
	// time, so they start folded into "completed • everything else".
	let reflectionsExpanded = $state(false);
	let reflectionsByUser = $state(new Map());
	let sessionsWithQuestions = $state([]);

	// Calculate stats for sidebar
	const stats = $derived({
		participantCount: participants.length,
		avgAttendance: participants.length > 0
			? Math.round(participants.reduce((sum, s) => sum + (s.attendanceCount || 0), 0) / participants.length / (selectedCohort?.current_session || 1) * 100)
			: 0,
		pendingReflections: participants.reduce(
			(sum, s) => sum + (s.reflectionStatus?.count?.pending || 0),
			0
		)
	});

	// Uniform across the cohort - every participant is measured against the
	// same cohort current_session, so this belongs in the group header.
	const reflectionTotal = $derived(
		participants.find(p => p.reflectionStatus?.count?.total)?.reflectionStatus?.count?.total || 0
	);

	// Recent activity
	let recentActivity = $state([]);

	// Last few emails logged per enrollment (id -> array of {email_type, subject, sent_at, status, email_templates})
	let emailHistory = $state({});

	// Status sort order for consistent grouping
	const statusOrder = { not_invited: 0, invited: 1, pending: 2, active: 3, held: 4, completed: 5, withdrawn: 6 };
	const reflectionOrder = { behind: 0, on_track: 1, complete: 2 };

	// Filtered and sorted participants
	const filteredParticipants = $derived(
		participants.filter(s => {
			const query = searchQuery.toLowerCase();
			const matchesSearch = !searchQuery ||
				s.full_name?.toLowerCase().includes(query) ||
				s.email?.toLowerCase().includes(query) ||
				s.user_profile?.phone?.toLowerCase().includes(query);
			const matchesHub = filterHub === 'all' || (filterHub === 'none' ? !s.hub_id : s.hub_id === filterHub);
			const matchesStatus = filterStatus === 'all' || getStatusKey(s) === filterStatus;
			const matchesSession = filterSession === 'all' || (() => {
				const cohortSession = selectedCohort?.current_session || 0;
				if (filterSession === 'behind') return s.current_session < cohortSession;
				if (filterSession === 'on_track') return s.current_session === cohortSession;
				if (filterSession === 'ahead') return s.current_session > cohortSession;
				return true;
			})();
			const matchesReflections = filterReflections === 'all' ||
				s.reflectionStatus?.status === filterReflections;
			const matchesAttendance = filterAttendance === 'all' || s.attendanceStatus === filterAttendance;
			return matchesSearch && matchesHub && matchesStatus && matchesSession && matchesReflections && matchesAttendance;
		}).sort((a, b) => {
			const dir = sortDirection === 'asc' ? 1 : -1;
			let cmp = 0;
			switch (sortColumn) {
				case 'name':
					cmp = (a.full_name || '').localeCompare(b.full_name || '');
					break;
				case 'hub':
					cmp = (a.courses_hubs?.name || '').localeCompare(b.courses_hubs?.name || '');
					break;
				case 'status':
					cmp = (statusOrder[getStatusKey(a)] ?? 99) - (statusOrder[getStatusKey(b)] ?? 99);
					break;
				case 'session':
					cmp = (a.current_session || 0) - (b.current_session || 0);
					break;
				case 'attendance':
					cmp = (a.attendanceCount || 0) - (b.attendanceCount || 0);
					break;
				case 'reflections':
					cmp = (reflectionOrder[a.reflectionStatus?.status] ?? 99) - (reflectionOrder[b.reflectionStatus?.status] ?? 99);
					if (cmp === 0) cmp = (a.reflectionStatus?.count?.submitted || 0) - (b.reflectionStatus?.count?.submitted || 0);
					break;
				case 'refMarked':
					cmp = (a.reflectionStatus?.count?.completed || 0) - (b.reflectionStatus?.count?.completed || 0);
					break;
				case 'refPending':
					cmp = (a.reflectionStatus?.count?.pending || 0) - (b.reflectionStatus?.count?.pending || 0);
					break;
				case 'refReturned':
					cmp = (a.reflectionStatus?.count?.returned || 0) - (b.reflectionStatus?.count?.returned || 0);
					break;
				case 'refDraft':
					cmp = (a.reflectionStatus?.count?.draft || 0) - (b.reflectionStatus?.count?.draft || 0);
					break;
				case 'refOther':
					cmp = otherReflections(a.reflectionStatus?.count) - otherReflections(b.reflectionStatus?.count);
					break;
			}
			return cmp * dir;
		})
	);

	function toggleSort(column) {
		if (sortColumn === column) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	// Collapsed column: everything handed in or started that is not yet marked.
	const otherReflections = (c) => (c?.pending || 0) + (c?.returned || 0) + (c?.draft || 0);

	// The whole point of collapsing is that the breakdown stays one hover away.
	function reflectionBreakdown(c) {
		const done = `${c.completed} completed of ${c.total}`;
		const parts = [];
		if (c.pending) parts.push(`${c.pending} submitted, not yet marked`);
		if (c.returned) parts.push(`${c.returned} returned to revise`);
		if (c.draft) parts.push(`${c.draft} draft`);
		return parts.length ? `${done} · ${parts.join(', ')}` : done;
	}

	function toggleReflectionColumns() {
		reflectionsExpanded = !reflectionsExpanded;
		// Never leave the table sorted by a column that is no longer on screen -
		// fold the sort into (or out of) the combined column instead.
		if (!reflectionsExpanded && ['refPending', 'refReturned', 'refDraft'].includes(sortColumn)) {
			sortColumn = 'refOther';
		} else if (reflectionsExpanded && sortColumn === 'refOther') {
			sortColumn = 'refMarked';
		}
	}

	function sortIndicator(column) {
		if (sortColumn !== column) return '';
		return sortDirection === 'asc' ? ' \u25B2' : ' \u25BC';
	}

	// "More than a course participant": admin/coordinator role, or any platform module
	// beyond courses.participant. These accounts can be removed from a cohort but never
	// permanently deleted (deleting them orphans profiles / breaks re-enrolment).
	const isStaffParticipant = (p) =>
		p?.role === 'admin' ||
		p?.role === 'coordinator' ||
		(Array.isArray(p?.user_profile?.modules) &&
			p.user_profile.modules.some(m => m && m !== 'courses.participant'));

	const selectedHasStaff = $derived(
		Array.from(selectedParticipants).some(id =>
			isStaffParticipant(participants.find(s => s.id === id))
		)
	);

	// Participants who can be advanced
	const participantsBehind = $derived(
		selectedCohort?.current_session > 0
			? Array.from(selectedParticipants)
					.map(id => participants.find(s => s.id === id))
					.filter(s => s && s.current_session < selectedCohort.current_session)
			: []
	);

	// Load participants when cohort changes
	$effect(() => {
		if (selectedCohortId) {
			filterHub = 'all';
			filterStatus = 'all';
			filterSession = 'all';
			filterReflections = 'all';
			filterAttendance = 'all';
			sortColumn = 'name';
			sortDirection = 'asc';
			searchQuery = '';
			loadParticipants();
			loadHubs();
		} else {
			participants = [];
		}
	});

	async function loadParticipants() {
		if (!selectedCohortId) return;

		// Use local lookup to avoid $derived reactivity issues
		const currentCohort = cohorts.find(c => c.id === selectedCohortId);
		if (!currentCohort) return;

		loadingParticipants = true;
		try {
			// Get module ID for fetching sessions with questions
			const moduleId = currentCohort.module?.id || currentCohort.module_id;

			const [enrollmentResponse, attendanceResponse, reflectionsData, sessionsResponse, activityResponse, emailHistoryResponse] = await Promise.all([
				fetch(`/admin/courses/${courseSlug}/api?endpoint=courses_enrollments&cohort_id=${selectedCohortId}`).then(r => r.json()),
				fetch(`/admin/courses/${courseSlug}/api?endpoint=attendance&cohort_id=${selectedCohortId}`).then(r => r.json()),
				fetchReflectionsByCohort(selectedCohortId, courseSlug),
				moduleId
					? fetch(`/admin/courses/${courseSlug}/api?endpoint=sessions_with_questions&module_id=${moduleId}`).then(r => r.json())
					: Promise.resolve({ success: true, data: [] }),
				fetch(`/admin/courses/${courseSlug}/api?endpoint=recent_activity&cohort_id=${selectedCohortId}`).then(r => r.json()),
				fetch(`/admin/courses/${courseSlug}/api?endpoint=email_history&cohort_id=${selectedCohortId}`).then(r => r.json())
			]);

			// Update activity
			recentActivity = activityResponse.success ? activityResponse.data : [];
			emailHistory = emailHistoryResponse.success ? emailHistoryResponse.data : {};

			reflectionsByUser = reflectionsData;
			sessionsWithQuestions = sessionsResponse.success ? sessionsResponse.data : [];

			// Create attendance map
			const attendanceMap = new Map();
			if (attendanceResponse.success && attendanceResponse.data) {
				attendanceResponse.data.forEach(record => {
					if (record.present) {
						const count = attendanceMap.get(record.enrollment_id) || 0;
						attendanceMap.set(record.enrollment_id, count + 1);
					}
				});
			}

			const cohortSession = currentCohort.current_session || 0;
			participants = (enrollmentResponse.success ? enrollmentResponse.data : []).map(user => {
				const userReflections = reflectionsByUser.get(user.user_profile_id) || [];
				const reflectionStatus = getUserReflectionStatus(userReflections, currentCohort.current_session, sessionsWithQuestions);
				const attCount = attendanceMap.get(user.id) || 0;

				let attendanceStatus = 'complete';
				if (cohortSession > 0) {
					if (attCount >= cohortSession) attendanceStatus = 'complete';
					else if (attCount >= cohortSession - 1) attendanceStatus = 'on_track';
					else attendanceStatus = 'behind';
				}

				return {
					...user,
					attendanceCount: attCount,
					attendanceStatus,
					reflectionStatus,
					isBehind: currentCohort && user.current_session < currentCohort.current_session
				};
			});
		} catch (err) {
			console.error('Failed to load participants:', err);
			participants = [];
		} finally {
			loadingParticipants = false;
		}
	}

	async function loadHubs() {
		if (!selectedCohortId) return;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api?endpoint=hubs&cohort_id=${selectedCohortId}`);
			const result = await response.json();
			hubs = result.success ? result.data : [];
		} catch (err) {
			console.error('Failed to load hubs:', err);
			hubs = [];
		}
	}

	function toggleSelectAll() {
		if (selectedParticipants.size === filteredParticipants.length) {
			selectedParticipants = new Set();
		} else {
			selectedParticipants = new Set(filteredParticipants.map(s => s.id));
		}
	}

	let anchorIndex = $state(null);
	let anchorSelected = $state(true); // was the anchor click a select (true) or deselect (false)?
	let lastShiftChanged = $state(new Set()); // IDs changed by the last shift+click

	function handleCheckboxClick(index, event) {
		event.stopPropagation();
		const newSelected = new Set(selectedParticipants);

		if (event.shiftKey && anchorIndex !== null) {
			const start = Math.min(anchorIndex, index);
			const end = Math.max(anchorIndex, index);

			// Undo previous shift changes
			for (const id of lastShiftChanged) {
				if (anchorSelected) {
					newSelected.delete(id);
				} else {
					newSelected.add(id);
				}
			}

			// Apply new range based on anchor action
			const newlyChanged = new Set();
			for (let i = start; i <= end; i++) {
				const pid = filteredParticipants[i]?.id;
				if (pid) {
					if (anchorSelected) {
						if (!newSelected.has(pid)) newlyChanged.add(pid);
						newSelected.add(pid);
					} else {
						if (newSelected.has(pid)) newlyChanged.add(pid);
						newSelected.delete(pid);
					}
				}
			}

			lastShiftChanged = newlyChanged;
		} else {
			// Regular click: toggle + set new anchor
			const id = filteredParticipants[index]?.id;
			const wasSelected = id ? newSelected.has(id) : false;
			if (id) {
				if (wasSelected) {
					newSelected.delete(id);
				} else {
					newSelected.add(id);
				}
			}
			anchorIndex = index;
			anchorSelected = !wasSelected;
			lastShiftChanged = new Set();
		}

		selectedParticipants = newSelected;
	}

	function handleCheckboxMousedown(event) {
		if (event.shiftKey) event.preventDefault();
	}

	// Sidebar actions
	function handleAdvanceSession() {
		// Pass any selected students to the modal
		advancementInitialIds = Array.from(selectedParticipants);
		showAdvancementModal = true;
	}

	function handleEmailAll() {
		emailRecipients = participants;
		initialTemplateSlug = '';
		showEmailModal = true;
	}

	function handleExport() {
		if (!selectedCohort) return;

		const totalSessions = getTotalSessions(selectedCohort);
		const cohortSession = selectedCohort.current_session || 0;

		const headers = [
			'Name', 'Email', 'Phone', 'Parish/Community', 'Parish Role', 'Address',
			'Hub', 'Role', 'Status', 'Session', 'Attendance',
			'Reflections Completed', 'Reflections Submitted', 'Reflections Returned', 'Reflections Draft',
			'Payment Status', 'Last Seen', 'Enrolled Date'
		];

		const rows = filteredParticipants.map(p => {
			const statusBadge = getStatusBadge(p);
			const showReflections = p.reflectionStatus && (selectedCohort?.current_session || 0) > 0;
			const refCount = p.reflectionStatus?.count;
			const attendance = cohortSession > 0
				? `${p.attendanceCount || 0} of ${cohortSession}`
				: '';
			const seenAt = lastSeenAt(p);

			return [
				p.full_name || '',
				p.email || '',
				p.user_profile?.phone || '',
				p.user_profile?.parish_community || '',
				p.user_profile?.parish_role || '',
				p.user_profile?.address || '',
				p.courses_hubs?.name || '',
				p.role || '',
				statusBadge.label,
				`${p.current_session} of ${totalSessions}`,
				attendance,
				showReflections ? refCount.completed : '',
				showReflections ? refCount.pending : '',
				showReflections ? refCount.returned : '',
				showReflections ? refCount.draft : '',
				p.payment_status || '',
				seenAt ? new Date(seenAt).toLocaleDateString() : '',
				p.created_at ? new Date(p.created_at).toLocaleDateString() : ''
			];
		});

		const csvContent = [
			headers.join(','),
			...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		const sanitizedName = selectedCohort.name.replace(/[^a-zA-Z0-9-_ ]/g, '').replace(/\s+/g, '-');
		link.setAttribute('href', url);
		link.setAttribute('download', `${sanitizedName}-${new Date().toISOString().split('T')[0]}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		toastSuccess(`Exported ${filteredParticipants.length} participants`);
	}

	function handleAddParticipant() {
		showStudentEnrollment = true;
	}

	function handleCohortSettings() {
		showCohortSettings = true;
	}

	async function handleCohortUpdate() {
		await invalidateAll();
		await loadParticipants();
	}

	async function handleCohortDelete() {
		await invalidateAll();
		// Navigate to dashboard without cohort selected
		goto(`/admin/courses/${courseSlug}`);
	}

	// Bulk actions
	function handleEmailSelected() {
		emailRecipients = participants.filter(p => selectedParticipants.has(p.id));
		initialTemplateSlug = '';
		showEmailModal = true;
	}

	function handleAdvanceSelected() {
		advancementInitialIds = Array.from(selectedParticipants);
		showAdvancementModal = true;
	}

	function handleAssignHub() {
		if (selectedParticipants.size === 0) {
			toastWarning('No participants selected');
			return;
		}
		selectedHubId = '';
		showHubAssignModal = true;
	}

	async function handleBulkHubAssignment() {
		if (selectedParticipants.size === 0) return;

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'bulk_assign_hub',
					enrollmentIds: Array.from(selectedParticipants),
					hubId: selectedHubId || null
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to assign hub');
			}

			toastSuccess(result.message);
			showHubAssignModal = false;
			selectedParticipants = new Set();
			await loadParticipants();
		} catch (err) {
			console.error('Error assigning hub:', err);
			toastError(err.message || 'Failed to assign hub');
		}
	}

	function handleRemoveSelected() {
		if (selectedParticipants.size === 0) return;
		showDeleteConfirm = true;
	}

	async function confirmRemoveEnrollment() {
		deleteLoading = true;
		deleteLoadingMessage = 'Removing enrollments...';

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'bulk_delete_enrollments',
					enrollmentIds: Array.from(selectedParticipants),
					forceDelete: true
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to remove participants');
			}

			toastSuccess(result.message);
			selectedParticipants = new Set();
			await loadParticipants();
		} catch (err) {
			console.error('Error removing participants:', err);
			toastError(err.message || 'Failed to remove participants');
		} finally {
			deleteLoading = false;
			showDeleteConfirm = false;
		}
	}

	async function confirmDeleteAccounts() {
		deleteLoading = true;
		deleteLoadingMessage = 'Deleting accounts...';

		try {
			const response = await fetch(`/admin/courses/${courseSlug}/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_user_accounts',
					enrollmentIds: Array.from(selectedParticipants)
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to delete accounts');
			}

			toastSuccess(result.message);
			selectedParticipants = new Set();
			await loadParticipants();
		} catch (err) {
			console.error('Error deleting accounts:', err);
			toastError(err.message || 'Failed to delete accounts');
		} finally {
			deleteLoading = false;
			showDeleteConfirm = false;
		}
	}

	// Modal handlers
	async function handleEnrollmentComplete() {
		showStudentEnrollment = false;
		await invalidateAll();
		await loadParticipants();
	}

	async function handleAdvancementComplete() {
		showAdvancementModal = false;
		selectedParticipants = new Set(); // Clear selection after advancement
		advancementInitialIds = [];
		await loadParticipants();
		await invalidateAll();
	}

	// Participant detail modal handlers
	function openParticipantDetail(participant) {
		selectedParticipantForDetail = participant;
		showParticipantDetail = true;
	}

	function handleParticipantDetailUpdate() {
		loadParticipants();
	}

	function handleParticipantDetailEmail(participant) {
		showParticipantDetail = false;
		emailRecipients = [participant];
		initialTemplateSlug = '';
		showEmailModal = true;
	}

	// Whether we have ever actually sent this participant anything - derived
	// from the real log instead of a separate "welcome email" flag, so it's
	// accurate no matter which template did it or who triggered it.
	function hasBeenEmailed(participant) {
		return (emailHistory[participant.id]?.length ?? 0) > 0;
	}

	// Most recent email logged for a participant, plus a tooltip listing the
	// last few - so "Invited" doesn't have to mean one specific template.
	function getLastEmailInfo(participant) {
		const logs = emailHistory[participant.id];
		if (!logs || logs.length === 0) return null;

		const [latest, ...rest] = logs;
		const tooltip = [latest, ...rest]
			.map((log) => `${emailDisplayName(log)} (${log.sent_by_name ? `sent by ${log.sent_by_name}` : 'system'}) — ${formatRelativeTime(log.sent_at)}`)
			.join('\n');

		return {
			label: emailDisplayName(latest),
			relative: formatRelativeTime(latest.sent_at),
			tooltip
		};
	}

	// Last time we have any evidence the participant was in the course.
	// last_login_at only moves when they authenticate again, and a session that
	// keeps refreshing never does - so someone who never signs out reads as
	// dormant no matter how much work they hand in. last_viewed_at moves every
	// time they open the course dashboard, so the later of the two is the honest
	// answer.
	function lastSeenAt(participant) {
		const stamps = [participant.last_login_at, participant.last_viewed_at]
			.filter(Boolean)
			.map(t => new Date(t).getTime())
			.filter(t => !isNaN(t));
		return stamps.length ? Math.max(...stamps) : null;
	}

	// Deliberately uncoloured. Traffic-lighting the date turned an arbitrary
	// threshold into a verdict - someone at 31 days went orange while someone at
	// 29 did not, and neither number means anything on its own. The date is the
	// information; the reader decides what is late.
	function _lastSeenActivity(seen) {
		return {
			label: formatRelativeTime(new Date(seen).toISOString()),
			sub: null,
			labelClass: 'text-gray-700',
			dot: null
		};
	}

	function getActivityInfo(participant) {
		if (participant.status === 'held') return { label: 'On Hold', sub: null, labelClass: 'text-orange-600', dot: null };
		if (participant.status === 'withdrawn') return { label: 'Withdrawn', sub: null, labelClass: 'text-red-500', dot: null };
		if (participant.status === 'completed') return { label: 'Completed', sub: null, labelClass: 'text-purple-600', dot: null };

		const seen = lastSeenAt(participant);

		if (participant.status === 'active') {
			if (!seen) {
				return { label: 'Active', sub: 'not signed in', labelClass: 'text-gray-700', dot: null };
			}
			return _lastSeenActivity(seen);
		}

		// DB status is 'invited' or 'pending' — use communication signals
		if (!hasBeenEmailed(participant) && !seen) {
			return { label: 'Not invited', sub: null, labelClass: 'text-gray-400 italic', dot: null };
		}
		if (!seen) {
			return { label: 'Invited', sub: 'not signed in', labelClass: 'text-gray-700', dot: null };
		}
		return _lastSeenActivity(seen);
	}

	// Keep getStatusBadge for CSV export and getStatusKey sorting
	function getStatusBadge(participant) {
		if (participant.status === 'active') return { label: 'Active', class: 'bg-green-100 text-green-700' };
		if (participant.status === 'held') return { label: 'On Hold', class: 'bg-orange-100 text-orange-700' };
		if (participant.status === 'withdrawn') return { label: 'Withdrawn', class: 'bg-red-100 text-red-700' };
		if (participant.status === 'completed') return { label: 'Completed', class: 'bg-purple-100 text-purple-700' };
		if (participant.status === 'pending') return { label: 'Pending', class: 'bg-yellow-100 text-yellow-700' };
		// DB status === 'invited'
		if (!hasBeenEmailed(participant) && !participant.last_login_at) {
			return { label: 'Not Invited', class: 'bg-gray-100 text-gray-600' };
		}
		return { label: 'Invited', class: 'bg-blue-100 text-blue-700' };
	}

	function getStatusKey(participant) {
		if (participant.status === 'active') return 'active';
		if (participant.status === 'held') return 'held';
		if (participant.status === 'withdrawn') return 'withdrawn';
		if (participant.status === 'completed') return 'completed';
		if (participant.status === 'pending') return 'pending';
		// DB status === 'invited': split by engagement signals
		if (participant.last_login_at) return 'active'; // logged in → treat same as DB-active
		if (!hasBeenEmailed(participant)) return 'not_invited';
		return 'invited'; // welcome email sent, hasn't signed in yet
	}

</script>

<div class="flex flex-col lg:flex-row min-h-screen lg:h-screen" style="background-color: var(--course-accent-dark);">
	<!-- Left Sidebar - Hidden on mobile -->
	<div class="hidden lg:block w-48 border-r flex-shrink-0 h-screen sticky top-0" style="border-color: rgba(255,255,255,0.1);">
		<CohortAdminSidebar
			cohort={selectedCohort}
			{stats}
			{recentActivity}
			onAdvanceSession={handleAdvanceSession}
			onEmailAll={handleEmailAll}
			onExport={handleExport}
			onAddParticipant={handleAddParticipant}
			onCohortSettings={handleCohortSettings}
		/>
	</div>

	<!-- Main Content Area -->
	<div class="flex-1 overflow-auto" style="background-color: var(--course-accent-dark);">
		<!-- Mobile Cohort Header - Shows on mobile when cohort is selected -->
		{#if selectedCohort}
			<div class="lg:hidden px-4 py-3 border-b" style="border-color: rgba(255,255,255,0.1);">
				<div class="flex items-center justify-between mb-2">
					<div class="min-w-0">
						<h2 class="text-sm font-bold text-white truncate">{selectedCohort.name}</h2>
						<p class="text-xs text-white/60">Session {selectedCohort.current_session}/{getTotalSessions(selectedCohort)} • {stats.participantCount} participants</p>
					</div>
				</div>
				<!-- Mobile Quick Actions -->
				<div class="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
					<button
						onclick={handleAddParticipant}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
						style="background-color: var(--course-accent-light); color: white;"
					>
						<UserPlus size={14} />
						Add
					</button>
					<button
						onclick={handleAdvanceSession}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/90 whitespace-nowrap transition-colors"
						style="background-color: rgba(255,255,255,0.1);"
					>
						<ArrowRight size={14} />
						Advance
					</button>
										<button
						onclick={handleEmailAll}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/90 whitespace-nowrap transition-colors"
						style="background-color: rgba(255,255,255,0.1);"
					>
						<Mail size={14} />
						Email All
					</button>
					<button
						onclick={handleExport}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/90 whitespace-nowrap transition-colors"
						style="background-color: rgba(255,255,255,0.1);"
					>
						<Download size={14} />
						Export
					</button>
					<button
						onclick={handleCohortSettings}
						class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white/90 whitespace-nowrap transition-colors"
						style="background-color: rgba(255,255,255,0.1);"
					>
						<Settings size={14} />
						Settings
					</button>
				</div>
			</div>
		{/if}

		{#if cohorts.length === 0}
			<!-- No cohorts exist yet -->
			<div class="flex items-center justify-center h-full p-8">
				<div class="text-center max-w-md">
					<div class="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-6">
						<Users size={40} class="text-white/60" />
					</div>
					<h2 class="text-2xl font-bold text-white mb-3">Create Your First Cohort</h2>
					<p class="text-white/70 mb-8">
						Cohorts are groups of participants taking your course together. Create one to start enrolling participants.
					</p>
					<button
						onclick={openCohortWizard}
						class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all hover:scale-105 hover:shadow-lg"
						style="background-color: var(--course-accent-light); color: white;"
					>
						<Plus size={20} />
						Create a Cohort
					</button>
				</div>
			</div>
		{:else if !selectedCohort}
			<!-- Cohorts exist but none selected -->
			<div class="flex items-center justify-center min-h-[60vh] lg:h-full p-4">
				<div class="text-center max-w-md">
					<h2 class="text-xl font-bold text-white mb-2">Select a Cohort</h2>
					<p class="text-sm text-white/70 mb-6">Choose a cohort to view details and manage participants.</p>

					<!-- Mobile: Show cohort list -->
					<div class="lg:hidden space-y-2">
						{#each cohorts as cohort}
							<button
								onclick={() => goto(`/admin/courses/${courseSlug}?cohort=${cohort.id}`)}
								class="w-full flex items-center justify-between px-4 py-3 rounded-lg text-left transition-colors"
								style="background-color: rgba(255,255,255,0.1);"
							>
								<div>
									<span class="text-white font-medium text-sm block">{cohort.name}</span>
									<span class="text-white/60 text-xs">Session {cohort.current_session}/{getTotalSessions(cohort)}</span>
								</div>
								<ArrowRight size={16} class="text-white/50" />
							</button>
						{/each}
					</div>

					<!-- Desktop: Just show message -->
					<p class="hidden lg:block text-xs text-white/50">Use the sidebar to select a cohort</p>
				</div>
			</div>
		{:else}
			<div class="p-3 sm:p-4 lg:p-6">
				<!-- Sticky filter header + bulk action bar -->
				<div
					class="sticky top-0 z-20 -mx-3 sm:-mx-4 lg:-mx-6 px-3 sm:px-4 lg:px-6 pb-3"
					style="background-color: var(--course-accent-dark);"
					bind:clientHeight={filterBarHeight}
				>
				<!-- Page Header + Search + Filters -->
				<div class="flex flex-col gap-2 mb-4">
					<div class="flex flex-wrap items-center gap-2">
						<h1 class="text-lg sm:text-xl font-bold text-white hidden lg:block shrink-0">Participants</h1>
						<div class="relative">
							<Search size={16} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
							<input
								type="text"
								bind:value={searchQuery}
								placeholder="Search..."
								class="w-36 sm:w-44 pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-gray-300 focus:outline-none bg-white text-gray-800 placeholder:text-gray-400 shadow-sm"
							/>
						</div>
						<FilterSelect bind:value={filterHub} options={hubOptions} icon={MapPin} />
						<FilterSelect bind:value={filterStatus} options={statusOptions} icon={Users} />
						<FiltersPanel
							bind:filterSession
							bind:filterAttendance
							bind:filterReflections
							{sessionOptions}
							{attendanceOptions}
							{reflectionOptions}
						/>
						{#if anyFilterActive}
							<button type="button" onclick={clearAllFilters} class="flex items-center gap-1 px-2 py-1.5 text-xs text-white/60 hover:text-white transition-colors rounded-lg hover:bg-white/10">
								<X size={12} />
								Clear
							</button>
						{/if}
					</div>
					{#if !loadingParticipants && participants.length > 0}
					<div class="flex items-center justify-between text-xs text-white/60 mt-0.5">
						<span>
							{#if filteredParticipants.length !== participants.length}
								<span class="text-white/90 font-medium">{filteredParticipants.length}</span> of {participants.length} participants
							{:else}
								{participants.length} participant{participants.length === 1 ? '' : 's'}
							{/if}
						</span>
						{#if filteredParticipants.length > 0}
							<button type="button" onclick={toggleSelectAll} class="text-white/60 hover:text-white transition-colors">
								{selectedParticipants.size === filteredParticipants.length && filteredParticipants.length > 0 ? 'Deselect all' : `Select all ${filteredParticipants.length}`}
							</button>
						{/if}
					</div>
					{/if}
				</div>
				<!-- Compact Bulk Action Bar (shows when participants selected) -->
				{#if selectedParticipants.size > 0}
					<div class="rounded-lg px-3 py-2 mb-3" style="background-color: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);">
						<div class="flex items-center justify-between mb-2 sm:mb-0">
							<span class="text-xs font-medium text-white">
								{selectedParticipants.size} selected
							</span>
							<button
								onclick={() => selectedParticipants = new Set()}
								class="text-xs text-white/70 hover:bg-white/10 px-2 py-1 rounded transition-colors sm:hidden"
							>
								Clear
							</button>
						</div>
						<div class="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide sm:flex-wrap sm:overflow-visible sm:pb-0 sm:mx-0 sm:px-0">
							<button
								onclick={handleEmailSelected}
								class="px-2 py-1.5 rounded text-xs font-medium text-white hover:bg-white/10 flex items-center gap-1.5 transition-colors whitespace-nowrap"
							>
								<Mail size={12} />
								Email
							</button>
							<button
								onclick={handleAdvanceSelected}
								class="px-2 py-1.5 rounded text-xs font-medium text-white hover:bg-white/10 flex items-center gap-1.5 transition-colors whitespace-nowrap"
							>
								<ArrowRight size={12} />
								Advance
							</button>
							<button
								onclick={handleAssignHub}
								class="px-2 py-1.5 rounded text-xs font-medium text-white hover:bg-white/10 flex items-center gap-1.5 transition-colors whitespace-nowrap"
							>
								<MapPin size={12} />
								Assign to Hub
							</button>
							<button
								onclick={handleRemoveSelected}
								class="px-2 py-1 rounded text-xs font-medium text-red-400 hover:bg-white/10 flex items-center gap-1.5 transition-colors whitespace-nowrap"
							>
								<Trash2 size={12} />
								Remove
							</button>
							<!-- Desktop clear button -->
							<button
								onclick={() => selectedParticipants = new Set()}
								class="hidden sm:flex text-xs text-white/70 hover:bg-white/10 px-2 py-1 rounded transition-colors whitespace-nowrap"
							>
								Clear
							</button>
						</div>
					</div>
				{/if}

				</div>

				<!-- Participants Table -->
				{#if loadingParticipants}
					<div class="flex items-center justify-center py-8">
						<Loader2 size={24} class="animate-spin text-white/40" />
						<span class="ml-2 text-sm text-white/70">Loading...</span>
					</div>
				{:else if filteredParticipants.length === 0}
					{#if participants.length === 0}
						<div class="bg-white rounded-lg border-2 border-dashed border-gray-200 p-12 text-center">
							<div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style="background-color: var(--course-accent-dark, #334642)20;">
								<UserPlus size={22} style="color: var(--course-accent-dark, #334642);" />
							</div>
							<h3 class="mb-1 text-sm font-semibold text-gray-900">No participants yet</h3>
							<p class="mb-5 text-sm text-gray-500">Add participants manually or via CSV upload to get started.</p>
							<button
								onclick={handleAddParticipant}
								class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
								style="background-color: var(--course-accent-dark, #334642);"
							>
								<UserPlus size={16} />
								Add Participants
							</button>
						</div>
					{:else}
						<div class="bg-white rounded border border-gray-200 p-8 text-center">
							<p class="text-sm text-gray-500">No participants match your search.</p>
						</div>
					{/if}
				{:else}
					<div class="bg-white rounded-lg border border-gray-200">
						<table class="w-full min-w-[540px] sm:min-w-[700px] lg:min-w-[900px]">
							<thead>
								<!-- Grouped header. lg-only: below lg the reflection columns are
										hidden and the colspans would not line up. The label doubles as the
										expand/collapse control for the group beneath it. -->
								<tr class="hidden lg:table-row bg-gray-100 sticky z-10" style="top: {filterBarHeight}px" bind:clientHeight={reflectionsHeaderHeight}>
									<th colspan="7" class="bg-gray-100"></th>
									<th colspan={reflectionsExpanded ? 4 : 1} class="px-2 sm:px-3 pt-2 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-400 bg-gray-100">
										<button
											onclick={toggleReflectionColumns}
											title={reflectionsExpanded ? 'Collapse to a single column' : 'Expand into completed / submitted / returned / draft columns'}
											class="inline-flex items-center gap-1 whitespace-nowrap hover:text-gray-600 cursor-pointer"
										>
											Reflections{reflectionTotal ? ` — of ${reflectionTotal}` : ''}
											<ChevronDown size={11} class="transition-transform {reflectionsExpanded ? '' : '-rotate-90'}" />
										</button>
									</th>
								</tr>
								<tr class="border-b border-gray-200 bg-gray-100">
									<th class="w-8 px-2 sm:px-3 py-2.5 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
										<input
											type="checkbox"
											onchange={toggleSelectAll}
											checked={selectedParticipants.size > 0 && selectedParticipants.size === filteredParticipants.length}
											class="rounded border-gray-300 w-3.5 h-3.5"
										/>
									</th>
									<th class="px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
										<button onclick={() => toggleSort('name')} class="hover:text-gray-900 cursor-pointer">Participant{sortIndicator('name')}</button>
									</th>
									<th class="hidden sm:table-cell px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">Phone</th>
									<th class="hidden md:table-cell px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
										<button onclick={() => toggleSort('hub')} class="hover:text-gray-900 cursor-pointer">Hub{sortIndicator('hub')}</button>
									</th>
									<th class="px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
										<button onclick={() => toggleSort('status')} class="hover:text-gray-900 cursor-pointer">Activity{sortIndicator('status')}</button>
									</th>
									<th class="px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
										<button onclick={() => toggleSort('session')} class="hover:text-gray-900 cursor-pointer">Sess.{sortIndicator('session')}</button>
									</th>
									<th class="hidden sm:table-cell px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
										<button onclick={() => toggleSort('attendance')} class="hover:text-gray-900 cursor-pointer">Attend.{sortIndicator('attendance')}</button>
									</th>
									{#if reflectionsExpanded}
										<th class="hidden lg:table-cell px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
											<button onclick={() => toggleSort('refMarked')} title="Marked as passed - the reflection is done" class="hover:text-gray-900 cursor-pointer">Completed{sortIndicator('refMarked')}</button>
										</th>
										<th class="hidden lg:table-cell px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
											<button onclick={() => toggleSort('refPending')} title="Handed in, waiting on review" class="hover:text-gray-900 cursor-pointer">Submitted{sortIndicator('refPending')}</button>
										</th>
										<th class="hidden lg:table-cell px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
											<button onclick={() => toggleSort('refReturned')} title="Sent back to the participant to revise" class="hover:text-gray-900 cursor-pointer">Returned{sortIndicator('refReturned')}</button>
										</th>
										<th class="hidden lg:table-cell px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
											<button onclick={() => toggleSort('refDraft')} title="Written but never submitted - no reviewer can see it" class="hover:text-gray-900 cursor-pointer">Draft{sortIndicator('refDraft')}</button>
										</th>
									{:else}
										<th class="hidden lg:table-cell px-2 sm:px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-600 whitespace-nowrap sticky z-10 bg-gray-100" style="top: {filterBarHeight + reflectionsHeaderHeight}px">
											<button onclick={() => toggleSort('refMarked')} title="Marked as passed - the reflection is done" class="hover:text-gray-900 cursor-pointer">Completed{sortIndicator('refMarked')}</button>
											<span class="mx-1 text-gray-300">•</span>
											<button onclick={() => toggleSort('refOther')} title="Submitted, returned and draft added together - expand for a column each" class="hover:text-gray-900 cursor-pointer">Other{sortIndicator('refOther')}</button>
										</th>
									{/if}
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each filteredParticipants as participant, i}
									{@const totalSessions = getTotalSessions(selectedCohort)}
									{@const cohortSession = selectedCohort.current_session || 0}
									{@const statusBadge = getStatusBadge(participant)}
									{@const activityInfo = getActivityInfo(participant)}
									{@const lastEmailInfo = getLastEmailInfo(participant)}
									<tr
										onclick={() => openParticipantDetail(participant)}
										class="hover:bg-gray-50 transition-colors cursor-pointer"
									>
										<td class="px-2 sm:px-3 py-2" onclick={(e) => e.stopPropagation()}>
											<input
												type="checkbox"
												checked={selectedParticipants.has(participant.id)}
												onclick={(e) => handleCheckboxClick(i, e)}
												onmousedown={handleCheckboxMousedown}
												class="rounded border-gray-300 w-3.5 h-3.5"
											/>
										</td>
										<!-- Participant: Name • email + Coordinator badge -->
										<td class="px-2 sm:px-3 py-2">
											<div class="flex items-center gap-1 sm:gap-1.5 flex-wrap">
												<span class="text-xs sm:text-sm font-medium text-gray-900">
													{participant.full_name}
												</span>
												{#if participant.role === 'coordinator'}
													<span class="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-purple-100 text-purple-700">
														<Home size={9} />
														Hub Coordinator
													</span>
												{/if}
												{#if participant.isBehind}
													<AlertTriangle size={12} class="text-orange-500 flex-shrink-0" />
												{/if}
											</div>
											<span class="text-[11px] sm:text-xs text-gray-500 block truncate max-w-[150px] sm:max-w-none">{participant.email}</span>
											{#if participant.status === 'pending'}
												<span class="text-[10px] text-gray-400 italic">No account yet</span>
											{/if}										</td>
										<!-- Phone - hidden on mobile -->
										<td class="hidden sm:table-cell px-2 sm:px-3 py-2">
											<span class="text-xs text-gray-600">{participant.user_profile?.phone || '-'}</span>
										</td>
										<!-- Hub - hidden on mobile/tablet -->
										<td class="hidden md:table-cell px-2 sm:px-3 py-2">
											<span class="text-xs text-gray-600">{participant.courses_hubs?.name || '-'}</span>
										</td>
										<!-- Activity -->
										<td class="px-2 sm:px-3 py-2">
											<span class="text-[10px] sm:text-xs font-medium {activityInfo.labelClass}">
												{#if activityInfo.dot}<span class="mr-1">{activityInfo.dot}</span>{/if}{activityInfo.label}
											</span>
											{#if activityInfo.sub}
												<span class="block text-[9px] sm:text-[10px] text-gray-400">{activityInfo.sub}</span>
											{/if}
											{#if lastEmailInfo}
												<span
													class="block text-[9px] sm:text-[10px] text-gray-400 truncate max-w-[110px] sm:max-w-none"
													title={lastEmailInfo.tooltip}
												>
													✉ {lastEmailInfo.label} · {lastEmailInfo.relative}
												</span>
											{/if}
										</td>
										<!-- Session progress -->
										<td class="px-2 sm:px-3 py-2">
											<span class="text-xs tabular-nums text-gray-700">
												{participant.current_session}/{totalSessions}
											</span>
										</td>
										<!-- Attendance - hidden on mobile -->
										<td class="hidden sm:table-cell px-2 sm:px-3 py-2">
											<span class="text-xs tabular-nums text-gray-700">
												{#if cohortSession > 0}
													{participant.attendanceCount}/{cohortSession}
												{:else}
													-
												{/if}
											</span>
										</td>
										<!-- Reflections (lg only): one combined column, or four when expanded -->
										{#if participant.reflectionStatus && (selectedCohort?.current_session || 0) > 0}
											{@const rc = participant.reflectionStatus.count}
											{#if reflectionsExpanded}
												<td class="hidden lg:table-cell px-2 sm:px-3 py-2 text-xs tabular-nums {rc.completed ? 'text-green-700 font-medium' : 'text-gray-300'}">{rc.completed}</td>
												<td class="hidden lg:table-cell px-2 sm:px-3 py-2 text-xs tabular-nums {rc.pending ? 'text-blue-600 font-medium' : 'text-gray-300'}">{rc.pending}</td>
												<td class="hidden lg:table-cell px-2 sm:px-3 py-2 text-xs tabular-nums {rc.returned ? 'text-rose-600 font-medium' : 'text-gray-300'}">{rc.returned}</td>
												<td class="hidden lg:table-cell px-2 sm:px-3 py-2 text-xs tabular-nums {rc.draft ? 'text-amber-600 font-medium' : 'text-gray-300'}">{rc.draft}</td>
											{:else}
												<td class="hidden lg:table-cell px-2 sm:px-3 py-2 text-xs tabular-nums" title={reflectionBreakdown(rc)}>
													<span class={rc.completed ? 'text-green-700 font-medium' : 'text-gray-300'}>{rc.completed}</span>
													<span class="mx-1 text-gray-300">•</span>
													<span class={otherReflections(rc) ? 'text-gray-700 font-medium' : 'text-gray-300'}>{otherReflections(rc)}</span>
												</td>
											{/if}
										{:else if reflectionsExpanded}
											<td class="hidden lg:table-cell px-2 sm:px-3 py-2 text-xs text-gray-400">-</td>
											<td class="hidden lg:table-cell px-2 sm:px-3 py-2"></td>
											<td class="hidden lg:table-cell px-2 sm:px-3 py-2"></td>
											<td class="hidden lg:table-cell px-2 sm:px-3 py-2"></td>
										{:else}
											<td class="hidden lg:table-cell px-2 sm:px-3 py-2 text-xs text-gray-400">-</td>
										{/if}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					<!-- Pagination info -->
					<div class="mt-2 text-xs text-white/70 text-center">
						{filteredParticipants.length} of {participants.length} participants
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>

<!-- Modals -->
<CohortSettingsModal
	show={showCohortSettings}
	cohort={selectedCohort}
	{courseSlug}
	{courseFeatures}
	{courseHubs}
	assignedHubIds={selectedCohort ? (cohortHubMap[selectedCohort.id] || []) : []}
	onClose={() => showCohortSettings = false}
	onUpdate={handleCohortUpdate}
	onDelete={handleCohortDelete}
/>

<ParticipantEnrollmentModal
	{courseSlug}
	cohort={selectedCohort}
	show={showStudentEnrollment}
	{hubs}
	onClose={() => showStudentEnrollment = false}
	onComplete={handleEnrollmentComplete}
/>

<StudentAdvancementModal
	{courseSlug}
	cohort={selectedCohort}
	students={participants}
	initialSelectedIds={advancementInitialIds}
	bind:show={showAdvancementModal}
	onComplete={handleAdvancementComplete}
/>

<ConfirmationModal
	show={showDeleteConfirm}
	title="Remove Participants"
	loading={deleteLoading}
	loadingMessage={deleteLoadingMessage}
	onCancel={() => showDeleteConfirm = false}
	actions={[
		{
			label: 'Remove from this cohort',
			description: 'Removes the enrollment from this cohort only. Their user account remains active and they can be re-enrolled later.',
			icon: UserMinus,
			variant: 'secondary',
			onClick: confirmRemoveEnrollment
		},
		...(selectedHasStaff ? [] : [{
			label: 'Permanently delete account',
			description: 'Completely removes their user account, all enrollments, and associated data. This cannot be undone.',
			icon: Trash2,
			variant: 'danger',
			onClick: confirmDeleteAccounts
		}])
	]}
>
	<p>You are about to remove <strong>{selectedParticipants.size} participant(s)</strong>.</p>
	{#if selectedHasStaff}
		<p class="text-sm text-amber-300 mt-2">Your selection includes a staff/admin account, so permanent deletion isn't available. You can still remove them from this cohort.</p>
	{/if}
	<p class="text-sm text-white/70">Choose an action:</p>
</ConfirmationModal>

<EmailSenderModal
	show={showEmailModal}
	{courseSlug}
	course={data.courseInfo}
	recipients={emailRecipients}
	cohortId={selectedCohort?.id}
	currentUserEmail={data.currentUserEmail}
	{initialTemplateSlug}
	onClose={() => {
		showEmailModal = false;
		initialTemplateSlug = '';
	}}
	onSent={async () => {
		selectedParticipants = new Set();
		await loadParticipants();
	}}
/>

<ParticipantDetailModal
	show={showParticipantDetail}
	participant={selectedParticipantForDetail}
	{courseSlug}
	cohort={selectedCohort}
	{hubs}
	{courseFeatures}
	totalSessions={getTotalSessions(selectedCohort)}
	onClose={() => {
		showParticipantDetail = false;
		selectedParticipantForDetail = null;
	}}
	onUpdate={handleParticipantDetailUpdate}
	onEmail={handleParticipantDetailEmail}
/>

<!-- Hub Assignment Modal -->
{#if showHubAssignModal}
<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
	<div class="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
		<h3 class="text-lg font-bold text-gray-900 mb-4">Assign to Hub</h3>
		<p class="text-sm text-gray-600 mb-4">
			Assign {selectedParticipants.size} selected participant(s) to a hub.
		</p>

		<select
			bind:value={selectedHubId}
			class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
		>
			<option value="">No hub (remove from hub)</option>
			{#each hubs as hub}
				<option value={hub.id}>{hub.name}</option>
			{/each}
		</select>

		{#if hubs.length === 0}
			<p class="text-sm text-amber-600 mb-4">
				No hubs available. Create hubs in the Hubs page first.
			</p>
		{/if}

		<div class="flex justify-end gap-3">
			<button
				onclick={() => showHubAssignModal = false}
				class="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
			>
				Cancel
			</button>
			<button
				onclick={handleBulkHubAssignment}
				class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
			>
				Assign
			</button>
		</div>
	</div>
</div>
{/if}

<script>
	import { invalidateAll } from '$app/navigation';
	import { Search, Mail, Download, ChevronDown, ChevronRight, Phone, MapPin, User, FileText, Calendar, Eye, Filter, X } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import EmailSenderModal from '$lib/components/EmailSenderModal.svelte';
	import ParticipantDetailModal from '$lib/components/ParticipantDetailModal.svelte';

	let { data } = $props();

	// Mobile filter state
	let showMobileFilters = $state(false);
	let course = $derived(data.course);
	let students = $derived(data.users || []);
	let hubs = $derived(data.hubs || []);
	let cohorts = $derived(data.cohorts || []);

	// Filter state
	let searchQuery = $state('');
	let selectedHub = $state('all');
	let selectedStatus = $state('all');
	let selectedCohort = $state('all');

	// Expanded rows state
	let expandedRows = $state(new Set());

	// Student selection state
	let selectedStudents = $state(new Set());
	let showEmailModal = $state(false);
	let showParticipantDetail = $state(false);
	let selectedParticipantForDetail = $state(null);

	// Filtered students
	let filteredStudents = $derived(
		students.filter(student => {
			const query = searchQuery.toLowerCase();
			const matchesSearch = !searchQuery ||
				student.user_profile?.full_name?.toLowerCase().includes(query) ||
				student.user_profile?.first_name?.toLowerCase().includes(query) ||
				student.user_profile?.last_name?.toLowerCase().includes(query) ||
				student.user_profile?.email?.toLowerCase().includes(query) ||
				student.user_profile?.phone?.toLowerCase().includes(query) ||
				student.user_profile?.parish_community?.toLowerCase().includes(query) ||
				student.user_profile?.parish_role?.toLowerCase().includes(query) ||
				student.user_profile?.address?.toLowerCase().includes(query) ||
				student.hub?.name?.toLowerCase().includes(query) ||
				student.notes?.toLowerCase().includes(query);

			const matchesHub = selectedHub === 'all' || student.hub_id === selectedHub;
			const matchesStatus = selectedStatus === 'all' || student.status === selectedStatus;
			const matchesCohort = selectedCohort === 'all' ||
				student.cohort_id === selectedCohort ||
				student.all_cohorts?.some(c => c?.id === selectedCohort);

			return matchesSearch && matchesHub && matchesStatus && matchesCohort;
		})
	);

	// Selection helpers
	let allFilteredSelected = $derived(
		filteredStudents.length > 0 &&
		filteredStudents.every(s => selectedStudents.has(s.id))
	);

	function toggleSelectAll() {
		if (allFilteredSelected) {
			filteredStudents.forEach(s => selectedStudents.delete(s.id));
		} else {
			filteredStudents.forEach(s => selectedStudents.add(s.id));
		}
		selectedStudents = new Set(selectedStudents);
	}

	let anchorIndex = $state(null);
	let anchorSelected = $state(true);
	let lastShiftChanged = $state(new Set());

	function handleCheckboxClick(index, e) {
		e.stopPropagation();
		const newSelected = new Set(selectedStudents);

		if (e.shiftKey && anchorIndex !== null) {
			const start = Math.min(anchorIndex, index);
			const end = Math.max(anchorIndex, index);

			for (const id of lastShiftChanged) {
				if (anchorSelected) {
					newSelected.delete(id);
				} else {
					newSelected.add(id);
				}
			}

			const newlyChanged = new Set();
			for (let i = start; i <= end; i++) {
				const sid = filteredStudents[i]?.id;
				if (sid) {
					if (anchorSelected) {
						if (!newSelected.has(sid)) newlyChanged.add(sid);
						newSelected.add(sid);
					} else {
						if (newSelected.has(sid)) newlyChanged.add(sid);
						newSelected.delete(sid);
					}
				}
			}

			lastShiftChanged = newlyChanged;
		} else {
			const id = filteredStudents[index]?.id;
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

		selectedStudents = newSelected;
	}

	function handleCheckboxMousedown(e) {
		if (e.shiftKey) e.preventDefault();
	}

	function toggleExpanded(studentId) {
		if (expandedRows.has(studentId)) {
			expandedRows.delete(studentId);
		} else {
			expandedRows.add(studentId);
		}
		expandedRows = new Set(expandedRows);
	}

	function openEmailModal() {
		showEmailModal = true;
	}

	function closeEmailModal() {
		showEmailModal = false;
		selectedStudents.clear();
		selectedStudents = new Set(selectedStudents);
	}

	let selectedEnrollments = $derived(
		students
			.filter(s => selectedStudents.has(s.id))
			.map(s => ({
				...s,
				full_name: s.user_profile?.full_name || 'Unknown',
				email: s.user_profile?.email || ''
			}))
	);

	let stats = $derived({
		total: filteredStudents.length,
		active: filteredStudents.filter(s => s.status === 'active').length,
		pending: filteredStudents.filter(s => s.status === 'pending' || s.status === 'invited').length
	});

	async function handleUpdateHub(studentId, newHubId, e) {
		e?.stopPropagation();
		try {
			const response = await fetch('/admin/courses/' + course.slug + '/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'update_enrollment',
					userId: studentId,
					updates: { hub_id: newHubId || null }
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to update hub');
			}

			await invalidateAll();
		} catch (err) {
			console.error('Error updating hub:', err);
			toastError(err.message || 'Failed to update hub', 'Update Failed');
		}
	}

	function getStatusBadge(status) {
		const badges = {
			active: 'bg-green-100 text-green-800',
			pending: 'bg-yellow-100 text-yellow-800',
			invited: 'bg-blue-100 text-blue-800',
			completed: 'bg-purple-100 text-purple-800',
			withdrawn: 'bg-red-100 text-red-800',
			held: 'bg-orange-100 text-orange-800'
		};
		return badges[status] || 'bg-gray-100 text-gray-600';
	}

	function openParticipantDetail(student, e) {
		e?.stopPropagation();
		selectedParticipantForDetail = student;
		showParticipantDetail = true;
	}

	async function handleParticipantDetailUpdate() {
		await invalidateAll();
	}

	function handleParticipantDetailEmail(participant) {
		showParticipantDetail = false;
		selectedStudents.clear();
		selectedStudents.add(participant.id);
		selectedStudents = new Set(selectedStudents);
		showEmailModal = true;
	}

	function exportToCSV() {
		const headers = [
			'First Name', 'Last Name', 'Email', 'Phone', 'Parish/Community',
			'Parish Role', 'Address', 'Hub', 'Cohort(s)', 'Status', 'Notes', 'Enrolled Date'
		];

		const rows = filteredStudents.map(s => [
			s.user_profile?.first_name || '',
			s.user_profile?.last_name || '',
			s.user_profile?.email || s.email || '',
			s.user_profile?.phone || '',
			s.user_profile?.parish_community || '',
			s.user_profile?.parish_role || '',
			s.user_profile?.address || '',
			s.hub?.name || '',
			s.all_cohorts?.map(c => c?.name).filter(Boolean).join('; ') || s.cohort?.name || '',
			s.status || '',
			s.notes || '',
			s.created_at ? new Date(s.created_at).toLocaleDateString() : ''
		]);

		const csvContent = [
			headers.join(','),
			...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
		].join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.setAttribute('href', url);
		link.setAttribute('download', `${course?.slug || 'course'}-participants-${new Date().toISOString().split('T')[0]}.csv`);
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);

		toastSuccess(`Exported ${filteredStudents.length} participants`);
	}

	// Get cohort names for display
	function getCohortDisplay(student) {
		if (student.all_cohorts?.length > 0) {
			const names = student.all_cohorts.map(c => c?.name).filter(Boolean);
			if (names.length > 1) {
				return { text: names.join(', '), multiple: true };
			}
			return { text: names[0] || '-', multiple: false };
		}
		return { text: student.cohort?.name || '-', multiple: false };
	}
</script>

<div class="flex flex-col lg:flex-row min-h-screen">
	<!-- Sidebar Filters (Desktop only) -->
	<div class="w-64 flex-shrink-0 h-screen hidden lg:flex flex-col border-r" style="background-color: var(--course-accent-dark); border-color: rgba(255,255,255,0.1);">
		<div class="p-4 border-b" style="border-color: rgba(255,255,255,0.1);">
			<h2 class="text-sm font-bold text-white/90 uppercase tracking-wide">Participant Database</h2>
			<p class="text-xs text-white/50 mt-1">
				<span class="font-semibold text-white">{stats.total}</span> of {students.length} showing
			</p>
		</div>

		<div class="flex-1 overflow-y-auto p-3 space-y-4">
			<div>
				<div class="relative">
					<Search size="14" class="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-white/40" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search all fields..."
						class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg text-white placeholder-white/40 focus:outline-none"
						style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
					/>
				</div>
			</div>

			<div class="grid grid-cols-2 gap-2">
				<div class="rounded-lg p-2.5" style="background-color: rgba(255,255,255,0.05);">
					<p class="text-[10px] text-white/50 uppercase tracking-wider">Active</p>
					<p class="text-lg font-bold text-white">{stats.active}</p>
				</div>
				<div class="rounded-lg p-2.5" style="background-color: rgba(255,255,255,0.05);">
					<p class="text-[10px] text-white/50 uppercase tracking-wider">Pending</p>
					<p class="text-lg font-bold text-white/70">{stats.pending}</p>
				</div>
			</div>

			{#if cohorts.length > 1}
				<div>
					<label class="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2 block px-1" for="cohort-filter">Cohort</label>
					<select
						id="cohort-filter"
						bind:value={selectedCohort}
						class="w-full px-3 py-1.5 text-xs rounded-lg text-white focus:outline-none"
						style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
					>
						<option value="all" class="text-gray-900">All Cohorts</option>
						{#each cohorts as cohort}
							<option value={cohort.id} class="text-gray-900">{cohort.name}</option>
						{/each}
					</select>
				</div>
			{/if}

			<div>
				<h3 class="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2 px-1">Status</h3>
				<div class="space-y-0.5">
					{#each [
						{ value: 'all', label: 'All Statuses' },
						{ value: 'active', label: 'Active' },
						{ value: 'pending', label: 'Pending' },
						{ value: 'invited', label: 'Invited' },
						{ value: 'completed', label: 'Completed' },
						{ value: 'withdrawn', label: 'Withdrawn' }
					] as option}
						<button
							onclick={() => selectedStatus = option.value}
							class="w-full flex items-center px-3 py-1.5 rounded-lg text-xs transition-colors {selectedStatus === option.value ? 'text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'}"
							style={selectedStatus === option.value ? 'background-color: color-mix(in srgb, var(--course-accent-light) 20%, transparent)' : ''}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			<div>
				<label class="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2 block px-1" for="hub-filter">Hub</label>
				<select
					id="hub-filter"
					bind:value={selectedHub}
					class="w-full px-3 py-1.5 text-xs rounded-lg text-white focus:outline-none"
					style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
				>
					<option value="all" class="text-gray-900">All Hubs</option>
					<option value="" class="text-gray-900">No Hub</option>
					{#each hubs as hub}
						<option value={hub.id} class="text-gray-900">{hub.name}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="p-3 border-t" style="border-color: rgba(255,255,255,0.1);">
			<button
				onclick={exportToCSV}
				class="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg transition-colors text-white/80 hover:text-white hover:bg-white/10"
				style="background-color: rgba(255,255,255,0.05);"
			>
				<Download size={14} />
				Export CSV
			</button>
		</div>
	</div>

	<!-- Main Content -->
	<div class="flex-1 flex flex-col min-w-0" style="background-color: var(--course-accent-dark);">
		<!-- Mobile Filter Section -->
		<div class="lg:hidden flex-shrink-0 p-3 border-b" style="border-color: rgba(255,255,255,0.1);">
			<!-- Header with stats and filter toggle -->
			<div class="flex items-center justify-between mb-3">
				<div>
					<h2 class="text-sm font-bold text-white/90">Participants</h2>
					<p class="text-xs text-white/50">
						<span class="font-semibold text-white">{stats.total}</span> of {students.length} showing
					</p>
				</div>
				<div class="flex items-center gap-2">
					<button
						onclick={exportToCSV}
						class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors text-white/80 hover:text-white"
						style="background-color: rgba(255,255,255,0.1);"
					>
						<Download size={14} />
					</button>
					<button
						onclick={() => showMobileFilters = !showMobileFilters}
						class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors text-white/80 hover:text-white {showMobileFilters ? 'text-white' : ''}"
						style="background-color: {showMobileFilters ? 'var(--course-accent)' : 'rgba(255,255,255,0.1)'};"
					>
						{#if showMobileFilters}
							<X size={14} />
						{:else}
							<Filter size={14} />
						{/if}
						Filters
					</button>
				</div>
			</div>

			<!-- Search (always visible on mobile) -->
			<div class="relative mb-3">
				<Search size="14" class="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-white/40" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search all fields..."
					class="w-full pl-8 pr-3 py-2 text-sm rounded-lg text-white placeholder-white/40 focus:outline-none"
					style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
				/>
			</div>

			<!-- Collapsible filters -->
			{#if showMobileFilters}
				<div class="space-y-3 pt-2 border-t" style="border-color: rgba(255,255,255,0.1);">
					<!-- Quick stats -->
					<div class="flex gap-2">
						<div class="flex-1 rounded-lg p-2" style="background-color: rgba(255,255,255,0.05);">
							<p class="text-[10px] text-white/50 uppercase tracking-wider">Active</p>
							<p class="text-base font-bold text-white">{stats.active}</p>
						</div>
						<div class="flex-1 rounded-lg p-2" style="background-color: rgba(255,255,255,0.05);">
							<p class="text-[10px] text-white/50 uppercase tracking-wider">Pending</p>
							<p class="text-base font-bold text-white/70">{stats.pending}</p>
						</div>
					</div>

					<!-- Filter dropdowns in a row -->
					<div class="flex gap-2 overflow-x-auto scrollbar-hide">
						<!-- Status filter -->
						<select
							bind:value={selectedStatus}
							class="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg text-white focus:outline-none"
							style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
						>
							<option value="all" class="text-gray-900">All Statuses</option>
							<option value="active" class="text-gray-900">Active</option>
							<option value="pending" class="text-gray-900">Pending</option>
							<option value="invited" class="text-gray-900">Invited</option>
							<option value="completed" class="text-gray-900">Completed</option>
							<option value="withdrawn" class="text-gray-900">Withdrawn</option>
						</select>

						<!-- Hub filter -->
						<select
							bind:value={selectedHub}
							class="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg text-white focus:outline-none"
							style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
						>
							<option value="all" class="text-gray-900">All Hubs</option>
							<option value="" class="text-gray-900">No Hub</option>
							{#each hubs as hub}
								<option value={hub.id} class="text-gray-900">{hub.name}</option>
							{/each}
						</select>

						<!-- Cohort filter (if multiple cohorts) -->
						{#if cohorts.length > 1}
							<select
								bind:value={selectedCohort}
								class="flex-shrink-0 px-3 py-1.5 text-xs rounded-lg text-white focus:outline-none"
								style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
							>
								<option value="all" class="text-gray-900">All Cohorts</option>
								{#each cohorts as cohort}
									<option value={cohort.id} class="text-gray-900">{cohort.name}</option>
								{/each}
							</select>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<!-- Fixed Action Bar -->
		<div class="flex-shrink-0 p-3 sm:p-4 border-b" style="border-color: rgba(255,255,255,0.1);">
			{#if selectedStudents.size > 0}
				<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
					<div class="flex items-center gap-3">
						<span class="text-sm font-medium text-white">{selectedStudents.size} selected</span>
						<button
							onclick={() => { selectedStudents.clear(); selectedStudents = new Set(selectedStudents); }}
							class="text-xs text-white/60 hover:text-white underline"
						>
							Clear
						</button>
					</div>
					<div class="flex items-center gap-2 overflow-x-auto scrollbar-hide whitespace-nowrap">
						{#if selectedStudents.size === 1}
							{@const selectedStudent = filteredStudents.find(s => selectedStudents.has(s.id))}
							{#if selectedStudent}
								<button
									onclick={(e) => openParticipantDetail(selectedStudent, e)}
									class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-white/80 hover:text-white flex-shrink-0"
									style="background-color: rgba(255,255,255,0.1);"
								>
									<Eye size={14} />
									<span class="hidden sm:inline">View Details</span>
									<span class="sm:hidden">View</span>
								</button>
							{/if}
						{/if}
						<button
							onclick={openEmailModal}
							class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors hover:opacity-90 flex-shrink-0"
							style="background-color: var(--course-accent);"
						>
							<Mail size={14} />
							<span class="hidden sm:inline">Send Email</span>
							<span class="sm:hidden">Email</span>
						</button>
					</div>
				</div>
			{:else}
				<div class="text-xs sm:text-sm text-white/50">
					<span class="hidden sm:inline">Click a row to expand details, or select participants for bulk actions</span>
					<span class="sm:hidden">Tap to expand, select for actions</span>
				</div>
			{/if}
		</div>

		<!-- Table Container -->
		<div class="flex-1 overflow-y-auto p-3 sm:p-4">
			<div class="bg-white rounded-lg shadow-lg overflow-hidden">
				<div class="overflow-x-auto">
					<table class="w-full table-fixed min-w-[400px] sm:min-w-[600px]">
						<thead class="bg-gray-50 border-b border-gray-200">
							<tr>
								<th class="w-8 sm:w-10 px-2 sm:px-3 py-2 sm:py-3">
									<input
										type="checkbox"
										checked={allFilteredSelected}
										onchange={toggleSelectAll}
										class="w-3.5 h-3.5 rounded border-gray-300 focus:ring-2"
									/>
								</th>
								<th class="px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
									Participant
								</th>
								<th class="w-24 sm:w-32 px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 hidden sm:table-cell">
									Hub
								</th>
								<th class="w-28 sm:w-36 px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500 hidden md:table-cell">
									Cohort
								</th>
								<th class="w-20 sm:w-24 px-2 sm:px-4 py-2 sm:py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-gray-500">
									Status
								</th>
								<th class="w-8 sm:w-10 px-2 sm:px-3 py-2 sm:py-3"></th>
							</tr>
						</thead>
					<tbody class="divide-y divide-gray-100">
						{#if filteredStudents.length === 0}
							<tr>
								<td colspan="6" class="px-4 py-12 text-center text-xs sm:text-sm text-gray-500">
									No participants found
								</td>
							</tr>
						{:else}
							{#each filteredStudents as student, i}
								{@const isExpanded = expandedRows.has(student.id)}
								{@const isSelected = selectedStudents.has(student.id)}
								{@const cohortInfo = getCohortDisplay(student)}
								<!-- Main Row -->
								<tr
									onclick={() => toggleExpanded(student.id)}
									class="cursor-pointer transition-colors {isExpanded ? 'bg-gray-100' : isSelected ? 'bg-gray-50' : 'hover:bg-gray-50'}"
								>
									<td class="w-8 sm:w-10 px-2 sm:px-3 py-2 sm:py-3">
										<input
											type="checkbox"
											checked={isSelected}
											onclick={(e) => handleCheckboxClick(i, e)}
											onmousedown={handleCheckboxMousedown}
											class="w-3.5 h-3.5 rounded border-gray-300 focus:ring-2"
										/>
									</td>
									<td class="px-2 sm:px-4 py-2 sm:py-3">
										<div class="text-xs sm:text-sm font-medium text-gray-900">
											{#if student.user_profile?.first_name || student.user_profile?.last_name}
												{student.user_profile?.first_name || ''} {student.user_profile?.last_name || ''}
											{:else}
												{student.user_profile?.full_name || student.full_name || 'Unknown'}
											{/if}
										</div>
										<div class="text-[10px] sm:text-xs text-gray-500 truncate max-w-[120px] sm:max-w-none">{student.user_profile?.email || student.email || ''}</div>
										<!-- Show hub on mobile (since column is hidden) -->
										<div class="sm:hidden text-[10px] text-gray-400 mt-0.5">
											{student.hub?.name || 'No Hub'}
										</div>
									</td>
									<td class="w-24 sm:w-32 px-2 sm:px-4 py-2 sm:py-3 hidden sm:table-cell">
										<select
											value={student.hub_id || ''}
											onclick={(e) => e.stopPropagation()}
											onchange={(e) => handleUpdateHub(student.id, e.target.value || null, e)}
											class="w-full text-xs px-1.5 sm:px-2 py-1 rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 text-gray-700 bg-white truncate"
										>
											<option value="">No Hub</option>
											{#each hubs as hub}
												<option value={hub.id}>{hub.name}</option>
											{/each}
										</select>
									</td>
									<td class="w-28 sm:w-36 px-2 sm:px-4 py-2 sm:py-3 hidden md:table-cell">
										{#if cohortInfo.multiple}
											<div class="text-xs text-gray-600 truncate" title={student.all_cohorts?.map(c => c?.name).filter(Boolean).join(', ')}>
												{student.all_cohorts?.length} cohorts
											</div>
										{:else}
											<span class="text-xs text-gray-600 truncate block">{cohortInfo.text}</span>
										{/if}
									</td>
									<td class="w-20 sm:w-24 px-2 sm:px-4 py-2 sm:py-3">
										<span class="inline-flex px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-medium rounded-full {getStatusBadge(student.status)}">
											{student.status || 'unknown'}
										</span>
									</td>
									<td class="w-8 sm:w-10 px-2 sm:px-3 py-2 sm:py-3 text-center">
										<ChevronRight size={16} class="inline-block text-gray-400 transition-transform duration-200 {isExpanded ? 'rotate-90' : ''}" />
									</td>
								</tr>

								<!-- Expanded Details Row -->
								{#if isExpanded}
									<tr class="bg-gray-50/80 border-b border-gray-200">
										<td colspan="6" class="px-2 sm:px-4 py-3 sm:py-4">
											<div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
												<!-- Mobile-only: Hub assignment (since column is hidden) -->
												<div class="sm:hidden">
													<div class="text-[10px] font-semibold uppercase text-gray-400 mb-1">Hub</div>
													<select
														value={student.hub_id || ''}
														onclick={(e) => e.stopPropagation()}
														onchange={(e) => handleUpdateHub(student.id, e.target.value || null, e)}
														class="w-full text-xs px-2 py-1 rounded border border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400 text-gray-700 bg-white"
													>
														<option value="">No Hub</option>
														{#each hubs as hub}
															<option value={hub.id}>{hub.name}</option>
														{/each}
													</select>
												</div>
												<!-- Mobile-only: Cohort info (since column is hidden) -->
												{#if cohortInfo.multiple || cohortInfo.text !== '-'}
													<div class="md:hidden">
														<div class="text-[10px] font-semibold uppercase text-gray-400 mb-1">Cohort</div>
														{#if cohortInfo.multiple}
															<div class="flex flex-wrap gap-1">
																{#each student.all_cohorts?.filter(c => c?.name) || [] as cohort}
																	<span class="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-gray-200 text-gray-600">
																		{cohort.name}
																	</span>
																{/each}
															</div>
														{:else}
															<div class="text-gray-700">{cohortInfo.text}</div>
														{/if}
													</div>
												{/if}
												<!-- Contact -->
												<div>
													<div class="text-[10px] font-semibold uppercase text-gray-400 mb-1">Phone</div>
													<div class="text-gray-700">{student.user_profile?.phone || '-'}</div>
												</div>
												<div>
													<div class="text-[10px] font-semibold uppercase text-gray-400 mb-1">Parish / Community</div>
													<div class="text-gray-700">{student.user_profile?.parish_community || '-'}</div>
												</div>
												<div>
													<div class="text-[10px] font-semibold uppercase text-gray-400 mb-1">Parish Role</div>
													<div class="text-gray-700">{student.user_profile?.parish_role || '-'}</div>
												</div>
												<div>
													<div class="text-[10px] font-semibold uppercase text-gray-400 mb-1">Address</div>
													<div class="text-gray-700">{student.user_profile?.address || '-'}</div>
												</div>
												{#if cohortInfo.multiple}
													<div class="hidden md:block">
														<div class="text-[10px] font-semibold uppercase text-gray-400 mb-1">All Cohorts</div>
														<div class="flex flex-wrap gap-1">
															{#each student.all_cohorts?.filter(c => c?.name) || [] as cohort}
																<span class="inline-flex px-1.5 py-0.5 text-[10px] rounded bg-gray-200 text-gray-600">
																	{cohort.name}
																</span>
															{/each}
														</div>
													</div>
												{/if}
												<div>
													<div class="text-[10px] font-semibold uppercase text-gray-400 mb-1">Admin Notes</div>
													<div class="text-gray-700">{student.notes || '-'}</div>
												</div>
												<div>
													<div class="text-[10px] font-semibold uppercase text-gray-400 mb-1">Enrolled</div>
													<div class="text-gray-700">{student.created_at ? new Date(student.created_at).toLocaleDateString() : '-'}</div>
												</div>
												<div class="flex items-end sm:col-span-1">
													<button
														onclick={(e) => openParticipantDetail(student, e)}
														class="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors text-gray-700 bg-white border border-gray-300 hover:bg-gray-100"
													>
														<Eye size={14} />
														Edit Profile
													</button>
												</div>
											</div>
										</td>
									</tr>
								{/if}
							{/each}
						{/if}
					</tbody>
				</table>
				</div>
			</div>

			<!-- Results Count -->
			<div class="mt-3 sm:mt-4 text-[10px] sm:text-xs text-white/60 text-center">
				Showing {filteredStudents.length} of {students.length} participants
			</div>
		</div>
	</div>
</div>

<!-- Email Sender Modal -->
<EmailSenderModal
	show={showEmailModal}
	courseSlug={course?.slug}
	{course}
	recipients={selectedEnrollments}
	currentUserEmail={data.currentUserEmail}
	onClose={closeEmailModal}
	onSent={closeEmailModal}
/>

<!-- Participant Detail Modal -->
<ParticipantDetailModal
	show={showParticipantDetail}
	participant={selectedParticipantForDetail}
	courseSlug={course?.slug}
	hubs={hubs}
	totalSessions={data.totalSessions || 8}
	showCohortHistory={false}
	onClose={() => {
		showParticipantDetail = false;
		selectedParticipantForDetail = null;
	}}
	onUpdate={handleParticipantDetailUpdate}
	onEmail={handleParticipantDetailEmail}
/>

<style>
	/* Use course accent color for checkboxes */
	input[type="checkbox"]:checked {
		background-color: var(--course-accent);
		border-color: var(--course-accent);
	}
	input[type="checkbox"]:focus {
		--tw-ring-color: var(--course-accent);
	}

	/* Hide scrollbar for horizontal scroll areas */
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>

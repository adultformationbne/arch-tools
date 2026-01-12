<script>
	import { invalidateAll } from '$app/navigation';
	import { Search, Mail } from 'lucide-svelte';
	import { toastError } from '$lib/utils/toast-helpers.js';
	import EmailSenderModal from '$lib/components/EmailSenderModal.svelte';
	import ParticipantDetailModal from '$lib/components/ParticipantDetailModal.svelte';

	let { data } = $props();
	let course = $derived(data.course);
	let students = $derived(data.users || []);
	let hubs = $derived(data.hubs || []);

	// Filter state
	let searchQuery = $state('');
	let selectedHub = $state('all');
	let selectedStatus = $state('all');

	// Student selection state
	let selectedStudents = $state(new Set());
	let showEmailModal = $state(false);
	let showParticipantDetail = $state(false);
	let selectedParticipantForDetail = $state(null);

	// Selection helpers
	let allFilteredSelected = $derived(
		filteredStudents.length > 0 &&
		filteredStudents.every(s => selectedStudents.has(s.id))
	);

	function toggleSelectAll() {
		if (allFilteredSelected) {
			// Deselect all filtered students
			filteredStudents.forEach(s => selectedStudents.delete(s.id));
		} else {
			// Select all filtered students
			filteredStudents.forEach(s => selectedStudents.add(s.id));
		}
		selectedStudents = new Set(selectedStudents);
	}

	function toggleStudent(studentId) {
		if (selectedStudents.has(studentId)) {
			selectedStudents.delete(studentId);
		} else {
			selectedStudents.add(studentId);
		}
		selectedStudents = new Set(selectedStudents);
	}

	function openEmailModal() {
		showEmailModal = true;
	}

	function closeEmailModal() {
		showEmailModal = false;
		// Clear selection after sending
		selectedStudents.clear();
		selectedStudents = new Set(selectedStudents);
	}

	// Get selected enrollments for email modal - transform to expected format
	let selectedEnrollments = $derived(
		students
			.filter(s => selectedStudents.has(s.id))
			.map(s => ({
				...s,
				full_name: s.user_profile?.full_name || 'Unknown',
				email: s.user_profile?.email || ''
			}))
	);

	// Filtered students
	let filteredStudents = $derived(
		students.filter(student => {
			// Search filter
			const matchesSearch = !searchQuery ||
				student.user_profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				student.user_profile?.email?.toLowerCase().includes(searchQuery.toLowerCase());

			// Hub filter
			const matchesHub = selectedHub === 'all' || student.hub_id === selectedHub;

			// Status filter
			const matchesStatus = selectedStatus === 'all' || student.status === selectedStatus;

			return matchesSearch && matchesHub && matchesStatus;
		})
	);

	// Stats
	let stats = $derived({
		total: students.length,
		active: students.filter(s => s.status === 'active').length,
		pending: students.filter(s => s.status === 'pending' || s.status === 'invited').length
	});

	async function handleUpdateHub(studentId, newHubId) {
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

			// Refresh data
			await invalidateAll();
		} catch (err) {
			console.error('Error updating hub:', err);
			toastError(err.message || 'Failed to update hub', 'Update Failed');
		}
	}

	function getStatusBadge(status) {
		const badges = {
			active: 'bg-green-100 text-green-700',
			pending: 'bg-yellow-100 text-yellow-700',
			invited: 'bg-blue-100 text-blue-700',
			completed: 'bg-gray-100 text-gray-700',
			withdrawn: 'bg-red-100 text-red-700'
		};
		return badges[status] || 'bg-gray-100 text-gray-700';
	}

	// Participant detail modal handlers
	function openParticipantDetail(student) {
		selectedParticipantForDetail = student;
		showParticipantDetail = true;
	}

	async function handleParticipantDetailUpdate() {
		await invalidateAll();
	}

	function handleParticipantDetailEmail(participant) {
		showParticipantDetail = false;
		// Transform participant to expected format for email modal
		const emailRecipient = {
			...participant,
			full_name: participant.full_name || participant.user_profile?.full_name || 'Unknown',
			email: participant.email || participant.user_profile?.email || ''
		};
		selectedStudents.clear();
		selectedStudents.add(participant.id);
		selectedStudents = new Set(selectedStudents);
		showEmailModal = true;
	}
</script>

<div class="flex min-h-screen">
	<!-- Sidebar Filters -->
	<div class="w-64 flex-shrink-0 h-screen flex flex-col border-r" style="background-color: var(--course-accent-dark); border-color: rgba(255,255,255,0.1);">
		<!-- Header -->
		<div class="p-4 border-b" style="border-color: rgba(255,255,255,0.1);">
			<h2 class="text-sm font-bold text-white/90 uppercase tracking-wide">Participants</h2>
			<p class="text-xs text-white/50 mt-1">
				<span class="font-semibold text-white">{stats.total}</span> enrolled
			</p>
		</div>

		<!-- Scrollable Content -->
		<div class="flex-1 overflow-y-auto p-3 space-y-4">
			<!-- Search -->
			<div>
				<div class="relative">
					<Search size="14" class="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-white/40" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search..."
						class="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg text-white placeholder-white/40 focus:outline-none"
						style="background-color: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);"
					/>
				</div>
			</div>

			<!-- Stats -->
			<div class="grid grid-cols-2 gap-2">
				<div class="rounded-lg p-2.5" style="background-color: rgba(255,255,255,0.05);">
					<p class="text-[10px] text-white/50 uppercase tracking-wider">Active</p>
					<p class="text-lg font-bold text-green-400">{stats.active}</p>
				</div>
				<div class="rounded-lg p-2.5" style="background-color: rgba(255,255,255,0.05);">
					<p class="text-[10px] text-white/50 uppercase tracking-wider">Pending</p>
					<p class="text-lg font-bold text-yellow-400">{stats.pending}</p>
				</div>
			</div>

			<!-- Status Filter -->
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

			<!-- Hub Filter -->
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
	</div>

	<!-- Main Content -->
	<div class="flex-1 p-6 overflow-y-auto">
		<!-- Action Toolbar (appears when students selected) -->
		{#if selectedStudents.size > 0}
			<div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex items-center justify-between">
				<div class="flex items-center gap-3">
					<div class="text-xs font-medium text-blue-900">
						{selectedStudents.size} selected
					</div>
					<button
						onclick={() => { selectedStudents.clear(); selectedStudents = new Set(selectedStudents); }}
						class="text-xs text-blue-700 hover:text-blue-900 underline"
					>
						Clear
					</button>
				</div>
				<button
					onclick={openEmailModal}
					class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
				>
					<Mail size={14} />
					Send Email
				</button>
			</div>
		{/if}

		<!-- Students Table -->
		<div class="bg-white rounded-lg overflow-hidden shadow-sm">
			<table class="w-full">
				<thead class="border-b" style="background-color: var(--course-accent-light); border-color: var(--course-surface);">
					<tr>
						<th class="px-4 py-2.5 w-10">
							<input
								type="checkbox"
								checked={allFilteredSelected}
								onchange={toggleSelectAll}
								class="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
						</th>
						<th class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style="color: var(--course-accent-darkest);">
							Participant
						</th>
						<th class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style="color: var(--course-accent-darkest);">
							Cohort
						</th>
						<th class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style="color: var(--course-accent-darkest);">
							Hub
						</th>
						<th class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style="color: var(--course-accent-darkest);">
							Session
						</th>
						<th class="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider" style="color: var(--course-accent-darkest);">
							Status
						</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-gray-100">
					{#if filteredStudents.length === 0}
						<tr>
							<td colspan="6" class="px-4 py-8 text-center text-sm text-gray-500">
								No participants found
							</td>
						</tr>
					{:else}
						{#each filteredStudents as student}
							<tr class="hover:bg-gray-50 transition-colors">
								<td class="px-4 py-2.5">
									<input
										type="checkbox"
										checked={selectedStudents.has(student.id)}
										onchange={() => toggleStudent(student.id)}
										class="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
								</td>
								<td class="px-4 py-2.5">
									<button
										onclick={() => openParticipantDetail(student)}
										class="text-left hover:bg-gray-100 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
									>
										<div class="text-sm font-medium text-gray-900 hover:text-blue-600">{student.user_profile?.full_name || 'Unknown'}</div>
										<div class="text-xs text-gray-500">{student.user_profile?.email || 'No email'}</div>
									</button>
								</td>
								<td class="px-4 py-2.5">
									{#if student.all_cohorts?.length > 0}
									{@const firstCohort = student.all_cohorts[0]}
									{@const extraCohorts = student.all_cohorts.slice(1).filter(c => c)}
										{#if firstCohort}
											<div class="text-sm text-gray-900">{firstCohort.name}</div>
											{#if firstCohort.module}
												<div class="text-xs text-gray-500">{firstCohort.module.name}</div>
											{/if}
										{/if}
										{#if extraCohorts.length > 0}
											<details class="mt-1">
												<summary class="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
													+{extraCohorts.length} more
												</summary>
												<div class="mt-1 pl-2 border-l-2 border-gray-200 space-y-1">
													{#each extraCohorts as cohort}
														<div>
															<div class="text-sm text-gray-700">{cohort.name}</div>
															{#if cohort.module}
																<div class="text-xs text-gray-500">{cohort.module.name}</div>
															{/if}
														</div>
													{/each}
												</div>
											</details>
										{/if}
									{:else if student.cohort}
										<div class="text-sm text-gray-900">{student.cohort.name}</div>
										{#if student.cohort.module}
											<div class="text-xs text-gray-500">{student.cohort.module.name}</div>
										{/if}
									{:else}
										<span class="text-xs text-gray-400">-</span>
									{/if}
								</td>
								<td class="px-4 py-2.5">
									<select
										value={student.hub_id || ''}
										onchange={(e) => handleUpdateHub(student.id, e.target.value || null)}
										class="text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 text-gray-900 bg-white"
									>
										<option value="">No Hub</option>
										{#each hubs as hub}
											<option value={hub.id}>{hub.name}</option>
										{/each}
									</select>
								</td>
								<td class="px-4 py-2.5 text-sm text-gray-900">
									{student.current_session || 1}
								</td>
								<td class="px-4 py-2.5">
									<span class="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full {getStatusBadge(student.status)}">
										{student.status}
									</span>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>

		<!-- Results Count -->
		<div class="mt-3 text-xs text-white/60 text-center">
			Showing {filteredStudents.length} of {students.length} participants
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
	totalSessions={8}
	onClose={() => {
		showParticipantDetail = false;
		selectedParticipantForDetail = null;
	}}
	onUpdate={handleParticipantDetailUpdate}
	onEmail={handleParticipantDetailEmail}
/>

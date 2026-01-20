<script>
	import { Users, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Check, X, Loader2 } from '$lib/icons';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';
	import { getUserInitials } from '$lib/utils/avatar.js';

	// Props from parent
	let { hubData = null, courseSlug = '' } = $props();

	let isExpanded = $state(false);
	let isLoading = $state(false);
	let isSaving = $state(false);

	// Live data fetched from API
	let liveHubData = $state(null);

	// Selected session for viewing/editing (defaults to current)
	let selectedSession = $state(null);

	const toggleExpanded = async () => {
		isExpanded = !isExpanded;
		if (isExpanded && !liveHubData) {
			await loadHubData();
		}
	};

	const loadHubData = async () => {
		isLoading = true;
		try {
			const response = await fetch(`/courses/${courseSlug}/coordinator/api`);
			if (!response.ok) {
				throw new Error('Failed to load hub data');
			}
			const data = await response.json();
			liveHubData = data;
			// Initialize selected session to current
			if (selectedSession === null) {
				selectedSession = data.currentSession;
			}
		} catch (err) {
			console.error('Error loading hub data:', err);
			toastError('Failed to load hub data');
		} finally {
			isLoading = false;
		}
	};

	const markAttendance = async (studentId, present) => {
		// Optimistically update UI
		const student = liveHubData?.students?.find(s => s.id === studentId);
		if (student) {
			if (!student.attendance) student.attendance = {};
			student.attendance[selectedSession] = present;
			liveHubData = { ...liveHubData };
		}

		try {
			const response = await fetch(`/courses/${courseSlug}/coordinator/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'mark_attendance',
					studentId,
					present,
					sessionNumber: selectedSession
				})
			});

			if (!response.ok) {
				throw new Error('Failed to mark attendance');
			}
		} catch (err) {
			console.error('Error marking attendance:', err);
			toastError('Failed to save attendance');
			await loadHubData();
		}
	};

	const markAllAttendance = async (present) => {
		isSaving = true;
		const studentsToMark = students.filter(s => {
			const status = s.attendance?.[selectedSession];
			return status === undefined || status !== present;
		});

		try {
			await Promise.all(studentsToMark.map(s => markAttendance(s.id, present)));
			toastSuccess(`Marked all members ${present ? 'present' : 'absent'}`);
		} catch (err) {
			toastError('Failed to mark all attendance');
		} finally {
			isSaving = false;
		}
	};

	// Use live data if available, otherwise fall back to initial props
	const displayData = $derived(liveHubData || hubData);
	const students = $derived(displayData?.students || []);
	const currentSession = $derived(liveHubData?.currentSession || hubData?.currentSession || 1);
	const totalSessions = $derived(liveHubData?.totalSessions || 8);
	const hubName = $derived(liveHubData?.hub?.name || hubData?.hubName || 'Your Hub');

	// Coordinators can mark attendance up to one session ahead
	const maxSelectableSession = $derived(Math.min(currentSession + 1, totalSessions));

	const navigateSession = (direction) => {
		if (direction === 'prev' && selectedSession > 1) {
			selectedSession--;
		} else if (direction === 'next' && selectedSession < maxSelectableSession) {
			selectedSession++;
		}
	};

	const selectSession = (sessionNum) => {
		if (sessionNum <= maxSelectableSession) {
			selectedSession = sessionNum;
		}
	};

	// Stats for selected session
	const sessionStats = $derived(() => {
		let present = 0;
		let absent = 0;
		let unmarked = 0;
		students.forEach(s => {
			const status = s.attendance?.[selectedSession];
			if (status === true) present++;
			else if (status === false) absent++;
			else unmarked++;
		});
		return { present, absent, unmarked };
	});

	// Generate session numbers array
	const sessionNumbers = $derived(Array.from({ length: totalSessions }, (_, i) => i + 1));

	// Get attendance status for a student in the selected session
	const getAttendanceStatus = (student) => {
		const status = student.attendance?.[selectedSession];
		if (status === true) return 'present';
		if (status === false) return 'absent';
		return 'unmarked';
	};
</script>

<!-- Hub Coordinator Bar -->
{#if hubData}
<div class="py-2">
	<div class="max-w-7xl mx-auto">
		<div
			class="rounded-xl border transition-all duration-300 overflow-hidden"
			style="background-color: color-mix(in srgb, var(--course-accent-light) 30%, white); border-color: var(--course-accent-light);"
		>
			<!-- Collapsed Header -->
			<div class="px-4 py-2">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div class="flex items-center gap-1.5">
							<Users size="16" style="color: var(--course-accent-dark);" />
							<span class="font-semibold text-sm" style="color: var(--course-accent-dark);">Hub Coordinator</span>
						</div>
						<div class="h-4 w-px" style="background-color: var(--course-accent-light);"></div>
						<div class="text-xs" style="color: var(--course-accent-dark);">
							<span class="font-medium">{hubName}</span> •
							<span>{students.length} members</span>
						</div>
					</div>

					<div class="flex items-center gap-3">
						{#if !isExpanded && liveHubData}
							<div class="flex items-center gap-2 text-xs" style="color: var(--course-accent-dark);">
								<span class="flex items-center gap-1">
									<span class="w-2 h-2 rounded-full bg-green-500"></span>
									{sessionStats().present}
								</span>
								<span class="flex items-center gap-1">
									<span class="w-2 h-2 rounded-full bg-red-500"></span>
									{sessionStats().absent}
								</span>
								<span class="flex items-center gap-1">
									<span class="w-2 h-2 rounded-full bg-amber-400"></span>
									{sessionStats().unmarked}
								</span>
							</div>
						{/if}
						<div class="text-xs font-medium" style="color: var(--course-accent-dark);">
							Session {currentSession} of {totalSessions}
						</div>
						<button
							onclick={toggleExpanded}
							class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:opacity-90"
							style="background-color: var(--course-accent-dark); color: var(--course-text-on-dark);"
						>
							{isExpanded ? 'Collapse' : 'Manage Attendance'}
							{#if isExpanded}
								<ChevronUp size="14" />
							{:else}
								<ChevronDown size="14" />
							{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Expanded Content -->
			{#if isExpanded}
				<div class="border-t" style="border-color: var(--course-accent-light);">
					<div class="px-6 py-5" style="background-color: color-mix(in srgb, var(--course-accent-light) 20%, white);">
						{#if isLoading}
							<div class="flex items-center justify-center py-12">
								<Loader2 size="32" class="animate-spin" style="color: var(--course-accent-dark);" />
							</div>
						{:else}
							<!-- Session Navigation -->
							<div class="flex items-center justify-between mb-5">
								<div class="flex items-center gap-2">
									<!-- Prev -->
									<button
										onclick={() => navigateSession('prev')}
										disabled={selectedSession <= 1}
										class="p-2 rounded-lg transition-colors disabled:opacity-30"
										style="background-color: var(--course-accent-dark); color: var(--course-text-on-dark);"
									>
										<ChevronLeft size="18" />
									</button>

									<!-- Session Buttons -->
									{#each sessionNumbers as sNum}
										<button
											onclick={() => selectSession(sNum)}
											disabled={sNum > maxSelectableSession}
											class="w-9 h-9 rounded-lg text-sm font-bold transition-all"
											style={selectedSession === sNum
												? `background-color: var(--course-accent-dark); color: var(--course-text-on-dark);`
												: sNum > maxSelectableSession
													? 'background-color: #e5e7eb; color: #9ca3af;'
													: 'background-color: white; color: var(--course-accent-dark); border: 1px solid var(--course-accent-light);'}
										>
											{sNum}
										</button>
									{/each}

									<!-- Next -->
									<button
										onclick={() => navigateSession('next')}
										disabled={selectedSession >= maxSelectableSession}
										class="p-2 rounded-lg transition-colors disabled:opacity-30"
										style="background-color: var(--course-accent-dark); color: var(--course-text-on-dark);"
									>
										<ChevronRight size="18" />
									</button>

									{#if selectedSession < currentSession}
										<span class="ml-3 px-3 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-700">
											Past Session
										</span>
									{/if}
								</div>

								<!-- Stats & Bulk Actions -->
								<div class="flex items-center gap-4">
									<div class="flex items-center gap-3 text-sm font-medium" style="color: var(--course-accent-dark);">
										<span class="flex items-center gap-1.5">
											<span class="w-3 h-3 rounded-full bg-green-500"></span>
											{sessionStats().present}
										</span>
										<span class="flex items-center gap-1.5">
											<span class="w-3 h-3 rounded-full bg-red-500"></span>
											{sessionStats().absent}
										</span>
										<span class="flex items-center gap-1.5">
											<span class="w-3 h-3 rounded-full bg-amber-400"></span>
											{sessionStats().unmarked}
										</span>
									</div>
									<button
										onclick={() => markAllAttendance(true)}
										disabled={isSaving}
										class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-50"
									>
										<Check size="14" />
										All Present
									</button>
									<button
										onclick={() => markAllAttendance(false)}
										disabled={isSaving}
										class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
									>
										<X size="14" />
										All Absent
									</button>
								</div>
							</div>

							<!-- Student List -->
							<div class="bg-white rounded-xl shadow-sm overflow-hidden">
								{#if students.length === 0}
									<p class="text-center text-gray-500 py-12">No members assigned to your hub</p>
								{:else}
									<div class="divide-y divide-gray-100">
										{#each students as student}
											{@const status = getAttendanceStatus(student)}
											<div class="flex items-center justify-between px-5 py-4 hover:bg-gray-50/50 transition-colors">
												<!-- Member Info -->
												<div class="flex items-center gap-4">
													<div
														class="w-11 h-11 rounded-full flex items-center justify-center font-semibold text-white text-sm"
														style="background-color: var(--course-accent-dark);"
													>
														{getUserInitials(student.name)}
													</div>
													<div>
														<div class="flex items-center gap-2">
															<span class="font-semibold text-gray-800">{student.name}</span>
															{#if student.role === 'coordinator'}
																<span class="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">Coordinator</span>
															{/if}
														</div>
														<div class="text-sm text-gray-500">{student.email}</div>
													</div>
												</div>

												<!-- Attendance Buttons -->
												<div class="flex items-center gap-2">
													<button
														onclick={() => markAttendance(student.id, true)}
														class="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
														class:bg-green-500={status === 'present'}
														class:text-white={status === 'present'}
														class:shadow-sm={status === 'present'}
														class:bg-gray-100={status !== 'present'}
														class:text-gray-600={status !== 'present'}
														class:hover:bg-green-50={status !== 'present'}
														class:hover:text-green-700={status !== 'present'}
													>
														<Check size="16" />
														Present
													</button>
													<button
														onclick={() => markAttendance(student.id, false)}
														class="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-sm transition-all"
														class:bg-red-500={status === 'absent'}
														class:text-white={status === 'absent'}
														class:shadow-sm={status === 'absent'}
														class:bg-gray-100={status !== 'absent'}
														class:text-gray-600={status !== 'absent'}
														class:hover:bg-red-50={status !== 'absent'}
														class:hover:text-red-700={status !== 'absent'}
													>
														<X size="16" />
														Absent
													</button>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
{/if}

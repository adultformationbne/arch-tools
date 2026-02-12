<script>
	import { Calendar, Users, CheckCircle, XCircle, ChevronDown, ChevronRight, User, Building, AlertCircle } from '$lib/icons';
	import { getUserInitials } from '$lib/utils/avatar.js';

	/**
	 * @typedef {{ id: string, full_name: string, email: string, hub_name?: string, attendance: Array<{ session_number: number, present: boolean }> }} Student
	 * @typedef {{ nonHubStudents?: Student[], hubStudents?: Student[] }} AttendanceData
	 */

	let { data } = $props();

	const courseSlug = $derived(data.courseSlug);
	const initialCohortId = $derived(data.cohorts[0]?.id || null);
	/** @type {string|null} */
	let selectedCohortId = $state(null);

	// Initialize selectedCohortId from derived initial value
	$effect(() => {
		if (selectedCohortId === null && initialCohortId) {
			selectedCohortId = initialCohortId;
		}
	});
	/** @type {number|null} */
	let expandedSession = $state(null);
	let expandedHubs = $state(new Set()); // Track which hubs are expanded
	/** @type {Record<number, string>} */
	let sessionSearchTerms = $state({});

	/** @param {Student[]} students @param {number} sessionNum */
	const filterStudents = (students, sessionNum) => {
		const term = (sessionSearchTerms[sessionNum] || '').toLowerCase().trim();
		if (!term) return students;
		return students.filter(s => {
			const name = (s.full_name || '').toLowerCase();
			// Match if full name starts with term, or any word in name starts with term
			return name.startsWith(term) || name.split(/\s+/).some(word => word.startsWith(term));
		});
	};
	/** @type {AttendanceData} */
	let attendanceData = $state({});
	let isLoading = $state(false);
	let overrideState = $state({ show: false, studentId: /** @type {string|null} */ (null), sessionNumber: /** @type {number|null} */ (null), studentName: /** @type {string|null} */ (null) });

	/** @param {string} hubName */
	const toggleHub = (hubName) => {
		const newExpanded = new Set(expandedHubs);
		if (newExpanded.has(hubName)) {
			newExpanded.delete(hubName);
		} else {
			newExpanded.add(hubName);
		}
		expandedHubs = newExpanded;
	};

	// Load attendance data when cohort is selected
	/** @param {string|null} cohortId */
	const loadAttendanceForCohort = async (cohortId) => {
		if (!cohortId) return;

		isLoading = true;
		try {
			const response = await fetch(`/admin/courses/${courseSlug}/attendance/api?cohortId=${cohortId}`);
			const result = await response.json();
			attendanceData = result;
		} catch (error) {
			console.error('Error loading attendance:', error);
		} finally {
			isLoading = false;
		}
	};

	// Load when cohort changes
	$effect(() => {
		if (selectedCohortId) {
			loadAttendanceForCohort(selectedCohortId);
		}
	});

	/** @param {number} sessionNum */
	const toggleSession = (sessionNum) => {
		expandedSession = expandedSession === sessionNum ? null : sessionNum;
	};

	// Debounce map to prevent rapid duplicate requests
	const pendingRequests = new Map();

	/** @param {string} userId @param {number} sessionNumber @param {boolean} present */
	const markAttendance = async (userId, sessionNumber, present) => {
		if (!selectedCohortId) return;

		// Create unique key for this attendance mark
		const requestKey = `${userId}-${sessionNumber}`;

		// Cancel pending request if exists
		if (pendingRequests.has(requestKey)) {
			clearTimeout(pendingRequests.get(requestKey));
		}

		// Optimistically update the UI immediately
		/** @param {Student[]} studentList */
		const updateAttendanceOptimistically = (studentList) => {
			return studentList.map(student => {
				if (student.id === userId) {
					const existingRecord = student.attendance.find(a => a.session_number === sessionNumber);
					if (existingRecord) {
						existingRecord.present = present;
					} else {
						student.attendance.push({ session_number: sessionNumber, present });
					}
				}
				return student;
			});
		};

		// Apply optimistic update
		attendanceData.nonHubStudents = updateAttendanceOptimistically(attendanceData.nonHubStudents || []);
		attendanceData.hubStudents = updateAttendanceOptimistically(attendanceData.hubStudents || []);

		// Debounce the API call (300ms)
		const timeoutId = setTimeout(async () => {
			try {
				const response = await fetch(`/admin/courses/${courseSlug}/attendance/api`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						userId,
						cohortId: selectedCohortId,
						sessionNumber,
						present
					})
				});

				if (!response.ok) {
					// If failed, reload to get accurate state
					await loadAttendanceForCohort(selectedCohortId);
				}
			} catch (error) {
				console.error('Error marking attendance:', error);
				// Reload on error
				await loadAttendanceForCohort(selectedCohortId);
			} finally {
				pendingRequests.delete(requestKey);
			}
		}, 300);

		pendingRequests.set(requestKey, timeoutId);
	};

	/** @param {number} sessionNum */
	const getSessionStats = (sessionNum) => {
		if (!attendanceData.nonHubStudents && !attendanceData.hubStudents) {
			return { total: 0, marked: 0 };
		}

		const nonHub = attendanceData.nonHubStudents || [];
		const hub = attendanceData.hubStudents || [];
		const total = nonHub.length + hub.length;

		const marked = [...nonHub, ...hub].filter(student => {
			const record = student.attendance?.find(a => a.session_number === sessionNum);
			return record !== undefined;
		}).length;

		return { total, marked };
	};

	/** @param {Student} student @param {number} sessionNum */
	const getAttendanceStatus = (student, sessionNum) => {
		const record = student.attendance?.find(a => a.session_number === sessionNum);
		return record?.present;
	};

	const selectedCohort = $derived(data.cohorts.find(/** @param {any} c */ (c) => c.id === selectedCohortId));

	/** @param {boolean} present */
	const handleOverrideConfirm = async (present) => {
		if (!overrideState.studentId || overrideState.sessionNumber === null) return;

		// Mark the attendance with the override
		await markAttendance(overrideState.studentId, overrideState.sessionNumber, present);

		// Close the modal
		overrideState = { show: false, studentId: null, sessionNumber: null, studentName: null };
	};

	const cancelOverride = () => {
		overrideState = { show: false, studentId: null, sessionNumber: null, studentName: null };
	};
</script>

<div class="p-3 sm:p-4 lg:p-6">
	<div class="py-6 sm:py-8 lg:py-12">
		<div class="max-w-7xl mx-auto">
			<!-- Header with Cohort Selector -->
			<div class="mb-6 sm:mb-8 flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 lg:gap-8">
				<div>
					<h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">Attendance</h1>
					<p class="text-base sm:text-lg lg:text-xl text-white/70">Track student attendance by session</p>
				</div>

				<div class="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm w-full lg:w-auto lg:min-w-[400px]">
					<label for="cohort-select" class="block text-sm font-semibold text-gray-700 mb-2">Select Cohort</label>
					<select
						id="cohort-select"
						bind:value={selectedCohortId}
						class="w-full px-3 sm:px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:border-transparent text-sm sm:text-base"
						style="outline-color: var(--course-accent-light);"
					>
						<option value={null}>Choose a cohort...</option>
						{#each data.cohorts as cohort}
							<option value={cohort.id}>
								{cohort.name} - {cohort.modules?.name || 'Module'}
							</option>
						{/each}
					</select>
				</div>
			</div>

			{#if isLoading}
				<div class="bg-white rounded-xl sm:rounded-2xl p-8 sm:p-12 shadow-sm text-center">
					<div class="animate-spin mx-auto w-10 h-10 sm:w-12 sm:h-12 border-4 border-gray-300 border-t-accf-accent rounded-full mb-4"></div>
					<p class="text-gray-600 text-sm sm:text-base">Loading attendance data...</p>
				</div>
			{:else if selectedCohortId && attendanceData}
				<!-- Session Grid -->
				<div class="space-y-2 sm:space-y-3">
					{#each Array(8) as _, sessionIndex}
						{@const sessionNum = sessionIndex + 1}
						{@const stats = getSessionStats(sessionNum)}
						{@const isExpanded = expandedSession === sessionNum}

						<div class="bg-white rounded-xl sm:rounded-2xl shadow-sm overflow-hidden">
							<!-- Session Header -->
							<button
								onclick={() => toggleSession(sessionNum)}
								class="w-full px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
							>
								<div class="flex items-center gap-2 sm:gap-4">
									<div class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center font-bold text-white text-sm sm:text-base" style="background-color: var(--course-accent-dark);">
										{sessionNum}
									</div>
									<div class="text-left">
										<h3 class="font-bold text-base sm:text-lg text-gray-800">Session {sessionNum}</h3>
										<p class="text-xs sm:text-sm text-gray-600">
											{stats.marked} of {stats.total} marked
										</p>
									</div>
								</div>

								<div class="flex items-center gap-2 sm:gap-4">
									{#if stats.marked < stats.total}
										<span class="px-2 sm:px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-xs sm:text-sm font-medium">
											<span class="hidden sm:inline">{stats.total - stats.marked} pending</span>
											<span class="sm:hidden">{stats.total - stats.marked}</span>
										</span>
									{:else if stats.total > 0}
										<span class="px-2 sm:px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs sm:text-sm font-medium">
											<span class="hidden sm:inline">Complete</span>
											<span class="sm:hidden">Done</span>
										</span>
									{/if}

									{#if isExpanded}
										<ChevronDown size="20" class="text-gray-400 w-5 h-5 sm:w-6 sm:h-6" />
									{:else}
										<ChevronRight size="20" class="text-gray-400 w-5 h-5 sm:w-6 sm:h-6" />
									{/if}
								</div>
							</button>

							<!-- Expanded Session Content -->
							{#if isExpanded}
								{@const filteredNonHub = filterStudents(attendanceData.nonHubStudents || [], sessionNum)}
								{@const filteredHub = filterStudents(attendanceData.hubStudents || [], sessionNum)}
								<div class="border-t border-gray-200">
									<!-- Search Bar -->
									<div class="px-3 sm:px-6 pt-3 sm:pt-4">
										<input
											type="text"
											placeholder="Search by name..."
											bind:value={sessionSearchTerms[sessionNum]}
											class="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent"
											style="--tw-ring-color: var(--course-accent-light);"
										/>
									</div>

									<!-- Non-Hub Students Section -->
									{#if filteredNonHub.length > 0}
										<div class="p-3 sm:p-6 border-b border-gray-200">
											<h4 class="font-bold text-sm sm:text-md text-gray-700 mb-3 sm:mb-4 flex items-center gap-2">
												<User size="18" class="w-4 h-4 sm:w-5 sm:h-5" />
												Non-Hub Students ({filteredNonHub.length})
											</h4>
											<div class="space-y-2 sm:space-y-3">
												{#each filteredNonHub as student}
													{@const status = getAttendanceStatus(student, sessionNum)}

													<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 px-3 sm:px-4 bg-gray-50 rounded-lg">
														<div class="flex items-center gap-2 sm:gap-3">
															<div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-white text-xs sm:text-sm flex-shrink-0" style="background-color: var(--course-accent-dark);">
																{getUserInitials(student.full_name)}
															</div>
															<div class="min-w-0">
																<div class="font-semibold text-sm sm:text-base text-gray-800 truncate">{student.full_name}</div>
																<div class="text-xs sm:text-sm text-gray-600 truncate">{student.email}</div>
															</div>
														</div>

														<div class="flex items-center gap-2 sm:gap-3 ml-10 sm:ml-0">
															<button
																onclick={() => markAttendance(student.id, sessionNum, true)}
																class="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg font-medium transition-colors text-sm min-w-[80px] sm:min-w-0"
																class:bg-green-600={status === true}
																class:text-white={status === true}
																class:bg-gray-200={status !== true}
																class:text-gray-700={status !== true}
																class:hover:bg-green-700={status === true}
																class:hover:bg-gray-300={status !== true}
															>
																Present
															</button>
															<button
																onclick={() => markAttendance(student.id, sessionNum, false)}
																class="flex-1 sm:flex-none px-3 sm:px-4 py-2.5 sm:py-2 rounded-lg font-medium transition-colors text-sm min-w-[80px] sm:min-w-0"
																class:bg-red-600={status === false}
																class:text-white={status === false}
																class:bg-gray-200={status !== false}
																class:text-gray-700={status !== false}
																class:hover:bg-red-700={status === false}
																class:hover:bg-gray-300={status !== false}
															>
																Absent
															</button>
														</div>
													</div>
												{/each}
											</div>
										</div>
									{/if}

									<!-- Hub Students Section (Read-only with override) -->
									{#if filteredHub.length > 0}
										<div class="p-3 sm:p-6">
											<h4 class="font-bold text-sm sm:text-md text-gray-700 mb-3 sm:mb-4 flex flex-wrap items-center gap-2">
												<Building size="18" class="w-4 h-4 sm:w-5 sm:h-5" />
												<span>Hub Students ({filteredHub.length})</span>
												<span class="text-xs sm:text-sm font-normal text-gray-500">Marked by coordinators</span>
											</h4>

											{#each Object.entries(filteredHub.reduce(/** @param {Record<string, Student[]>} acc @param {Student} student */ (acc, student) => {
												const hubName = student.hub_name || 'Unknown Hub';
												if (!acc[hubName]) acc[hubName] = [];
												acc[hubName].push(student);
												return acc;
											}, /** @type {Record<string, Student[]>} */ ({}))) as [hubName, students]}
												{@const isHubExpanded = expandedHubs.has(hubName)}
												{@const hubStats = /** @type {Student[]} */ (students).reduce(/** @param {{ present: number, absent: number, notMarked: number }} acc @param {Student} s */ (acc, s) => {
													const status = getAttendanceStatus(s, sessionNum);
													if (status === true) acc.present++;
													else if (status === false) acc.absent++;
													else acc.notMarked++;
													return acc;
												}, { present: 0, absent: 0, notMarked: 0 })}

												<div class="mb-3 sm:mb-4 last:mb-0">
													<!-- Hub Header (Clickable) -->
													<button
														onclick={() => toggleHub(hubName)}
														class="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 py-3 px-3 sm:px-4 bg-gray-100 rounded-lg border border-gray-200 hover:bg-gray-200 transition-colors"
													>
														<div class="flex items-center gap-2 sm:gap-3">
															<Building size="18" class="text-gray-600 w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
															<div class="text-left">
																<h5 class="font-semibold text-sm sm:text-base text-gray-800">{hubName}</h5>
																<p class="text-xs text-gray-600">{students.length} students</p>
															</div>
														</div>

														<div class="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 ml-6 sm:ml-0">
															<!-- Quick stats -->
															<div class="flex items-center gap-1 sm:gap-2 text-xs flex-wrap">
																{#if hubStats.present > 0}
																	<span class="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-green-100 text-green-700 rounded-full font-medium">
																		{hubStats.present} <span class="hidden sm:inline">present</span>
																	</span>
																{/if}
																{#if hubStats.absent > 0}
																	<span class="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-red-100 text-red-700 rounded-full font-medium">
																		{hubStats.absent} <span class="hidden sm:inline">absent</span>
																	</span>
																{/if}
																{#if hubStats.notMarked > 0}
																	<span class="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-200 text-gray-700 rounded-full font-medium">
																		{hubStats.notMarked} <span class="hidden sm:inline">unmarked</span>
																	</span>
																{/if}
															</div>

															{#if isHubExpanded}
																<ChevronDown size="20" class="text-gray-500 w-5 h-5 flex-shrink-0" />
															{:else}
																<ChevronRight size="20" class="text-gray-500 w-5 h-5 flex-shrink-0" />
															{/if}
														</div>
													</button>

													<!-- Hub Students (Expandable) -->
													{#if isHubExpanded}
														<div class="mt-2 space-y-2 ml-2 sm:ml-4">
															{#each /** @type {Student[]} */ (students) as student}
																{@const status = getAttendanceStatus(student, sessionNum)}
																{@const record = student.attendance?.find(/** @param {{ session_number: number }} a */ (a) => a.session_number === sessionNum)}

																<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3 px-3 sm:px-4 bg-gray-50 rounded-lg border border-gray-200">
																	<div class="flex items-center gap-2 sm:gap-3">
																		<div class="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-semibold text-white text-xs sm:text-sm flex-shrink-0" style="background-color: var(--course-accent-dark);">
																			{getUserInitials(student.full_name)}
																		</div>
																		<div class="min-w-0">
																			<div class="font-semibold text-sm sm:text-base text-gray-800 truncate">{student.full_name}</div>
																			<div class="text-xs text-gray-600">
																				{#if record}
																					Marked by coordinator
																				{:else}
																					Not yet marked
																				{/if}
																			</div>
																		</div>
																	</div>

																	<div class="flex flex-wrap items-center gap-2 sm:gap-3 ml-10 sm:ml-0">
																		{#if status !== undefined}
																			<span class="px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium" class:bg-green-100={status} class:text-green-700={status} class:bg-red-100={!status} class:text-red-700={!status}>
																				{status ? 'Present' : 'Absent'}
																			</span>
																		{:else}
																			<span class="px-2 sm:px-3 py-1 bg-gray-200 text-gray-600 rounded-full text-xs sm:text-sm font-medium">
																				Not marked
																			</span>
																		{/if}

																		{#if record}
																			<button
																				onclick={() => {
																					overrideState = {
																						show: true,
																						studentId: student.id,
																						sessionNumber: sessionNum,
																						studentName: student.full_name
																					};
																				}}
																				class="px-3 py-1.5 sm:py-1 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-lg transition-colors border border-gray-300"
																			>
																				Override
																			</button>
																		{:else}
																			<button
																				onclick={() => markAttendance(student.id, sessionNum, true)}
																				class="px-3 py-1.5 sm:py-1 text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg transition-colors"
																			>
																				Mark Present
																			</button>
																			<button
																				onclick={() => markAttendance(student.id, sessionNum, false)}
																				class="px-3 py-1.5 sm:py-1 text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300 rounded-lg transition-colors"
																			>
																				Mark Absent
																			</button>
																		{/if}
																	</div>
																</div>
															{/each}
														</div>
													{/if}
												</div>
											{/each}
										</div>
									{/if}

									<!-- Empty State -->
									{#if filteredNonHub.length === 0 && filteredHub.length === 0}
										<div class="p-8 sm:p-12 text-center">
											<Users size="48" class="mx-auto mb-4 text-gray-400 w-10 h-10 sm:w-12 sm:h-12" />
											{#if sessionSearchTerms[sessionNum]}
												<p class="text-gray-600 text-sm sm:text-base">No students matching "{sessionSearchTerms[sessionNum]}"</p>
											{:else}
												<p class="text-gray-600 text-sm sm:text-base">No students enrolled in this cohort</p>
											{/if}
										</div>
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<!-- Empty State -->
				<div class="bg-white rounded-xl sm:rounded-2xl p-8 sm:p-12 shadow-sm text-center">
					<Calendar size="64" class="mx-auto mb-4 text-gray-400 w-12 h-12 sm:w-16 sm:h-16" />
					<h3 class="text-lg sm:text-xl font-bold text-gray-600 mb-2">Select a cohort to begin</h3>
					<p class="text-gray-500 text-sm sm:text-base">Choose a cohort from the dropdown above to view and mark attendance</p>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Override Confirmation Modal -->
{#if overrideState.show}
	<div
		class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4"
		role="presentation"
		onmousedown={(e) => e.target === e.currentTarget && cancelOverride()}
	>
		<div
			class="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-lg w-full"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
			onkeydown={(e) => e.stopPropagation()}
		>
			<div class="p-4 sm:p-6 border-b border-gray-200">
				<h3 class="text-lg sm:text-xl font-bold text-gray-800">Override Coordinator Marking</h3>
				<p class="text-xs sm:text-sm text-gray-600 mt-1">
					You are about to override the attendance marking for <strong>{overrideState.studentName}</strong> in Session {overrideState.sessionNumber}.
				</p>
			</div>

			<div class="p-4 sm:p-6">
				<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
					<div class="flex items-start gap-2 sm:gap-3">
						<AlertCircle size="20" class="text-amber-600 mt-0.5 w-5 h-5 flex-shrink-0" />
						<div class="text-xs sm:text-sm text-amber-800">
							<p class="font-semibold mb-1">This will override the coordinator's marking</p>
							<p>This action should only be used to correct errors or handle special circumstances.</p>
						</div>
					</div>
				</div>

				<p class="text-gray-700 font-medium mb-3 sm:mb-4 text-sm sm:text-base">Mark this student as:</p>

				<div class="flex flex-col sm:flex-row gap-2 sm:gap-3">
					<button
						onclick={() => handleOverrideConfirm(true)}
						class="flex-1 px-4 sm:px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
					>
						<CheckCircle size="20" class="w-5 h-5" />
						Present
					</button>
					<button
						onclick={() => handleOverrideConfirm(false)}
						class="flex-1 px-4 sm:px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
					>
						<XCircle size="20" class="w-5 h-5" />
						Absent
					</button>
				</div>
			</div>

			<div class="p-4 sm:p-6 pt-0">
				<button
					onclick={cancelOverride}
					class="w-full px-4 sm:px-6 py-2.5 sm:py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium rounded-lg transition-colors text-sm sm:text-base"
				>
					Cancel
				</button>
			</div>
		</div>
	</div>
{/if}

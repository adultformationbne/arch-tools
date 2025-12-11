<script>
	import { Users, CheckSquare, Calendar, ChevronDown, ChevronUp, Check, X, Loader2 } from 'lucide-svelte';
	import ReflectionStatusBadge from '$lib/components/ReflectionStatusBadge.svelte';
	import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';
	import { getUserInitials } from '$lib/utils/avatar.js';

	// Props from parent
	let { hubData = null, courseSlug = '' } = $props();

	let isExpanded = $state(false);
	let activeTab = $state('attendance');
	let isLoading = $state(false);
	let isSaving = $state(false);

	// Live data fetched from API
	let liveHubData = $state(null);
	let pendingChanges = $state({});

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
			student.attendanceStatus = present ? 'present' : 'absent';
			liveHubData = { ...liveHubData };
		}

		// Track pending change
		pendingChanges[studentId] = present;

		try {
			const response = await fetch(`/courses/${courseSlug}/coordinator/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'mark_attendance',
					studentId,
					present,
					sessionNumber: liveHubData?.currentSession || hubData?.currentSession
				})
			});

			if (!response.ok) {
				throw new Error('Failed to mark attendance');
			}

			// Clear pending change on success
			delete pendingChanges[studentId];
		} catch (err) {
			console.error('Error marking attendance:', err);
			toastError('Failed to save attendance');
			// Reload to get accurate state
			await loadHubData();
		}
	};

	// Use live data if available, otherwise fall back to initial props
	const displayData = $derived(liveHubData || hubData);
	const students = $derived(displayData?.students || []);
	const currentSession = $derived(displayData?.currentSession || hubData?.currentSession || 1);
	const hubName = $derived(liveHubData?.hub?.name || hubData?.hubName || 'Your Hub');

	// Stats
	const attendanceStats = $derived(() => {
		const present = students.filter(s => s.attendanceStatus === 'present').length;
		const absent = students.filter(s => s.attendanceStatus === 'absent').length;
		const unmarked = students.length - present - absent;
		return { present, absent, unmarked };
	});
</script>

<!-- Hub Coordinator Bar -->
{#if hubData}
<div class="py-4">
	<div class="max-w-7xl mx-auto">
		<div class="rounded-2xl border-2 transition-all duration-300 overflow-hidden" style="background-color: #eae2d9; border-color: #c59a6b;">
			<!-- Collapsed Header -->
			<div class="px-8 py-4">
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<div class="flex items-center gap-2">
							<Users size="20" style="color: #334642;" />
							<span class="font-semibold text-lg" style="color: #334642;">Hub Coordinator</span>
						</div>
						<div class="h-6 w-px" style="background-color: #c59a6b;"></div>
						<div class="text-sm" style="color: #334642;">
							<span class="font-medium">{hubName}</span> •
							<span>{students.length} students</span>
						</div>
					</div>

					<div class="flex items-center gap-4">
						<div class="text-sm" style="color: #334642;">
							Session {currentSession}
						</div>
						<button
							onclick={toggleExpanded}
							class="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-colors hover:opacity-90"
							style="background-color: #334642; color: white;"
						>
							{isExpanded ? 'Collapse' : 'Manage Hub'}
							{#if isExpanded}
								<ChevronUp size="16" />
							{:else}
								<ChevronDown size="16" />
							{/if}
						</button>
					</div>
				</div>
			</div>

			<!-- Expanded Content -->
			{#if isExpanded}
				<div class="border-t" style="border-color: #c59a6b;">
					<!-- Tab Navigation -->
					<div class="px-8 py-3" style="background-color: #d4c4b0;">
						<div class="flex gap-6">
							<button
								onclick={() => activeTab = 'attendance'}
								class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
								class:active-tab={activeTab === 'attendance'}
								class:inactive-tab={activeTab !== 'attendance'}
							>
								<CheckSquare size="16" />
								Mark Attendance
							</button>
							<button
								onclick={() => activeTab = 'progress'}
								class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
								class:active-tab={activeTab === 'progress'}
								class:inactive-tab={activeTab !== 'progress'}
							>
								<Calendar size="16" />
								Student Progress
							</button>
						</div>
					</div>

					<!-- Tab Content -->
					<div class="px-8 py-6" style="background-color: #eae2d9;">
						{#if isLoading}
							<div class="flex items-center justify-center py-12">
								<Loader2 size="32" class="animate-spin" style="color: #334642;" />
							</div>
						{:else if activeTab === 'attendance'}
							<!-- Attendance Marking -->
							<div>
								<div class="flex items-center justify-between mb-4">
									<h3 class="text-xl font-bold" style="color: #334642;">Session {currentSession} Attendance</h3>
									<div class="flex items-center gap-4 text-sm">
										<span class="flex items-center gap-1">
											<span class="w-3 h-3 rounded-full bg-green-500"></span>
											{attendanceStats().present} present
										</span>
										<span class="flex items-center gap-1">
											<span class="w-3 h-3 rounded-full bg-red-500"></span>
											{attendanceStats().absent} absent
										</span>
										<span class="flex items-center gap-1">
											<span class="w-3 h-3 rounded-full bg-gray-300"></span>
											{attendanceStats().unmarked} unmarked
										</span>
									</div>
								</div>
								<div class="bg-white rounded-2xl p-6 shadow-sm">
									{#if students.length === 0}
										<p class="text-center text-gray-500 py-8">No students assigned to your hub</p>
									{:else}
										<div class="space-y-3">
											{#each students as student}
												<div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
													<div class="flex items-center gap-4">
														<div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white" style="background-color: #334642;">
															{getUserInitials(student.name)}
														</div>
														<div>
															<div class="font-semibold text-gray-800">{student.name}</div>
															<div class="text-sm text-gray-500">{student.email}</div>
														</div>
													</div>
													<div class="flex items-center gap-2">
														<button
															onclick={() => markAttendance(student.id, true)}
															class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
															class:bg-green-500={student.attendanceStatus === 'present'}
															class:text-white={student.attendanceStatus === 'present'}
															class:bg-gray-100={student.attendanceStatus !== 'present'}
															class:text-gray-600={student.attendanceStatus !== 'present'}
															class:hover:bg-green-100={student.attendanceStatus !== 'present'}
														>
															<Check size="16" />
															Present
														</button>
														<button
															onclick={() => markAttendance(student.id, false)}
															class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all"
															class:bg-red-500={student.attendanceStatus === 'absent'}
															class:text-white={student.attendanceStatus === 'absent'}
															class:bg-gray-100={student.attendanceStatus !== 'absent'}
															class:text-gray-600={student.attendanceStatus !== 'absent'}
															class:hover:bg-red-100={student.attendanceStatus !== 'absent'}
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
							</div>

						{:else if activeTab === 'progress'}
							<!-- Student Progress Overview -->
							<div>
								<h3 class="text-xl font-bold mb-4" style="color: #334642;">Hub Student Progress</h3>
								<div class="bg-white rounded-2xl p-6 shadow-sm">
									{#if students.length === 0}
										<p class="text-center text-gray-500 py-8">No students assigned to your hub</p>
									{:else}
										<div class="space-y-4">
											{#each students as student}
												<div class="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
													<div class="flex items-center gap-4">
														<div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white" style="background-color: #334642;">
															{getUserInitials(student.name)}
														</div>
														<div>
															<div class="font-semibold text-gray-800">{student.name}</div>
															<div class="text-sm text-gray-500">Session {student.currentSession || 0}</div>
														</div>
													</div>
													<div class="flex items-center gap-6">
														<!-- Attendance Status -->
														<div class="text-sm">
															<span class="text-gray-500">Attendance:</span>
															{#if student.attendanceStatus === 'present'}
																<span class="ml-1 text-green-600 font-medium">Present</span>
															{:else if student.attendanceStatus === 'absent'}
																<span class="ml-1 text-red-600 font-medium">Absent</span>
															{:else}
																<span class="ml-1 text-gray-400">Not marked</span>
															{/if}
														</div>
														<!-- Reflection Status -->
														<div>
															{#if student.reflectionStatus && student.reflectionStatus !== 'not_started'}
																<ReflectionStatusBadge status={student.reflectionStatus} />
															{:else}
																<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
																	Not Started
																</span>
															{/if}
														</div>
													</div>
												</div>
											{/each}
										</div>
									{/if}
								</div>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
{/if}

<style>
	.active-tab {
		background-color: #c59a6b;
		color: #334642;
	}

	.inactive-tab {
		color: #334642;
	}

	.inactive-tab:hover {
		background-color: rgba(197, 154, 107, 0.2);
	}
</style>

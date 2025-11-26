<script>
	import { Users, CheckSquare, BookOpen, ChevronDown, ChevronUp, Calendar, MessageSquare } from 'lucide-svelte';

	// Props from parent
	let { hubData = null } = $props();

	let isExpanded = $state(false);
	let activeTab = $state('attendance'); // 'attendance' | 'progress' | 'reflections'

	const toggleExpanded = () => {
		isExpanded = !isExpanded;
	};

	const markAttendance = (studentId, present) => {
		// TODO: Implement API call to mark attendance
		const student = hubData?.students.find(s => s.id === studentId);
		if (student) {
			student.attendanceStatus = present ? 'present' : 'absent';
		}
	};

	const getReflectionStatusLabel = (status) => {
		if (status === null) return 'N/A';
		switch (status) {
			case 'submitted':
			case 'under_review':
			case 'passed':
				return '✓ Submitted';
			case 'not_started':
				return '⏳ Not Started';
			case 'needs_revision':
			case 'resubmitted':
				return '⚠️ Needs Work';
			default:
				return '⏳ Not Started';
		}
	};

	const getReflectionStatusClass = (status) => {
		if (status === null) return 'bg-gray-50 text-gray-400';
		switch (status) {
			case 'submitted':
			case 'under_review':
			case 'passed':
				return 'bg-green-100 text-green-700';
			case 'needs_revision':
			case 'resubmitted':
				return 'bg-orange-100 text-orange-700';
			default:
				return 'bg-gray-100 text-gray-700';
		}
	};
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
					<span class="font-medium">{hubData.hubName}</span> •
					<span>{hubData.students?.length || 0} students</span>
				</div>
			</div>

			<div class="flex items-center gap-4">
				<div class="text-sm" style="color: #334642;">
					Session {hubData.currentSession} attendance & reflections
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
						<button
							onclick={() => activeTab = 'reflections'}
							class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
							class:active-tab={activeTab === 'reflections'}
							class:inactive-tab={activeTab !== 'reflections'}
						>
							<MessageSquare size="16" />
							Public Reflections
						</button>
						<div class="flex-1"></div>
						<a
							href="/hub-coordinator-guide"
							target="_blank"
							class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:opacity-80"
							style="background-color: #c59a6b; color: #334642;"
						>
							<BookOpen size="16" />
							Coordinator Guide
						</a>
						</div>
					</div>

					<!-- Tab Content -->
					<div class="px-8 py-6" style="background-color: #eae2d9;">

					{#if activeTab === 'attendance'}
						<!-- Attendance Marking -->
						<div>
							<h3 class="text-xl font-bold mb-4" style="color: #334642;">Session {hubData.currentSession} Attendance</h3>
							<div class="bg-white rounded-2xl p-6 shadow-sm">
								<div class="space-y-4">
									{#each hubData.students || [] as student}
										<div class="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
											<div class="flex items-center gap-4">
												<div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white" style="background-color: #334642;">
													{student.name.split(' ').map(n => n[0]).join('')}
												</div>
												<div>
													<div class="font-semibold text-gray-800">{student.name}</div>
													<div class="text-sm text-gray-600">{student.email}</div>
												</div>
											</div>
											<div class="flex items-center gap-3">
												<button
													onclick={() => markAttendance(student.id, true)}
													class="px-6 py-2 rounded-lg font-medium transition-colors"
													class:bg-green-500={student.attendanceStatus === 'present'}
													class:text-white={student.attendanceStatus === 'present'}
													class:bg-gray-200={student.attendanceStatus !== 'present'}
													class:text-gray-700={student.attendanceStatus !== 'present'}
												>
													Present
												</button>
												<button
													onclick={() => markAttendance(student.id, false)}
													class="px-6 py-2 rounded-lg font-medium transition-colors"
													class:bg-red-500={student.attendanceStatus === 'absent'}
													class:text-white={student.attendanceStatus === 'absent'}
													class:bg-gray-200={student.attendanceStatus !== 'absent'}
													class:text-gray-700={student.attendanceStatus !== 'absent'}
												>
													Absent
												</button>
											</div>
										</div>
									{/each}
								</div>
								<div class="mt-6 flex justify-end">
									<button class="px-6 py-3 rounded-lg font-semibold text-white transition-colors hover:opacity-90" style="background-color: #334642;">
										Save Attendance
									</button>
								</div>
							</div>
						</div>

					{:else if activeTab === 'progress'}
						<!-- Student Progress Overview -->
						<div>
							<h3 class="text-xl font-bold mb-4" style="color: #334642;">Hub Student Progress</h3>
							<div class="bg-white rounded-2xl p-6 shadow-sm">
								<div class="space-y-6">
									{#each hubData.students || [] as student}
										<div class="border-b border-gray-200 pb-6 last:border-b-0 last:pb-0">
											<div class="flex items-start justify-between mb-4">
												<div class="flex items-center gap-4">
													<div class="w-12 h-12 rounded-full flex items-center justify-center font-semibold text-white text-lg" style="background-color: #334642;">
														{student.name.split(' ').map(n => n[0]).join('')}
													</div>
													<div>
														<div class="font-semibold text-lg text-gray-800">{student.name}</div>
														<div class="text-sm text-gray-600">{student.email}</div>
													</div>
												</div>
												<div class="text-right">
													<div class="text-sm text-gray-600 mb-1">Session {hubData.currentSession} Reflection</div>
													<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium {getReflectionStatusClass(student.reflectionStatus)}">
														{getReflectionStatusLabel(student.reflectionStatus)}
													</div>
												</div>
											</div>
											<!-- Current Session Status -->
											<div>
												<div class="text-sm font-medium text-gray-700 mb-2">Session {hubData.currentSession} Status</div>
												<div class="flex gap-4 text-sm">
													<div>
														<span class="text-gray-600">Attendance:</span>
														<span class="font-medium" class:text-green-600={student.attendanceStatus === 'present'} class:text-red-600={student.attendanceStatus === 'absent'} class:text-gray-500={!student.attendanceStatus}>
															{student.attendanceStatus === 'present' ? 'Present' : student.attendanceStatus === 'absent' ? 'Absent' : 'Not Marked'}
														</span>
													</div>
													<div>
														<span class="text-gray-600">Current Session:</span>
														<span class="font-medium">{student.currentSession}</span>
													</div>
												</div>
											</div>
										</div>
									{/each}
								</div>
							</div>
						</div>

					{:else if activeTab === 'reflections'}
						<!-- Public Reflections from Hub -->
						<div>
							<h3 class="text-xl font-bold mb-4" style="color: #334642;">Public Reflections from Your Hub</h3>
							<div class="bg-white rounded-2xl p-6 shadow-sm">
								<div class="text-center py-12">
									<MessageSquare size="48" class="mx-auto mb-4 text-gray-400" />
									<h4 class="text-lg font-medium text-gray-600 mb-2">No Public Reflections Yet</h4>
									<p class="text-gray-500">When your hub members make their reflections public, you'll be able to read them here to facilitate group discussions.</p>
								</div>
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
<script>
	import { Users, CheckSquare, BookOpen, ChevronDown, ChevronUp, Calendar, MessageSquare } from 'lucide-svelte';

	let isExpanded = $state(false);
	let activeTab = $state('attendance'); // 'attendance' | 'progress' | 'reflections'

	const toggleExpanded = () => {
		isExpanded = !isExpanded;
	};

	// Mock hub data
	const hubData = $state({
		hubName: "St. Mary's Parish Hub",
		coordinatorName: "Maria Rodriguez",
		currentWeek: 8,
		students: [
			{ id: 1, name: "Sarah Johnson", attendance: [true, true, false, true, true, true, false, true], reflectionStatus: 'submitted', email: 'sarah@email.com' },
			{ id: 2, name: "Michael Chen", attendance: [true, true, true, true, false, true, true, false], reflectionStatus: 'not_started', email: 'michael@email.com' },
			{ id: 3, name: "Jennifer Davis", attendance: [false, true, true, true, true, true, true, true], reflectionStatus: 'submitted', email: 'jennifer@email.com' },
			{ id: 4, name: "Robert Wilson", attendance: [true, false, true, true, true, false, true, true], reflectionStatus: 'overdue', email: 'robert@email.com' },
			{ id: 5, name: "Lisa Anderson", attendance: [true, true, true, false, true, true, true, true], reflectionStatus: 'submitted', email: 'lisa@email.com' }
		]
	});

	const getAttendanceCount = (student) => {
		return student.attendance.filter(Boolean).length;
	};

	const markAttendance = (studentId, present) => {
		const student = hubData.students.find(s => s.id === studentId);
		if (student && student.attendance.length === hubData.currentWeek) {
			student.attendance[hubData.currentWeek - 1] = present;
		}
	};
</script>

<!-- Hub Coordinator Bar -->
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
					<span>{hubData.students.length} students</span>
				</div>
			</div>

			<div class="flex items-center gap-4">
				<div class="text-sm" style="color: #334642;">
					Week {hubData.currentWeek} attendance & reflections
				</div>
				<button
					on:click={toggleExpanded}
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
							on:click={() => activeTab = 'attendance'}
							class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
							class:active-tab={activeTab === 'attendance'}
							class:inactive-tab={activeTab !== 'attendance'}
						>
							<CheckSquare size="16" />
							Mark Attendance
						</button>
						<button
							on:click={() => activeTab = 'progress'}
							class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors"
							class:active-tab={activeTab === 'progress'}
							class:inactive-tab={activeTab !== 'progress'}
						>
							<Calendar size="16" />
							Student Progress
						</button>
						<button
							on:click={() => activeTab = 'reflections'}
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
							<h3 class="text-xl font-bold mb-4" style="color: #334642;">Week {hubData.currentWeek} Attendance</h3>
							<div class="bg-white rounded-2xl p-6 shadow-sm">
								<div class="space-y-4">
									{#each hubData.students as student}
										<div class="flex items-center justify-between py-3 border-b border-gray-200 last:border-b-0">
											<div class="flex items-center gap-4">
												<div class="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-white" style="background-color: #334642;">
													{student.name.split(' ').map(n => n[0]).join('')}
												</div>
												<div>
													<div class="font-semibold text-gray-800">{student.name}</div>
													<div class="text-sm text-gray-600">{getAttendanceCount(student)}/8 sessions attended</div>
												</div>
											</div>
											<div class="flex items-center gap-3">
												<button
													on:click={() => markAttendance(student.id, true)}
													class="px-6 py-2 rounded-lg font-medium transition-colors"
													class:bg-green-500={student.attendance[hubData.currentWeek - 1] === true}
													class:text-white={student.attendance[hubData.currentWeek - 1] === true}
													class:bg-gray-200={student.attendance[hubData.currentWeek - 1] !== true}
													class:text-gray-700={student.attendance[hubData.currentWeek - 1] !== true}
												>
													Present
												</button>
												<button
													on:click={() => markAttendance(student.id, false)}
													class="px-6 py-2 rounded-lg font-medium transition-colors"
													class:bg-red-500={student.attendance[hubData.currentWeek - 1] === false}
													class:text-white={student.attendance[hubData.currentWeek - 1] === false}
													class:bg-gray-200={student.attendance[hubData.currentWeek - 1] !== false}
													class:text-gray-700={student.attendance[hubData.currentWeek - 1] !== false}
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
									{#each hubData.students as student}
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
													<div class="text-sm text-gray-600 mb-1">Week 8 Reflection</div>
													<div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium"
														class:bg-green-100={student.reflectionStatus === 'submitted'}
														class:text-green-700={student.reflectionStatus === 'submitted'}
														class:bg-orange-100={student.reflectionStatus === 'not_started'}
														class:text-orange-700={student.reflectionStatus === 'not_started'}
														class:bg-red-100={student.reflectionStatus === 'overdue'}
														class:text-red-700={student.reflectionStatus === 'overdue'}
													>
														{#if student.reflectionStatus === 'submitted'}
															✓ Submitted
														{:else if student.reflectionStatus === 'not_started'}
															⏳ Not Started
														{:else if student.reflectionStatus === 'overdue'}
															⚠️ Overdue
														{/if}
													</div>
												</div>
											</div>
											<!-- Attendance Grid -->
											<div>
												<div class="text-sm font-medium text-gray-700 mb-2">Attendance Record</div>
												<div class="flex gap-1">
													{#each student.attendance as attended, weekIndex}
														<div
															class="w-8 h-8 rounded flex items-center justify-center text-xs font-medium"
															class:bg-green-500={attended}
															class:text-white={attended}
															class:bg-red-200={!attended}
															class:text-red-700={!attended}
															title="Week {weekIndex + 1}: {attended ? 'Present' : 'Absent'}"
														>
															{weekIndex + 1}
														</div>
													{/each}
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
<script>
	import { Search, Filter, Users, Edit2, Mail, MapPin } from 'lucide-svelte';

	let { data } = $props();
	let course = $derived(data.course);
	let students = $state(data.users || []);
	let hubs = $derived(data.hubs || []);

	// Filter state
	let searchQuery = $state('');
	let selectedHub = $state('all');
	let selectedStatus = $state('all');

	// Filtered students
	let filteredStudents = $derived(() => {
		return students.filter(student => {
			// Search filter
			const matchesSearch = !searchQuery ||
				student.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
				student.email?.toLowerCase().includes(searchQuery.toLowerCase());

			// Hub filter
			const matchesHub = selectedHub === 'all' || student.hub_id === selectedHub;

			// Status filter
			const matchesStatus = selectedStatus === 'all' || student.status === selectedStatus;

			return matchesSearch && matchesHub && matchesStatus;
		});
	});

	// Stats
	let stats = $derived(() => {
		const total = students.length;
		const active = students.filter(s => s.status === 'active').length;
		const pending = students.filter(s => s.status === 'pending' || s.status === 'invited').length;
		return { total, active, pending };
	});

	async function handleUpdateHub(studentId, newHubId) {
		try {
			const response = await fetch('/courses/' + course.slug + '/admin/api', {
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

			// Update local state
			const index = students.findIndex(s => s.id === studentId);
			if (index !== -1) {
				students[index].hub_id = newHubId;
				students = [...students];
			}
		} catch (err) {
			console.error('Error updating hub:', err);
			alert(err.message || 'Failed to update hub');
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
</script>

<div class="px-16 py-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-white">
			{course?.name} Participants
		</h1>
		<p class="text-white/80 mt-2">
			View and manage all participants enrolled in this course across all cohorts
		</p>
	</div>

	<!-- Stats Cards -->
	<div class="grid grid-cols-3 gap-6 mb-8">
		<div class="bg-white border rounded-lg p-6" style="border-color: var(--course-surface);">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-gray-600">Total Participants</p>
					<p class="text-3xl font-bold mt-1" style="color: var(--course-accent-dark);">
						{stats.total}
					</p>
				</div>
				<Users size={32} style="color: var(--course-accent-light);" />
			</div>
		</div>

		<div class="bg-white border rounded-lg p-6" style="border-color: var(--course-surface);">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-gray-600">Active</p>
					<p class="text-3xl font-bold mt-1 text-green-600">
						{stats.active}
					</p>
				</div>
				<div class="text-2xl">✓</div>
			</div>
		</div>

		<div class="bg-white border rounded-lg p-6" style="border-color: var(--course-surface);">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-sm text-gray-600">Pending</p>
					<p class="text-3xl font-bold mt-1 text-yellow-600">
						{stats.pending}
					</p>
				</div>
				<Mail size={32} class="text-yellow-500" />
			</div>
		</div>
	</div>

	<!-- Filters -->
	<div class="bg-white border rounded-lg p-6 mb-6" style="border-color: var(--course-surface);">
		<div class="grid grid-cols-3 gap-4">
			<!-- Search -->
			<div class="relative">
				<Search size={18} class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search by name or email..."
					class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
				/>
			</div>

			<!-- Hub Filter -->
			<select
				bind:value={selectedHub}
				class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
			>
				<option value="all">All Hubs</option>
				<option value="">No Hub</option>
				{#each hubs as hub}
					<option value={hub.id}>{hub.name}</option>
				{/each}
			</select>

			<!-- Status Filter -->
			<select
				bind:value={selectedStatus}
				class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
			>
				<option value="all">All Statuses</option>
				<option value="active">Active</option>
				<option value="pending">Pending</option>
				<option value="invited">Invited</option>
				<option value="completed">Completed</option>
				<option value="withdrawn">Withdrawn</option>
			</select>
		</div>
	</div>

	<!-- Students Table -->
	<div class="bg-white border rounded-lg overflow-hidden" style="border-color: var(--course-surface);">
		<table class="w-full">
			<thead class="bg-gray-50 border-b" style="border-color: var(--course-surface);">
				<tr>
					<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
						Participant
					</th>
					<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
						Cohort
					</th>
					<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
						Hub
					</th>
					<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
						Session
					</th>
					<th class="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
						Status
					</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-gray-200">
				{#if filteredStudents.length === 0}
					<tr>
						<td colspan="5" class="px-6 py-8 text-center text-gray-500">
							No participants found matching your filters
						</td>
					</tr>
				{:else}
					{#each filteredStudents as student}
						<tr class="hover:bg-gray-50 transition-colors">
							<!-- Student Info -->
							<td class="px-6 py-4">
								<div>
									<div class="font-medium text-gray-900">{student.full_name}</div>
									<div class="text-sm text-gray-500">{student.email}</div>
								</div>
							</td>

							<!-- Cohort -->
							<td class="px-6 py-4">
								<div class="text-sm">
									{#if student.cohort}
										<div class="font-medium text-gray-900">{student.cohort.name}</div>
										{#if student.cohort.module}
											<div class="text-gray-500">{student.cohort.module.name}</div>
										{/if}
									{:else}
										<span class="text-gray-400">-</span>
									{/if}
								</div>
							</td>

							<!-- Hub (Editable) -->
							<td class="px-6 py-4">
								<select
									value={student.hub_id || ''}
									onchange={(e) => handleUpdateHub(student.id, e.target.value || null)}
									class="text-sm px-3 py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white"
								>
									<option value="">No Hub</option>
									{#each hubs as hub}
										<option value={hub.id}>{hub.name}</option>
									{/each}
								</select>
							</td>

							<!-- Session -->
							<td class="px-6 py-4">
								<div class="text-sm text-gray-900">
									Session {student.current_session || 1}
								</div>
							</td>

							<!-- Status -->
							<td class="px-6 py-4">
								<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getStatusBadge(student.status)}">
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
	<div class="mt-4 text-sm text-gray-600 text-center">
		Showing {filteredStudents.length} of {students.length} participants
	</div>
</div>

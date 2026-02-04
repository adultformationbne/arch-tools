<script>
	import { Plus, MapPin, Edit, Trash2, ChevronDown, ChevronUp, Shield, UserPlus, X } from '$lib/icons';
	import HubModal from '$lib/components/HubModal.svelte';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';
	import { getUserInitials } from '$lib/utils/avatar.js';

	let { data } = $props();
	const course = $derived(data.course);
	let hubs = $state([]);
	let availableUsers = $state([]);

	// Sync state from server data
	$effect(() => {
		hubs = data.hubs || [];
		availableUsers = data.availableUsers || [];
	});

	// Modal state
	let showHubModal = $state(false);
	let editingHub = $state(null);

	// Delete confirmation state
	let showDeleteConfirm = $state(false);
	let hubToDelete = $state(null);

	// Expanded hub state
	let expandedHubs = $state({});

	// Add coordinator state
	let addingCoordinatorToHub = $state(null);
	let selectedUserId = $state('');
	let assigningCoordinator = $state(false);

	// Users available to be coordinators (exclude those already coordinator of THIS hub)
	const usersForCoordinatorDropdown = $derived(() => {
		if (!addingCoordinatorToHub) return [];
		const hub = hubs.find(h => h.id === addingCoordinatorToHub);
		const currentCoordinatorIds = hub?.coordinators?.map(c => c.id) || [];
		return availableUsers.filter(u => !currentCoordinatorIds.includes(u.id));
	});

	function handleCreateHub() {
		editingHub = null;
		showHubModal = true;
	}

	function handleEditHub(hub) {
		editingHub = hub;
		showHubModal = true;
	}

	function confirmDeleteHub(hub) {
		hubToDelete = hub;
		showDeleteConfirm = true;
	}

	async function handleDeleteHub() {
		const hub = hubToDelete;
		showDeleteConfirm = false;
		hubToDelete = null;

		if (!hub) return;

		try {
			const response = await fetch('/admin/courses/' + course.slug + '/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'delete_hub',
					hubId: hub.id
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to delete hub');
			}

			// Remove from list
			hubs = hubs.filter(h => h.id !== hub.id);
		} catch (err) {
			console.error('Error deleting hub:', err);
			toastError(err.message || 'Failed to delete hub', 'Delete Failed');
		}
	}

	function handleHubSaved(savedHub) {
		if (editingHub) {
			// Update existing hub
			const index = hubs.findIndex(h => h.id === savedHub.id);
			if (index !== -1) {
				hubs[index] = { ...hubs[index], ...savedHub };
				hubs = [...hubs];
			}
		} else {
			// Add new hub
			hubs = [...hubs, { ...savedHub, enrollmentCount: 0 }];
		}
	}

	function handleCloseModal() {
		showHubModal = false;
		editingHub = null;
	}

	function toggleHubExpanded(hubId) {
		expandedHubs[hubId] = !expandedHubs[hubId];
	}

	function startAddingCoordinator(hubId) {
		addingCoordinatorToHub = hubId;
		selectedUserId = '';
	}

	function cancelAddingCoordinator() {
		addingCoordinatorToHub = null;
		selectedUserId = '';
	}

	async function assignCoordinator(hubId) {
		if (!selectedUserId) return;

		assigningCoordinator = true;
		try {
			const response = await fetch('/admin/courses/' + course.slug + '/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'assign_hub_coordinator',
					enrollmentId: selectedUserId,
					hubId: hubId
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to assign coordinator');
			}

			// Update local state
			const user = availableUsers.find(u => u.id === selectedUserId);
			if (user) {
				// Update user in availableUsers
				user.role = 'coordinator';
				user.hub_id = hubId;
				availableUsers = [...availableUsers];

				// Add to hub's coordinators
				const hub = hubs.find(h => h.id === hubId);
				if (hub) {
					hub.coordinators = [...(hub.coordinators || []), {
						id: user.id,
						full_name: user.full_name,
						email: user.email
					}];
					hubs = [...hubs];
				}
			}

			toastSuccess('Coordinator assigned successfully');
			cancelAddingCoordinator();
		} catch (err) {
			console.error('Error assigning coordinator:', err);
			toastError(err.message || 'Failed to assign coordinator');
		} finally {
			assigningCoordinator = false;
		}
	}

	async function removeCoordinator(hubId, coordinator) {
		try {
			const response = await fetch('/admin/courses/' + course.slug + '/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'remove_hub_coordinator',
					enrollmentId: coordinator.id
				})
			});

			const result = await response.json();

			if (!response.ok || !result.success) {
				throw new Error(result.message || 'Failed to remove coordinator');
			}

			// Update local state
			const user = availableUsers.find(u => u.id === coordinator.id);
			if (user) {
				user.role = 'student';
				user.hub_id = null;
				availableUsers = [...availableUsers];
			}

			// Remove from hub's coordinators
			const hub = hubs.find(h => h.id === hubId);
			if (hub) {
				hub.coordinators = hub.coordinators.filter(c => c.id !== coordinator.id);
				hubs = [...hubs];
			}

			toastSuccess('Coordinator removed');
		} catch (err) {
			console.error('Error removing coordinator:', err);
			toastError(err.message || 'Failed to remove coordinator');
		}
	}
</script>

<div class="p-3 sm:p-4 lg:p-6">
	<!-- Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 sm:mb-8">
		<div>
			<h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-white">
				{course?.name} Hubs
			</h1>
			<p class="text-white/80 mt-1 sm:mt-2 text-sm sm:text-base">
				Manage physical locations and groups for participant attendance tracking
			</p>
		</div>
		<button
			onclick={handleCreateHub}
			class="flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold transition-colors w-full sm:w-auto"
			style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
		>
			<Plus size={20} />
			Create Hub
		</button>
	</div>

	<!-- Hubs Grid -->
	{#if hubs.length === 0}
		<div class="text-center py-10 sm:py-16 px-4">
			<MapPin size={48} class="mx-auto mb-4" style="color: var(--course-accent-light);" />
			<h3 class="text-lg sm:text-xl font-semibold mb-2 text-white">
				No hubs yet
			</h3>
			<p class="text-white/80 mb-6 text-sm sm:text-base">
				Create your first hub to organise participants by location or group
			</p>
			<button
				onclick={handleCreateHub}
				class="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold w-full sm:w-auto"
				style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
			>
				<Plus size={20} />
				Create Hub
			</button>
		</div>
	{:else}
		<div class="bg-white rounded-lg border overflow-hidden" style="border-color: var(--course-surface);">
			<!-- Table Header - Hidden on mobile -->
			<div class="hidden sm:grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b text-sm font-semibold text-gray-600" style="border-color: var(--course-surface);">
				<div class="col-span-5">Hub</div>
				<div class="col-span-5">Coordinators</div>
				<div class="col-span-2 text-right">Actions</div>
			</div>

			<!-- Hub Rows -->
			{#each hubs as hub}
				<!-- Main Row - Card layout on mobile, grid on larger screens -->
				<div
					class="flex flex-col sm:grid sm:grid-cols-12 gap-2 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 sm:items-center border-b hover:bg-gray-50 cursor-pointer"
					style="border-color: var(--course-surface);"
					role="button"
					tabindex="0"
					onclick={() => toggleHubExpanded(hub.id)}
					onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleHubExpanded(hub.id)}
				>
					<!-- Hub Name & Location + Actions on mobile -->
					<div class="sm:col-span-5 flex items-center gap-2 sm:gap-3">
						<button class="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0">
							{#if expandedHubs[hub.id]}
								<ChevronUp size={18} class="text-gray-500" />
							{:else}
								<ChevronDown size={18} class="text-gray-500" />
							{/if}
						</button>
						<div class="flex-1 min-w-0">
							<div class="font-semibold text-gray-900 text-sm sm:text-base truncate">{hub.name}</div>
							{#if hub.location}
								<div class="text-xs text-gray-500 flex items-center gap-1 truncate">
									<MapPin size={12} class="flex-shrink-0" />
									<span class="truncate">{hub.location}</span>
								</div>
							{/if}
						</div>
						<!-- Actions - Mobile only, inline with hub name -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="flex sm:hidden gap-1 flex-shrink-0"
							onkeydown={(e) => e.stopPropagation()}
						>
							<button
								onclick={(e) => { e.stopPropagation(); handleEditHub(hub); }}
								class="p-2 hover:bg-gray-200 rounded transition-colors"
								title="Edit hub"
							>
								<Edit size={16} class="text-gray-600" />
							</button>
							<button
								onclick={(e) => { e.stopPropagation(); confirmDeleteHub(hub); }}
								class="p-2 hover:bg-red-100 rounded transition-colors"
								title="Delete hub"
							>
								<Trash2 size={16} class="text-red-500" />
							</button>
						</div>
					</div>

					<!-- Coordinators Preview -->
					<div class="sm:col-span-5 pl-8 sm:pl-0">
						{#if hub.coordinators?.length > 0}
							<div class="flex items-center gap-2">
								<div class="flex -space-x-2">
									{#each hub.coordinators.slice(0, 3) as coordinator}
										<div
											class="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 border-white"
											style="background-color: #d97706;"
											title={coordinator.full_name}
										>
											{getUserInitials(coordinator.full_name)}
										</div>
									{/each}
								</div>
								<span class="text-xs sm:text-sm text-gray-600">
									{hub.coordinators.length} coordinator{hub.coordinators.length !== 1 ? 's' : ''}
								</span>
							</div>
						{:else}
							<span class="text-xs sm:text-sm text-gray-400 italic">No coordinators</span>
						{/if}
					</div>

					<!-- Actions - Desktop only -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div
						class="hidden sm:flex col-span-2 justify-end gap-1"
						onkeydown={(e) => e.stopPropagation()}
					>
						<button
							onclick={(e) => { e.stopPropagation(); handleEditHub(hub); }}
							class="p-2 hover:bg-gray-200 rounded transition-colors"
							title="Edit hub"
						>
							<Edit size={16} class="text-gray-600" />
						</button>
						<button
							onclick={(e) => { e.stopPropagation(); confirmDeleteHub(hub); }}
							class="p-2 hover:bg-red-100 rounded transition-colors"
							title="Delete hub"
						>
							<Trash2 size={16} class="text-red-500" />
						</button>
					</div>
				</div>

				<!-- Expanded Details -->
				{#if expandedHubs[hub.id]}
					<div class="px-3 sm:px-4 py-3 sm:py-4 bg-gray-50 border-b" style="border-color: var(--course-surface);">
						<div class="ml-6 sm:ml-8">
							<!-- Coordinators List -->
							<div class="max-w-full sm:max-w-md">
								<div class="flex items-center justify-between mb-2">
									<h4 class="text-xs sm:text-sm font-semibold text-gray-700 flex items-center gap-2">
										<Shield size={14} class="text-amber-600" />
										Coordinators
									</h4>
									{#if addingCoordinatorToHub !== hub.id}
										<button
											onclick={() => startAddingCoordinator(hub.id)}
											class="flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors"
										>
											<UserPlus size={12} />
											Add
										</button>
									{/if}
								</div>

								{#if hub.coordinators?.length > 0}
									<div class="space-y-2 sm:space-y-1">
										{#each hub.coordinators as coordinator}
											<div class="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-sm py-2 sm:py-1 group border-b sm:border-0 border-gray-200 last:border-0">
												<div class="flex items-center gap-2">
													<div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style="background-color: #d97706;">
														{getUserInitials(coordinator.full_name)}
													</div>
													<span class="font-medium text-gray-800 text-sm">{coordinator.full_name}</span>
													<button
														onclick={() => removeCoordinator(hub.id, coordinator)}
														class="sm:opacity-0 sm:group-hover:opacity-100 p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-all ml-auto sm:ml-0 sm:order-last"
														title="Remove coordinator"
													>
														<X size={14} />
													</button>
												</div>
												<span class="hidden sm:inline text-gray-400">·</span>
												<span class="text-gray-500 text-xs sm:text-sm sm:flex-1 pl-8 sm:pl-0 truncate">{coordinator.email}</span>
											</div>
										{/each}
									</div>
								{:else if addingCoordinatorToHub !== hub.id}
									<p class="text-xs sm:text-sm text-gray-400 italic">No coordinators assigned</p>
								{/if}

								<!-- Add coordinator form -->
								{#if addingCoordinatorToHub === hub.id}
									<div class="mt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
										<select
											bind:value={selectedUserId}
											class="flex-1 text-sm px-2 py-2 sm:py-1.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-amber-500 bg-white"
										>
											<option value="">Select person...</option>
											{#each usersForCoordinatorDropdown() as user}
												<option value={user.id}>{user.full_name}</option>
											{/each}
										</select>
										<div class="flex gap-2">
											<button
												onclick={() => assignCoordinator(hub.id)}
												disabled={!selectedUserId || assigningCoordinator}
												class="flex-1 sm:flex-none px-3 py-2 sm:py-1.5 text-xs font-medium rounded bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
											>
												{assigningCoordinator ? '...' : 'Assign'}
											</button>
											<button
												onclick={cancelAddingCoordinator}
												class="p-2 sm:p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
											>
												<X size={14} />
											</button>
										</div>
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}
</div>

<!-- Hub Modal -->
<HubModal
	isOpen={showHubModal}
	hub={editingHub}
	courseId={data.courseId}
	courseSlug={course?.slug}
	onClose={handleCloseModal}
	onSave={handleHubSaved}
/>

<!-- Confirmation Modal -->
<ConfirmationModal
	show={showDeleteConfirm}
	title="Delete Hub"
	confirmText="Delete"
	cancelText="Cancel"
	onConfirm={handleDeleteHub}
	onCancel={() => {
		showDeleteConfirm = false;
		hubToDelete = null;
	}}
>
	<p>Are you sure you want to delete "<strong>{hubToDelete?.name}</strong>"?</p>
	<p class="text-sm text-gray-600 mt-2">This action cannot be undone.</p>
</ConfirmationModal>

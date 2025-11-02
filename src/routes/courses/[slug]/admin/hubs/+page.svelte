<script>
	import { Plus, MapPin, Users, Edit, Trash2, UserCircle } from 'lucide-svelte';
	import HubModal from '$lib/components/HubModal.svelte';

	let { data } = $props();
	let course = $derived(data.course);
	let hubs = $state(data.hubs || []);
	let potentialCoordinators = $derived(data.potentialCoordinators || []);

	// Modal state
	let showHubModal = $state(false);
	let editingHub = $state(null);

	function handleCreateHub() {
		editingHub = null;
		showHubModal = true;
	}

	function handleEditHub(hub) {
		editingHub = hub;
		showHubModal = true;
	}

	async function handleDeleteHub(hub) {
		const confirmed = confirm(
			`Are you sure you want to delete "${hub.name}"?\n\n` +
			`This will remove ${hub.enrollmentCount} participant(s) from this hub.`
		);
		if (!confirmed) return;

		try {
			const response = await fetch('/courses/' + course.slug + '/admin/api', {
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
			alert(err.message || 'Failed to delete hub');
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
</script>

<div class="px-16 py-8">
	<!-- Header -->
	<div class="flex items-center justify-between mb-8">
		<div>
			<h1 class="text-3xl font-bold text-white">
				{course?.name} Hubs
			</h1>
			<p class="text-white/80 mt-2">
				Manage physical locations and groups for participant attendance tracking
			</p>
		</div>
		<button
			onclick={handleCreateHub}
			class="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-colors"
			style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
		>
			<Plus size={20} />
			Create Hub
		</button>
	</div>

	<!-- Hubs Grid -->
	{#if hubs.length === 0}
		<div class="text-center py-16">
			<MapPin size={48} class="mx-auto mb-4" style="color: var(--course-accent-light);" />
			<h3 class="text-xl font-semibold mb-2 text-white">
				No hubs yet
			</h3>
			<p class="text-white/80 mb-6">
				Create your first hub to organize participants by location or group
			</p>
			<button
				onclick={handleCreateHub}
				class="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold"
				style="background-color: var(--course-accent-light); color: var(--course-accent-darkest);"
			>
				<Plus size={20} />
				Create Hub
			</button>
		</div>
	{:else}
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
			{#each hubs as hub}
				<div
					class="bg-white border rounded-lg p-6 hover:shadow-lg transition-shadow"
					style="border-color: var(--course-surface);"
				>
					<!-- Hub Header -->
					<div class="flex items-start justify-between mb-4">
						<div class="flex-1">
							<h3 class="text-xl font-bold mb-1" style="color: var(--course-accent-dark);">
								{hub.name}
							</h3>
							{#if hub.location}
								<div class="flex items-center gap-2 text-sm text-gray-600">
									<MapPin size={14} />
									<span>{hub.location}</span>
								</div>
							{/if}
						</div>
					</div>

					<!-- Coordinator -->
					{#if hub.coordinator}
						<div class="mb-4 p-3 bg-gray-50 rounded-lg">
							<div class="flex items-center gap-2 text-sm">
								<UserCircle size={16} style="color: var(--course-accent-light);" />
								<div>
									<div class="font-medium text-gray-700">{hub.coordinator.full_name}</div>
									<div class="text-gray-500 text-xs">{hub.coordinator.email}</div>
								</div>
							</div>
						</div>
					{/if}

					<!-- Stats -->
					<div class="flex items-center justify-between pt-4 border-t" style="border-color: var(--course-surface);">
						<div class="flex items-center gap-2">
							<Users size={18} style="color: var(--course-accent-light);" />
							<span class="text-lg font-bold" style="color: var(--course-accent-dark);">
								{hub.enrollmentCount}
							</span>
							<span class="text-sm text-gray-500">participants</span>
						</div>

						<!-- Actions -->
						<div class="flex gap-2">
							<button
								onclick={() => handleEditHub(hub)}
								class="p-2 hover:bg-gray-100 rounded transition-colors"
								title="Edit hub"
							>
								<Edit size={18} style="color: var(--course-accent-dark);" />
							</button>
							<button
								onclick={() => handleDeleteHub(hub)}
								class="p-2 hover:bg-red-50 rounded transition-colors"
								title="Delete hub"
							>
								<Trash2 size={18} class="text-red-600" />
							</button>
						</div>
					</div>
				</div>
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
	{potentialCoordinators}
	onClose={handleCloseModal}
	onSave={handleHubSaved}
/>

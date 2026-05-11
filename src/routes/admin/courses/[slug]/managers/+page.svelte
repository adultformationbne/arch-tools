<script>
	import { invalidateAll } from '$app/navigation';
	import { Search, Shield, UserPlus, UserMinus, X } from '$lib/icons';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';

	let { data } = $props();

	const courseSlug = $derived(data.courseSlug);

	let managers = $derived(data.managers || []);
	let platformAdmins = $derived(data.platformAdmins || []);
	let allUsers = $derived(data.allUsers || []);

	let searchQuery = $state('');
	let loadingUserId = $state(null);

	const managerIds = $derived(new Set(managers.map((m) => m.id)));
	const platformAdminIds = $derived(new Set(platformAdmins.map((a) => a.id)));

	const filteredUsers = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return [];
		return allUsers.filter(
			(u) =>
				!managerIds.has(u.id) &&
				!platformAdminIds.has(u.id) &&
				(u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
		);
	});

	async function addManager(userId) {
		loadingUserId = userId;
		try {
			const res = await fetch(`/admin/courses/${courseSlug}/managers/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'add_manager', userId })
			});
			const result = await res.json();
			if (!result.success) throw new Error(result.error);
			toastSuccess('Manager added');
			searchQuery = '';
			await invalidateAll();
		} catch (err) {
			toastError(err.message || 'Failed to add manager');
		} finally {
			loadingUserId = null;
		}
	}

	async function removeManager(userId) {
		loadingUserId = userId;
		try {
			const res = await fetch(`/admin/courses/${courseSlug}/managers/api`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'remove_manager', userId })
			});
			const result = await res.json();
			if (!result.success) throw new Error(result.error);
			toastSuccess('Manager removed');
			await invalidateAll();
		} catch (err) {
			toastError(err.message || 'Failed to remove manager');
		} finally {
			loadingUserId = null;
		}
	}

	function getInitials(name) {
		if (!name) return '?';
		return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
	}
</script>

<div class="min-h-screen p-3 sm:p-4 lg:p-6" style="background-color: var(--course-accent-dark);">
	<div class="max-w-3xl mx-auto">

		<!-- Header -->
		<div class="mb-6 lg:mb-8">
			<h1 class="text-2xl lg:text-3xl font-bold text-white mb-1">Managers</h1>
			<p class="text-sm text-white/70">Search for any user to grant them manager access to this course.</p>
		</div>

		<!-- Search card -->
		<div class="bg-white rounded-lg shadow-lg mb-4">
			<div class="p-4 sm:p-5 lg:p-6">
				<label class="block text-sm font-medium text-gray-700 mb-2">Add a manager</label>
				<div class="relative">
					<Search class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="Search by name or email…"
						class="w-full pl-9 pr-9 py-2.5 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300 focus:border-transparent"
					/>
					{#if searchQuery}
						<button
							onclick={() => (searchQuery = '')}
							class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
						>
							<X class="w-4 h-4" />
						</button>
					{/if}
				</div>

				{#if searchQuery.trim()}
					<div class="mt-2 border border-gray-200 rounded-lg overflow-hidden">
						{#if filteredUsers.length === 0}
							<p class="px-4 py-3 text-sm text-gray-500">No users found</p>
						{:else}
							{#each filteredUsers as user (user.id)}
								<div class="flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50">
									<div class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 overflow-hidden" style="background-color: var(--course-accent-dark);">
										{#if user.avatar_url}
											<img src={user.avatar_url} alt="" class="w-8 h-8 object-cover" />
										{:else}
											{getInitials(user.full_name)}
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<p class="text-sm font-medium text-gray-900 truncate">{user.full_name || 'Unknown'}</p>
										<p class="text-xs text-gray-500 truncate">{user.email}</p>
									</div>
									<button
										onclick={() => addManager(user.id)}
										disabled={loadingUserId === user.id}
										class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-white text-xs font-medium transition-opacity hover:opacity-90 disabled:opacity-50"
										style="background-color: var(--course-accent-light);"
									>
										<UserPlus class="w-3.5 h-3.5" />
										{loadingUserId === user.id ? 'Adding…' : 'Add'}
									</button>
								</div>
							{/each}
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Current managers card -->
		<div class="bg-white rounded-lg shadow-lg mb-4">
			<div class="p-4 sm:p-5 lg:p-6">
				<h2 class="text-base font-semibold text-gray-900 mb-4">
					Course Managers <span class="text-gray-400 font-normal">({managers.length})</span>
				</h2>

				{#if managers.length === 0}
					<div class="rounded-lg border border-dashed border-gray-300 p-8 text-center">
						<Shield class="mx-auto h-10 w-10 text-gray-300 mb-3" />
						<p class="text-sm text-gray-500">No managers assigned. Search above to add one.</p>
					</div>
				{:else}
					<div class="divide-y divide-gray-100">
						{#each managers as manager (manager.id)}
							<div class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
								<div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden" style="background-color: var(--course-accent-dark);">
									{#if manager.avatar_url}
										<img src={manager.avatar_url} alt="" class="w-9 h-9 object-cover" />
									{:else}
										{getInitials(manager.full_name)}
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-gray-900 truncate">{manager.full_name || 'Unknown'}</p>
									<p class="text-xs text-gray-500 truncate">{manager.email}</p>
								</div>
								<button
									onclick={() => removeManager(manager.id)}
									disabled={loadingUserId === manager.id}
									class="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-red-600 text-xs font-medium border border-red-200 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-50"
								>
									<UserMinus class="w-3.5 h-3.5" />
									{loadingUserId === manager.id ? 'Removing…' : 'Remove'}
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>

		<!-- Platform admins card (informational) -->
		{#if platformAdmins.length > 0}
			<div class="bg-white rounded-lg shadow-lg">
				<div class="p-4 sm:p-5 lg:p-6">
					<h2 class="text-base font-semibold text-gray-900 mb-1">Platform Admins</h2>
					<p class="text-xs text-gray-500 mb-4">These users have access to all courses and cannot be removed here.</p>
					<div class="divide-y divide-gray-100">
						{#each platformAdmins as admin (admin.id)}
							<div class="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
								<div class="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-semibold flex-shrink-0 overflow-hidden" style="background-color: var(--course-accent-dark);">
									{#if admin.avatar_url}
										<img src={admin.avatar_url} alt="" class="w-9 h-9 object-cover" />
									{:else}
										{getInitials(admin.full_name)}
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium text-gray-900 truncate">{admin.full_name || 'Unknown'}</p>
									<p class="text-xs text-gray-500 truncate">{admin.email}</p>
								</div>
								<span class="px-2 py-1 rounded text-xs text-gray-500 bg-gray-100">Platform admin</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

	</div>
</div>

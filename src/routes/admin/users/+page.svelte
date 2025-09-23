<script lang="ts">
	import { Shield, Mail, Edit2, Save, X } from 'lucide-svelte';

	export let data;
	let { supabase, users, currentUser } = data;

	let editingUserId = null;
	let editingRole = '';
	let loading = false;
	let message = '';

	function startEdit(userId: string, currentRole: string) {
		editingUserId = userId;
		editingRole = currentRole;
	}

	function cancelEdit() {
		editingUserId = null;
		editingRole = '';
	}

	async function saveRole(userId: string) {
		loading = true;
		message = '';

		try {
			const { error } = await supabase
				.from('user_profiles')
				.update({ role: editingRole })
				.eq('id', userId);

			if (error) throw error;

			// Update local state
			const userIndex = users.findIndex(u => u.id === userId);
			if (userIndex !== -1) {
				users[userIndex].role = editingRole;
			}

			cancelEdit();
			message = 'Role updated successfully';
			setTimeout(() => message = '', 3000);
		} catch (error) {
			console.error('Error updating role:', error);
			message = 'Error updating role';
		} finally {
			loading = false;
		}
	}

	const roleColors = {
		admin: 'bg-red-100 text-red-800',
		editor: 'bg-blue-100 text-blue-800',
		contributor: 'bg-green-100 text-green-800',
		viewer: 'bg-gray-100 text-gray-800'
	};
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="bg-white shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200">
				<div class="flex items-center justify-between">
					<h1 class="text-2xl font-semibold text-gray-900 flex items-center">
						<Shield class="h-6 w-6 mr-2" />
						User Management
					</h1>
					{#if message}
						<div class="text-sm text-green-600 font-medium">{message}</div>
					{/if}
				</div>
			</div>

			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200">
					<thead class="bg-gray-50">
						<tr>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								User
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Role
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Organization
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Joined
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each users as user}
							<tr class:bg-yellow-50={user.id === currentUser.id}>
								<td class="px-6 py-4 whitespace-nowrap">
									<div class="flex items-center">
										<div>
											<div class="text-sm font-medium text-gray-900">
												{user.full_name || user.display_name || 'No name'}
												{#if user.id === currentUser.id}
													<span class="ml-2 text-xs text-gray-500">(You)</span>
												{/if}
											</div>
											<div class="text-sm text-gray-500 flex items-center">
												<Mail class="h-3 w-3 mr-1" />
												{user.email}
											</div>
										</div>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap">
									{#if editingUserId === user.id}
										<select
											bind:value={editingRole}
											class="text-sm rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
											disabled={user.id === currentUser.id}
										>
											<option value="admin">Admin</option>
											<option value="editor">Editor</option>
											<option value="contributor">Contributor</option>
											<option value="viewer">Viewer</option>
										</select>
									{:else}
										<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full {roleColors[user.role]}">
											{user.role}
										</span>
									{/if}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{user.organization || '-'}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
									{new Date(user.created_at).toLocaleDateString()}
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
									{#if editingUserId === user.id}
										<button
											on:click={() => saveRole(user.id)}
											disabled={loading}
											class="text-green-600 hover:text-green-900 mr-3"
										>
											<Save class="h-4 w-4" />
										</button>
										<button
											on:click={cancelEdit}
											disabled={loading}
											class="text-gray-600 hover:text-gray-900"
										>
											<X class="h-4 w-4" />
										</button>
									{:else}
										<button
											on:click={() => startEdit(user.id, user.role)}
											disabled={user.id === currentUser.id}
											class="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed"
											title={user.id === currentUser.id ? "You cannot edit your own role" : "Edit role"}
										>
											<Edit2 class="h-4 w-4" />
										</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		<div class="mt-8 bg-white shadow rounded-lg p-6">
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Role Permissions</h2>
			<div class="space-y-3">
				<div>
					<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">Admin</span>
					<span class="ml-2 text-sm text-gray-600">Full system access, user management, all features</span>
				</div>
				<div>
					<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Editor</span>
					<span class="ml-2 text-sm text-gray-600">Edit content, manage DGR, create and publish</span>
				</div>
				<div>
					<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Contributor</span>
					<span class="ml-2 text-sm text-gray-600">Submit DGR reflections, view content</span>
				</div>
				<div>
					<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">Viewer</span>
					<span class="ml-2 text-sm text-gray-600">Read-only access to public content</span>
				</div>
			</div>
		</div>
	</div>
</div>
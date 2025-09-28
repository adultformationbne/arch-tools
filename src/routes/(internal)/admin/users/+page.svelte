<script lang="ts">
	import { Shield, Mail, Edit2, Save, X, Plus, UserPlus, KeyRound } from 'lucide-svelte';
	import { apiPost, supabaseRequest } from '$lib/utils/api-handler.js';
	import { toastMultiStep, toastNextStep, dismissToast, toastValidationError, updateToastStatus } from '$lib/utils/toast-helpers.js';

	export let data;
	let { supabase, users, currentUser } = data;

	let editingUserId = null;
	let editingRole = '';
	let loading = false;

	// New user form
	let showNewUserForm = false;
	let newUser = {
		email: '',
		password: '',
		full_name: '',
		role: 'viewer'
	};
	let createUserLoading = false;

	// Password reset functionality
	let showPasswordResetModal = false;
	let resetPasswordUserId = null;
	let resetPasswordLoading = false;
	let newPassword = '';

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

		try {
			await supabaseRequest(
				() => supabase
					.from('user_profiles')
					.update({ role: editingRole })
					.eq('id', userId),
				{
					loadingMessage: 'Saving user permissions',
					loadingTitle: 'Updating role...',
					successMessage: 'User role updated successfully',
					successTitle: 'Success!'
				}
			);

			// Update local state
			const userIndex = users.findIndex(u => u.id === userId);
			if (userIndex !== -1) {
				users[userIndex].role = editingRole;
			}

			cancelEdit();
		} catch (error) {
			console.error('Error updating role:', error);
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

	async function createNewUser() {
		createUserLoading = true;

		const toastId = toastMultiStep([
			{
				title: 'Creating user...',
				message: 'Setting up new account',
				type: 'info'
			},
			{
				title: 'Configuring permissions...',
				message: 'Applying user role',
				type: 'loading'
			},
			{
				title: 'Complete!',
				message: 'New user created successfully',
				type: 'success'
			}
		], false);

		try {
			// Create user via API endpoint
			const result = await apiPost('/api/admin/users', newUser, {
				showToast: false // We're handling the multi-step toast manually
			});

			toastNextStep(toastId);

			// Add new user to the list
			users = [result.user, ...users];

			toastNextStep(toastId);

			// Reset form
			newUser = {
				email: '',
				password: '',
				full_name: '',
				role: 'viewer'
			};
			showNewUserForm = false;

			// Auto-dismiss success toast after 3 seconds
			setTimeout(() => dismissToast(toastId), 3000);
		} catch (error) {
			console.error('Error creating user:', error);
			updateToastStatus(
				toastId,
				'error',
				error.message || 'Failed to create user',
				'User Creation Failed',
				5000
			);
		} finally {
			createUserLoading = false;
		}
	}

	function showPasswordReset(userId: string) {
		resetPasswordUserId = userId;
		showPasswordResetModal = true;
		newPassword = '';
	}

	async function resetUserPassword() {
		if (!newPassword || newPassword.length < 6) {
			toastValidationError('Password', 'must be at least 6 characters');
			return;
		}

		resetPasswordLoading = true;

		try {
			await apiPost(
				'/api/admin/reset-password',
				{
					userId: resetPasswordUserId,
					newPassword: newPassword
				},
				{
					loadingMessage: 'Updating user credentials',
					loadingTitle: 'Resetting password...',
					successMessage: 'Password reset successfully',
					successTitle: 'Success!'
				}
			);

			showPasswordResetModal = false;
		} catch (error) {
			console.error('Error resetting password:', error);
		} finally {
			resetPasswordLoading = false;
		}
	}
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
					<div class="flex items-center space-x-4">
						<button
							on:click={() => showNewUserForm = true}
							class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
						>
							<UserPlus class="h-4 w-4 mr-2" />
							Add User
						</button>
					</div>
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
										<div class="flex items-center space-x-2">
											<button
												on:click={() => startEdit(user.id, user.role)}
												disabled={user.id === currentUser.id}
												class="text-blue-600 hover:text-blue-900 disabled:text-gray-400 disabled:cursor-not-allowed"
												title={user.id === currentUser.id ? "You cannot edit your own role" : "Edit role"}
											>
												<Edit2 class="h-4 w-4" />
											</button>
											<button
												on:click={() => showPasswordReset(user.id)}
												class="text-orange-600 hover:text-orange-900"
												title="Reset password"
											>
												<KeyRound class="h-4 w-4" />
											</button>
										</div>
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

<!-- New User Modal -->
{#if showNewUserForm}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-4">Create New User</h3>

				<form on:submit|preventDefault={createNewUser} class="space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium text-gray-700">Email</label>
						<input
							type="email"
							id="email"
							bind:value={newUser.email}
							required
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
							placeholder="user@example.com"
						/>
					</div>

					<div>
						<label for="password" class="block text-sm font-medium text-gray-700">Password</label>
						<input
							type="password"
							id="password"
							bind:value={newUser.password}
							required
							minlength="6"
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
							placeholder="Minimum 6 characters"
						/>
					</div>

					<div>
						<label for="full_name" class="block text-sm font-medium text-gray-700">Full Name</label>
						<input
							type="text"
							id="full_name"
							bind:value={newUser.full_name}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
							placeholder="John Doe"
						/>
					</div>

					<div>
						<label for="role" class="block text-sm font-medium text-gray-700">Role</label>
						<select
							id="role"
							bind:value={newUser.role}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
						>
							<option value="viewer">Viewer</option>
							<option value="contributor">Contributor</option>
							<option value="editor">Editor</option>
							<option value="admin">Admin</option>
						</select>
					</div>


					<div class="flex justify-end space-x-3 pt-4">
						<button
							type="button"
							on:click={() => showNewUserForm = false}
							disabled={createUserLoading}
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={createUserLoading}
							class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							{createUserLoading ? 'Creating...' : 'Create User'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

<!-- Password Reset Modal -->
{#if showPasswordResetModal}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-4 flex items-center">
					<KeyRound class="h-5 w-5 mr-2" />
					Reset User Password
				</h3>

				<form on:submit|preventDefault={resetUserPassword} class="space-y-4">
					<div>
						<label for="new_password" class="block text-sm font-medium text-gray-700">
							New Password
						</label>
						<input
							type="password"
							id="new_password"
							bind:value={newPassword}
							required
							minlength="6"
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
							placeholder="Enter new password (minimum 6 characters)"
						/>
						<p class="mt-1 text-sm text-gray-500">
							The user will be able to sign in with this new password immediately.
						</p>
					</div>


					<div class="flex justify-end space-x-3 pt-4">
						<button
							type="button"
							on:click={() => showPasswordResetModal = false}
							disabled={resetPasswordLoading}
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={resetPasswordLoading}
							class="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
						>
							{resetPasswordLoading ? 'Resetting...' : 'Reset Password'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
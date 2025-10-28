<script lang="ts">
	import { Shield, Mail, Edit2, Save, X, Plus, UserPlus, KeyRound, Trash2, Send } from 'lucide-svelte';
	import { apiPost, apiDelete, apiPut, supabaseRequest } from '$lib/utils/api-handler.js';
	import { toastMultiStep, toastNextStep, dismissToast, toastValidationError, updateToastStatus, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { invalidateAll } from '$app/navigation';

	export let data;
	let { supabase, users, currentUser, currentUserProfile } = data;

	let editingUserId = null;
	let editingModules = [];
	let loading = false;

	// Available modules for selection
	const availableModules = [
		{ id: 'user_management', name: 'User Management', description: 'Create and manage admin users' },
		{ id: 'dgr', name: 'Daily Gospel Reflections', description: 'Manage DGR contributors and schedule' },
		{ id: 'editor', name: 'Content Editor', description: 'Edit books, blocks, and chapters' },
		{ id: 'courses', name: 'Courses', description: 'Manage course content' },
		{ id: 'courses_admin', name: 'ACCF Admin', description: 'Manage ACCF cohorts and students' }
	];

	// New user form
	let showNewUserForm = false;
	let newUser = {
		email: '',
		full_name: '',
		modules: []
	};
	let createUserLoading = false;

	// Password reset functionality
	let showPasswordResetModal = false;
	let resetPasswordUserId = null;
	let resetPasswordLoading = false;
	let newPassword = '';

	// Delete confirmation
	let showDeleteModal = false;
	let deleteUserId = null;
	let deleteUserEmail = '';
	let deleteLoading = false;

	function startEdit(userId: string, currentModules: string[]) {
		editingUserId = userId;
		editingModules = [...currentModules];
	}

	function cancelEdit() {
		editingUserId = null;
		editingModules = [];
	}

	function toggleModule(moduleId: string) {
		if (editingModules.includes(moduleId)) {
			editingModules = editingModules.filter(m => m !== moduleId);
		} else {
			editingModules = [...editingModules, moduleId];
		}
	}

	async function savePermissions(userId: string) {
		loading = true;

		try {
			await supabaseRequest(
				() => supabase
					.from('user_profiles')
					.update({ modules: editingModules })
					.eq('id', userId),
				{
					loadingMessage: 'Saving user permissions',
					loadingTitle: 'Updating permissions...',
					successMessage: 'User permissions updated successfully',
					successTitle: 'Success!'
				}
			);

			cancelEdit();

			// Refresh data from server
			await invalidateAll();
		} catch (error) {
			console.error('Error updating permissions:', error);
		} finally {
			loading = false;
		}
	}

	function getModuleBadgeColor(moduleId: string) {
		const colors = {
			'user_management': 'bg-purple-100 text-purple-800',
			'dgr': 'bg-blue-100 text-blue-800',
			'editor': 'bg-green-100 text-green-800',
			'courses': 'bg-yellow-100 text-yellow-800',
			'courses_admin': 'bg-red-100 text-red-800'
		};
		return colors[moduleId] || 'bg-gray-100 text-gray-800';
	}

	async function createNewUser() {
		createUserLoading = true;

		const toastId = toastMultiStep([
			{
				title: 'Creating invitation...',
				message: 'Setting up new account',
				type: 'info'
			},
			{
				title: 'Sending email...',
				message: 'Sending magic link to user',
				type: 'loading'
			},
			{
				title: 'Invitation sent!',
				message: `Magic link sent to ${newUser.email}`,
				type: 'success'
			}
		], false);

		try {
			// Create user via API endpoint (sends invitation)
			await apiPost('/api/admin/users', newUser, {
				showToast: false // We're handling the multi-step toast manually
			});

			toastNextStep(toastId);
			toastNextStep(toastId);

			// Reset form
			newUser = {
				email: '',
				full_name: '',
				modules: []
			};
			showNewUserForm = false;

			// Refresh data from server
			await invalidateAll();

			// Auto-dismiss success toast after 5 seconds
			setTimeout(() => dismissToast(toastId), 5000);
		} catch (error) {
			console.error('Error creating user:', error);
			updateToastStatus(
				toastId,
				'error',
				error.message || 'Failed to send invitation',
				'Invitation Failed',
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

			// Refresh data from server
			await invalidateAll();
		} catch (error) {
			console.error('Error resetting password:', error);
		} finally {
			resetPasswordLoading = false;
		}
	}

	function confirmDelete(userId: string, userEmail: string) {
		deleteUserId = userId;
		deleteUserEmail = userEmail;
		showDeleteModal = true;
	}

	async function deleteUser() {
		deleteLoading = true;

		try {
			await apiDelete(
				'/api/admin/users',
				{ userId: deleteUserId },
				{
					loadingMessage: 'Removing user from system',
					loadingTitle: 'Deleting user...',
					successMessage: `User ${deleteUserEmail} deleted successfully`,
					successTitle: 'User Deleted'
				}
			);

			showDeleteModal = false;

			// Refresh data from server
			await invalidateAll();
		} catch (error) {
			console.error('Error deleting user:', error);
		} finally {
			deleteLoading = false;
		}
	}

	async function resendInvitation(userId: string, userEmail: string) {
		try {
			await apiPut(
				'/api/admin/users',
				{ userId, action: 'resend_invitation' },
				{
					loadingMessage: 'Resending invitation email',
					loadingTitle: 'Sending...',
					successMessage: `Invitation resent to ${userEmail}`,
					successTitle: 'Invitation Sent'
				}
			);

			// Refresh data from server
			await invalidateAll();
		} catch (error) {
			console.error('Error resending invitation:', error);
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
								Module Access
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
											<div class="text-sm font-medium text-gray-900 flex items-center gap-2">
												{user.full_name || user.display_name || 'No name'}
												{#if user.id === currentUser.id}
													<span class="text-xs text-gray-500">(You)</span>
												{/if}
												{#if user.isPending}
													<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
														Pending
													</span>
												{/if}
											</div>
											<div class="text-sm text-gray-500 flex items-center">
												<Mail class="h-3 w-3 mr-1" />
												{user.email}
											</div>
										</div>
									</div>
								</td>
								<td class="px-6 py-4">
									{#if editingUserId === user.id}
										<div class="space-y-2">
											{#each availableModules as module}
												<label class="flex items-center space-x-2 cursor-pointer">
													<input
														type="checkbox"
														checked={editingModules.includes(module.id)}
														on:change={() => toggleModule(module.id)}
														disabled={user.id === currentUser.id && module.id === 'user_management'}
														class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
													/>
													<span class="text-sm text-gray-700">{module.name}</span>
												</label>
											{/each}
										</div>
									{:else}
										<div class="flex flex-wrap gap-1">
											{#if user.modules && user.modules.length > 0}
												{#each user.modules as moduleId}
													{@const module = availableModules.find(m => m.id === moduleId)}
													<span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full {getModuleBadgeColor(moduleId)}">
														{module?.name || moduleId}
													</span>
												{/each}
											{:else}
												<span class="text-sm text-gray-400 italic">No modules</span>
											{/if}
										</div>
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
										<div class="flex items-center space-x-2">
											<button
												on:click={() => savePermissions(user.id)}
												disabled={loading}
												class="text-green-600 hover:text-green-900"
												title="Save permissions"
											>
												<Save class="h-4 w-4" />
											</button>
											<button
												on:click={cancelEdit}
												disabled={loading}
												class="text-gray-600 hover:text-gray-900"
												title="Cancel"
											>
												<X class="h-4 w-4" />
											</button>
										</div>
									{:else}
										<div class="flex items-center space-x-2">
											<button
												on:click={() => startEdit(user.id, user.modules || [])}
												class="text-blue-600 hover:text-blue-900"
												title="Edit permissions"
											>
												<Edit2 class="h-4 w-4" />
											</button>
											{#if user.isPending}
												<button
													on:click={() => resendInvitation(user.id, user.email)}
													class="text-green-600 hover:text-green-900"
													title="Resend invitation"
												>
													<Send class="h-4 w-4" />
												</button>
											{:else}
												<button
													on:click={() => showPasswordReset(user.id)}
													class="text-orange-600 hover:text-orange-900"
													title="Reset password"
												>
													<KeyRound class="h-4 w-4" />
												</button>
											{/if}
											<button
												on:click={() => confirmDelete(user.id, user.email)}
												disabled={user.id === currentUser.id}
												class="text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed"
												title={user.id === currentUser.id ? "Cannot delete yourself" : "Delete user"}
											>
												<Trash2 class="h-4 w-4" />
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
			<h2 class="text-lg font-semibold text-gray-900 mb-4">Available Modules</h2>
			<div class="space-y-3">
				{#each availableModules as module}
					<div>
						<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getModuleBadgeColor(module.id)}">
							{module.name}
						</span>
						<span class="ml-2 text-sm text-gray-600">{module.description}</span>
					</div>
				{/each}
			</div>
			<p class="mt-4 text-sm text-gray-500">
				Users can be granted access to one or more modules. Each module grants full admin access to that feature area.
			</p>
		</div>
	</div>
</div>

<!-- New User Modal -->
{#if showNewUserForm}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-2">Invite New Admin User</h3>
				<p class="text-sm text-gray-600 mb-4">
					An invitation email with a magic link will be sent to set up their account.
				</p>

				<form on:submit|preventDefault={createNewUser} class="space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium text-gray-700">Email Address</label>
						<input
							type="email"
							id="email"
							bind:value={newUser.email}
							required
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
							placeholder="user@example.com"
						/>
						<p class="mt-1 text-xs text-gray-500">They'll receive a magic link to set their password</p>
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
						<label class="block text-sm font-medium text-gray-700 mb-2">Module Access</label>
						<div class="space-y-2 bg-gray-50 p-3 rounded-md border border-gray-300">
							{#each availableModules as module}
								<label class="flex items-start space-x-2 cursor-pointer">
									<input
										type="checkbox"
										checked={newUser.modules.includes(module.id)}
										on:change={() => {
											if (newUser.modules.includes(module.id)) {
												newUser.modules = newUser.modules.filter(m => m !== module.id);
											} else {
												newUser.modules = [...newUser.modules, module.id];
											}
										}}
										class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<div>
										<div class="text-sm font-medium text-gray-700">{module.name}</div>
										<div class="text-xs text-gray-500">{module.description}</div>
									</div>
								</label>
							{/each}
						</div>
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
							{createUserLoading ? 'Sending Invitation...' : 'Send Invitation'}
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

<!-- Delete Confirmation Modal -->
{#if showDeleteModal}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<div class="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
					<Trash2 class="h-6 w-6 text-red-600" />
				</div>
				<h3 class="text-lg font-medium text-gray-900 text-center mb-2">Delete User</h3>
				<p class="text-sm text-gray-600 text-center mb-4">
					Are you sure you want to delete <strong>{deleteUserEmail}</strong>?
				</p>
				<p class="text-sm text-red-600 text-center mb-6">
					This action cannot be undone. All user data will be permanently removed.
				</p>

				<div class="flex justify-end space-x-3">
					<button
						type="button"
						on:click={() => showDeleteModal = false}
						disabled={deleteLoading}
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						on:click={deleteUser}
						disabled={deleteLoading}
						class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
					>
						{deleteLoading ? 'Deleting...' : 'Delete User'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
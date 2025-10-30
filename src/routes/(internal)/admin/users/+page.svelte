<script lang="ts">
	import { Shield, Mail, Edit2, Save, X, Plus, UserPlus, KeyRound, Trash2, Send, GraduationCap, BookOpen } from 'lucide-svelte';
	import { apiPost, apiDelete, apiPut, supabaseRequest } from '$lib/utils/api-handler.js';
	import { toastMultiStep, toastNextStep, dismissToast, toastValidationError, updateToastStatus, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { invalidateAll } from '$app/navigation';

	export let data;
	let { supabase, users, currentUser, currentUserProfile, courses, cohorts } = data;

	let editingUserId = null;
	let editingModules = [];
	let loading = false;

	// Filter state
	let roleFilter = 'all'; // 'all', 'admin', 'student', 'hub_coordinator'
	let searchQuery = '';

	// Available modules for selection
	const availableModules = [
		{ id: 'user_management', name: 'User Management', description: 'Create and manage admin users' },
		{ id: 'dgr', name: 'Daily Gospel Reflections', description: 'Manage DGR contributors and schedule' },
		{ id: 'editor', name: 'Content Editor', description: 'Edit books, blocks, and chapters' },
		{ id: 'courses', name: 'Courses', description: 'Manage course content and cohorts' }
	];

	// Available course roles
	const courseRoles = [
		{ id: 'student', name: 'Student', description: 'Can access course materials and submit reflections' },
		{ id: 'coordinator', name: 'Coordinator', description: 'Can coordinate hubs and view student progress' },
		{ id: 'admin', name: 'Course Admin', description: 'Can manage course content and settings' }
	];

	// New user form
	let showNewUserForm = false;
	let newUser = {
		email: '',
		full_name: '',
		role: 'student',
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

	// Course enrollment management
	let showEnrollmentModal = false;
	let enrollmentUserId = null;
	let enrollmentUserName = '';
	let newEnrollment = {
		cohortId: '',
		role: 'student'
	};
	let enrollmentLoading = false;

	// Edit enrollment
	let editingEnrollmentId = null;
	let editingEnrollmentRole = '';

	// Filtered users
	$: filteredUsers = users.filter(user => {
		// Role filter
		if (roleFilter !== 'all' && user.role !== roleFilter) {
			return false;
		}
		// Search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			const matchesName = user.full_name?.toLowerCase().includes(query);
			const matchesEmail = user.email?.toLowerCase().includes(query);
			const matchesOrg = user.organization?.toLowerCase().includes(query);
			return matchesName || matchesEmail || matchesOrg;
		}
		return true;
	});

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
			await apiPut(
				'/api/admin/users',
				{
					userId,
					action: 'update_modules',
					modules: editingModules
				},
				{
					loadingMessage: 'Saving user permissions',
					loadingTitle: 'Updating permissions...',
					successMessage: 'User permissions updated successfully',
					successTitle: 'Success!'
				}
			);

			cancelEdit();
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
			'courses': 'bg-yellow-100 text-yellow-800'
		};
		return colors[moduleId] || 'bg-gray-100 text-gray-800';
	}

	function getRoleBadgeColor(role: string) {
		const colors = {
			'admin': 'bg-red-100 text-red-800',
			'student': 'bg-blue-100 text-blue-800',
			'hub_coordinator': 'bg-purple-100 text-purple-800',
			'coordinator': 'bg-purple-100 text-purple-800'
		};
		return colors[role] || 'bg-gray-100 text-gray-800';
	}

	function getCourseRoleBadgeColor(role: string) {
		const colors = {
			'admin': 'bg-orange-100 text-orange-800',
			'student': 'bg-green-100 text-green-800',
			'coordinator': 'bg-indigo-100 text-indigo-800'
		};
		return colors[role] || 'bg-gray-100 text-gray-800';
	}

	async function createNewUser(event) {
		event?.preventDefault();
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
			await apiPost('/api/admin/users', newUser, {
				showToast: false
			});

			toastNextStep(toastId);
			toastNextStep(toastId);

			newUser = {
				email: '',
				full_name: '',
				role: 'student',
				modules: []
			};
			showNewUserForm = false;
			await invalidateAll();

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

	async function resetUserPassword(event) {
		event?.preventDefault();
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

			await invalidateAll();
		} catch (error) {
			console.error('Error resending invitation:', error);
		}
	}

	// Course enrollment functions
	function showAddEnrollment(userId: string, userName: string) {
		enrollmentUserId = userId;
		enrollmentUserName = userName;
		newEnrollment = {
			cohortId: '',
			role: 'student'
		};
		showEnrollmentModal = true;
	}

	async function addEnrollment(event) {
		event?.preventDefault();
		if (!newEnrollment.cohortId) {
			toastValidationError('Cohort', 'must be selected');
			return;
		}

		enrollmentLoading = true;

		try {
			await apiPost(
				'/api/admin/enrollments',
				{
					userId: enrollmentUserId,
					cohortId: newEnrollment.cohortId,
					role: newEnrollment.role
				},
				{
					loadingMessage: 'Enrolling user in course',
					loadingTitle: 'Adding enrollment...',
					successMessage: 'User enrolled successfully',
					successTitle: 'Success!'
				}
			);

			showEnrollmentModal = false;
			await invalidateAll();
		} catch (error) {
			console.error('Error adding enrollment:', error);
		} finally {
			enrollmentLoading = false;
		}
	}

	async function removeEnrollment(enrollmentId: string, courseName: string) {
		if (!confirm(`Remove this enrollment from ${courseName}?`)) {
			return;
		}

		try {
			await apiDelete(
				'/api/admin/enrollments',
				{ enrollmentId },
				{
					loadingMessage: 'Removing enrollment',
					loadingTitle: 'Removing...',
					successMessage: 'Enrollment removed successfully',
					successTitle: 'Success!'
				}
			);

			await invalidateAll();
		} catch (error) {
			console.error('Error removing enrollment:', error);
		}
	}

	function startEditEnrollment(enrollmentId: string, currentRole: string) {
		editingEnrollmentId = enrollmentId;
		editingEnrollmentRole = currentRole;
	}

	function cancelEditEnrollment() {
		editingEnrollmentId = null;
		editingEnrollmentRole = '';
	}

	async function saveEnrollmentRole(enrollmentId: string) {
		try {
			await apiPut(
				'/api/admin/enrollments',
				{
					enrollmentId,
					role: editingEnrollmentRole
				},
				{
					loadingMessage: 'Updating enrollment role',
					loadingTitle: 'Updating...',
					successMessage: 'Role updated successfully',
					successTitle: 'Success!'
				}
			);

			cancelEditEnrollment();
			await invalidateAll();
		} catch (error) {
			console.error('Error updating enrollment:', error);
		}
	}

	function getCohortLabel(cohort: any) {
		if (!cohort) return 'Unknown';
		const courseName = cohort.module?.course?.name || 'Unknown Course';
		const moduleName = cohort.module?.name || '';
		return `${courseName} - ${cohort.name}`;
	}
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="bg-white shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200">
				<div class="flex items-center justify-between mb-4">
					<h1 class="text-2xl font-semibold text-gray-900 flex items-center">
						<Shield class="h-6 w-6 mr-2" />
						User Management
					</h1>
					<div class="flex items-center space-x-4">
						<button
							onclick={() => showNewUserForm = true}
							class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
						>
							<UserPlus class="h-4 w-4 mr-2" />
							Add User
						</button>
					</div>
				</div>

				<!-- Filters -->
				<div class="flex items-center space-x-4">
					<div class="flex-1">
						<input
							type="text"
							bind:value={searchQuery}
							placeholder="Search by name, email, or organization..."
							class="w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
						/>
					</div>
					<div>
						<select
							bind:value={roleFilter}
							class="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
						>
							<option value="all">All Roles</option>
							<option value="admin">Platform Admin</option>
							<option value="student">Student</option>
							<option value="hub_coordinator">Hub Coordinator</option>
						</select>
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
								Platform Access
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Course Enrollments
							</th>
							<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
								Actions
							</th>
						</tr>
					</thead>
					<tbody class="bg-white divide-y divide-gray-200">
						{#each filteredUsers as user}
							<tr class:bg-yellow-50={user.id === currentUser.id}>
								<td class="px-6 py-4">
									<div class="flex items-start flex-col">
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
										{#if user.organization}
											<div class="text-xs text-gray-400 mt-1">
												{user.organization}
											</div>
										{/if}
										<div class="mt-1">
											<span class="px-2 py-0.5 text-xs font-semibold rounded-full {getRoleBadgeColor(user.role)}">
												{user.role === 'hub_coordinator' ? 'Hub Coordinator' : user.role.charAt(0).toUpperCase() + user.role.slice(1)}
											</span>
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
														onchange={() => toggleModule(module.id)}
														disabled={user.id === currentUser.id && module.id === 'user_management'}
														class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
													/>
													<span class="text-sm text-gray-700">{module.name}</span>
												</label>
											{/each}
										</div>
									{:else}
										<div class="flex flex-wrap gap-1">
											{#if user.role === 'admin'}
												<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
													All Modules (Platform Admin)
												</span>
											{:else if user.modules && user.modules.length > 0}
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
								<td class="px-6 py-4">
									<div class="space-y-2">
										{#if user.enrollments && user.enrollments.length > 0}
											{#each user.enrollments as enrollment}
												{@const cohort = enrollment.cohort}
												{@const courseName = cohort?.module?.course?.name || 'Unknown'}
												{@const cohortName = cohort?.name || 'Unknown Cohort'}
												<div class="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded">
													<div class="flex-1 min-w-0">
														<div class="text-xs font-medium text-gray-900 truncate">
															{courseName}
														</div>
														<div class="text-xs text-gray-500 truncate">
															{cohortName}
														</div>
													</div>
													{#if editingEnrollmentId === enrollment.id}
														<div class="flex items-center gap-1">
															<select
																bind:value={editingEnrollmentRole}
																class="text-xs rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
															>
																<option value="student">Student</option>
																<option value="coordinator">Coordinator</option>
																<option value="admin">Admin</option>
															</select>
															<button
																onclick={() => saveEnrollmentRole(enrollment.id)}
																class="text-green-600 hover:text-green-900"
																title="Save"
															>
																<Save class="h-3 w-3" />
															</button>
															<button
																onclick={cancelEditEnrollment}
																class="text-gray-600 hover:text-gray-900"
																title="Cancel"
															>
																<X class="h-3 w-3" />
															</button>
														</div>
													{:else}
														<div class="flex items-center gap-1">
															<span class="px-2 py-0.5 text-xs font-semibold rounded-full {getCourseRoleBadgeColor(enrollment.role)}">
																{enrollment.role}
															</span>
															<button
																onclick={() => startEditEnrollment(enrollment.id, enrollment.role)}
																class="text-blue-600 hover:text-blue-900"
																title="Edit role"
															>
																<Edit2 class="h-3 w-3" />
															</button>
															<button
																onclick={() => removeEnrollment(enrollment.id, courseName)}
																class="text-red-600 hover:text-red-900"
																title="Remove enrollment"
															>
																<X class="h-3 w-3" />
															</button>
														</div>
													{/if}
												</div>
											{/each}
										{:else}
											<span class="text-sm text-gray-400 italic">No enrollments</span>
										{/if}
										<button
											onclick={() => showAddEnrollment(user.id, user.full_name || user.email)}
											class="text-xs text-blue-600 hover:text-blue-900 flex items-center gap-1"
										>
											<Plus class="h-3 w-3" />
											Add Enrollment
										</button>
									</div>
								</td>
								<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
									{#if editingUserId === user.id}
										<div class="flex items-center space-x-2">
											<button
												onclick={() => savePermissions(user.id)}
												disabled={loading}
												class="text-green-600 hover:text-green-900"
												title="Save permissions"
											>
												<Save class="h-4 w-4" />
											</button>
											<button
												onclick={cancelEdit}
												disabled={loading}
												class="text-gray-600 hover:text-gray-900"
												title="Cancel"
											>
												<X class="h-4 w-4" />
											</button>
										</div>
									{:else}
										<div class="flex items-center space-x-2">
											{#if user.role !== 'student'}
												<button
													onclick={() => startEdit(user.id, user.modules || [])}
													class="text-blue-600 hover:text-blue-900"
													title="Edit platform permissions"
												>
													<Edit2 class="h-4 w-4" />
												</button>
											{/if}
											{#if user.isPending}
												<button
													onclick={() => resendInvitation(user.id, user.email)}
													class="text-green-600 hover:text-green-900"
													title="Resend invitation"
												>
													<Send class="h-4 w-4" />
												</button>
											{:else}
												<button
													onclick={() => showPasswordReset(user.id)}
													class="text-orange-600 hover:text-orange-900"
													title="Reset password"
												>
													<KeyRound class="h-4 w-4" />
												</button>
											{/if}
											<button
												onclick={() => confirmDelete(user.id, user.email)}
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

		<div class="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
			<!-- Platform Roles & Modules -->
			<div class="bg-white shadow rounded-lg p-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
					<Shield class="h-5 w-5 mr-2" />
					Platform Roles & Modules
				</h2>

				<h3 class="text-sm font-semibold text-gray-700 mb-2">Platform Roles</h3>
				<div class="space-y-2 mb-4">
					<div class="flex items-start">
						<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 mr-2">Admin</span>
						<span class="text-sm text-gray-600">Full platform access, automatic access to all modules and courses</span>
					</div>
					<div class="flex items-start">
						<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 mr-2">Student</span>
						<span class="text-sm text-gray-600">Regular user, enrolls in courses</span>
					</div>
					<div class="flex items-start">
						<span class="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800 mr-2">Hub Coordinator</span>
						<span class="text-sm text-gray-600">Manages hubs within courses</span>
					</div>
				</div>

				<h3 class="text-sm font-semibold text-gray-700 mb-2 mt-4">Available Modules</h3>
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
			</div>

			<!-- Course Roles -->
			<div class="bg-white shadow rounded-lg p-6">
				<h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
					<GraduationCap class="h-5 w-5 mr-2" />
					Course Roles
				</h2>
				<div class="space-y-3">
					{#each courseRoles as role}
						<div class="flex items-start">
							<span class="px-2 py-1 text-xs font-semibold rounded-full {getCourseRoleBadgeColor(role.id)} mr-2">
								{role.name}
							</span>
							<span class="text-sm text-gray-600">{role.description}</span>
						</div>
					{/each}
				</div>
				<p class="mt-4 text-sm text-gray-500">
					Course roles are assigned per enrollment. Users can have different roles in different courses.
				</p>
			</div>
		</div>
	</div>
</div>

<!-- New User Modal -->
{#if showNewUserForm}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-[500px] shadow-lg rounded-md bg-white max-h-[80vh] overflow-y-auto">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-2">Invite New User</h3>
				<p class="text-sm text-gray-600 mb-4">
					An invitation email with a magic link will be sent to set up their account.
				</p>

				<form onsubmit={createNewUser} class="space-y-4">
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
						<label for="role" class="block text-sm font-medium text-gray-700">Platform Role</label>
						<select
							id="role"
							bind:value={newUser.role}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
						>
							<option value="student">Student</option>
							<option value="hub_coordinator">Hub Coordinator</option>
							<option value="admin">Platform Admin</option>
						</select>
					</div>

					{#if newUser.role !== 'student'}
						<div>
							<h3 class="block text-sm font-medium text-gray-700 mb-2">Module Access</h3>
							<div class="space-y-2 bg-gray-50 p-3 rounded-md border border-gray-300">
								{#if newUser.role === 'admin'}
									<p class="text-sm text-gray-600 italic">Platform admins have automatic access to all modules</p>
								{:else}
									{#each availableModules as module}
										<label class="flex items-start space-x-2 cursor-pointer">
											<input
												type="checkbox"
												checked={newUser.modules.includes(module.id)}
												onchange={() => {
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
								{/if}
							</div>
						</div>
					{/if}

					<div class="flex justify-end space-x-3 pt-4">
						<button
							type="button"
							onclick={() => showNewUserForm = false}
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

<!-- Add Enrollment Modal -->
{#if showEnrollmentModal}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
		<div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-2 flex items-center">
					<GraduationCap class="h-5 w-5 mr-2" />
					Add Course Enrollment
				</h3>
				<p class="text-sm text-gray-600 mb-4">
					Enroll {enrollmentUserName} in a course
				</p>

				<form onsubmit={addEnrollment} class="space-y-4">
					<div>
						<label for="cohortId" class="block text-sm font-medium text-gray-700">Select Cohort</label>
						<select
							id="cohortId"
							bind:value={newEnrollment.cohortId}
							required
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
						>
							<option value="">Choose a cohort...</option>
							{#each cohorts as cohort}
								<option value={cohort.id}>
									{getCohortLabel(cohort)}
								</option>
							{/each}
						</select>
					</div>

					<div>
						<label for="enrollmentRole" class="block text-sm font-medium text-gray-700">Course Role</label>
						<select
							id="enrollmentRole"
							bind:value={newEnrollment.role}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
						>
							<option value="student">Student</option>
							<option value="coordinator">Coordinator</option>
							<option value="admin">Course Admin</option>
						</select>
					</div>

					<div class="flex justify-end space-x-3 pt-4">
						<button
							type="button"
							onclick={() => showEnrollmentModal = false}
							disabled={enrollmentLoading}
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={enrollmentLoading}
							class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							{enrollmentLoading ? 'Enrolling...' : 'Enroll User'}
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

				<form onsubmit={resetUserPassword} class="space-y-4">
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
							onclick={() => showPasswordResetModal = false}
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
						onclick={() => showDeleteModal = false}
						disabled={deleteLoading}
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={deleteUser}
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

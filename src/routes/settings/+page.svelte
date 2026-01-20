<script lang="ts">
	import { UserPlus, Users } from '$lib/icons';
	import { apiPut } from '$lib/utils/api-handler.js';
	import { invalidateAll } from '$app/navigation';

	// Import user components
	import DeleteUserModal from '$lib/components/users/DeleteUserModal.svelte';
	import PasswordResetModal from '$lib/components/users/PasswordResetModal.svelte';
	import AddEnrollmentModal from '$lib/components/users/AddEnrollmentModal.svelte';
	import InviteUserModal from '$lib/components/users/InviteUserModal.svelte';
	import UserEnrollmentsModal from '$lib/components/users/UserEnrollmentsModal.svelte';
	import UserCardMobile from '$lib/components/users/UserCardMobile.svelte';
	import UserTableRow from '$lib/components/users/UserTableRow.svelte';
	import ModulesInfoAccordion from '$lib/components/users/ModulesInfoAccordion.svelte';
	import RolesInfoAccordion from '$lib/components/users/RolesInfoAccordion.svelte';
	import PlatformSettingsSection from '$lib/components/users/PlatformSettingsSection.svelte';
	import SettingsNavigation from '$lib/components/SettingsNavigation.svelte';

	let { data } = $props();
	let users = $derived(data.users);
	let currentUser = $derived(data.currentUser);
	let currentUserProfile = $derived(data.currentUserProfile);
	let cohorts = $derived(data.cohorts);

	let editingUserId = $state(null);
	let editingModules = $state([]);
	let loading = $state(false);

	// Navigation state
	let activeSection = $state('users'); // 'users' or 'platform'
	let activeSubSection = $state('active'); // 'active' or 'pending'

	// Filter state
	let moduleFilter = $state('all');
	let searchQuery = $state('');

	function handleNavigate(section: string) {
		activeSection = section;
	}

	// Accordion state
	let showModulesInfo = $state(false);
	let showRolesInfo = $state(false);

	// Available modules for selection with icons (must match AUTH_SYSTEM.md and profile page)
	const availableModules = [
		{ id: 'platform.admin', name: 'Platform Admin', description: 'Manage users, invitations, permissions, and platform settings' },
		{ id: 'dgr', name: 'Daily Gospel Reflections', description: 'Manage DGR contributors and schedule' },
		{ id: 'editor', name: 'Content Editor', description: 'Edit books, blocks, and chapters' },
		{ id: 'courses.participant', name: 'Course Participant', description: 'Access My Courses and participant dashboards' },
		{ id: 'courses.manager', name: 'Course Manager', description: 'Manage assigned courses and cohorts' },
		{ id: 'courses.admin', name: 'Course Admin', description: 'Manage all courses platform-wide' }
	];
	const moduleFilterOptions = [
		{ value: 'all', label: 'All Modules' },
		...availableModules.map((module) => ({ value: module.id, label: module.name }))
	];

	// Available course enrollment roles (cohort participants only)
	const courseRoles = [
		{ id: 'student', name: 'Participant', description: 'Regular course participant - can access materials and submit reflections' },
		{ id: 'coordinator', name: 'Hub Coordinator', description: 'Hub coordinator - can coordinate hubs and view student progress' }
	];

	// Modal state
	let showNewUserModal = $state(false);
	let showPasswordResetModal = $state(false);
	let resetPasswordUserId = $state(null);
	let showDeleteModal = $state(false);
	let deleteUserId = $state(null);
	let deleteUserEmail = $state('');
	let showAddEnrollmentModal = $state(false);
	let enrollmentUserId = $state(null);
	let enrollmentUserName = $state('');
	let showEnrollmentsModal = $state(false);
	let enrollmentsModalUserId = $state(null);
	let enrollmentsModalUserName = $state('');

	// Edit enrollment state
	let editingEnrollmentId = $state(null);
	let editingEnrollmentRole = $state('');

	// Mobile card expanded states
	let expandedUserCards = $state(new Set());

	// Expanded modules state
	let expandedModulesUserId = $state(null);

	// Filtered users
	function userHasModule(user, moduleId) {
		return user.modules?.includes?.(moduleId);
	}

	let filteredUsers = $derived(users.filter(user => {
		// Tab filter (active vs pending)
		if (activeSubSection === 'active' && user.isPending) return false;
		if (activeSubSection === 'pending' && !user.isPending) return false;

		// Module filter
		if (moduleFilter !== 'all' && !userHasModule(user, moduleFilter)) {
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
	}));

	// Count users by status
	let activeUsersCount = $derived(users.filter(u => !u.isPending).length);
	let pendingUsersCount = $derived(users.filter(u => u.isPending).length);

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

			users = users.map((existing) =>
				existing.id === userId ? { ...existing, modules: [...editingModules] } : existing
			);
			if (currentUserProfile?.id === userId) {
				currentUserProfile = {
					...currentUserProfile,
					modules: [...editingModules]
				};
			}

			cancelEdit();
			await invalidateAll();
		} catch (error) {
			console.error('Error updating permissions:', error);
		} finally {
			loading = false;
		}
	}

	function confirmDelete(userId: string, userEmail: string) {
		deleteUserId = userId;
		deleteUserEmail = userEmail;
		showDeleteModal = true;
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

	function showAddEnrollment(userId: string, userName: string) {
		enrollmentUserId = userId;
		enrollmentUserName = userName;
		showAddEnrollmentModal = true;
	}

	function showEnrollmentsForUser(userId: string, userName: string) {
		enrollmentsModalUserId = userId;
		enrollmentsModalUserName = userName;
		showEnrollmentsModal = true;
	}

	function handleUserCreated() {
		invalidateAll();
	}

	function startEditEnrollment(enrollmentId: string, currentRole: string) {
		editingEnrollmentId = enrollmentId;
		editingEnrollmentRole = currentRole;
	}

	function cancelEditEnrollment() {
		editingEnrollmentId = null;
		editingEnrollmentRole = '';
	}

	async function removeEnrollment(enrollmentId: string, courseName: string) {
		// The UserCardMobile component will handle this
	}
</script>

<!-- Settings Navigation -->
<SettingsNavigation {activeSection} onNavigate={handleNavigate} />

<div class="min-h-screen bg-gray-50">
	<div class="max-w-7xl mx-auto">
		<div class="bg-white border-x border-b border-gray-200 shadow-sm">
			<!-- User Management Section -->
			{#if activeSection === 'users'}
				<!-- Header -->
				<div class="px-8 py-8 border-b border-gray-200 bg-gray-50">
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<div>
							<h2 class="text-2xl font-bold text-gray-900 flex items-center">
								<Users class="h-6 w-6 mr-3" />
								User Management
							</h2>
							<p class="mt-2 text-sm text-gray-600">
								Manage users, permissions, and platform access
							</p>
						</div>
						<button
							onclick={() => showNewUserModal = true}
							class="inline-flex items-center justify-center px-6 py-3 border border-gray-900 text-sm font-bold uppercase tracking-wide text-white bg-gray-900 rounded hover:bg-gray-800 transition-colors"
						>
							<UserPlus class="h-5 w-5 mr-2" />
							Add User
						</button>
					</div>
				</div>

				<!-- Sub-tabs -->
				<div class="border-b border-gray-200 bg-white">
					<nav class="flex px-8 -mb-px" aria-label="User Tabs">
						<button
							onclick={() => activeSubSection = 'active'}
							class="px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {activeSubSection === 'active'
								? 'border-gray-900 text-gray-900'
								: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
						>
							Active Users
							<span class="ml-2 py-0.5 px-2 rounded-full text-xs {activeSubSection === 'active' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}">
								{activeUsersCount}
							</span>
						</button>
						<button
							onclick={() => activeSubSection = 'pending'}
							class="px-6 py-4 border-b-2 font-medium text-sm whitespace-nowrap transition-colors {activeSubSection === 'pending'
								? 'border-gray-900 text-gray-900'
								: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}"
						>
							Pending Invites
							<span class="ml-2 py-0.5 px-2 rounded-full text-xs {activeSubSection === 'pending' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}">
								{pendingUsersCount}
							</span>
						</button>
					</nav>
				</div>

				<!-- Filters -->
				<div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 px-8 py-6 bg-white border-b border-gray-200">
					<div class="flex-1">
						<label for="search" class="block text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide">
							Search
						</label>
						<input
							id="search"
							type="text"
							bind:value={searchQuery}
							placeholder="Search by name, email, or organization..."
							class="w-full rounded border border-gray-300 focus:border-gray-900 focus:ring-0 text-sm px-4 py-3 transition-colors"
						/>
					</div>
					<div class="w-full sm:w-64">
						<label for="module-filter" class="block text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide">
							Filter by Module
						</label>
						<select
							id="module-filter"
							bind:value={moduleFilter}
							class="w-full rounded border border-gray-300 focus:border-gray-900 focus:ring-0 text-sm px-4 py-3 transition-colors"
						>
							{#each moduleFilterOptions as option}
								<option value={option.value}>{option.label}</option>
							{/each}
						</select>
					</div>

					<!-- User count badge -->
					<div class="hidden sm:flex items-end pb-3">
						<div class="inline-flex items-center px-4 py-2 bg-gray-100 border border-gray-300 rounded">
							<span class="text-xs font-bold text-gray-600 uppercase tracking-wide mr-2">
								{activeSubSection === 'active' ? 'Active' : 'Pending'}:
							</span>
							<span class="text-lg font-bold text-gray-900">
								{activeSubSection === 'active' ? activeUsersCount : pendingUsersCount}
							</span>
						</div>
					</div>
				</div>
			{/if}

			<!-- Platform Settings Content -->
			{#if activeSection === 'platform'}
				<div class="px-8 py-8">
					<PlatformSettingsSection />
				</div>
			{/if}

			<!-- User Management Content -->
			{#if activeSection === 'users'}
				<!-- Mobile Card View -->
			<div class="lg:hidden px-8 py-6 space-y-4 bg-gray-50">
				{#each filteredUsers as user}
					<UserCardMobile
						{user}
						currentUserId={currentUser.id}
						isExpanded={expandedUserCards.has(user.id)}
						{availableModules}
						{editingUserId}
						{editingModules}
						{loading}
						{editingEnrollmentId}
						{editingEnrollmentRole}
						onToggleExpand={() => {
							const newSet = new Set(expandedUserCards);
							if (expandedUserCards.has(user.id)) {
								newSet.delete(user.id);
							} else {
								newSet.add(user.id);
							}
							expandedUserCards = newSet;
						}}
						onStartEdit={startEdit}
						onCancelEdit={cancelEdit}
						onToggleModule={toggleModule}
						onSavePermissions={savePermissions}
						onResendInvitation={resendInvitation}
						onShowPasswordReset={(userId) => {
							resetPasswordUserId = userId;
							showPasswordResetModal = true;
						}}
						onConfirmDelete={confirmDelete}
						onShowAddEnrollment={showAddEnrollment}
						onStartEditEnrollment={(enrollmentId, currentRole) => {
							editingEnrollmentId = enrollmentId;
							editingEnrollmentRole = currentRole;
						}}
						onCancelEditEnrollment={() => {
							editingEnrollmentId = null;
							editingEnrollmentRole = '';
						}}
						onSaveEnrollmentRole={async (enrollmentId, role) => {
							// Update via the UserEnrollmentsModal component
							editingEnrollmentRole = role;
						}}
						onRemoveEnrollment={removeEnrollment}
					/>
				{/each}
			</div>

			<!-- Desktop Table View -->
			<div class="hidden lg:block overflow-x-auto bg-white">
				<div class="inline-block min-w-full align-middle">
					<div class="overflow-visible">
						<table class="min-w-full divide-y divide-gray-200">
							<thead class="bg-gray-50 border-b border-gray-200">
								<tr>
									<th class="px-8 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
										User
									</th>
									<th class="px-8 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
										Platform Access
									</th>
									<th class="px-8 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
										Course Enrollments
									</th>
									<th class="px-8 py-4 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
										Actions
									</th>
								</tr>
							</thead>
							<tbody class="bg-white divide-y divide-gray-100">
								{#each filteredUsers as user}
									<UserTableRow
										{user}
										currentUserId={currentUser.id}
										{availableModules}
										{editingUserId}
										{editingModules}
										{expandedModulesUserId}
										{loading}
										onStartEdit={startEdit}
										onCancelEdit={cancelEdit}
										onToggleModule={toggleModule}
										onSavePermissions={savePermissions}
										onShowEnrollmentModal={showEnrollmentsForUser}
										onResendInvitation={resendInvitation}
										onShowPasswordReset={(userId) => {
											resetPasswordUserId = userId;
											showPasswordResetModal = true;
										}}
										onConfirmDelete={confirmDelete}
										onExpandModules={(userId) => expandedModulesUserId = userId}
										onCollapseModules={() => expandedModulesUserId = null}
									/>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<div class="px-8 py-8 bg-gray-50 border-t border-gray-200">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
				<!-- Platform Modules -->
				<ModulesInfoAccordion
					{availableModules}
					isOpen={showModulesInfo}
					onToggle={() => showModulesInfo = !showModulesInfo}
				/>

				<!-- Course Enrollment Roles -->
				<RolesInfoAccordion
					{courseRoles}
					isOpen={showRolesInfo}
					onToggle={() => showRolesInfo = !showRolesInfo}
				/>
				</div>
			</div>
		{/if}
	</div>
	</div>
</div>

<!-- Modals -->
<InviteUserModal
	isOpen={showNewUserModal}
	{availableModules}
	onClose={() => {
		showNewUserModal = false;
		handleUserCreated();
	}}
/>

<PasswordResetModal
	isOpen={showPasswordResetModal}
	userId={resetPasswordUserId}
	onClose={() => {
		showPasswordResetModal = false;
		resetPasswordUserId = null;
	}}
	onReset={invalidateAll}
/>

<DeleteUserModal
	isOpen={showDeleteModal}
	userId={deleteUserId}
	userEmail={deleteUserEmail}
	onClose={() => {
		showDeleteModal = false;
		deleteUserId = null;
		deleteUserEmail = '';
	}}
	onDeleted={invalidateAll}
/>

<AddEnrollmentModal
	isOpen={showAddEnrollmentModal}
	userId={enrollmentUserId}
	userName={enrollmentUserName}
	{cohorts}
	onClose={() => {
		showAddEnrollmentModal = false;
		enrollmentUserId = null;
		enrollmentUserName = '';
	}}
	onEnrolled={invalidateAll}
/>

<UserEnrollmentsModal
	isOpen={showEnrollmentsModal}
	user={users.find(u => u.id === enrollmentsModalUserId)}
	userName={enrollmentsModalUserName}
	onClose={() => {
		showEnrollmentsModal = false;
		enrollmentsModalUserId = null;
		enrollmentsModalUserName = '';
	}}
	onUpdated={invalidateAll}
	onAddEnrollment={() => {
		showAddEnrollmentModal = true;
		enrollmentUserId = enrollmentsModalUserId;
		enrollmentUserName = enrollmentsModalUserName;
	}}
/>

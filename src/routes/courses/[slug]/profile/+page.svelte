<script>
	import { User, Mail, Lock, Shield, Trash2, Save, Edit3 } from 'lucide-svelte';
	import { toastWarning } from '$lib/utils/toast-helpers.js';

	// Mock user data - would come from auth/database
	let userProfile = $state({
		name: 'Sarah Johnson',
		email: 'sarah.johnson@email.com',
		cohort: 'Foundations of Faith - February 2024',
		hub: "St. Mary's Parish Hub",
		joinDate: 'February 1, 2024',
		completedModules: ['Foundations of Faith'],
		currentSession: 8
	});

	// Form states
	let isEditingProfile = $state(false);
	let isChangingPassword = $state(false);
	let showDeleteConfirm = $state(false);

	// Form data
	let profileForm = $state({
		name: userProfile.name,
		email: userProfile.email
	});

	let passwordForm = $state({
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	});

	// Form handlers
	const startEditingProfile = () => {
		profileForm.name = userProfile.name;
		profileForm.email = userProfile.email;
		isEditingProfile = true;
	};

	const cancelEditingProfile = () => {
		isEditingProfile = false;
		profileForm.name = userProfile.name;
		profileForm.email = userProfile.email;
	};

	const saveProfile = () => {
		// TODO: Submit to API
		userProfile.name = profileForm.name;
		userProfile.email = profileForm.email;
		isEditingProfile = false;
		console.log('Profile saved:', profileForm);
	};

	const startChangingPassword = () => {
		passwordForm.currentPassword = '';
		passwordForm.newPassword = '';
		passwordForm.confirmPassword = '';
		isChangingPassword = true;
	};

	const cancelChangingPassword = () => {
		isChangingPassword = false;
		passwordForm.currentPassword = '';
		passwordForm.newPassword = '';
		passwordForm.confirmPassword = '';
	};

	const savePassword = () => {
		if (passwordForm.newPassword !== passwordForm.confirmPassword) {
			toastWarning('New passwords do not match', 'Password Mismatch');
			return;
		}
		// TODO: Submit to API
		isChangingPassword = false;
		passwordForm.currentPassword = '';
		passwordForm.newPassword = '';
		passwordForm.confirmPassword = '';
		console.log('Password changed');
	};

	const deleteAccount = () => {
		// TODO: Submit to API
		console.log('Account deletion requested');
		// Redirect to goodbye page
	};
</script>

<div class="px-16 py-8">
	<div class="max-w-4xl mx-auto space-y-8">

		<!-- Page Header -->
		<div class="mb-8">
			<h1 class="text-4xl font-bold text-white mb-2">Profile Settings</h1>
			<p class="text-white opacity-75">Manage your account information and preferences</p>
		</div>

		<!-- Profile Information Card -->
		<div class="bg-white rounded-2xl p-8 shadow-sm">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Personal Information</h2>
				{#if !isEditingProfile}
					<button
						onclick={startEditingProfile}
						class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:bg-gray-100"
						style="color: var(--course-accent-light);"
					>
						<Edit3 size="16" />
						Edit
					</button>
				{/if}
			</div>

			{#if isEditingProfile}
				<!-- Edit Mode -->
				<div class="space-y-6">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2" for="profile-name">Full Name</label>
					<input
						id="profile-name"
						type="text"
						bind:value={profileForm.name}
						class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-opacity-20 text-gray-900 bg-white"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2" for="profile-email">Email Address</label>
					<input
						id="profile-email"
						type="email"
						bind:value={profileForm.email}
						class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-opacity-20 text-gray-900 bg-white"
					/>
					</div>
					<div class="flex gap-4 pt-4">
						<button
							onclick={saveProfile}
							class="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-colors hover:opacity-90"
							style="background-color: var(--course-accent-dark);"
						>
							<Save size="16" />
							Save Changes
						</button>
						<button
							onclick={cancelEditingProfile}
							class="px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<!-- View Mode -->
				<div class="grid md:grid-cols-2 gap-6">
					<div class="flex items-center gap-4">
						<div class="w-12 h-12 rounded-full flex items-center justify-center" style="background-color: var(--course-accent-dark);">
							<User size="20" class="text-white" />
						</div>
						<div>
							<p class="text-sm text-gray-600">Full Name</p>
							<p class="text-lg font-semibold text-gray-800">{userProfile.name}</p>
						</div>
					</div>
					<div class="flex items-center gap-4">
						<div class="w-12 h-12 rounded-full flex items-center justify-center" style="background-color: var(--course-accent-light);">
							<Mail size="20" class="text-white" />
						</div>
						<div>
							<p class="text-sm text-gray-600">Email Address</p>
							<p class="text-lg font-semibold text-gray-800">{userProfile.email}</p>
						</div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Course Information Card -->
		<div class="bg-white rounded-2xl p-8 shadow-sm">
			<h2 class="text-2xl font-bold text-gray-800 mb-6">Course Information</h2>
			<div class="grid md:grid-cols-2 gap-6">
				<div>
					<p class="text-sm text-gray-600 mb-2">Current Cohort</p>
					<p class="text-lg font-semibold text-gray-800">{userProfile.cohort}</p>
				</div>
				<div>
					<p class="text-sm text-gray-600 mb-2">Hub Location</p>
					<p class="text-lg font-semibold text-gray-800">{userProfile.hub}</p>
				</div>
				<div>
					<p class="text-sm text-gray-600 mb-2">Current Session</p>
					<p class="text-lg font-semibold text-gray-800">Session {userProfile.currentSession} of 8</p>
				</div>
				<div>
					<p class="text-sm text-gray-600 mb-2">Joined</p>
					<p class="text-lg font-semibold text-gray-800">{userProfile.joinDate}</p>
				</div>
			</div>
		</div>

		<!-- Security Settings Card -->
		<div class="bg-white rounded-2xl p-8 shadow-sm">
			<div class="flex items-center justify-between mb-6">
				<h2 class="text-2xl font-bold text-gray-800">Security Settings</h2>
				{#if !isChangingPassword}
					<button
						onclick={startChangingPassword}
						class="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors hover:bg-gray-100"
						style="color: var(--course-accent-light);"
					>
						<Lock size="16" />
						Change Password
					</button>
				{/if}
			</div>

			{#if isChangingPassword}
				<!-- Password Change Form -->
				<div class="space-y-6">
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2" for="current-password">Current Password</label>
					<input
						id="current-password"
						type="password"
						bind:value={passwordForm.currentPassword}
						class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-opacity-20 text-gray-900 bg-white"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2" for="new-password">New Password</label>
					<input
						id="new-password"
						type="password"
						bind:value={passwordForm.newPassword}
						class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-opacity-20 text-gray-900 bg-white"
					/>
				</div>
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-2" for="confirm-password">Confirm New Password</label>
					<input
						id="confirm-password"
						type="password"
						bind:value={passwordForm.confirmPassword}
						class="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-opacity-20 text-gray-900 bg-white"
					/>
					</div>
					<div class="flex gap-4 pt-4">
						<button
							onclick={savePassword}
							class="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white transition-colors hover:opacity-90"
							style="background-color: var(--course-accent-dark);"
						>
							<Lock size="16" />
							Update Password
						</button>
						<button
							onclick={cancelChangingPassword}
							class="px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			{:else}
				<!-- Password Status -->
				<div class="flex items-center gap-4">
					<div class="w-12 h-12 rounded-full flex items-center justify-center" style="background-color: var(--course-accent-dark);">
						<Shield size="20" class="text-white" />
					</div>
					<div>
						<p class="text-sm text-gray-600">Password</p>
						<p class="text-lg font-semibold text-gray-800">••••••••••••</p>
						<p class="text-xs text-gray-500">Last changed: 30 days ago</p>
					</div>
				</div>
			{/if}
		</div>

		<!-- Danger Zone Card -->
		<div class="bg-white rounded-2xl p-8 shadow-sm border border-red-200">
			<h2 class="text-2xl font-bold text-red-600 mb-4">Danger Zone</h2>
			<p class="text-gray-600 mb-6">Once you delete your account, there is no going back. Please be certain.</p>

			{#if !showDeleteConfirm}
				<button
					onclick={() => showDeleteConfirm = true}
					class="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors"
				>
					<Trash2 size="16" />
					Delete Account
				</button>
			{:else}
				<div class="space-y-4">
					<p class="text-red-600 font-medium">Are you absolutely sure? This action cannot be undone.</p>
					<div class="flex gap-4">
						<button
							onclick={deleteAccount}
							class="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
						>
							<Trash2 size="16" />
							Yes, Delete My Account
						</button>
						<button
							onclick={() => showDeleteConfirm = false}
							class="px-6 py-3 rounded-xl font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
						>
							Cancel
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

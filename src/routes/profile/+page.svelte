<script lang="ts">
	import { Save, Lock, Eye, EyeOff } from 'lucide-svelte';

	export let data;

	let { supabase, profile } = data;
	let loading = false;
	let saveMessage = '';

	let formData = {
		full_name: profile?.full_name || ''
	};

	// Password change functionality
	let showPasswordSection = false;
	let passwordLoading = false;
	let passwordMessage = '';
	let showPassword = false;
	let passwordData = {
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	};

	async function handleSubmit() {
		loading = true;
		saveMessage = '';

		try {
			const { error } = await supabase
				.from('user_profiles')
				.update(formData)
				.eq('id', profile.id);

			if (error) throw error;

			saveMessage = 'Profile updated successfully!';
			setTimeout(() => saveMessage = '', 3000);
		} catch (error) {
			console.error('Error updating profile:', error);
			saveMessage = 'Error updating profile. Please try again.';
		} finally {
			loading = false;
		}
	}

	async function handlePasswordChange() {
		passwordLoading = true;
		passwordMessage = '';

		// Validate passwords
		if (!passwordData.currentPassword) {
			passwordMessage = 'Current password is required';
			passwordLoading = false;
			return;
		}

		if (passwordData.newPassword.length < 6) {
			passwordMessage = 'New password must be at least 6 characters';
			passwordLoading = false;
			return;
		}

		if (passwordData.newPassword !== passwordData.confirmPassword) {
			passwordMessage = 'New passwords do not match';
			passwordLoading = false;
			return;
		}

		try {
			// First verify current password by attempting to sign in
			const { error: verifyError } = await supabase.auth.signInWithPassword({
				email: profile.email,
				password: passwordData.currentPassword
			});

			if (verifyError) {
				throw new Error('Current password is incorrect');
			}

			// Update password
			const { error: updateError } = await supabase.auth.updateUser({
				password: passwordData.newPassword
			});

			if (updateError) throw updateError;

			passwordMessage = 'Password updated successfully!';
			passwordData = {
				currentPassword: '',
				newPassword: '',
				confirmPassword: ''
			};
			showPasswordSection = false;

			setTimeout(() => passwordMessage = '', 3000);
		} catch (error) {
			console.error('Error updating password:', error);
			passwordMessage = error.message || 'Error updating password';
		} finally {
			passwordLoading = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-lg mx-auto px-4 space-y-8">
		<div class="bg-white shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200">
				<h1 class="text-xl font-semibold text-gray-900">Profile</h1>
			</div>

			<form on:submit|preventDefault={handleSubmit} class="p-6 space-y-4">
				<div>
					<label for="full_name" class="block text-sm font-medium text-gray-700">
						Name
					</label>
					<input
						type="text"
						id="full_name"
						bind:value={formData.full_name}
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
						placeholder="Your name"
					/>
				</div>

				{#if saveMessage}
					<div class="rounded-md bg-green-50 p-4">
						<p class="text-sm font-medium text-green-800">{saveMessage}</p>
					</div>
				{/if}

				<div class="flex justify-end">
					<button
						type="submit"
						disabled={loading}
						class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					>
						<Save class="h-4 w-4 mr-2" />
						{loading ? 'Saving...' : 'Save'}
					</button>
				</div>
			</form>
		</div>

		<!-- Password Change Section -->
		<div class="bg-white shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200">
				<div class="flex items-center justify-between">
					<h2 class="text-xl font-semibold text-gray-900 flex items-center">
						<Lock class="h-5 w-5 mr-2" />
						Security Settings
					</h2>
					<button
						on:click={() => showPasswordSection = !showPasswordSection}
						class="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700"
					>
						{showPasswordSection ? 'Cancel' : 'Change Password'}
					</button>
				</div>
			</div>

			{#if showPasswordSection}
				<form on:submit|preventDefault={handlePasswordChange} class="p-6 space-y-4">
					<div>
						<label for="current_password" class="block text-sm font-medium text-gray-700">
							Current Password
						</label>
						<div class="relative mt-1">
							<input
								type={showPassword ? 'text' : 'password'}
								id="current_password"
								bind:value={passwordData.currentPassword}
								required
								class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
								placeholder="Enter your current password"
							/>
							<button
								type="button"
								on:click={() => showPassword = !showPassword}
								class="absolute inset-y-0 right-0 pr-3 flex items-center"
							>
								{#if showPassword}
									<EyeOff class="h-4 w-4 text-gray-400" />
								{:else}
									<Eye class="h-4 w-4 text-gray-400" />
								{/if}
							</button>
						</div>
					</div>

					<div>
						<label for="new_password" class="block text-sm font-medium text-gray-700">
							New Password
						</label>
						<input
							type="password"
							id="new_password"
							bind:value={passwordData.newPassword}
							required
							minlength="6"
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
							placeholder="Enter new password (minimum 6 characters)"
						/>
					</div>

					<div>
						<label for="confirm_password" class="block text-sm font-medium text-gray-700">
							Confirm New Password
						</label>
						<input
							type="password"
							id="confirm_password"
							bind:value={passwordData.confirmPassword}
							required
							minlength="6"
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
							placeholder="Confirm new password"
						/>
					</div>

					{#if passwordMessage}
						<div class="rounded-md p-4 {passwordMessage.includes('successfully') ? 'bg-green-50' : 'bg-red-50'}">
							<p class="text-sm font-medium {passwordMessage.includes('successfully') ? 'text-green-800' : 'text-red-800'}">{passwordMessage}</p>
						</div>
					{/if}

					<div class="flex justify-end space-x-3 pt-4">
						<button
							type="button"
							on:click={() => showPasswordSection = false}
							disabled={passwordLoading}
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={passwordLoading}
							class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							<Lock class="h-4 w-4 mr-2" />
							{passwordLoading ? 'Updating...' : 'Update Password'}
						</button>
					</div>
				</form>
			{/if}
		</div>

		{#if profile?.role === 'admin'}
			<div class="bg-white shadow rounded-lg">
				<div class="px-6 py-4 border-b border-gray-200">
					<h2 class="text-xl font-semibold text-gray-900">Admin Panel</h2>
				</div>
				<div class="p-6">
					<a
						href="/admin/users"
						class="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
					>
						Manage Users
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	input {
		@apply border px-3 py-2;
	}
</style>
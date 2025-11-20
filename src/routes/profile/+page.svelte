<script lang="ts">
	import { Save, Lock, Eye, EyeOff, Shield, User, Users, BookOpen, Edit3, GraduationCap, Briefcase, Settings as SettingsIcon, LogOut } from 'lucide-svelte';
	import { supabaseRequest, createFormSubmitHandler } from '$lib/utils/api-handler.js';
	import { toastMultiStep, toastNextStep, dismissToast, toastValidationError, updateToastStatus } from '$lib/utils/toast-helpers.js';
	import { toast } from '$lib/stores/toast.svelte.js';
	import FormField from '$lib/components/FormField.svelte';
	import { validators, commonRules, passwordConfirmation, createValidationToastHelper } from '$lib/utils/form-validator.js';

	let { data } = $props();

	let supabase = $derived(data.supabase);
	let profile = $derived(data.profile);
	let loading = $state(false);

let formData = $state({
    full_name: ''
  });

$effect(() => {
    if (profile) {
      formData = {
        full_name: profile.full_name ?? ''
      };
    }
  });

	// Module configuration with labels, descriptions, icons, and colors
	const moduleConfig = {
		'platform.admin': {
			label: 'Platform Admin',
			description: 'Manage users, invitations, permissions, and platform settings',
			icon: Users,
			color: 'purple'
		},
		'dgr': {
			label: 'Daily Gospel Reflections',
			description: 'Manage DGR contributors and schedule',
			icon: BookOpen,
			color: 'blue'
		},
		'editor': {
			label: 'Content Editor',
			description: 'Edit books, blocks, and chapters',
			icon: Edit3,
			color: 'green'
		},
		'courses.participant': {
			label: 'Course Participant',
			description: 'Access enrolled courses and submit reflections',
			icon: GraduationCap,
			color: 'emerald'
		},
		'courses.manager': {
			label: 'Course Manager',
			description: 'Manage assigned courses and cohorts',
			icon: Briefcase,
			color: 'amber'
		},
		'courses.admin': {
			label: 'Course Admin',
			description: 'Manage all courses platform-wide',
			icon: SettingsIcon,
			color: 'red'
		}
	};

	// Color classes for module badges
	const colorClasses = {
		purple: 'bg-purple-100 text-purple-800 border-purple-200',
		blue: 'bg-blue-100 text-blue-800 border-blue-200',
		green: 'bg-green-100 text-green-800 border-green-200',
		emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
		amber: 'bg-amber-100 text-amber-800 border-amber-200',
		red: 'bg-red-100 text-red-800 border-red-200'
	};

	// Password change functionality
	let showPasswordSection = $state(false);
	let passwordLoading = $state(false);
	let showPassword = $state(false);
	let passwordData = $state({
		currentPassword: '',
		newPassword: '',
		confirmPassword: ''
	});

	const handleProfileSubmit = createFormSubmitHandler(
		async (data) => {
			return await supabaseRequest(
				() => supabase.from('user_profiles').update(data).eq('id', profile.id),
				{
					loadingMessage: 'Updating your profile',
					successMessage: 'Profile updated successfully'
				}
			);
		},
		null,
		{
			loadingTitle: 'Saving...',
			successTitle: 'Success!'
		}
	);

async function handleSubmit(event?: Event) {
    event?.preventDefault();
    loading = true;
    try {
        await handleProfileSubmit(formData);
			// Reload page to refresh profile data
			setTimeout(() => {
				window.location.reload();
			}, 1000);
		} catch (error) {
			console.error('Error updating profile:', error);
		} finally {
			loading = false;
		}
	}

	// Create validation helper with toast integration
	const validationToast = createValidationToastHelper(toast);

	// Form field references for validation
	let currentPasswordField;
	let newPasswordField;
	let confirmPasswordField;

	// Validate entire password form
	function validatePasswordForm() {
		let isValid = true;

		// Validate each field and show errors
		if (currentPasswordField && !currentPasswordField.validateNow()) {
			isValid = false;
		}
		if (newPasswordField && !newPasswordField.validateNow()) {
			isValid = false;
		}
		if (confirmPasswordField && !confirmPasswordField.validateNow()) {
			isValid = false;
		}

		return isValid;
	}

async function handlePasswordChange(event?: Event) {
    event?.preventDefault();
    passwordLoading = true;

		// Validate passwords using new system
		if (!validatePasswordForm()) {
			passwordLoading = false;
			return;
		}

		const toastId = toastMultiStep([
			{
				title: 'Verifying...',
				message: 'Checking current password',
				type: 'info'
			},
			{
				title: 'Updating...',
				message: 'Setting new password',
				type: 'loading'
			},
			{
				title: 'Complete!',
				message: 'Password updated successfully',
				type: 'success'
			}
		], false);

		try {
			// First verify current password by attempting to sign in
			const { error: verifyError } = await supabase.auth.signInWithPassword({
				email: profile.email,
				password: passwordData.currentPassword
			});

			if (verifyError) {
				throw new Error('Current password is incorrect');
			}

			toastNextStep(toastId);

			// Update password
			const { error: updateError } = await supabase.auth.updateUser({
				password: passwordData.newPassword
			});

			if (updateError) throw updateError;

			toastNextStep(toastId);

			// Reset form and close section
			passwordData = {
				currentPassword: '',
				newPassword: '',
				confirmPassword: ''
			};
			showPasswordSection = false;

			// Auto-dismiss success toast after 3 seconds
			setTimeout(() => dismissToast(toastId), 3000);
		} catch (error) {
			console.error('Error updating password:', error);
			toast.updateToast(toastId, {
				title: 'Password Update Failed',
				message: error.message || 'Failed to update password',
				type: 'error',
				closeable: true,
				duration: 5000
			});
		} finally {
			passwordLoading = false;
		}
	}
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-2xl mx-auto px-4 space-y-6">
		<!-- Header -->
		<div class="text-center mb-8">
			<div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white mb-4">
				<User class="h-8 w-8" />
			</div>
			<h1 class="text-3xl font-bold text-gray-900">Your Profile</h1>
			<p class="text-sm text-gray-500 mt-1">Manage your account settings and preferences</p>
		</div>

		<!-- Profile Information Card -->
		<div class="bg-white shadow-sm rounded-lg border border-gray-200">
			<div class="px-6 py-4 border-b border-gray-200">
				<h2 class="text-lg font-semibold text-gray-900 flex items-center">
					<User class="h-5 w-5 mr-2 text-gray-600" />
					Personal Information
				</h2>
			</div>

	<form onsubmit={handleSubmit} class="p-6 space-y-6">
				<div>
					<label for="email" class="block text-sm font-medium text-gray-700 mb-2">
						Email Address
					</label>
					<div class="px-4 py-3 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600">
						{profile?.email || 'No email'}
					</div>
					<p class="mt-1.5 text-xs text-gray-500">Your email address cannot be changed</p>
				</div>

				<div>
					<label for="full_name" class="block text-sm font-medium text-gray-700 mb-2">
						Full Name
					</label>
					<input
						type="text"
						id="full_name"
						bind:value={formData.full_name}
						class="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-3"
						placeholder="Enter your full name"
					/>
				</div>

		<div>
			<label class="block text-sm font-medium text-gray-700 mb-3">
				<div class="flex items-center">
					<Shield class="h-4 w-4 mr-1.5" />
					Platform Access
				</div>
			</label>

			{#if profile?.modules && profile.modules.length > 0}
				<div class="space-y-2">
					{#each profile.modules as module}
						{@const config = moduleConfig[module]}
						{#if config}
							<div class="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
								<div class="flex-shrink-0 w-10 h-10 rounded-lg {colorClasses[config.color]} flex items-center justify-center">
									<svelte:component this={config.icon} class="h-5 w-5" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="text-sm font-medium text-gray-900">
										{config.label}
									</div>
									<div class="text-xs text-gray-500 mt-0.5">
										{config.description}
									</div>
								</div>
							</div>
						{:else}
							<div class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
								<div class="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
									<Shield class="h-5 w-5 text-gray-600" />
								</div>
								<div class="flex-1">
									<div class="text-sm font-medium text-gray-900">{module}</div>
								</div>
							</div>
						{/if}
					{/each}
				</div>
				<p class="mt-3 text-xs text-gray-500">
					These modules determine which sections you can access. Contact an administrator to request changes.
				</p>
			{:else}
				<div class="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 border-dashed">
					<div class="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-200 flex items-center justify-center">
						<Shield class="h-5 w-5 text-gray-400" />
					</div>
					<div class="flex-1">
						<div class="text-sm font-medium text-gray-500">No platform modules assigned</div>
						<div class="text-xs text-gray-400 mt-0.5">Contact an administrator to request access</div>
					</div>
				</div>
			{/if}
		</div>

				<div class="flex justify-end pt-2">
					<button
						type="submit"
						disabled={loading}
						class="inline-flex items-center px-6 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 shadow-sm transition-colors"
					>
						<Save class="h-4 w-4 mr-2" />
						{loading ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</form>
		</div>

		<!-- Password Change Section -->
		<div class="bg-white shadow-sm rounded-lg border border-gray-200">
			<div class="px-6 py-4 border-b border-gray-200">
				<div class="flex items-center justify-between">
					<h2 class="text-lg font-semibold text-gray-900 flex items-center">
						<Lock class="h-5 w-5 mr-2 text-gray-600" />
						Security Settings
					</h2>
		<button
			onclick={() => showPasswordSection = !showPasswordSection}
						class="inline-flex items-center px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
					>
						{showPasswordSection ? 'Cancel' : 'Change Password'}
					</button>
				</div>
			</div>

	{#if showPasswordSection}
		<form onsubmit={handlePasswordChange} class="p-6 space-y-5">
					<div>
						<label for="current_password" class="block text-sm font-medium text-gray-700 mb-2">
							Current Password
						</label>
						<div class="relative">
							<input
								type={showPassword ? 'text' : 'password'}
								id="current_password"
								bind:value={passwordData.currentPassword}
								required
								class="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-3 pr-10 border"
								placeholder="Enter your current password"
							/>
			<button
				type="button"
				onclick={() => showPassword = !showPassword}
								class="absolute inset-y-0 right-0 pr-3 flex items-center hover:text-gray-600"
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
						<label for="new_password" class="block text-sm font-medium text-gray-700 mb-2">
							New Password
						</label>
						<input
							type="password"
							id="new_password"
							bind:value={passwordData.newPassword}
							required
							minlength="6"
							class="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-3 border"
							placeholder="Minimum 6 characters"
						/>
					</div>

					<div>
						<label for="confirm_password" class="block text-sm font-medium text-gray-700 mb-2">
							Confirm New Password
						</label>
						<input
							type="password"
							id="confirm_password"
							bind:value={passwordData.confirmPassword}
							required
							minlength="6"
							class="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-3 border"
							placeholder="Re-enter your new password"
						/>
					</div>


					<div class="flex justify-end space-x-3 pt-2">
			<button
				type="button"
				onclick={() => showPasswordSection = false}
							disabled={passwordLoading}
							class="px-5 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={passwordLoading}
							class="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 shadow-sm transition-colors"
						>
							<Lock class="h-4 w-4 mr-2" />
							{passwordLoading ? 'Updating...' : 'Update Password'}
						</button>
					</div>
				</form>
			{:else}
				<div class="p-6">
					<p class="text-sm text-gray-500">
						Keep your account secure by using a strong password. Click "Change Password" above to update your credentials.
					</p>
				</div>
			{/if}
		</div>

		<!-- Sign Out Section -->
		<div class="bg-white shadow-sm rounded-lg border border-gray-200">
			<div class="px-6 py-4 border-b border-gray-200">
				<h2 class="text-lg font-semibold text-gray-900 flex items-center">
					<LogOut class="h-5 w-5 mr-2 text-gray-600" />
					Account Actions
				</h2>
			</div>
			<div class="p-6">
				<p class="text-sm text-gray-600 mb-4">
					Sign out of your account. You'll need to sign in again to access the platform.
				</p>
				<a
					href="/auth/logout"
					class="inline-flex items-center px-5 py-2.5 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 shadow-sm transition-colors"
				>
					<LogOut class="h-4 w-4 mr-2" />
					Sign Out
				</a>
			</div>
		</div>

		{#if profile?.modules && profile.modules.includes('platform.admin')}
			<div class="bg-gradient-to-br from-purple-50 to-purple-100 shadow-sm rounded-lg border border-purple-200">
				<div class="px-6 py-4 border-b border-purple-200 bg-white/50">
					<h2 class="text-lg font-semibold text-gray-900 flex items-center">
						<Users class="h-5 w-5 mr-2 text-purple-600" />
						Platform Admin
					</h2>
				</div>
				<div class="p-6">
					<p class="text-sm text-gray-700 mb-4">
						You have access to user management tools
					</p>
					<a
						href="/users"
						class="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-sm transition-colors"
					>
						<Users class="h-4 w-4 mr-2" />
						Manage Users
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>

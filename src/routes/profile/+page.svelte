<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';
	import { UserCircle, Mail, Phone, Building, Save } from 'lucide-svelte';

	export let data;

	let { supabase, profile } = data;
	let loading = false;
	let saveMessage = '';

	let formData = {
		full_name: profile?.full_name || '',
		display_name: profile?.display_name || '',
		phone: profile?.phone || '',
		organization: profile?.organization || '',
		bio: profile?.bio || ''
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
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="bg-white shadow rounded-lg">
			<div class="px-6 py-4 border-b border-gray-200">
				<h1 class="text-2xl font-semibold text-gray-900">Profile Settings</h1>
			</div>

			<form on:submit|preventDefault={handleSubmit} class="p-6 space-y-6">
				<div class="flex items-center space-x-4 pb-6 border-b border-gray-200">
					<div class="flex-shrink-0">
						<UserCircle class="h-20 w-20 text-gray-400" />
					</div>
					<div>
						<p class="text-sm text-gray-500">Email</p>
						<p class="text-lg font-medium text-gray-900">{profile?.email}</p>
						<p class="text-sm text-gray-500 mt-1">Role: <span class="capitalize">{profile?.role || 'viewer'}</span></p>
					</div>
				</div>

				<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
					<div>
						<label for="full_name" class="block text-sm font-medium text-gray-700">
							Full Name
						</label>
						<input
							type="text"
							id="full_name"
							bind:value={formData.full_name}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							placeholder="John Doe"
						/>
					</div>

					<div>
						<label for="display_name" class="block text-sm font-medium text-gray-700">
							Display Name
						</label>
						<input
							type="text"
							id="display_name"
							bind:value={formData.display_name}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							placeholder="How you want to be called"
						/>
					</div>

					<div>
						<label for="phone" class="block text-sm font-medium text-gray-700">
							<Phone class="inline h-4 w-4 mr-1" />
							Phone Number
						</label>
						<input
							type="tel"
							id="phone"
							bind:value={formData.phone}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							placeholder="+61 400 000 000"
						/>
					</div>

					<div>
						<label for="organization" class="block text-sm font-medium text-gray-700">
							<Building class="inline h-4 w-4 mr-1" />
							Organization
						</label>
						<input
							type="text"
							id="organization"
							bind:value={formData.organization}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
							placeholder="Parish or organization name"
						/>
					</div>
				</div>

				<div>
					<label for="bio" class="block text-sm font-medium text-gray-700">
						Bio / About
					</label>
					<textarea
						id="bio"
						bind:value={formData.bio}
						rows="4"
						class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
						placeholder="Tell us a bit about yourself..."
					/>
				</div>

				{#if saveMessage}
					<div class="rounded-md bg-green-50 p-4">
						<p class="text-sm font-medium text-green-800">{saveMessage}</p>
					</div>
				{/if}

				<div class="flex justify-end space-x-3">
					<button
						type="submit"
						disabled={loading}
						class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					>
						<Save class="h-4 w-4 mr-2" />
						{loading ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</form>
		</div>

		{#if profile?.role === 'admin'}
			<div class="mt-8 bg-white shadow rounded-lg">
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
	input, textarea {
		@apply border px-3 py-2;
	}
</style>
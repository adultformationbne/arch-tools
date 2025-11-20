<script lang="ts">
	import { Settings, Save } from 'lucide-svelte';
	import { apiGet, apiPut } from '$lib/utils/api-handler.js';
	import { onMount } from 'svelte';

	let loading = $state(false);
	let settings = $state({
		platform_name: '',
		logo_path: '',
		from_email: '',
		organization: ''
	});
	let originalSettings = $state(null);

	onMount(async () => {
		await loadSettings();
	});

	async function loadSettings() {
		loading = true;
		try {
			const response = await fetch('/api/admin/platform-settings');
			if (!response.ok) {
				throw new Error('Failed to load settings');
			}
			const data = await response.json();
			settings = {
				platform_name: data.platform_name || '',
				logo_path: data.logo_path || '',
				from_email: data.from_email || '',
				organization: data.organization || ''
			};
			originalSettings = { ...settings };
		} catch (error) {
			console.error('Error loading platform settings:', error);
		} finally {
			loading = false;
		}
	}

	async function saveSettings() {
		loading = true;
		try {
			await apiPut(
				'/api/admin/platform-settings',
				settings,
				{
					successMessage: 'Platform settings updated successfully',
					loadingMessage: 'Saving platform settings...'
				}
			);
			originalSettings = { ...settings };
			// Reload page to apply new settings
			setTimeout(() => window.location.reload(), 1000);
		} catch (error) {
			console.error('Error saving platform settings:', error);
		} finally {
			loading = false;
		}
	}

	let hasChanges = $derived(
		originalSettings &&
		(settings.platform_name !== originalSettings.platform_name ||
			settings.logo_path !== originalSettings.logo_path ||
			settings.from_email !== originalSettings.from_email ||
			settings.organization !== originalSettings.organization)
	);

	function resetChanges() {
		if (originalSettings) {
			settings = { ...originalSettings };
		}
	}
</script>

<div class="max-w-3xl">
	<div class="bg-white shadow rounded-lg">
		<div class="px-6 py-4 border-b border-gray-200">
			<h2 class="text-lg font-semibold text-gray-900 flex items-center">
				<Settings class="h-5 w-5 mr-2" />
				Platform Settings
			</h2>
			<p class="mt-1 text-sm text-gray-500">
				Configure platform-wide settings used across the application
			</p>
		</div>

		<div class="px-6 py-6 space-y-6">
			<!-- Platform Name -->
			<div>
				<label for="platform-name" class="block text-sm font-medium text-gray-700 mb-1">
					Platform Name
				</label>
				<input
					id="platform-name"
					type="text"
					bind:value={settings.platform_name}
					disabled={loading}
					class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
					placeholder="Archdiocesan Ministries Platform"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Used in page titles, emails, and login page
				</p>
			</div>

			<!-- Logo Path -->
			<div>
				<label for="logo-path" class="block text-sm font-medium text-gray-700 mb-1">
					Logo Path
				</label>
				<input
					id="logo-path"
					type="text"
					bind:value={settings.logo_path}
					disabled={loading}
					class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
					placeholder="/archmin-mark.png"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Path to logo image (must be in /static folder or absolute URL)
				</p>
				{#if settings.logo_path}
					<div class="mt-2">
						<img
							src={settings.logo_path}
							alt="Logo preview"
							class="h-16 w-16 object-contain border border-gray-200 rounded p-2"
							onerror={(e) => {
								e.target.style.display = 'none';
							}}
						/>
					</div>
				{/if}
			</div>

			<!-- From Email -->
			<div>
				<label for="from-email" class="block text-sm font-medium text-gray-700 mb-1">
					From Email Address
				</label>
				<input
					id="from-email"
					type="email"
					bind:value={settings.from_email}
					disabled={loading}
					class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
					placeholder="Platform Name <noreply@example.com>"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Email address used as sender for system emails (format: "Name &lt;email@domain.com&gt;")
				</p>
			</div>

			<!-- Organization Name -->
			<div>
				<label for="organization" class="block text-sm font-medium text-gray-700 mb-1">
					Organization Name
				</label>
				<input
					id="organization"
					type="text"
					bind:value={settings.organization}
					disabled={loading}
					class="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
					placeholder="Archdiocesan Ministries"
				/>
				<p class="mt-1 text-xs text-gray-500">
					Organization name used in email footers
				</p>
			</div>
		</div>

		<!-- Actions -->
		{#if hasChanges}
			<div class="px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
				<p class="text-sm text-gray-600">
					You have unsaved changes
				</p>
				<div class="flex space-x-3">
					<button
						type="button"
						onclick={resetChanges}
						disabled={loading}
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={saveSettings}
						disabled={loading}
						class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					>
						<Save class="h-4 w-4 mr-2" />
						{loading ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

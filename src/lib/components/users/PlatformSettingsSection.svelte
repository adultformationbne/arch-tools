<script lang="ts">
	import { Settings, Save } from '$lib/icons';
	import { apiGet, apiPut } from '$lib/utils/api-handler.js';
	import { onMount } from 'svelte';

	let loading = $state(false);
	let settings = $state({
		platform_name: '',
		logo_path: '',
		from_email: '',
		reply_to_email: '',
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
				reply_to_email: data.reply_to_email || '',
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
			settings.reply_to_email !== originalSettings.reply_to_email ||
			settings.organization !== originalSettings.organization)
	);

	function resetChanges() {
		if (originalSettings) {
			settings = { ...originalSettings };
		}
	}
</script>

<div class="max-w-4xl mx-auto">
	<div class="bg-white rounded-lg border border-gray-200 shadow-sm">
		<div class="px-8 py-8 border-b border-gray-200 bg-gray-50">
			<h2 class="text-2xl font-bold text-gray-900 flex items-center">
				<Settings class="h-6 w-6 mr-3" />
				Platform Settings
			</h2>
			<p class="mt-2 text-sm text-gray-600">
				Configure platform-wide settings used across the application
			</p>
		</div>

		<div class="px-8 py-10 space-y-8">
			<!-- Platform Name -->
			<div>
				<label for="platform-name" class="block text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">
					Platform Name
				</label>
				<input
					id="platform-name"
					type="text"
					bind:value={settings.platform_name}
					disabled={loading}
					class="block w-full px-4 py-3 rounded border border-gray-300 focus:border-gray-900 focus:ring-0 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
					placeholder="Archdiocesan Ministries Platform"
				/>
				<p class="mt-2 text-xs text-gray-600">
					Used in page titles, emails, and login page
				</p>
			</div>

			<!-- Logo Path -->
			<div>
				<label for="logo-path" class="block text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">
					Logo Path
				</label>
				<input
					id="logo-path"
					type="text"
					bind:value={settings.logo_path}
					disabled={loading}
					class="block w-full px-4 py-3 rounded border border-gray-300 focus:border-gray-900 focus:ring-0 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
					placeholder="/archmin-mark.png"
				/>
				<p class="mt-2 text-xs text-gray-600">
					Path to logo image (must be in /static folder or absolute URL)
				</p>
				{#if settings.logo_path}
					<div class="mt-4 p-4 border border-gray-200 rounded bg-gray-50 inline-block">
						<img
							src={settings.logo_path}
							alt="Logo preview"
							class="h-20 w-20 object-contain"
							onerror={(e) => {
								e.target.style.display = 'none';
							}}
						/>
					</div>
				{/if}
			</div>

			<!-- From Email -->
			<div>
				<label for="from-email" class="block text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">
					From Email Address
				</label>
				<input
					id="from-email"
					type="email"
					bind:value={settings.from_email}
					disabled={loading}
					class="block w-full px-4 py-3 rounded border border-gray-300 focus:border-gray-900 focus:ring-0 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
					placeholder="Platform Name <noreply@example.com>"
				/>
				<p class="mt-2 text-xs text-gray-600">
					Email address used as sender for system emails (format: "Name &lt;email@domain.com&gt;")
				</p>
			</div>

			<!-- Reply-To Email -->
			<div>
				<label for="reply-to-email" class="block text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">
					Default Reply-To Email
				</label>
				<input
					id="reply-to-email"
					type="email"
					bind:value={settings.reply_to_email}
					disabled={loading}
					class="block w-full px-4 py-3 rounded border border-gray-300 focus:border-gray-900 focus:ring-0 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
					placeholder="support@example.com"
				/>
				<p class="mt-2 text-xs text-gray-600">
					When recipients reply to emails, replies will go to this address. Courses can override this with their own reply-to.
				</p>
			</div>

			<!-- Organization Name -->
			<div>
				<label for="organization" class="block text-sm font-bold text-gray-900 mb-2 uppercase tracking-wide">
					Organization Name
				</label>
				<input
					id="organization"
					type="text"
					bind:value={settings.organization}
					disabled={loading}
					class="block w-full px-4 py-3 rounded border border-gray-300 focus:border-gray-900 focus:ring-0 disabled:bg-gray-100 disabled:cursor-not-allowed transition-colors"
					placeholder="Archdiocesan Ministries"
				/>
				<p class="mt-2 text-xs text-gray-600">
					Organization name used in email footers
				</p>
			</div>
		</div>

		<!-- Actions -->
		{#if hasChanges}
			<div class="px-8 py-6 bg-yellow-50 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
				<p class="text-sm font-bold text-gray-900 uppercase tracking-wide">
					You have unsaved changes
				</p>
				<div class="flex gap-3 w-full sm:w-auto">
					<button
						type="button"
						onclick={resetChanges}
						disabled={loading}
						class="flex-1 sm:flex-none px-6 py-3 text-sm font-bold uppercase tracking-wide text-gray-900 bg-white border border-gray-900 rounded hover:bg-gray-50 transition-colors disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={saveSettings}
						disabled={loading}
						class="flex-1 sm:flex-none inline-flex items-center justify-center px-6 py-3 text-sm font-bold uppercase tracking-wide text-white bg-gray-900 border border-gray-900 rounded hover:bg-gray-800 transition-colors disabled:opacity-50"
					>
						<Save class="h-4 w-4 mr-2" />
						{loading ? 'Saving...' : 'Save Changes'}
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

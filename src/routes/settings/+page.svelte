<script>
	import { Shield } from 'lucide-svelte';
	import PlatformSettingsSection from '$lib/components/users/PlatformSettingsSection.svelte';
</script>

<div class="min-h-screen bg-gray-50 py-8">
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
		<div class="mb-6">
			<h1 class="text-2xl font-semibold text-gray-900 flex items-center">
				<Shield class="h-6 w-6 mr-2" />
				Platform Settings
			</h1>
			<p class="mt-1 text-sm text-gray-500">
				Configure platform-wide settings
			</p>
		</div>

		<PlatformSettingsSection />
	</div>
</div>

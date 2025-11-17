<script>
	import { Shield, ChevronDown, ChevronUp } from 'lucide-svelte';

	let { availableModules = [], isOpen = false, onToggle } = $props();

	function getModuleBadgeColor(moduleId) {
		return 'bg-gray-100 text-gray-700 border border-gray-200';
	}
</script>

<div class="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
	<button
		onclick={onToggle}
		class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
	>
		<h2 class="text-lg font-semibold text-gray-900 flex items-center">
			<Shield class="h-5 w-5 mr-2 text-blue-600" />
			Platform Modules Reference
		</h2>
		{#if isOpen}
			<ChevronUp class="h-5 w-5 text-gray-500" />
		{:else}
			<ChevronDown class="h-5 w-5 text-gray-500" />
		{/if}
	</button>

	{#if isOpen}
		<div class="px-6 pb-6 border-t border-gray-200">
			<p class="text-sm text-gray-600 mb-4 mt-4">
				Platform access is completely module-driven. Assign the combinations that match a
				user&rsquo;s responsibilities—no separate platform roles or hard-coded "admins" remain.
			</p>

			<h3 class="text-sm font-semibold text-gray-700 mb-2 mt-4">Available Modules</h3>
			<div class="space-y-3">
				{#each availableModules as module}
					<div>
						<span
							class="inline-flex px-2 py-1 text-xs font-semibold rounded-full {getModuleBadgeColor(module.id)}"
						>
							{module.name}
						</span>
						<span class="ml-2 text-sm text-gray-600">{module.description}</span>
					</div>
				{/each}
			</div>
			<div class="mt-4 text-sm text-gray-600">
				<p class="font-semibold text-gray-700 mb-1">Common combinations:</p>
				<ul class="list-disc pl-5 space-y-1">
					<li>
						<span class="font-medium">Platform manager:</span> users, courses.admin, editor, dgr
					</li>
					<li>
						<span class="font-medium">Course staff:</span> courses.manager (+ courses.participant if
						they also take courses)
					</li>
					<li><span class="font-medium">Participant only:</span> courses.participant</li>
				</ul>
			</div>
		</div>
	{/if}
</div>

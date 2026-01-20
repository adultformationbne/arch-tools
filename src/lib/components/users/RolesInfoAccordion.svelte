<script>
	import { GraduationCap, ChevronDown, ChevronUp } from '$lib/icons';

	let { courseRoles = [], isOpen = false, onToggle } = $props();

	function getCourseRoleBadgeColor(role) {
		const colors = {
			admin: 'bg-orange-100 text-orange-800',
			student: 'bg-green-100 text-green-800',
			coordinator: 'bg-indigo-100 text-indigo-800'
		};
		return colors[role] || 'bg-gray-100 text-gray-800';
	}
</script>

<div class="bg-white shadow rounded-lg overflow-hidden border border-gray-200">
	<button
		onclick={onToggle}
		class="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
	>
		<h2 class="text-lg font-semibold text-gray-900 flex items-center">
			<GraduationCap class="h-5 w-5 mr-2 text-green-600" />
			Course Roles Reference
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
				<strong>Cohort enrollments are for participants only.</strong> Course managers and admins
				are NOT enrolled in cohorts—they manage courses via platform modules.
			</p>
			<div class="space-y-3">
				{#each courseRoles as role}
					<div class="flex items-start">
						<span
							class="px-2 py-1 text-xs font-semibold rounded-full {getCourseRoleBadgeColor(role.id)} mr-2"
						>
							{role.name}
						</span>
						<span class="text-sm text-gray-600">{role.description}</span>
					</div>
				{/each}
			</div>
			<div class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded">
				<p class="text-xs text-amber-900 font-semibold mb-2">How Course Access Works:</p>
				<ul class="text-xs text-amber-800 space-y-1 ml-4 list-disc">
					<li>
						<strong>Participants:</strong> Need
						<code class="bg-amber-100 px-1 rounded">courses.participant</code> module + cohort enrollment
						(student or coordinator role)
					</li>
					<li>
						<strong>Course Managers:</strong> Need
						<code class="bg-amber-100 px-1 rounded">courses.manager</code> module + assignment to specific
						courses (no enrollment)
					</li>
					<li>
						<strong>Course Admins:</strong> Need
						<code class="bg-amber-100 px-1 rounded">courses.admin</code> module (can manage ALL courses,
						no assignment or enrollment needed)
					</li>
				</ul>
			</div>
		</div>
	{/if}
</div>

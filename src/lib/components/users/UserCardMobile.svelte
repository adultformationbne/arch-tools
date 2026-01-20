<script>
	import {
		Mail,
		ChevronDown,
		Shield,
		GraduationCap,
		Edit2,
		Send,
		KeyRound,
		Trash2,
		Save,
		X,
		Plus
	} from '$lib/icons';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

	let {
		user,
		currentUserId,
		isExpanded = false,
		availableModules = [],
		editingUserId = null,
		editingModules = [],
		loading = false,
		onToggleExpand,
		onStartEdit,
		onCancelEdit,
		onToggleModule,
		onSavePermissions,
		onResendInvitation,
		onShowPasswordReset,
		onConfirmDelete,
		onShowAddEnrollment,
		onStartEditEnrollment,
		onCancelEditEnrollment,
		onSaveEnrollmentRole,
		onRemoveEnrollment,
		editingEnrollmentId = null,
		editingEnrollmentRole = ''
	} = $props();

	function getModuleBadgeColor(moduleId) {
		return 'bg-gray-100 text-gray-700 border border-gray-200';
	}

	function getCourseRoleBadgeColor(role) {
		const colors = {
			admin: 'bg-orange-100 text-orange-800',
			student: 'bg-green-100 text-green-800',
			coordinator: 'bg-indigo-100 text-indigo-800'
		};
		return colors[role] || 'bg-gray-100 text-gray-800';
	}
</script>

<div
	class="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden {user.id === currentUserId ? 'bg-blue-50 border-blue-200' : ''}"
>
	<!-- User Info Header - Always Visible -->
	<button
		onclick={onToggleExpand}
		class="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
	>
		<div class="flex items-start justify-between gap-3">
			<div class="flex items-start gap-3 flex-1 min-w-0">
				<UserAvatar user={user} size="sm" />
				<div class="flex-1 min-w-0">
					<div class="text-sm font-medium text-gray-900 flex items-center gap-2 flex-wrap">
						{user.full_name || user.display_name || 'No name'}
					{#if user.id === currentUserId}
						<span class="text-xs font-medium text-blue-600">(You)</span>
					{/if}
					{#if user.isPending}
						<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
							Pending
						</span>
					{/if}
				</div>
				<div class="text-xs text-gray-500 flex items-center mt-1">
					<Mail class="h-3 w-3 mr-1 flex-shrink-0" />
					<span class="truncate">{user.email}</span>
				</div>
				{#if user.organization}
					<div class="text-xs text-gray-400 mt-1">
						{user.organization}
					</div>
				{/if}
				<!-- Quick summary when collapsed -->
				{#if !isExpanded}
					<div class="flex items-center gap-3 mt-2 text-xs text-gray-500">
						{#if user.modules && user.modules.length > 0}
							<span class="flex items-center gap-1">
								<Shield class="h-3 w-3" />
								{user.modules.length}
								{user.modules.length === 1 ? 'module' : 'modules'}
							</span>
						{/if}
						{#if user.enrollments && user.enrollments.length > 0}
							<span class="flex items-center gap-1">
								<GraduationCap class="h-3 w-3" />
								{user.enrollments.length}
								{user.enrollments.length === 1 ? 'course' : 'courses'}
							</span>
						{/if}
					</div>
				{/if}
				</div>
			</div>
			<div class="flex-shrink-0 pt-1">
				<ChevronDown
					class="h-4 w-4 text-gray-400 transition-transform {isExpanded ? 'rotate-180' : ''}"
				/>
			</div>
		</div>
	</button>

	{#if isExpanded}
		<!-- Platform Access -->
		<div class="px-4 py-3 border-t border-gray-100">
			<div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
				Platform Access
			</div>
			{#if editingUserId === user.id}
				<div class="flex flex-wrap gap-2">
					{#each availableModules as module}
						{@const isActive = editingModules.includes(module.id)}
						<button
							type="button"
							aria-pressed={isActive}
							class="px-3 py-1 rounded-full border text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
							class:bg-gray-900={isActive}
							class:text-white={isActive}
							class:border-gray-900={isActive}
							class:bg-gray-100={!isActive}
							class:text-gray-600={!isActive}
							class:border-gray-300={!isActive}
							onclick={() => onToggleModule(module.id)}
							disabled={user.id === currentUserId && module.id === 'platform.admin'}
							class:opacity-50={user.id === currentUserId && module.id === 'platform.admin'}
							title={module.description}
						>
							{module.name}
						</button>
					{/each}
				</div>
			{:else}
				<div class="flex flex-wrap gap-1">
					{#if user.modules && user.modules.length > 0}
						{#each user.modules as moduleId}
							{@const module = availableModules.find((m) => m.id === moduleId)}
							<span
								class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full {getModuleBadgeColor(moduleId)}"
							>
								{module?.name || moduleId}
							</span>
						{/each}
					{:else}
						<span class="text-sm text-gray-400 italic">No modules</span>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Course Enrollments -->
		<div class="px-4 py-3 border-b border-gray-100">
			<div class="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
				Course Enrollments
			</div>
			<div class="space-y-2">
				{#if user.enrollments && user.enrollments.length > 0}
					{#each user.enrollments as enrollment}
						{@const cohort = enrollment.cohort}
						{@const courseName = cohort?.module?.course?.name || 'Unknown'}
						{@const cohortName = cohort?.name || 'Unknown Cohort'}
						<div class="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded">
							<div class="flex-1 min-w-0">
								<div class="text-xs font-medium text-gray-900 truncate">
									{courseName}
								</div>
								<div class="text-xs text-gray-500 truncate">
									{cohortName}
								</div>
							</div>
							{#if editingEnrollmentId === enrollment.id}
								<div class="flex items-center gap-1">
									<select
										value={editingEnrollmentRole}
										onchange={(e) => {
											editingEnrollmentRole = e.target.value;
										}}
										class="text-xs rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
									>
										<option value="student">Participant</option>
										<option value="coordinator">Hub Coordinator</option>
									</select>
									<button
										onclick={() => onSaveEnrollmentRole(enrollment.id, editingEnrollmentRole)}
										class="text-green-600 hover:text-green-900"
										title="Save"
									>
										<Save class="h-3 w-3" />
									</button>
									<button
										onclick={onCancelEditEnrollment}
										class="text-gray-600 hover:text-gray-900"
										title="Cancel"
									>
										<X class="h-3 w-3" />
									</button>
								</div>
							{:else}
								<div class="flex items-center gap-1">
									<span
										class="px-2 py-0.5 text-xs font-semibold rounded-full {getCourseRoleBadgeColor(enrollment.role)}"
									>
										{enrollment.role}
									</span>
									<button
										onclick={() => onStartEditEnrollment(enrollment.id, enrollment.role)}
										class="text-blue-600 hover:text-blue-900"
										title="Edit role"
									>
										<Edit2 class="h-3 w-3" />
									</button>
									<button
										onclick={() => onRemoveEnrollment(enrollment.id, courseName)}
										class="text-red-600 hover:text-red-900"
										title="Remove enrollment"
									>
										<X class="h-3 w-3" />
									</button>
								</div>
							{/if}
						</div>
					{/each}
				{:else}
					<span class="text-sm text-gray-400 italic">No enrollments</span>
				{/if}
				<button
					onclick={() => onShowAddEnrollment(user.id, user.full_name || user.email)}
					class="text-xs text-blue-600 hover:text-blue-900 flex items-center gap-1"
				>
					<Plus class="h-3 w-3" />
					Add Enrollment
				</button>
			</div>
		</div>

		<!-- Actions -->
		<div class="px-4 py-3 bg-gray-50">
			{#if editingUserId === user.id}
				<div class="flex items-center justify-end space-x-3">
					<button
						onclick={() => onSavePermissions(user.id)}
						disabled={loading}
						class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700"
					>
						<Save class="h-3 w-3 mr-1" />
						Save
					</button>
					<button
						onclick={onCancelEdit}
						disabled={loading}
						class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50"
					>
						<X class="h-3 w-3 mr-1" />
						Cancel
					</button>
				</div>
			{:else}
				<div class="flex items-center justify-end space-x-3">
					<button
						onclick={() => onStartEdit(user.id, user.modules || [])}
						class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-900"
						title="Edit platform permissions"
					>
						<Edit2 class="h-3 w-3 mr-1" />
						Edit
					</button>
					{#if user.isPending}
						<button
							onclick={() => onResendInvitation(user.id, user.email)}
							class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-600 hover:text-green-900"
							title="Resend invitation"
						>
							<Send class="h-3 w-3 mr-1" />
							Resend
						</button>
					{:else}
						<button
							onclick={() => onShowPasswordReset(user.id)}
							class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-orange-600 hover:text-orange-900"
							title="Reset password"
						>
							<KeyRound class="h-3 w-3 mr-1" />
							Reset
						</button>
					{/if}
					<button
						onclick={() => onConfirmDelete(user.id, user.email)}
						disabled={user.id === currentUserId}
						class="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-900 disabled:text-gray-400 disabled:cursor-not-allowed"
						title={user.id === currentUserId ? 'Cannot delete yourself' : 'Delete user'}
					>
						<Trash2 class="h-3 w-3 mr-1" />
						Delete
					</button>
				</div>
			{/if}
		</div>
	{/if}
</div>

<script>
	import {
		Mail,
		Save,
		X,
		Edit2,
		Plus,
		Send,
		KeyRound,
		Trash2,
		MoreVertical
	} from 'lucide-svelte';
	import { createDropdown } from '$lib/utils/dropdown.js';
	import UserAvatar from '$lib/components/UserAvatar.svelte';

	let {
		user,
		currentUserId,
		availableModules = [],
		editingUserId = null,
		editingModules = [],
		expandedModulesUserId = null,
		loading = false,
		onStartEdit,
		onCancelEdit,
		onToggleModule,
		onSavePermissions,
		onShowEnrollmentModal,
		onResendInvitation,
		onShowPasswordReset,
		onConfirmDelete,
		onExpandModules,
		onCollapseModules
	} = $props();

	let dropdownButton = $state(null);
	let dropdownMenu = $state(null);
	let dropdownController = $state(null);

	function getModuleBadgeColor(moduleId) {
		return 'bg-gray-100 text-gray-700 border border-gray-200';
	}

	function dropdownAction(node, params) {
		const { type } = params;

		if (type === 'button') {
			dropdownButton = node;
		} else if (type === 'menu') {
			dropdownMenu = node;
		}

		// Initialize dropdown if both elements exist
		if (dropdownButton && dropdownMenu) {
			dropdownController = createDropdown(dropdownButton, dropdownMenu, {
				placement: 'bottom-end',
				offset: 4
			});
		}

		return {
			destroy() {
				if (type === 'button') {
					dropdownController?.destroy();
				}
			}
		};
	}
</script>

<tr>
	<td class="px-6 py-4">
		<div class="flex items-start gap-3">
			<UserAvatar user={user} size="md" />
			<div class="flex items-start flex-col">
				<div class="text-sm font-medium text-gray-900 flex items-center gap-2">
					{user.full_name || user.display_name || 'No name'}
					{#if user.id === currentUserId}
						<span class="text-xs text-gray-500">(You)</span>
					{/if}
					{#if user.isPending}
						<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
							Pending
						</span>
					{/if}
				</div>
				<div class="text-sm text-gray-500 flex items-center">
					<Mail class="h-3 w-3 mr-1" />
					{user.email}
				</div>
				{#if user.organization}
					<div class="text-xs text-gray-400 mt-1">
						{user.organization}
					</div>
				{/if}
			</div>
		</div>
	</td>
	<td class="px-6 py-4">
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
						disabled={user.id === currentUserId && module.id === 'users'}
						class:opacity-50={user.id === currentUserId && module.id === 'users'}
						title={module.description}
					>
						{module.name}
					</button>
				{/each}
			</div>
		{:else}
			<div class="flex flex-wrap gap-1">
				{#if user.modules && user.modules.length > 0}
					{@const isExpanded = expandedModulesUserId === user.id}
					{@const visibleModules = isExpanded ? user.modules : user.modules.slice(0, 3)}
					{@const remainingCount = user.modules.length - 3}
					{#each visibleModules as moduleId}
						{@const module = availableModules.find((m) => m.id === moduleId)}
						<span
							class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full {getModuleBadgeColor(moduleId)}"
						>
							{module?.name || moduleId}
						</span>
					{/each}
					{#if remainingCount > 0 && !isExpanded}
						<button
							onclick={() => onExpandModules(user.id)}
							class="px-2 py-1 inline-flex text-xs leading-5 font-medium text-blue-600 hover:text-blue-800 hover:underline"
						>
							+{remainingCount} more
						</button>
					{:else if isExpanded}
						<button
							onclick={onCollapseModules}
							class="px-2 py-1 inline-flex text-xs leading-5 font-medium text-blue-600 hover:text-blue-800 hover:underline"
						>
							Show less
						</button>
					{/if}
				{:else}
					<span class="text-sm text-gray-400 italic">No modules</span>
				{/if}
			</div>
		{/if}
	</td>
	<td class="px-6 py-4">
		{#if user.enrollments && user.enrollments.length > 0}
			<button
				onclick={() => onShowEnrollmentModal(user.id, user.full_name || user.email)}
				class="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 border border-gray-200 rounded-full hover:bg-gray-200 transition-colors"
			>
				{user.enrollments.length}
				{user.enrollments.length === 1 ? 'course' : 'courses'}
			</button>
		{:else}
			<span class="text-sm text-gray-400 italic">None</span>
		{/if}
	</td>
	<td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
		{#if editingUserId === user.id}
			<div class="flex items-center justify-end space-x-2">
				<button
					onclick={() => onSavePermissions(user.id)}
					disabled={loading}
					class="text-green-600 hover:text-green-900"
					title="Save permissions"
				>
					<Save class="h-4 w-4" />
				</button>
				<button
					onclick={onCancelEdit}
					disabled={loading}
					class="text-gray-600 hover:text-gray-900"
					title="Cancel"
				>
					<X class="h-4 w-4" />
				</button>
			</div>
		{:else}
			<div class="relative">
				<button
					onclick={(e) => {
						e.stopPropagation();
						dropdownController?.toggle();
					}}
					use:dropdownAction={{ type: 'button' }}
					class="p-1 rounded hover:bg-gray-100 transition-colors"
					title="Actions"
				>
					<MoreVertical class="h-5 w-5 text-gray-400" />
				</button>

				<!-- Dropdown menu (hidden by default) -->
				<div
					use:dropdownAction={{ type: 'menu' }}
					style="display: none;"
					class="w-48 bg-white rounded-md shadow-lg border border-gray-200"
				>
					<div class="py-1">
						<button
							onclick={() => {
								onStartEdit(user.id, user.modules || []);
								dropdownController?.hide();
							}}
							class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
						>
							<Edit2 class="h-4 w-4" />
							Edit Permissions
						</button>
						<button
							onclick={() => {
								onShowEnrollmentModal(user.id, user.full_name || user.email);
								dropdownController?.hide();
							}}
							class="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
						>
							<Plus class="h-4 w-4" />
							Add Enrollment
						</button>
						{#if user.isPending}
							<button
								onclick={() => {
									onResendInvitation(user.id, user.email);
									dropdownController?.hide();
								}}
								class="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-gray-100 flex items-center gap-2"
							>
								<Send class="h-4 w-4" />
								Resend Invitation
							</button>
						{:else}
							<button
								onclick={() => {
									onShowPasswordReset(user.id);
									dropdownController?.hide();
								}}
								class="w-full text-left px-4 py-2 text-sm text-orange-700 hover:bg-gray-100 flex items-center gap-2"
							>
								<KeyRound class="h-4 w-4" />
								Reset Password
							</button>
						{/if}
						<div class="border-t border-gray-100"></div>
						<button
							onclick={() => {
								onConfirmDelete(user.id, user.email);
								dropdownController?.hide();
							}}
							disabled={user.id === currentUserId}
							class="w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-gray-100 flex items-center gap-2 disabled:text-gray-400 disabled:cursor-not-allowed"
						>
							<Trash2 class="h-4 w-4" />
							Delete User
						</button>
					</div>
				</div>
			</div>
		{/if}
	</td>
</tr>

<script>
	import { Trash2 } from '$lib/icons';
	import { apiDelete } from '$lib/utils/api-handler.js';

	let { isOpen = false, userId = null, userEmail = '', onClose, onDeleted } = $props();
	let deleteLoading = $state(false);

	async function deleteUser() {
		deleteLoading = true;

		try {
			await apiDelete(
				'/api/admin/users',
				{ userId },
				{
					loadingMessage: 'Removing user from system',
					loadingTitle: 'Deleting user...',
					successMessage: `User ${userEmail} deleted successfully`,
					successTitle: 'User Deleted'
				}
			);

			onDeleted?.();
			onClose?.();
		} catch (error) {
			console.error('Error deleting user:', error);
		} finally {
			deleteLoading = false;
		}
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 px-4">
		<div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<div class="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 rounded-full mb-4">
					<Trash2 class="h-6 w-6 text-red-600" />
				</div>
				<h3 class="text-lg font-medium text-gray-900 text-center mb-2">Delete User</h3>
				<p class="text-sm text-gray-600 text-center mb-4">
					Are you sure you want to delete <strong>{userEmail}</strong>?
				</p>
				<p class="text-sm text-red-600 text-center mb-6">
					This action cannot be undone. All user data will be permanently removed.
				</p>

				<div class="flex justify-end space-x-3">
					<button
						type="button"
						onclick={onClose}
						disabled={deleteLoading}
						class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={deleteUser}
						disabled={deleteLoading}
						class="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
					>
						{deleteLoading ? 'Deleting...' : 'Delete User'}
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}

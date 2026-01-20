<script>
	import { KeyRound } from '$lib/icons';
	import { apiPost } from '$lib/utils/api-handler.js';
	import { toastValidationError } from '$lib/utils/toast-helpers.js';

	let { isOpen = false, userId = null, onClose, onReset } = $props();
	let resetPasswordLoading = $state(false);
	let newPassword = $state('');

	async function resetUserPassword(event) {
		event?.preventDefault();
		if (!newPassword || newPassword.length < 6) {
			toastValidationError('Password', 'must be at least 6 characters');
			return;
		}

		resetPasswordLoading = true;

		try {
			await apiPost(
				'/api/admin/reset-password',
				{
					userId: userId,
					newPassword: newPassword
				},
				{
					loadingMessage: 'Updating user credentials',
					loadingTitle: 'Resetting password...',
					successMessage: 'Password reset successfully',
					successTitle: 'Success!'
				}
			);

			onReset?.();
			onClose?.();
			newPassword = '';
		} catch (error) {
			console.error('Error resetting password:', error);
		} finally {
			resetPasswordLoading = false;
		}
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 px-4">
		<div class="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-4 flex items-center">
					<KeyRound class="h-5 w-5 mr-2" />
					Reset User Password
				</h3>

				<form onsubmit={resetUserPassword} class="space-y-4">
					<div>
						<label for="new_password" class="block text-sm font-medium text-gray-700">
							New Password
						</label>
						<input
							type="password"
							id="new_password"
							bind:value={newPassword}
							required
							minlength="6"
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
							placeholder="Enter new password (minimum 6 characters)"
						/>
						<p class="mt-1 text-sm text-gray-500">
							The user will be able to sign in with this new password immediately.
						</p>
					</div>

					<div class="flex justify-end space-x-3 pt-4">
						<button
							type="button"
							onclick={() => {
								onClose?.();
								newPassword = '';
							}}
							disabled={resetPasswordLoading}
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={resetPasswordLoading}
							class="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:opacity-50"
						>
							{resetPasswordLoading ? 'Resetting...' : 'Reset Password'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

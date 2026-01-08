<script>
	import { apiPost } from '$lib/utils/api-handler.js';
	import {
		toastMultiStep,
		toastNextStep,
		dismissToast,
		updateToastStatus
	} from '$lib/utils/toast-helpers.js';

	let {
		isOpen = false,
		availableModules = [],
		onClose
	} = $props();

	let createUserLoading = $state(false);
	let newUser = $state({
		email: '',
		full_name: '',
		modules: [],
		sendWelcomeEmail: false
	});

	function getModuleBadgeColor(moduleId) {
		return 'bg-gray-100 text-gray-700 border border-gray-200';
	}

	async function createNewUser(event) {
		event?.preventDefault();
		createUserLoading = true;

		const toastId = toastMultiStep(
			[
				{
					title: 'Creating user...',
					message: 'Setting up new account',
					type: 'info'
				},
				{
					title: 'User created!',
					message: `${newUser.email} can now login`,
					type: 'success'
				}
			],
			false
		);

		try {
			await apiPost('/api/admin/users', newUser, {
				showToast: false
			});

			toastNextStep(toastId);

			newUser = {
				email: '',
				full_name: '',
				role: 'student',
				modules: [],
				sendWelcomeEmail: false
			};
			onClose?.();

			setTimeout(() => dismissToast(toastId), 5000);
		} catch (error) {
			console.error('Error creating user:', error);
			updateToastStatus(
				toastId,
				'error',
				error.message || 'Failed to create user',
				'Creation Failed',
				5000
			);
		} finally {
			createUserLoading = false;
		}
	}
</script>

{#if isOpen}
	<div class="fixed inset-0 bg-gray-600 bg-opacity-50 z-50 flex items-center justify-center px-4">
		<div
			class="p-5 border w-full max-w-[500px] shadow-lg rounded-md bg-white"
		>
			<div class="mt-3">
				<h3 class="text-lg font-medium text-gray-900 mb-2">Invite New User</h3>
				<p class="text-sm text-gray-600 mb-4">
					The user will be able to login immediately using their email address at /login.
				</p>

				<form onsubmit={createNewUser} class="space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium text-gray-700">Email Address</label>
						<input
							type="email"
							id="email"
							bind:value={newUser.email}
							required
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
							placeholder="user@example.com"
						/>
						<p class="mt-1 text-xs text-gray-500">
							They can login at /login with their email. System will send OTP to verify and set password.
						</p>
					</div>

					<div>
						<label for="full_name" class="block text-sm font-medium text-gray-700">Full Name</label>
						<input
							type="text"
							id="full_name"
							bind:value={newUser.full_name}
							class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2 border"
							placeholder="John Doe"
						/>
					</div>

					<div>
						<h3 class="block text-sm font-medium text-gray-700 mb-2">Module Access</h3>
						<div class="space-y-2 bg-gray-50 p-3 rounded-md border border-gray-300">
							{#each availableModules as module}
								<label class="flex items-start space-x-2 cursor-pointer">
									<input
										type="checkbox"
										checked={newUser.modules.includes(module.id)}
										onchange={() => {
											if (newUser.modules.includes(module.id)) {
												newUser.modules = newUser.modules.filter((m) => m !== module.id);
											} else {
												newUser.modules = [...newUser.modules, module.id];
											}
										}}
										class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
									/>
									<div>
										<div class="text-sm font-medium text-gray-700">{module.name}</div>
										<div class="text-xs text-gray-500">{module.description}</div>
									</div>
								</label>
							{/each}
						</div>
					</div>

					<div class="border-t border-gray-200 pt-4">
						<label class="flex items-start space-x-3 cursor-pointer">
							<input
								type="checkbox"
								bind:checked={newUser.sendWelcomeEmail}
								class="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
							/>
							<div>
								<div class="text-sm font-medium text-gray-700">Send welcome email</div>
								<div class="text-xs text-gray-500">
									Send login instructions to the user's email address. The email will include manual login steps to avoid email scanning issues.
								</div>
							</div>
						</label>
					</div>

					<div class="flex justify-end space-x-3 pt-4">
						<button
							type="button"
							onclick={() => {
								onClose?.();
								newUser = {
									email: '',
									full_name: '',
									modules: [],
									sendWelcomeEmail: false
								};
							}}
							disabled={createUserLoading}
							class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={createUserLoading}
							class="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
						>
							{createUserLoading ? 'Sending Invitation...' : 'Send Invitation'}
						</button>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}

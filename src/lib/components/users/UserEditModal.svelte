<script>
	import { X, Save, User, Mail, Phone, Building } from '$lib/icons';
	import { toastError } from '$lib/utils/toast-helpers.js';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let {
		show = false,
		user = null,
		availableModules = [],
		currentUserId = '',
		onClose = () => {},
		onUpdate = () => {}
	} = $props();

	let formData = $state({ full_name: '', email: '', phone: '', organization: '', modules: [] });
	let isLoading = $state(false);
	let showMergeConfirm = $state(false);
	let pendingSave = $state(false);

	$effect(() => {
		if (user && show) {
			formData = {
				full_name: user.full_name || '',
				email: user.email || '',
				phone: user.phone || '',
				organization: user.organization || '',
				modules: [...(user.modules || [])]
			};
		}
	});

	function toggleModule(moduleId) {
		if (formData.modules.includes(moduleId)) {
			formData.modules = formData.modules.filter((m) => m !== moduleId);
		} else {
			formData.modules = [...formData.modules, moduleId];
		}
	}

	async function handleSave() {
		if (!user) return;

		if (formData.email !== user.email && !pendingSave) {
			const res = await fetch(
				`/api/admin/users?action=check_email&email=${encodeURIComponent(formData.email)}&excludeId=${user.id}`
			);
			const { exists } = await res.json();
			if (exists) {
				showMergeConfirm = true;
				return;
			}
		}
		pendingSave = false;
		isLoading = true;

		try {
			const res = await fetch('/api/admin/users', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					userId: user.id,
					action: 'update_details',
					full_name: formData.full_name || null,
					email: formData.email,
					phone: formData.phone || null,
					organization: formData.organization || null,
					modules: formData.modules
				})
			});

			const result = await res.json();
			if (!res.ok) throw new Error(result.message || 'Failed to update user');

			onUpdate({ ...user, ...formData });
			onClose();
		} catch (err) {
			toastError(err.message || 'Failed to update user');
		} finally {
			isLoading = false;
		}
	}
</script>

{#if show && user}
	<!-- Backdrop -->
	<div
		class="fixed inset-0 bg-black/50 z-40"
		role="button"
		tabindex="-1"
		onclick={onClose}
		onkeydown={(e) => e.key === 'Escape' && onClose()}
		aria-label="Close modal"
	></div>

	<!-- Modal -->
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
		<div class="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
			<!-- Header -->
			<div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
				<h2 class="text-lg font-semibold text-gray-900">Edit User</h2>
				<button onclick={onClose} class="p-1 rounded hover:bg-gray-100 transition-colors">
					<X class="h-5 w-5 text-gray-500" />
				</button>
			</div>

			<!-- Body -->
			<div class="px-6 py-5 space-y-5">
				<!-- Full Name -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1" for="edit-full-name">
						Full Name
					</label>
					<div class="relative">
						<User class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
						<input
							id="edit-full-name"
							type="text"
							bind:value={formData.full_name}
							class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Full name"
						/>
					</div>
				</div>

				<!-- Email -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1" for="edit-email">
						Email Address
					</label>
					<div class="relative">
						<Mail class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
						<input
							id="edit-email"
							type="email"
							bind:value={formData.email}
							class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Email address"
						/>
					</div>
				</div>

				<!-- Phone -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1" for="edit-phone">
						Phone
					</label>
					<div class="relative">
						<Phone class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
						<input
							id="edit-phone"
							type="tel"
							bind:value={formData.phone}
							class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Phone number"
						/>
					</div>
				</div>

				<!-- Organisation -->
				<div>
					<label class="block text-sm font-medium text-gray-700 mb-1" for="edit-org">
						Organisation
					</label>
					<div class="relative">
						<Building class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
						<input
							id="edit-org"
							type="text"
							bind:value={formData.organization}
							class="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="Organisation"
						/>
					</div>
				</div>

				<!-- Modules -->
				<div>
					<p class="block text-sm font-medium text-gray-700 mb-2">Platform Permissions</p>
					<div class="flex flex-wrap gap-2">
						{#each availableModules as module}
							{@const isActive = formData.modules.includes(module.id)}
							{@const isSelfAdmin = user.id === currentUserId && module.id === 'platform.admin'}
							<button
								type="button"
								onclick={() => toggleModule(module.id)}
								disabled={isSelfAdmin}
								title={isSelfAdmin ? "Can't remove your own admin access" : module.description}
								class="px-3 py-1 rounded-full border text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500"
								class:bg-gray-900={isActive}
								class:text-white={isActive}
								class:border-gray-900={isActive}
								class:bg-gray-100={!isActive}
								class:text-gray-600={!isActive}
								class:border-gray-300={!isActive}
								class:opacity-50={isSelfAdmin}
								class:cursor-not-allowed={isSelfAdmin}
							>
								{module.name}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Footer -->
			<div class="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
				<button
					onclick={onClose}
					class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
				>
					Cancel
				</button>
				<button
					onclick={handleSave}
					disabled={isLoading}
					class="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
				>
					<Save class="h-4 w-4" />
					{isLoading ? 'Saving…' : 'Save Changes'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Account Merge Confirmation -->
<ConfirmationModal
	show={showMergeConfirm}
	title="Account Merge Required"
	confirmText="Yes, Merge Accounts"
	cancelText="Cancel"
	onConfirm={() => { showMergeConfirm = false; pendingSave = true; handleSave(); }}
	onCancel={() => { showMergeConfirm = false; }}
>
	<p>An account already exists for <strong>{formData.email}</strong>.</p>
	<p class="mt-2">Proceeding will <strong>merge both accounts</strong> — all enrollments will be moved to whichever account was most recently active, and the other account will be deleted.</p>
	<p class="mt-2">The user should log in using their existing credentials for <strong>{formData.email}</strong>.</p>
</ConfirmationModal>

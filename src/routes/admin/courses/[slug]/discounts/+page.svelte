<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { formatPrice } from '$lib/utils/enrollment-links';
	import { apiPost, apiDelete } from '$lib/utils/api-handler.js';
	import { Plus, Trash2, Check, X, Tag, Calendar, Users } from '$lib/icons';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let { data } = $props();

	// Modal state
	let showCreateModal = $state(false);
	let showDeleteConfirm = $state(false);
	let codeToDelete = $state<string | null>(null);

	// Create form state
	let code = $state('');
	let discountType = $state<'percentage' | 'fixed'>('percentage');
	let discountValue = $state('');
	let cohortId = $state('');
	let maxUses = $state('');
	let expiresAt = $state('');
	let isCreating = $state(false);

	function resetCreateForm() {
		code = '';
		discountType = 'percentage';
		discountValue = '';
		cohortId = '';
		maxUses = '';
		expiresAt = '';
	}

	async function handleCreate() {
		if (!code.trim()) {
			toastError('Please enter a code');
			return;
		}
		if (!discountValue || parseFloat(discountValue) <= 0) {
			toastError('Please enter a valid discount value');
			return;
		}
		if (discountType === 'percentage' && parseFloat(discountValue) > 100) {
			toastError('Percentage cannot exceed 100%');
			return;
		}

		isCreating = true;

		try {
			await apiPost(`/admin/courses/${$page.params.slug}/discounts/api`, {
				action: 'create',
				code: code.trim().toUpperCase(),
				discountType,
				discountValue:
					discountType === 'percentage'
						? parseInt(discountValue)
						: Math.round(parseFloat(discountValue) * 100),
				cohortId: cohortId || null,
				maxUses: maxUses ? parseInt(maxUses) : null,
				expiresAt: expiresAt || null
			});

			toastSuccess('Discount code created');
			showCreateModal = false;
			resetCreateForm();
			invalidateAll();
		} catch (err) {
			toastError(err instanceof Error ? err.message : 'Failed to create discount code');
		} finally {
			isCreating = false;
		}
	}

	async function toggleCodeActive(codeId: string, currentActive: boolean) {
		try {
			await apiPost(`/admin/courses/${$page.params.slug}/discounts/api`, {
				action: 'toggle',
				codeId,
				isActive: !currentActive
			});

			toastSuccess(currentActive ? 'Code deactivated' : 'Code activated');
			invalidateAll();
		} catch (err) {
			toastError(err instanceof Error ? err.message : 'Failed to update code');
		}
	}

	async function deleteCode() {
		if (!codeToDelete) return;

		try {
			await apiDelete(`/admin/courses/${$page.params.slug}/discounts/api?codeId=${codeToDelete}`);

			toastSuccess('Discount code deleted');
			showDeleteConfirm = false;
			codeToDelete = null;
			invalidateAll();
		} catch (err) {
			toastError(err instanceof Error ? err.message : 'Failed to delete code');
		}
	}

	function formatDiscount(type: string, value: number): string {
		if (type === 'percentage') {
			return `${value}% off`;
		}
		return `${formatPrice(value, 'AUD')} off`;
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return 'Never';
		return new Date(dateString).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}

	function getCohortName(discountCode: any): string {
		if (!discountCode.cohort_id) return 'All cohorts';
		return discountCode.cohort
			? `${discountCode.cohort.module.name} - ${discountCode.cohort.name}`
			: 'Unknown cohort';
	}
</script>

<svelte:head>
	<title>Discount Codes | {data.courseInfo.name}</title>
</svelte:head>

<div class="min-h-screen p-3 sm:p-4 lg:p-6" style="background-color: var(--course-accent-dark);">
	<div class="max-w-4xl mx-auto">
		<!-- Header -->
		<div class="mb-4 sm:mb-6 lg:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">Discount Codes</h1>
				<p class="text-sm sm:text-base text-white/70">
					Create promotional codes for course enrollments
				</p>
			</div>
			<button
				onclick={() => (showCreateModal = true)}
				class="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 sm:py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]"
				style="background-color: var(--course-accent-light);"
			>
				<Plus class="h-4 w-4" />
				Create Code
			</button>
		</div>

		<!-- Content Card -->
		<div class="bg-white rounded-lg shadow-lg">
			<div class="p-4 sm:p-5 lg:p-6">
				{#if data.discountCodes.length === 0}
					<div class="rounded-lg border border-dashed border-gray-300 p-8 sm:p-12 text-center">
						<Tag class="mx-auto h-12 w-12 text-gray-400" />
						<h3 class="mt-4 text-lg font-medium text-gray-900">No discount codes</h3>
						<p class="mt-2 text-sm text-gray-500">
							Create codes to offer discounts on course enrollments.
						</p>
						<button
							onclick={() => (showCreateModal = true)}
							class="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 sm:py-2 text-sm font-medium text-white hover:opacity-90 min-h-[44px]"
							style="background-color: var(--course-accent-light);"
						>
							<Plus class="h-4 w-4" />
							Create Code
						</button>
					</div>
				{:else}
					<div class="space-y-4">
						{#each data.discountCodes as discountCode}
							<div
								class="rounded-lg border p-4 transition-shadow hover:shadow-md"
								class:border-gray-200={discountCode.is_active}
								class:bg-white={discountCode.is_active}
								class:border-red-200={!discountCode.is_active}
								class:bg-red-50={!discountCode.is_active}
							>
								<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
									<!-- Code info -->
									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center gap-2 sm:gap-3">
											<code
												class="rounded bg-gray-100 px-3 py-1 text-base sm:text-lg font-bold tracking-wider text-gray-900"
											>
												{discountCode.code}
											</code>
											<span
												class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-sm font-medium"
												class:bg-green-100={discountCode.discount_type === 'percentage'}
												class:text-green-700={discountCode.discount_type === 'percentage'}
												class:bg-blue-100={discountCode.discount_type === 'fixed'}
												class:text-blue-700={discountCode.discount_type === 'fixed'}
											>
												{formatDiscount(discountCode.discount_type, discountCode.discount_value)}
											</span>
											{#if !discountCode.is_active}
												<span class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
													Inactive
												</span>
											{/if}
										</div>

										<!-- Stats -->
										<div class="mt-2 flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-500">
											<span class="flex items-center gap-1">
												<Tag class="h-4 w-4" />
												{getCohortName(discountCode)}
											</span>
											<span class="flex items-center gap-1">
												<Users class="h-4 w-4" />
												{discountCode.uses_count}{discountCode.max_uses
													? ` / ${discountCode.max_uses}`
													: ''} uses
											</span>
											{#if discountCode.expires_at}
												<span class="flex items-center gap-1">
													<Calendar class="h-4 w-4" />
													Expires: {formatDate(discountCode.expires_at)}
												</span>
											{/if}
										</div>
									</div>

									<!-- Actions -->
									<div class="flex items-center gap-2">
										<button
											onclick={() => toggleCodeActive(discountCode.id, discountCode.is_active)}
											class="rounded p-2 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
											class:text-green-600={discountCode.is_active}
											class:text-gray-400={!discountCode.is_active}
											title={discountCode.is_active ? 'Deactivate' : 'Activate'}
										>
											{#if discountCode.is_active}
												<Check class="h-5 w-5" />
											{:else}
												<X class="h-5 w-5" />
											{/if}
										</button>
										<button
											onclick={() => {
												codeToDelete = discountCode.id;
												showDeleteConfirm = true;
											}}
											class="rounded p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
											title="Delete"
										>
											<Trash2 class="h-5 w-5" />
										</button>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

<!-- Create Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
			<h2 class="mb-4 text-xl font-bold text-gray-900">Create Discount Code</h2>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleCreate();
				}}
				class="space-y-4"
			>
				<!-- Code -->
				<div>
					<label for="code" class="mb-1 block text-sm font-medium text-gray-700">
						Code <span class="text-red-500">*</span>
					</label>
					<input
						type="text"
						id="code"
						bind:value={code}
						placeholder="e.g., EARLYBIRD, STMARYS25"
						class="block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono uppercase"
						required
					/>
					<p class="mt-1 text-xs text-gray-500">
						This is what customers will enter at checkout
					</p>
				</div>

				<!-- Discount type -->
				<div>
					<label class="mb-1 block text-sm font-medium text-gray-700">
						Discount Type <span class="text-red-500">*</span>
					</label>
					<div class="flex gap-4">
						<label class="flex items-center gap-2">
							<input
								type="radio"
								name="discountType"
								value="percentage"
								bind:group={discountType}
								class="h-4 w-4 text-blue-600"
							/>
							<span>Percentage off</span>
						</label>
						<label class="flex items-center gap-2">
							<input
								type="radio"
								name="discountType"
								value="fixed"
								bind:group={discountType}
								class="h-4 w-4 text-blue-600"
							/>
							<span>Fixed amount off</span>
						</label>
					</div>
				</div>

				<!-- Discount value -->
				<div>
					<label for="discountValue" class="mb-1 block text-sm font-medium text-gray-700">
						{discountType === 'percentage' ? 'Percentage' : 'Amount'} <span class="text-red-500">*</span
						>
					</label>
					<div class="relative">
						{#if discountType === 'fixed'}
							<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
						{/if}
						<input
							type="number"
							id="discountValue"
							bind:value={discountValue}
							min="1"
							max={discountType === 'percentage' ? 100 : undefined}
							step={discountType === 'fixed' ? '0.01' : '1'}
							placeholder={discountType === 'percentage' ? 'e.g., 25' : 'e.g., 50.00'}
							class="block w-full rounded-lg border border-gray-300 py-2 pr-3"
							class:pl-8={discountType === 'fixed'}
							class:pl-3={discountType !== 'fixed'}
							required
						/>
						{#if discountType === 'percentage'}
							<span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
						{/if}
					</div>
				</div>

				<!-- Cohort scope -->
				<div>
					<label for="cohort" class="mb-1 block text-sm font-medium text-gray-700">
						Applies To
					</label>
					<select
						id="cohort"
						bind:value={cohortId}
						class="block w-full rounded-lg border border-gray-300 px-3 py-2"
					>
						<option value="">All cohorts in this course</option>
						{#each data.cohorts as cohort}
							<option value={cohort.id}>{cohort.module.name} - {cohort.name}</option>
						{/each}
					</select>
				</div>

				<!-- Max uses -->
				<div>
					<label for="maxUses" class="mb-1 block text-sm font-medium text-gray-700">
						Max Uses (optional)
					</label>
					<input
						type="number"
						id="maxUses"
						bind:value={maxUses}
						min="1"
						placeholder="Unlimited"
						class="block w-full rounded-lg border border-gray-300 px-3 py-2"
					/>
				</div>

				<!-- Expiry -->
				<div>
					<label for="expires" class="mb-1 block text-sm font-medium text-gray-700">
						Expires On (optional)
					</label>
					<input
						type="date"
						id="expires"
						bind:value={expiresAt}
						min={new Date().toISOString().split('T')[0]}
						class="block w-full rounded-lg border border-gray-300 px-3 py-2"
					/>
				</div>

				<!-- Actions -->
				<div class="flex justify-end gap-3 pt-4">
					<button
						type="button"
						onclick={() => {
							showCreateModal = false;
							resetCreateForm();
						}}
						class="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isCreating}
						class="rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
						style="background-color: var(--course-accent-light);"
					>
						{isCreating ? 'Creating...' : 'Create Code'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation -->
<ConfirmationModal
	show={showDeleteConfirm}
	onConfirm={deleteCode}
	onCancel={() => {
		showDeleteConfirm = false;
		codeToDelete = null;
	}}
	confirmText="Delete"
	confirmClass="bg-red-600 hover:bg-red-700"
>
	<p>Are you sure you want to delete this discount code?</p>
	<p class="mt-2 text-sm text-gray-500">
		The code will no longer work at checkout. This will also deactivate the code in Stripe.
	</p>
</ConfirmationModal>

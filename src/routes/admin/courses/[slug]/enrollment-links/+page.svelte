<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/stores';
	import { PUBLIC_SITE_URL } from '$env/static/public';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { formatPrice } from '$lib/utils/enrollment-links';
	import { apiPost, apiDelete } from '$lib/utils/api-handler.js';
	import {
		Plus,
		Copy,
		Link,
		ExternalLink,
		Trash2,
		Check,
		X,
		MapPin,
		Calendar,
		Users
	} from '$lib/icons';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let { data } = $props();

	// Modal state
	let showCreateModal = $state(false);
	let showDeleteConfirm = $state(false);
	let linkToDelete = $state<string | null>(null);

	// Create form state
	let selectedCohortId = $state('');
	let selectedHubId = $state('');
	let linkName = $state('');
	let customPrice = $state('');
	let maxUses = $state('');
	let expiresAt = $state('');
	let isCreating = $state(false);

	// Filter state
	let filterCohortId = $state('');

	// Computed
	let filteredLinks = $derived(
		filterCohortId
			? data.enrollmentLinks.filter((l) => l.cohort_id === filterCohortId)
			: data.enrollmentLinks
	);

	let selectedCohort = $derived(data.cohorts.find((c) => c.id === selectedCohortId));

	function getEnrollmentUrl(code: string): string {
		return `${PUBLIC_SITE_URL}/enroll/${code}`;
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			toastSuccess('Link copied to clipboard');
		} catch {
			toastError('Failed to copy link');
		}
	}

	function resetCreateForm() {
		selectedCohortId = '';
		selectedHubId = '';
		linkName = '';
		customPrice = '';
		maxUses = '';
		expiresAt = '';
	}

	async function handleCreate() {
		if (!selectedCohortId) {
			toastError('Please select a cohort');
			return;
		}

		isCreating = true;

		try {
			await apiPost(`/admin/courses/${$page.params.slug}/enrollment-links/api`, {
				action: 'create',
				cohortId: selectedCohortId,
				hubId: selectedHubId || null,
				name: linkName || null,
				priceCents: customPrice ? Math.round(parseFloat(customPrice) * 100) : null,
				maxUses: maxUses ? parseInt(maxUses) : null,
				expiresAt: expiresAt || null
			});

			toastSuccess('Enrollment link created');
			showCreateModal = false;
			resetCreateForm();
			invalidateAll();
		} catch (err) {
			toastError(err instanceof Error ? err.message : 'Failed to create link');
		} finally {
			isCreating = false;
		}
	}

	async function toggleLinkActive(linkId: string, currentActive: boolean) {
		try {
			await apiPost(`/admin/courses/${$page.params.slug}/enrollment-links/api`, {
				action: 'toggle',
				linkId,
				isActive: !currentActive
			});

			toastSuccess(currentActive ? 'Link deactivated' : 'Link activated');
			invalidateAll();
		} catch (err) {
			toastError(err instanceof Error ? err.message : 'Failed to update link');
		}
	}

	async function deleteLink() {
		if (!linkToDelete) return;

		try {
			await apiDelete(
				`/admin/courses/${$page.params.slug}/enrollment-links/api?linkId=${linkToDelete}`
			);

			toastSuccess('Link deleted');
			showDeleteConfirm = false;
			linkToDelete = null;
			invalidateAll();
		} catch (err) {
			toastError(err instanceof Error ? err.message : 'Failed to delete link');
		}
	}

	function getCohortName(cohortId: string): string {
		const cohort = data.cohorts.find((c) => c.id === cohortId);
		return cohort ? `${cohort.module.name} - ${cohort.name}` : 'Unknown';
	}

	function formatDate(dateString: string | null): string {
		if (!dateString) return 'Never';
		return new Date(dateString).toLocaleDateString('en-AU', {
			day: 'numeric',
			month: 'short',
			year: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>Enrollment Links | {data.courseInfo.name}</title>
</svelte:head>

<div class="min-h-screen p-3 sm:p-4 lg:p-6" style="background-color: var(--course-accent-dark);">
	<div class="max-w-4xl mx-auto">
		<!-- Header -->
		<div class="mb-4 sm:mb-6 lg:mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div>
				<h1 class="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1 sm:mb-2">Enrollment Links</h1>
				<p class="text-sm sm:text-base text-white/70">
					Create and manage public sign-up links for your courses
				</p>
			</div>
			<button
				onclick={() => (showCreateModal = true)}
				class="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 sm:py-2 text-sm font-medium text-white min-h-[44px]"
				style="background-color: var(--course-accent-light);"
			>
				<Plus class="h-4 w-4" />
				Create Link
			</button>
		</div>

		<!-- Content Card -->
		<div class="bg-white rounded-lg shadow-lg">
			<!-- Filters -->
			{#if data.cohorts.length > 1}
				<div class="p-4 sm:p-5 lg:p-6 border-b border-gray-200">
					<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
						<label for="filterCohort" class="text-sm font-medium text-gray-700">Filter by cohort:</label>
						<select
							id="filterCohort"
							bind:value={filterCohortId}
							class="rounded-lg border border-gray-300 px-3 py-2 text-sm"
						>
							<option value="">All cohorts</option>
							{#each data.cohorts as cohort}
								<option value={cohort.id}>{cohort.module.name} - {cohort.name}</option>
							{/each}
						</select>
					</div>
				</div>
			{/if}

			<!-- Links list -->
			<div class="p-4 sm:p-5 lg:p-6">
				{#if filteredLinks.length === 0}
					<div class="rounded-lg border border-dashed border-gray-300 p-8 sm:p-12 text-center">
						<Link class="mx-auto h-12 w-12 text-gray-400" />
						<h3 class="mt-4 text-lg font-medium text-gray-900">No enrollment links</h3>
						<p class="mt-2 text-sm text-gray-500">
							Create a link to allow people to self-enroll in your courses.
						</p>
						<button
							onclick={() => (showCreateModal = true)}
							class="mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2.5 sm:py-2 text-sm font-medium text-white min-h-[44px] hover:opacity-90"
							style="background-color: var(--course-accent-light);"
						>
							<Plus class="h-4 w-4" />
							Create Link
						</button>
					</div>
				{:else}
					<div class="space-y-4">
						{#each filteredLinks as link}
							{@const cohort = data.cohorts.find((c) => c.id === link.cohort_id)}
							<div
								class="rounded-lg border p-4 transition-shadow hover:shadow-md"
								class:border-gray-200={link.is_active}
								class:bg-white={link.is_active}
								class:border-red-200={!link.is_active}
								class:bg-red-50={!link.is_active}
							>
								<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
									<!-- Link info -->
									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center gap-2">
											<h3 class="font-medium text-gray-900">
												{link.name || getCohortName(link.cohort_id)}
											</h3>
											{#if link.hub}
												<span
													class="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
												>
													<MapPin class="h-3 w-3" />
													{link.hub.name}
												</span>
											{/if}
											{#if !link.is_active}
												<span
													class="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
												>
													Inactive
												</span>
											{/if}
										</div>

										<!-- URL -->
										<div class="mt-2 flex flex-wrap items-center gap-2">
											<code class="rounded bg-gray-100 px-2 py-1 text-xs sm:text-sm text-gray-700 break-all">
												{getEnrollmentUrl(link.code)}
											</code>
											<div class="flex items-center gap-1">
												<button
													onclick={() => copyToClipboard(getEnrollmentUrl(link.code))}
													class="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
													title="Copy link"
												>
													<Copy class="h-4 w-4" />
												</button>
												<a
													href={getEnrollmentUrl(link.code)}
													target="_blank"
													rel="noopener noreferrer"
													class="rounded p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 min-h-[44px] min-w-[44px] flex items-center justify-center"
													title="Open link"
												>
													<ExternalLink class="h-4 w-4" />
												</a>
											</div>
										</div>

										<!-- Stats -->
										<div class="mt-2 flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-gray-500">
											<span class="flex items-center gap-1">
												<Users class="h-4 w-4" />
												{link.uses_count}{link.max_uses ? ` / ${link.max_uses}` : ''} uses
											</span>
											{#if link.expires_at}
												<span class="flex items-center gap-1">
													<Calendar class="h-4 w-4" />
													Expires: {formatDate(link.expires_at)}
												</span>
											{/if}
											{#if link.price_cents !== null}
												<span class="font-medium text-green-600">
													{formatPrice(link.price_cents, cohort?.currency || 'AUD')}
												</span>
											{:else if cohort?.is_free}
												<span class="font-medium text-green-600">Free</span>
											{:else if cohort?.price_cents}
												<span class="text-gray-600">
													{formatPrice(cohort.price_cents, cohort.currency || 'AUD')}
												</span>
											{/if}
										</div>
									</div>

									<!-- Actions -->
									<div class="flex items-center gap-2">
										<button
											onclick={() => toggleLinkActive(link.id, link.is_active)}
											class="rounded p-2 hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
											class:text-green-600={link.is_active}
											class:text-gray-400={!link.is_active}
											title={link.is_active ? 'Deactivate' : 'Activate'}
										>
											{#if link.is_active}
												<Check class="h-5 w-5" />
											{:else}
												<X class="h-5 w-5" />
											{/if}
										</button>
										<button
											onclick={() => {
												linkToDelete = link.id;
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
			<h2 class="mb-4 text-xl font-bold text-gray-900">Create Enrollment Link</h2>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleCreate();
				}}
				class="space-y-4"
			>
				<!-- Cohort selection -->
				<div>
					<label for="cohort" class="mb-1 block text-sm font-medium text-gray-700">
						Cohort <span class="text-red-500">*</span>
					</label>
					<select
						id="cohort"
						bind:value={selectedCohortId}
						required
						class="block w-full rounded-lg border border-gray-300 px-3 py-2"
					>
						<option value="">Select a cohort</option>
						{#each data.cohorts as cohort}
							<option value={cohort.id}>{cohort.module.name} - {cohort.name}</option>
						{/each}
					</select>
				</div>

				<!-- Hub selection (optional) -->
				{#if data.hubs.length > 0}
					<div>
						<label for="hub" class="mb-1 block text-sm font-medium text-gray-700">
							Hub (optional)
						</label>
						<select
							id="hub"
							bind:value={selectedHubId}
							class="block w-full rounded-lg border border-gray-300 px-3 py-2"
						>
							<option value="">General link (no hub)</option>
							{#each data.hubs as hub}
								<option value={hub.id}>{hub.name}</option>
							{/each}
						</select>
						<p class="mt-1 text-xs text-gray-500">
							Hub-specific links auto-assign enrollees to that hub
						</p>
					</div>
				{/if}

				<!-- Link name (optional) -->
				<div>
					<label for="name" class="mb-1 block text-sm font-medium text-gray-700">
						Link Name (optional)
					</label>
					<input
						type="text"
						id="name"
						bind:value={linkName}
						placeholder="e.g., Early Bird Special"
						class="block w-full rounded-lg border border-gray-300 px-3 py-2"
					/>
					<p class="mt-1 text-xs text-gray-500">A friendly name to identify this link</p>
				</div>

				<!-- Custom price (optional) -->
				<div>
					<label for="price" class="mb-1 block text-sm font-medium text-gray-700">
						Custom Price (optional)
					</label>
					<div class="relative">
						<span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
						<input
							type="number"
							id="price"
							bind:value={customPrice}
							step="0.01"
							min="0"
							placeholder={selectedCohort?.price_cents
								? (selectedCohort.price_cents / 100).toFixed(2)
								: '0.00'}
							class="block w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3"
						/>
					</div>
					<p class="mt-1 text-xs text-gray-500">
						Leave empty to use cohort price ({selectedCohort?.is_free
							? 'Free'
							: selectedCohort?.price_cents
								? formatPrice(selectedCohort.price_cents, selectedCohort.currency || 'AUD')
								: 'Not set'})
					</p>
				</div>

				<!-- Max uses (optional) -->
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

				<!-- Expiry date (optional) -->
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
						disabled={isCreating || !selectedCohortId}
						class="rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
						style="background-color: var(--course-accent-light);"
					>
						{isCreating ? 'Creating...' : 'Create Link'}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Delete Confirmation -->
<ConfirmationModal
	show={showDeleteConfirm}
	onConfirm={deleteLink}
	onCancel={() => {
		showDeleteConfirm = false;
		linkToDelete = null;
	}}
	confirmText="Delete"
	confirmClass="bg-red-600 hover:bg-red-700"
>
	<p>Are you sure you want to delete this enrollment link?</p>
	<p class="mt-2 text-sm text-gray-500">
		This will not affect existing enrollments, but the link will no longer work.
	</p>
</ConfirmationModal>

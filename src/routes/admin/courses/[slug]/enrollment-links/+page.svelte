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
		MapPin,
		Tag,
		Clock,
		Star,
		Users
	} from '$lib/icons';
	import ConfirmationModal from '$lib/components/ConfirmationModal.svelte';

	let { data } = $props();

	const courseFeatures = $derived(data.courseFeatures || {});

	// Modal state
	let showCreateModal = $state(false);
	let showDeleteConfirm = $state(false);
	let linkToDelete = $state<string | null>(null);

	// Create form state
	let selectedCohortId = $state('');
	let selectedHubId = $state('');
	let showHubSelector = $state(false);
	let linkName = $state('');
	let customPrice = $state('');
	let maxUses = $state('');
	let bypassEnrollmentWindow = $state(false);
	let isCreating = $state(false);

	// Filter state
	let filterCohortId = $state('');

	const MAIN_LINK_NAME = 'Main link';

	// A "main link" is the canonical, override-free link for a cohort.
	function isMainLink(link: any): boolean {
		return (
			link.name === MAIN_LINK_NAME &&
			link.hub_id === null &&
			link.price_cents === null &&
			link.bypass_enrollment_window === false &&
			link.show_hub_selector !== true
		);
	}

	let filteredLinks = $derived(
		filterCohortId
			? data.enrollmentLinks.filter((l) => l.cohort_id === filterCohortId)
			: data.enrollmentLinks
	);

	// Cohorts to show, respecting the filter
	let visibleCohorts = $derived(
		filterCohortId ? data.cohorts.filter((c) => c.id === filterCohortId) : data.cohorts
	);

	let selectedCohort = $derived(data.cohorts.find((c) => c.id === selectedCohortId));

	function mainLinkFor(cohortId: string) {
		return filteredLinks.find((l) => l.cohort_id === cohortId && isMainLink(l));
	}

	function additionalLinksFor(cohortId: string) {
		return filteredLinks.filter((l) => l.cohort_id === cohortId && !isMainLink(l));
	}

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
		selectedHubId = '';
		showHubSelector = false;
		linkName = '';
		customPrice = '';
		maxUses = '';
		bypassEnrollmentWindow = false;
	}

	function openCreateModal(cohortId?: string) {
		selectedCohortId = cohortId || filterCohortId || '';
		resetCreateForm();
		showCreateModal = true;
	}

	async function handleCreate() {
		if (!selectedCohortId) {
			toastError('Please select a cohort');
			return;
		}

		isCreating = true;

		try {
			// Price override: an entered value (incl. 0 for scholarships) overrides the
			// cohort price; empty inherits the cohort price (null).
			const hasPriceOverride =
				courseFeatures.acceptPayments && customPrice !== '' && customPrice !== null;

			await apiPost(
				`/admin/courses/${$page.params.slug}/enrollment-links/api`,
				{
					action: 'create',
					cohortId: selectedCohortId,
					hubId: showHubSelector ? null : selectedHubId || null,
					showHubSelector,
					name: linkName || null,
					priceCents: hasPriceOverride ? Math.round(parseFloat(customPrice) * 100) : null,
					maxUses: maxUses ? parseInt(maxUses) : null,
					bypassEnrollmentWindow
				},
				{ successMessage: 'Enrollment link created' }
			);

			showCreateModal = false;
			resetCreateForm();
			invalidateAll();
		} catch {
			// apiPost already surfaces the error toast.
		} finally {
			isCreating = false;
		}
	}

	async function toggleLinkActive(linkId: string, currentActive: boolean) {
		try {
			await apiPost(
				`/admin/courses/${$page.params.slug}/enrollment-links/api`,
				{
					action: 'toggle',
					linkId,
					isActive: !currentActive
				},
				{ successMessage: currentActive ? 'Link deactivated' : 'Link activated' }
			);

			invalidateAll();
		} catch {
			// apiPost already surfaces the error toast.
		}
	}

	async function deleteLink() {
		if (!linkToDelete) return;

		try {
			await apiDelete(
				`/admin/courses/${$page.params.slug}/enrollment-links/api?linkId=${linkToDelete}`,
				null,
				{ successMessage: 'Link deleted' }
			);

			showDeleteConfirm = false;
			linkToDelete = null;
			invalidateAll();
		} catch {
			// apiDelete already surfaces the error toast.
		}
	}

	function getCohortName(cohortId: string): string {
		const cohort = data.cohorts.find((c) => c.id === cohortId);
		return cohort ? `${cohort.module.name} - ${cohort.name}` : 'Unknown';
	}

	// Only show a link title when it's a meaningful custom name — not "Main link"
	// and not the auto-generated cohort name (which is already the card header).
	function customName(link: any): string | null {
		const n = (link.name || '').trim();
		if (!n || n === MAIN_LINK_NAME || n === getCohortName(link.cohort_id)) return null;
		return n;
	}

	// Human-readable description of the cohort's default price
	function cohortPriceLabel(cohort: any): string {
		if (!cohort) return 'Not set';
		if (!cohort.price_cents || cohort.price_cents <= 0) return 'Free';
		return formatPrice(cohort.price_cents, cohort.currency || 'AUD');
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
					Each cohort has one main link to hand out. Create additional links to override the hub, price, or enrollment window.
				</p>
			</div>
			<button
				onclick={() => openCreateModal()}
				class="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 sm:py-2 text-sm font-medium text-white min-h-[44px]"
				style="background-color: var(--course-accent-light);"
			>
				<Plus class="h-4 w-4" />
				Create Link
			</button>
		</div>

		<!-- Filters -->
		{#if data.cohorts.length > 1}
			<div class="mb-4 rounded-lg bg-white/10 p-3 sm:p-4">
				<div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
					<label for="filterCohort" class="text-sm font-medium text-white">Filter by cohort:</label>
					<select
						id="filterCohort"
						bind:value={filterCohortId}
						class="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
					>
						<option value="">All cohorts</option>
						{#each data.cohorts as cohort}
							<option value={cohort.id}>{cohort.module.name} - {cohort.name}</option>
						{/each}
					</select>
				</div>
			</div>
		{/if}

		{#if visibleCohorts.length === 0}
			<div class="rounded-lg bg-white p-8 sm:p-12 text-center shadow-lg">
				<Link class="mx-auto h-12 w-12 text-gray-400" />
				<h3 class="mt-4 text-lg font-medium text-gray-900">No cohorts yet</h3>
				<p class="mt-2 text-sm text-gray-500">Create a cohort first to manage its enrollment links.</p>
			</div>
		{:else}
			<div class="space-y-6">
				{#each visibleCohorts as cohort (cohort.id)}
					{@const mainLink = mainLinkFor(cohort.id)}
					{@const additional = additionalLinksFor(cohort.id)}
					<div class="rounded-lg bg-white shadow-lg">
						<!-- Cohort header -->
						<div class="flex flex-col gap-2 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
							<div>
								<h2 class="text-base font-semibold text-gray-900 sm:text-lg">
									{cohort.module.name} - {cohort.name}
								</h2>
								<p class="text-xs text-gray-500">
									Cohort price: {cohortPriceLabel(cohort)}
								</p>
							</div>
							<button
								onclick={() => openCreateModal(cohort.id)}
								class="inline-flex items-center justify-center gap-2 self-start rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 sm:self-auto"
							>
								<Plus class="h-4 w-4" />
								Add link
							</button>
						</div>

						<div class="space-y-4 p-4 sm:p-5">
							<!-- Main link -->
							{#if mainLink}
								<div>
									<div class="mb-2 flex items-center gap-2">
										<Star class="h-4 w-4" style="color: var(--course-accent-dark);" />
										<h3 class="text-sm font-semibold text-gray-900">Main link</h3>
										<span class="text-xs text-gray-500">— the one to hand out</span>
									</div>
									<div
										class="rounded-lg border p-4"
										class:opacity-60={!mainLink.is_active}
										style="border-color: color-mix(in srgb, var(--course-accent-dark) 25%, white); background-color: color-mix(in srgb, var(--course-accent-dark) 5%, white);"
									>
										{@render linkBody(mainLink, cohort)}
									</div>
								</div>
							{/if}

							<!-- Additional links -->
							{#if additional.length > 0}
								<div>
									<h3 class="mb-2 text-sm font-semibold text-gray-900">Additional links</h3>
									<div class="space-y-3">
										{#each additional as link (link.id)}
											<div
												class="rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-sm"
												class:opacity-60={!link.is_active}
											>
												{@render linkBody(link, cohort)}
											</div>
										{/each}
									</div>
								</div>
							{:else if mainLink}
								<p class="text-xs text-gray-400">
									No additional links. Use “Add link” to override hub, price, or late access.
								</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

{#snippet linkBody(link: any, cohort: any)}
	<div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
		<!-- Link info -->
		<div class="min-w-0 flex-1">
			{#if customName(link) || link.hub || link.show_hub_selector || link.price_cents !== null || link.bypass_enrollment_window}
				<div class="flex flex-wrap items-center gap-1.5">
					{#if customName(link)}
						<h4 class="mr-1 font-medium text-gray-900">{customName(link)}</h4>
					{/if}
					<!-- Override badges — neutral by default, with a light brand tint on price -->
					{#if link.hub}
						<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
							<MapPin class="h-3 w-3 text-gray-400" />
							{link.hub.name}
						</span>
					{/if}
					{#if link.show_hub_selector}
						<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
							<MapPin class="h-3 w-3 text-gray-400" />
							Hub choice
						</span>
					{/if}
					{#if link.price_cents !== null}
						<span
							class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
							style="background-color: color-mix(in srgb, var(--course-accent-dark) 10%, white); color: color-mix(in srgb, var(--course-accent-dark) 78%, black);"
						>
							<Tag class="h-3 w-3" />
							{#if link.price_cents <= 0}
								Free
							{:else}
								{formatPrice(link.price_cents, cohort?.currency || 'AUD')}
							{/if}
						</span>
					{/if}
					{#if link.bypass_enrollment_window}
						<span class="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
							<Clock class="h-3 w-3 text-gray-400" />
							Late access
						</span>
					{/if}
				</div>
			{/if}

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
			</div>
		</div>

		<!-- Actions -->
		<div class="flex items-center gap-3 self-start lg:self-center">
			<!-- Active toggle: labelled switch so its purpose is unmistakable -->
			<button
				type="button"
				role="switch"
				aria-checked={link.is_active}
				onclick={() => toggleLinkActive(link.id, link.is_active)}
				class="inline-flex items-center gap-2"
				title={link.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}
			>
				<span
					class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
					style={link.is_active ? 'background-color: var(--course-accent-dark);' : 'background-color: #d1d5db;'}
				>
					<span
						class="inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform"
						style={link.is_active ? 'transform: translateX(18px);' : 'transform: translateX(3px);'}
					></span>
				</span>
				<span
					class="text-xs font-medium"
					class:text-gray-700={link.is_active}
					class:text-gray-400={!link.is_active}
				>
					{link.is_active ? 'Active' : 'Inactive'}
				</span>
			</button>
			<button
				onclick={() => {
					linkToDelete = link.id;
					showDeleteConfirm = true;
				}}
				class="flex h-9 w-9 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
				title="Delete"
			>
				<Trash2 class="h-4 w-4" />
			</button>
		</div>
	</div>
{/snippet}

<!-- Create Modal -->
{#if showCreateModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
		<div class="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
			<h2 class="mb-1 text-xl font-bold text-gray-900">Create Additional Link</h2>
			<p class="mb-4 text-sm text-gray-500">
				Override one or more of the cohort defaults. Leave an option untouched to inherit the cohort setting.
			</p>

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

				<!-- Hub handling -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
					<label class="flex items-start gap-2 text-sm font-medium text-gray-700">
						<input
							type="checkbox"
							bind:checked={showHubSelector}
							class="mt-0.5 h-4 w-4 rounded border-gray-300"
						/>
						<span>
							Show a hub dropdown — let participants pick their hub
						</span>
					</label>
					<p class="mt-1 pl-6 text-xs text-gray-500">
						The dropdown lists the hubs assigned to this cohort (set them in Cohort Settings).
						Pair this with a price override below for a discounted hub rate.
					</p>
				</div>

				<!-- Single-hub lock (only when not showing a dropdown) -->
				{#if !showHubSelector && data.hubs.length > 0}
					<div>
						<label for="hub" class="mb-1 block text-sm font-medium text-gray-700">
							Lock to one hub (optional)
						</label>
						<select
							id="hub"
							bind:value={selectedHubId}
							class="block w-full rounded-lg border border-gray-300 px-3 py-2"
						>
							<option value="">No hub (in-person / cohort default)</option>
							{#each data.hubs as hub}
								<option value={hub.id}>{hub.name}</option>
							{/each}
						</select>
						<p class="mt-1 text-xs text-gray-500">
							Locks this link to a single hub and auto-assigns every enrollee to it.
						</p>
					</div>
				{/if}

				<!-- Link name (optional) -->
				<div>
					<label for="name" class="mb-1 block text-sm font-medium text-gray-700">
						Link name (optional)
					</label>
					<input
						type="text"
						id="name"
						bind:value={linkName}
						placeholder="e.g., Scholarship, Late enrolments"
						class="block w-full rounded-lg border border-gray-300 px-3 py-2"
					/>
					<p class="mt-1 text-xs text-gray-500">A friendly name to identify this link.</p>
				</div>

				<!-- Price override (optional) - only when payments enabled -->
				{#if courseFeatures.acceptPayments}
					<div>
						<label for="price" class="mb-1 block text-sm font-medium text-gray-700">
							Price override (optional)
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
							Overrides the cohort price. Enter 0 for a free (e.g. scholarship) link. Leave empty to use
							the cohort price ({cohortPriceLabel(selectedCohort)}).
						</p>
					</div>
				{/if}

				<!-- Max uses (optional) -->
				<div>
					<label for="maxUses" class="mb-1 block text-sm font-medium text-gray-700">
						Max uses (optional)
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

				<!-- Late access (optional) -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
					<label class="flex items-start gap-2 text-sm font-medium text-gray-700">
						<input
							type="checkbox"
							bind:checked={bypassEnrollmentWindow}
							class="mt-0.5 h-4 w-4 rounded border-gray-300"
						/>
						<span>
							Allow enrolling after the cohort's enrollment window closes (late access)
						</span>
					</label>
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

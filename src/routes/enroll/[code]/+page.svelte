<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { PUBLIC_STRIPE_PUBLISHABLE_KEY } from '$env/static/public';
	import { toastError } from '$lib/utils/toast-helpers.js';
	import { formatPrice } from '$lib/utils/enrollment-links';
	import { Loader2 } from '$lib/icons';

	let { data } = $props();

	// Form state
	let firstName = $state(data.existingUser?.full_name?.split(' ')[0] || '');
	let surname = $state(data.existingUser?.full_name?.split(' ').slice(1).join(' ') || '');
	let email = $state(data.existingUser?.email || '');
	let phone = $state(data.existingUser?.phone || '');
	let parishId = $state(data.existingUser?.parish_id || '');
	let parishOther = $state('');
	let referralSource = $state('');
	let referralOther = $state('');

	let isSubmitting = $state(false);
	let parishSearch = $state('');

	// Filter parishes based on search
	let filteredParishes = $derived(() => {
		if (!parishSearch) return data.parishes.slice(0, 20);
		const search = parishSearch.toLowerCase();
		return data.parishes
			.filter(
				(p) =>
					p.name.toLowerCase().includes(search) ||
					p.location?.toLowerCase().includes(search) ||
					p.diocese?.toLowerCase().includes(search)
			)
			.slice(0, 20);
	});

	// Form validation
	let formErrors = $state<Record<string, string>>({});

	function validateForm(): boolean {
		formErrors = {};

		if (!firstName.trim()) formErrors.firstName = 'First name is required';
		if (!surname.trim()) formErrors.surname = 'Surname is required';
		if (!email.trim()) formErrors.email = 'Email is required';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) formErrors.email = 'Invalid email address';
		if (!phone.trim()) formErrors.phone = 'Phone number is required';
		if (!parishId && !parishOther.trim()) formErrors.parish = 'Please select or enter your parish';

		return Object.keys(formErrors).length === 0;
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();

		if (!validateForm()) {
			toastError('Please fix the errors below');
			return;
		}

		isSubmitting = true;

		try {
			const formData = {
				firstName: firstName.trim(),
				surname: surname.trim(),
				email: email.trim().toLowerCase(),
				phone: phone.trim(),
				parishId: parishId || null,
				parishOther: parishOther.trim() || null,
				referralSource: referralSource || null,
				referralOther: referralOther.trim() || null,
				enrollmentLinkId: data.enrollmentLink.id,
				cohortId: data.cohort.id
			};

			// Submit to API
			const response = await fetch(`/api/enroll/${data.enrollmentLink.code}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to process enrollment');
			}

			if (result.checkoutUrl) {
				// Redirect to Stripe Checkout
				window.location.href = result.checkoutUrl;
			} else if (result.successUrl) {
				// Free enrollment - go to success page
				goto(result.successUrl);
			}
		} catch (err) {
			console.error('Enrollment error:', err);
			toastError(err instanceof Error ? err.message : 'An error occurred');
			isSubmitting = false;
		}
	}

	// Course branding
	let courseBranding = $derived(data.course.settings?.branding || {});
	let accentColor = $derived(courseBranding.accentColor || '#1e40af');
</script>

<svelte:head>
	<title>Enroll in {data.module.name} | {data.course.name}</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
	<div class="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
		<div class="overflow-hidden rounded-2xl bg-white shadow-xl lg:grid lg:grid-cols-2">
			<!-- Left side - Course info -->
			<div
				class="relative bg-gradient-to-br from-blue-900 to-blue-700 p-8 text-white lg:p-12"
				style="--accent: {accentColor};"
			>
				<div class="relative z-10">
					<!-- Course badge -->
					<div class="mb-6">
						<span class="rounded-full bg-white/20 px-3 py-1 text-sm font-medium">
							{data.course.name}
						</span>
					</div>

					<!-- Module name -->
					<h1 class="mb-4 text-3xl font-bold lg:text-4xl">
						{data.module.name}
					</h1>

					<!-- Module description -->
					{#if data.module.description}
						<p class="mb-8 text-lg text-blue-100">
							{data.module.description}
						</p>
					{/if}

					<!-- Cohort info -->
					<div class="space-y-4">
						<div class="flex items-center gap-3">
							<div class="rounded-lg bg-white/10 p-2">
								<svg
									class="h-5 w-5"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
									/>
								</svg>
							</div>
							<div>
								<p class="text-sm text-blue-200">Cohort</p>
								<p class="font-medium">{data.cohort.name}</p>
							</div>
						</div>

						{#if data.cohort.startDate}
							<div class="flex items-center gap-3">
								<div class="rounded-lg bg-white/10 p-2">
									<svg
										class="h-5 w-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
										/>
									</svg>
								</div>
								<div>
									<p class="text-sm text-blue-200">Starts</p>
									<p class="font-medium">
										{new Date(data.cohort.startDate).toLocaleDateString('en-AU', {
											weekday: 'long',
											year: 'numeric',
											month: 'long',
											day: 'numeric'
										})}
									</p>
								</div>
							</div>
						{/if}

						{#if data.hub}
							<div class="flex items-center gap-3">
								<div class="rounded-lg bg-white/10 p-2">
									<svg
										class="h-5 w-5"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
										/>
									</svg>
								</div>
								<div>
									<p class="text-sm text-blue-200">Hub</p>
									<p class="font-medium">{data.hub.name}</p>
									{#if data.hub.location}
										<p class="text-sm text-blue-200">{data.hub.location}</p>
									{/if}
								</div>
							</div>
						{/if}
					</div>

					<!-- Price -->
					<div class="mt-8 border-t border-white/20 pt-8">
						{#if data.pricing.isFree}
							<p class="text-3xl font-bold">Free</p>
						{:else}
							<p class="text-sm text-blue-200">Enrollment fee</p>
							<p class="text-3xl font-bold">
								{formatPrice(data.pricing.amount, data.pricing.currency)}
							</p>
						{/if}
					</div>
				</div>

				<!-- Background decoration -->
				<div class="absolute inset-0 overflow-hidden opacity-10">
					<svg
						class="absolute -right-20 -top-20 h-96 w-96"
						viewBox="0 0 200 200"
						fill="currentColor"
					>
						<path
							d="M100,10 L120,90 L200,100 L120,110 L100,190 L80,110 L0,100 L80,90 Z"
							transform="rotate(15, 100, 100)"
						/>
					</svg>
				</div>
			</div>

			<!-- Right side - Form -->
			<div class="p-8 lg:p-12">
				<h2 class="mb-6 text-2xl font-bold text-gray-900">Register for this course</h2>

				<form onsubmit={handleSubmit} class="space-y-5">
					<!-- Name fields -->
					<div class="grid gap-4 sm:grid-cols-2">
						<div>
							<label for="firstName" class="mb-1 block text-sm font-medium text-gray-700">
								First Name <span class="text-red-500">*</span>
							</label>
							<input
								type="text"
								id="firstName"
								bind:value={firstName}
								disabled={!!data.existingUser}
								class="block w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
								class:border-red-500={formErrors.firstName}
							/>
							{#if formErrors.firstName}
								<p class="mt-1 text-sm text-red-500">{formErrors.firstName}</p>
							{/if}
						</div>

						<div>
							<label for="surname" class="mb-1 block text-sm font-medium text-gray-700">
								Surname <span class="text-red-500">*</span>
							</label>
							<input
								type="text"
								id="surname"
								bind:value={surname}
								disabled={!!data.existingUser}
								class="block w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
								class:border-red-500={formErrors.surname}
							/>
							{#if formErrors.surname}
								<p class="mt-1 text-sm text-red-500">{formErrors.surname}</p>
							{/if}
						</div>
					</div>

					<!-- Email -->
					<div>
						<label for="email" class="mb-1 block text-sm font-medium text-gray-700">
							Email <span class="text-red-500">*</span>
						</label>
						<input
							type="email"
							id="email"
							bind:value={email}
							disabled={!!data.existingUser}
							class="block w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:bg-gray-100"
							class:border-red-500={formErrors.email}
						/>
						{#if formErrors.email}
							<p class="mt-1 text-sm text-red-500">{formErrors.email}</p>
						{/if}
					</div>

					<!-- Phone -->
					<div>
						<label for="phone" class="mb-1 block text-sm font-medium text-gray-700">
							Phone <span class="text-red-500">*</span>
						</label>
						<input
							type="tel"
							id="phone"
							bind:value={phone}
							placeholder="04XX XXX XXX"
							class="block w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							class:border-red-500={formErrors.phone}
						/>
						{#if formErrors.phone}
							<p class="mt-1 text-sm text-red-500">{formErrors.phone}</p>
						{/if}
					</div>

					<!-- Parish -->
					<div>
						<label for="parish" class="mb-1 block text-sm font-medium text-gray-700">
							Parish or Community <span class="text-red-500">*</span>
						</label>
						<div class="relative">
							<input
								type="text"
								id="parishSearch"
								bind:value={parishSearch}
								placeholder="Search for your parish..."
								class="block w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500"
								class:border-red-500={formErrors.parish}
							/>
							{#if parishSearch && !parishId}
								<div
									class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
								>
									{#each filteredParishes() as parish}
										<button
											type="button"
											class="block w-full px-4 py-2 text-left hover:bg-gray-50"
											onclick={() => {
												parishId = parish.id;
												parishSearch = parish.name;
												parishOther = '';
											}}
										>
											<span class="font-medium">{parish.name}</span>
											{#if parish.location}
												<span class="text-gray-500"> - {parish.location}</span>
											{/if}
										</button>
									{/each}
									<button
										type="button"
										class="block w-full border-t px-4 py-2 text-left text-blue-600 hover:bg-gray-50"
										onclick={() => {
											parishId = '';
											parishOther = parishSearch;
										}}
									>
										+ Add "{parishSearch}" as other
									</button>
								</div>
							{/if}
						</div>
						{#if parishId}
							<p class="mt-1 text-sm text-green-600">
								✓ Selected: {data.parishes.find((p) => p.id === parishId)?.name}
								<button
									type="button"
									class="ml-2 text-blue-600 underline"
									onclick={() => {
										parishId = '';
										parishSearch = '';
									}}
								>
									Change
								</button>
							</p>
						{:else if parishOther}
							<p class="mt-1 text-sm text-gray-600">
								Other: {parishOther}
								<button
									type="button"
									class="ml-2 text-blue-600 underline"
									onclick={() => {
										parishOther = '';
										parishSearch = '';
									}}
								>
									Change
								</button>
							</p>
						{/if}
						{#if formErrors.parish}
							<p class="mt-1 text-sm text-red-500">{formErrors.parish}</p>
						{/if}
					</div>

					<!-- Referral source (optional) -->
					<div>
						<label for="referralSource" class="mb-1 block text-sm font-medium text-gray-700">
							How did you find out about this course?
						</label>
						<select
							id="referralSource"
							bind:value={referralSource}
							class="block w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500"
						>
							<option value="">Select an option (optional)</option>
							{#each data.referralSources as source}
								<option value={source.value}>{source.label}</option>
							{/each}
						</select>
						{#if referralSource === 'other'}
							<input
								type="text"
								bind:value={referralOther}
								placeholder="Please specify..."
								class="mt-2 block w-full rounded-lg border border-gray-300 px-4 py-2.5 shadow-sm focus:border-blue-500 focus:ring-blue-500"
							/>
						{/if}
					</div>

					<!-- Submit button -->
					<div class="pt-4">
						<button
							type="submit"
							disabled={isSubmitting}
							class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-lg font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
						>
							{#if isSubmitting}
								<Loader2 class="h-5 w-5 animate-spin" />
								Processing...
							{:else if data.pricing.isFree}
								Register Now
							{:else}
								Continue to Payment
							{/if}
						</button>
					</div>

					{#if !data.pricing.isFree}
						<p class="text-center text-sm text-gray-500">
							You'll be redirected to our secure payment provider
						</p>
					{/if}
				</form>
			</div>
		</div>
	</div>
</div>

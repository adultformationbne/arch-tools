<script lang="ts">
	import { goto } from '$app/navigation';
	import { toastError } from '$lib/utils/toast-helpers.js';
	import { formatPrice } from '$lib/utils/enrollment-links';
	import { Loader2, ChevronDown } from '$lib/icons';
	import EnrollmentProgressStepper from '$lib/components/EnrollmentProgressStepper.svelte';
	import FullPageLoadingOverlay from '$lib/components/FullPageLoadingOverlay.svelte';

	let { data } = $props();

	// Determine flow type for progress stepper
	let flowType = $derived(() => {
		if (!data.pricing.isFree) return 'paid';
		if (data.cohort.enrollmentType === 'approval_required') return 'free_approval';
		return 'free_auto';
	});

	// Loading overlay state
	let showLoadingOverlay = $state(false);
	let loadingMessage = $state('Processing...');
	let loadingSubMessage = $state('');

	// Expandable description state
	let showFullDescription = $state(false);

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
	let showPendingApproval = $state(false);

	// Show warning if payment was cancelled
	$effect(() => {
		if (data.paymentCancelled) {
			toastError('Payment was cancelled. Please try again when ready.');
		}
	});

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
				// Show loading overlay and redirect to Stripe Checkout
				loadingMessage = 'Redirecting to payment...';
				loadingSubMessage = 'Please wait while we connect to our secure payment provider.';
				showLoadingOverlay = true;
				window.location.href = result.checkoutUrl;
			} else if (result.pendingApproval) {
				// Show pending approval message
				showPendingApproval = true;
				isSubmitting = false;
			} else if (result.successUrl) {
				// Show loading overlay and go to success page
				loadingMessage = 'Registration successful!';
				loadingSubMessage = 'Redirecting to set up your password...';
				showLoadingOverlay = true;
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
	let enrollmentBackgroundUrl = $derived(courseBranding.enrollmentBackgroundUrl || '');

	// Check if description is long (more than 150 chars)
	let isDescriptionLong = $derived((data.module.description?.length || 0) > 150);
	let truncatedDescription = $derived(
		data.module.description?.slice(0, 150) + (isDescriptionLong ? '...' : '')
	);
</script>

<svelte:head>
	<title>Enroll in {data.module.name} | {data.course.name}</title>
</svelte:head>

<!-- Full page loading overlay -->
<FullPageLoadingOverlay show={showLoadingOverlay} message={loadingMessage} subMessage={loadingSubMessage} />

<div class="flex min-h-screen">
	<!-- Left side - Form -->
	<div class="flex w-full flex-col bg-white lg:w-1/2">
		<!-- Logo/brand area -->
		<div class="px-6 py-6 sm:px-10 lg:px-12">
			{#if courseBranding.logoUrl}
				<img src={courseBranding.logoUrl} alt={data.course.name} class="h-8 w-auto" />
			{:else}
				<span class="text-lg font-semibold text-gray-900">{data.course.name}</span>
			{/if}
		</div>

		<!-- Main content area -->
		<div class="flex flex-1 flex-col justify-center px-6 pb-12 sm:px-10 lg:px-12">
			<!-- Progress stepper -->
			<div class="mb-8">
				<EnrollmentProgressStepper flow={flowType()} currentStep={1} />
			</div>

			{#if showPendingApproval}
				<!-- Pending Approval Message -->
				<div class="flex flex-col items-center justify-center py-8 text-center">
					<div class="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
						<svg class="h-8 w-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
						</svg>
					</div>
					<h2 class="mb-3 text-2xl font-bold text-gray-900">Request Submitted</h2>
					<p class="mb-6 max-w-sm text-gray-600">
						Your enrollment request has been submitted and is awaiting approval. We'll notify you at <strong>{email}</strong> once your request is reviewed.
					</p>
					<div class="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
						<p class="font-medium">What happens next?</p>
						<ul class="mt-2 list-inside list-disc text-left">
							<li>A course administrator will review your request</li>
							<li>You'll receive an email once approved</li>
							<li>Then you can set up your password and access the course</li>
						</ul>
					</div>
				</div>
			{:else}
				<!-- Mobile course info (visible only on mobile) -->
				<div class="mb-8 rounded-xl bg-gray-50 p-4 lg:hidden">
					<div class="flex items-start justify-between gap-4">
						<div class="min-w-0 flex-1">
							<p class="text-xs font-medium uppercase tracking-wide text-gray-500">{data.course.name}</p>
							<h2 class="mt-1 text-lg font-bold text-gray-900">{data.module.name}</h2>
							<div class="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-600">
								{#if data.cohort.startDate}
									<span>Starts {new Date(data.cohort.startDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
									<span class="text-gray-300">•</span>
								{/if}
								<span>{data.cohort.name}</span>
							</div>
						</div>
						<div class="text-right">
							{#if data.pricing.isFree}
								<span class="inline-block rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">Free</span>
							{:else}
								<span class="text-lg font-bold text-gray-900">{formatPrice(data.pricing.amount, data.pricing.currency)}</span>
							{/if}
						</div>
					</div>
					{#if data.module.description}
						<div class="mt-3 border-t border-gray-200 pt-3">
							{#if isDescriptionLong && !showFullDescription}
								<p class="text-sm text-gray-600">{truncatedDescription}</p>
								<button
									type="button"
									class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-gray-700"
									onclick={() => showFullDescription = true}
								>
									Read more
									<ChevronDown class="h-4 w-4" />
								</button>
							{:else}
								<p class="text-sm text-gray-600">{data.module.description}</p>
								{#if isDescriptionLong}
									<button
										type="button"
										class="mt-1 inline-flex items-center gap-1 text-sm font-medium text-gray-900 hover:text-gray-700"
										onclick={() => showFullDescription = false}
									>
										Show less
										<ChevronDown class="h-4 w-4 rotate-180" />
									</button>
								{/if}
							{/if}
						</div>
					{/if}
				</div>

				<div class="max-w-md">
					<h1 class="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
						Register for this course
					</h1>
					<p class="mt-2 text-gray-600">
						Enter your details below to enroll.
					</p>

					<form onsubmit={handleSubmit} class="mt-8 space-y-5">
						<!-- Name fields -->
						<div class="grid gap-4 sm:grid-cols-2">
							<div>
								<label for="firstName" class="block text-sm font-medium text-gray-900">
									First Name <span class="text-red-500">*</span>
								</label>
								<input
									type="text"
									id="firstName"
									bind:value={firstName}
									disabled={!!data.existingUser}
									class="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
									class:border-red-500={formErrors.firstName}
								/>
								{#if formErrors.firstName}
									<p class="mt-1.5 text-sm text-red-500">{formErrors.firstName}</p>
								{/if}
							</div>

							<div>
								<label for="surname" class="block text-sm font-medium text-gray-900">
									Surname <span class="text-red-500">*</span>
								</label>
								<input
									type="text"
									id="surname"
									bind:value={surname}
									disabled={!!data.existingUser}
									class="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
									class:border-red-500={formErrors.surname}
								/>
								{#if formErrors.surname}
									<p class="mt-1.5 text-sm text-red-500">{formErrors.surname}</p>
								{/if}
							</div>
						</div>

						<!-- Email -->
						<div>
							<label for="email" class="block text-sm font-medium text-gray-900">
								Email <span class="text-red-500">*</span>
							</label>
							<input
								type="email"
								id="email"
								bind:value={email}
								disabled={!!data.existingUser}
								class="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-500"
								class:border-red-500={formErrors.email}
							/>
							{#if formErrors.email}
								<p class="mt-1.5 text-sm text-red-500">{formErrors.email}</p>
							{/if}
						</div>

						<!-- Phone -->
						<div>
							<label for="phone" class="block text-sm font-medium text-gray-900">
								Phone <span class="text-red-500">*</span>
							</label>
							<input
								type="tel"
								id="phone"
								bind:value={phone}
								placeholder="04XX XXX XXX"
								class="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
								class:border-red-500={formErrors.phone}
							/>
							{#if formErrors.phone}
								<p class="mt-1.5 text-sm text-red-500">{formErrors.phone}</p>
							{/if}
						</div>

						<!-- Parish -->
						<div>
							<label for="parishSearch" class="block text-sm font-medium text-gray-900">
								Parish or Community <span class="text-red-500">*</span>
							</label>
							<div class="relative mt-1.5">
								<input
									type="text"
									id="parishSearch"
									bind:value={parishSearch}
									placeholder="Search for your parish..."
									class="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
									class:border-red-500={formErrors.parish}
								/>
								{#if parishSearch && !parishId}
									<div class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
										{#each filteredParishes() as parish}
											<button
												type="button"
												class="block w-full min-h-[48px] px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100"
												onclick={() => {
													parishId = parish.id;
													parishSearch = parish.name;
													parishOther = '';
												}}
											>
												<span class="font-medium text-gray-900">{parish.name}</span>
												{#if parish.location}
													<span class="text-gray-500"> - {parish.location}</span>
												{/if}
											</button>
										{/each}
										<button
											type="button"
											class="block w-full min-h-[48px] border-t px-4 py-3 text-left font-medium text-gray-900 hover:bg-gray-50 active:bg-gray-100"
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
								<p class="mt-1.5 text-sm text-green-600">
									Selected: {data.parishes.find((p) => p.id === parishId)?.name}
									<button
										type="button"
										class="ml-2 font-medium text-gray-900 underline"
										onclick={() => {
											parishId = '';
											parishSearch = '';
										}}
									>
										Change
									</button>
								</p>
							{:else if parishOther}
								<p class="mt-1.5 text-sm text-gray-600">
									Other: {parishOther}
									<button
										type="button"
										class="ml-2 font-medium text-gray-900 underline"
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
								<p class="mt-1.5 text-sm text-red-500">{formErrors.parish}</p>
							{/if}
						</div>

						<!-- Referral source (optional) -->
						<div>
							<label for="referralSource" class="block text-sm font-medium text-gray-900">
								How did you find out about this course?
							</label>
							<select
								id="referralSource"
								bind:value={referralSource}
								class="mt-1.5 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
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
									class="mt-2 block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
								/>
							{/if}
						</div>

						<!-- Submit button -->
						<div class="pt-2">
							<button
								type="submit"
								disabled={isSubmitting}
								class="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
			{/if}
		</div>
	</div>

	<!-- Right side - Image/Content panel (hidden on mobile) -->
	<div class="relative hidden w-1/2 lg:block">
		<!-- Background image or gradient -->
		{#if enrollmentBackgroundUrl}
			<div
				class="absolute inset-0 bg-cover bg-center"
				style="background-image: url('{enrollmentBackgroundUrl}');"
			>
				<div class="absolute inset-0 bg-gray-900/60"></div>
			</div>
		{:else}
			<div class="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900"></div>
		{/if}

		<!-- Content overlay -->
		<div class="relative flex h-full flex-col justify-between p-12 text-white">
			<!-- Top: Course info -->
			<div>
				<p class="text-sm font-medium uppercase tracking-wide text-white/70">{data.course.name}</p>
				<h2 class="mt-4 text-4xl font-bold leading-tight">{data.module.name}</h2>

				<!-- Expandable description -->
				{#if data.module.description}
					<div class="mt-6">
						{#if isDescriptionLong && !showFullDescription}
							<p class="text-lg leading-relaxed text-white/80">{truncatedDescription}</p>
							<button
								type="button"
								class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-white hover:text-white/80"
								onclick={() => showFullDescription = true}
							>
								Read more
								<ChevronDown class="h-4 w-4" />
							</button>
						{:else}
							<p class="text-lg leading-relaxed text-white/80">{data.module.description}</p>
							{#if isDescriptionLong}
								<button
									type="button"
									class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-white hover:text-white/80"
									onclick={() => showFullDescription = false}
								>
									Show less
									<ChevronDown class="h-4 w-4 rotate-180" />
								</button>
							{/if}
						{/if}
					</div>
				{/if}
			</div>

			<!-- Bottom: Cohort details & price -->
			<div class="space-y-6">
				<!-- Cohort info cards -->
				<div class="flex flex-wrap gap-4">
					<div class="rounded-lg bg-white/10 px-4 py-3 backdrop-blur-sm">
						<p class="text-xs font-medium uppercase tracking-wide text-white/60">Cohort</p>
						<p class="mt-1 font-semibold">{data.cohort.name}</p>
					</div>

					{#if data.cohort.startDate}
						<div class="rounded-lg bg-white/10 px-4 py-3 backdrop-blur-sm">
							<p class="text-xs font-medium uppercase tracking-wide text-white/60">Starts</p>
							<p class="mt-1 font-semibold">
								{new Date(data.cohort.startDate).toLocaleDateString('en-AU', {
									month: 'short',
									day: 'numeric',
									year: 'numeric'
								})}
							</p>
						</div>
					{/if}

					{#if data.hub}
						<div class="rounded-lg bg-white/10 px-4 py-3 backdrop-blur-sm">
							<p class="text-xs font-medium uppercase tracking-wide text-white/60">Location</p>
							<p class="mt-1 font-semibold">{data.hub.name}</p>
						</div>
					{/if}
				</div>

				<!-- Price -->
				<div class="border-t border-white/20 pt-6">
					{#if data.pricing.isFree}
						<p class="text-sm font-medium uppercase tracking-wide text-white/60">Enrollment</p>
						<p class="mt-1 text-4xl font-bold">Free</p>
					{:else}
						<p class="text-sm font-medium uppercase tracking-wide text-white/60">Enrollment Fee</p>
						<p class="mt-1 text-4xl font-bold">
							{formatPrice(data.pricing.amount, data.pricing.currency)}
						</p>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

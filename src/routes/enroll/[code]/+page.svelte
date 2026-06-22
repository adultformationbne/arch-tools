<script lang="ts">
	import { goto } from '$app/navigation';
	import { toastError } from '$lib/utils/toast-helpers.js';
	import { formatPrice } from '$lib/utils/enrollment-links';
	import { Loader2, ChevronDown } from '$lib/icons';
	import EnrollmentProgressStepper from '$lib/components/EnrollmentProgressStepper.svelte';
	import FullPageLoadingOverlay from '$lib/components/FullPageLoadingOverlay.svelte';
	import { tick, onDestroy } from 'svelte';
	import { loadStripe } from '@stripe/stripe-js';
	import { env } from '$env/dynamic/public';

	let { data } = $props();

	// Course accent colors from settings
	let accentDark = $derived(data.course?.settings?.theme?.accentDark || '#334642');
	let accentDarkest = $derived(data.course?.settings?.theme?.accentDarkest || '#1e2322');
	let accentLight = $derived(data.course?.settings?.theme?.accentLight || '#c59a6b');

	// Two-step flow: 1 = details + hub, 2 = review + price + confirm
	let step = $state(1);

	// Hub selection — locked links keep their hub; general links let the user choose
	let selectedHubId = $state(data.lockedHubId || data.preselectedHubId || '');
	let hubLocked = $derived(!!data.lockedHubId);
	let hasHubs = $derived((data.hubs?.length || 0) > 0);
	let selectedHub = $derived(data.hubs?.find((h) => h.id === selectedHubId) || null);

	// Price depends on the selected hub. Computed server-side (authoritative) and chosen here.
	let currentPricing = $derived(selectedHub ? selectedHub.pricing : data.basePricing);

	// Determine flow type for progress stepper
	let flowType = $derived(() => {
		if (!currentPricing.isFree) return 'paid';
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

	// Embedded Stripe checkout (mounted in-page on the paid path)
	let showEmbedded = $state(false);
	let embeddedCheckout: { mount: (sel: string) => void; destroy: () => void } | null = null;

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

	// Step 1 → Step 2: validate details, then reveal the price on the review step
	function goToReview() {
		if (!validateForm()) {
			toastError('Please fix the errors below');
			return;
		}
		step = 2;
		if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	function backToDetails() {
		step = 1;
	}

	// Mount Stripe Embedded Checkout into the page (real Stripe only)
	async function mountEmbeddedCheckout(clientSecret: string) {
		const pk = env.PUBLIC_STRIPE_PUBLISHABLE_KEY;
		if (!pk) {
			toastError('Payment is not configured. Please contact support.');
			isSubmitting = false;
			return;
		}
		showEmbedded = true;
		await tick();
		try {
			const stripe = await loadStripe(pk);
			if (!stripe) throw new Error('Stripe failed to load');
			const checkout = await stripe.createEmbeddedCheckoutPage({ clientSecret });
			embeddedCheckout = checkout;
			checkout.mount('#embedded-checkout');
		} catch (err) {
			console.error('Embedded checkout error:', err);
			toastError('Could not load the payment form. Please try again.');
			showEmbedded = false;
		} finally {
			isSubmitting = false;
		}
	}

	function cancelEmbedded() {
		if (embeddedCheckout) {
			embeddedCheckout.destroy();
			embeddedCheckout = null;
		}
		showEmbedded = false;
	}

	onDestroy(() => {
		if (embeddedCheckout) embeddedCheckout.destroy();
	});

	async function handleSubmit(event: Event) {
		event.preventDefault();

		// Safety: never submit from the details step
		if (step !== 2) {
			goToReview();
			return;
		}

		if (!validateForm()) {
			step = 1;
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
				cohortId: data.cohort.id,
				hubId: selectedHubId || null
			};

			const response = await fetch(`/api/enroll/${data.enrollmentLink.code}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(formData)
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to process enrollment');
			}

			if (result.clientSecret) {
				await mountEmbeddedCheckout(result.clientSecret);
			} else if (result.checkoutUrl) {
				loadingMessage = 'Redirecting to payment...';
				loadingSubMessage = 'Please wait while we connect to our secure payment provider.';
				showLoadingOverlay = true;
				window.location.href = result.checkoutUrl;
			} else if (result.pendingApproval) {
				showPendingApproval = true;
				isSubmitting = false;
			} else if (result.successUrl) {
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


	// Branding
	let courseBranding = $derived(data.course?.settings?.branding || {});
	let enrollmentBackgroundUrl = $derived(courseBranding.enrollmentBackgroundUrl || '');

	// Description helpers
	let isDescriptionLong = $derived((data.module?.description?.length || 0) > 150);
	let truncatedDescription = $derived(
		data.module?.description?.slice(0, 150) + (isDescriptionLong ? '...' : '')
	);
</script>

<svelte:head>
	<title>Enroll in {data.module?.name} | {data.course?.name}</title>
</svelte:head>

<FullPageLoadingOverlay show={showLoadingOverlay} message={loadingMessage} subMessage={loadingSubMessage} />

<div class="flex min-h-screen flex-col lg:flex-row">

	<!-- Left side - Form -->
	<div class="flex w-full flex-col lg:w-1/2">

		<!-- Mobile dark header with logo -->
		<div class="flex items-center px-6 py-4 lg:hidden" style="background-color: {accentDarkest};">
			{#if courseBranding.logoUrl}
				<img src={courseBranding.logoUrl} alt={data.course?.name} class="h-7 w-auto" />
			{:else}
				<span class="text-base font-semibold text-white">{data.course?.name}</span>
			{/if}
		</div>

		<!-- Form area -->
		<div class="flex flex-1 flex-col bg-white px-6 py-6 sm:px-8 lg:px-10 lg:py-10">

			<div class="flex flex-1 flex-col justify-center">
				<!-- Progress stepper -->
				<div class="mb-6">
					<EnrollmentProgressStepper flow={flowType()} currentStep={1} accentColor={accentDark} />
				</div>

				{#if showPendingApproval}
					<div class="flex flex-col items-center justify-center py-10 text-center">
						<div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
							<svg class="h-7 w-7 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
							</svg>
						</div>
						<h2 class="mb-2 text-xl font-bold text-gray-900">Request Submitted</h2>
						<p class="mb-4 max-w-sm text-sm text-gray-600">
							Your enrollment request is awaiting approval. We'll notify you at <strong>{email}</strong> once reviewed.
						</p>
						<div class="rounded-lg bg-gray-50 p-4 text-left text-sm text-gray-700">
							<p class="font-medium">What happens next?</p>
							<ul class="mt-2 list-inside list-disc space-y-1">
								<li>A course administrator will review your request</li>
								<li>You'll receive an email once approved</li>
								<li>Then you can set up your password and access the course</li>
							</ul>
						</div>
					</div>

				{:else}

					<!-- Mobile course info card -->
					<div class="mb-6 rounded-xl p-4 lg:hidden" style="background-color: {accentDark}33; border: 1px solid {accentDark}55;">
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<p class="truncate text-xs font-medium uppercase tracking-wide" style="color: {accentDark};">{data.course?.name}</p>
								<h2 class="mt-0.5 text-base font-bold text-gray-900">{data.module?.name}</h2>
								<div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-500">
									{#if data.cohort?.startDate}
										<span>Starts {new Date(data.cohort.startDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
										<span>·</span>
									{/if}
									<span>{data.cohort?.name}</span>
								</div>
							</div>
							{#if step === 2}
								<div class="shrink-0">
									{#if currentPricing.isFree}
										<span class="inline-block rounded-full px-2.5 py-1 text-xs font-semibold text-white" style="background-color: {accentDark};">Free</span>
									{:else}
										<span class="text-base font-bold text-gray-900">{formatPrice(currentPricing.amount, currentPricing.currency)}</span>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					{#if step === 1}
						<!-- STEP 1: Details + hub -->
						<div class="mx-auto w-full max-w-sm">
							<h1 class="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
								Register for this course
							</h1>
							<p class="mt-1 text-sm text-gray-500">Enter your details below to get started.</p>

							<form onsubmit={(e) => { e.preventDefault(); goToReview(); }} class="mt-5 space-y-4">
								<!-- Name fields -->
								<div class="grid gap-3 sm:grid-cols-2">
									<div>
										<label for="firstName" class="block text-sm font-medium text-gray-900">
											First Name <span class="text-red-500">*</span>
										</label>
										<input
											type="text"
											id="firstName"
											bind:value={firstName}
											disabled={!!data.existingUser}
											class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
											class:border-red-500={formErrors.firstName}
											style="focus:border-color: {accentDark};"
										/>
										{#if formErrors.firstName}
											<p class="mt-1 text-xs text-red-500">{formErrors.firstName}</p>
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
											class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
											class:border-red-500={formErrors.surname}
										/>
										{#if formErrors.surname}
											<p class="mt-1 text-xs text-red-500">{formErrors.surname}</p>
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
										class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none disabled:bg-gray-50 disabled:text-gray-500"
										class:border-red-500={formErrors.email}
									/>
									{#if formErrors.email}
										<p class="mt-1 text-xs text-red-500">{formErrors.email}</p>
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
										class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none"
										class:border-red-500={formErrors.phone}
									/>
									{#if formErrors.phone}
										<p class="mt-1 text-xs text-red-500">{formErrors.phone}</p>
									{/if}
								</div>

								<!-- Parish -->
								<div>
									<label for="parishSearch" class="block text-sm font-medium text-gray-900">
										Parish or Community <span class="text-red-500">*</span>
									</label>
									<div class="relative mt-1">
										<input
											type="text"
											id="parishSearch"
											bind:value={parishSearch}
											placeholder="Search for your parish..."
											class="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none"
											class:border-red-500={formErrors.parish}
										/>
										{#if parishSearch && !parishId}
											<div class="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
												{#each filteredParishes() as parish}
													<button
														type="button"
														class="block w-full min-h-[44px] px-4 py-2.5 text-left text-sm hover:bg-gray-50"
														onclick={() => {
															parishId = parish.id;
															parishSearch = parish.name;
															parishOther = '';
														}}
													>
														<span class="font-medium text-gray-900">{parish.name}</span>
														{#if parish.location}
															<span class="text-gray-500"> — {parish.location}</span>
														{/if}
													</button>
												{/each}
												<button
													type="button"
													class="block w-full min-h-[44px] border-t px-4 py-2.5 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
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
										<p class="mt-1 text-xs text-green-600">
											✓ {data.parishes.find((p) => p.id === parishId)?.name}
											<button type="button" class="ml-1 underline text-gray-500" onclick={() => { parishId = ''; parishSearch = ''; }}>Change</button>
										</p>
									{:else if parishOther}
										<p class="mt-1 text-xs text-gray-500">
											Other: {parishOther}
											<button type="button" class="ml-1 underline" onclick={() => { parishOther = ''; parishSearch = ''; }}>Change</button>
										</p>
									{/if}
									{#if formErrors.parish}
										<p class="mt-1 text-xs text-red-500">{formErrors.parish}</p>
									{/if}
								</div>

								<!-- Hub / Location selection -->
								{#if hubLocked && data.hub}
									<div>
										<span class="block text-sm font-medium text-gray-900">Hub / Location</span>
										<p class="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
											{data.hub.name}{#if data.hub.location} — {data.hub.location}{/if}
										</p>
									</div>
								{:else if hasHubs}
									<div>
										<label for="hub" class="block text-sm font-medium text-gray-900">
											Hub / Location
										</label>
										<select
											id="hub"
											bind:value={selectedHubId}
											class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none"
										>
											<option value="">No specific hub</option>
											{#each data.hubs as hub}
												<option value={hub.id}>{hub.name}{hub.location ? ` — ${hub.location}` : ''}</option>
											{/each}
										</select>
										<p class="mt-1 text-xs text-gray-400">Choose the location where you'll attend, if applicable.</p>
									</div>
								{/if}

								<!-- Referral source -->
								<div>
									<label for="referralSource" class="block text-sm font-medium text-gray-900">
										How did you find out about this course?
									</label>
									<select
										id="referralSource"
										bind:value={referralSource}
										class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none"
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
											class="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none"
										/>
									{/if}
								</div>

								<!-- Continue to review -->
								<div class="pt-1">
									<button
										type="submit"
										class="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none"
										style="background-color: {accentDark};"
									>
										Continue
									</button>
								</div>
							</form>
						</div>

					{:else}
						<!-- STEP 2: Review + price + confirm -->
						<div class="mx-auto w-full max-w-sm">
							<button
								type="button"
								class="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
								onclick={() => (showEmbedded ? cancelEmbedded() : backToDetails())}
							>
								<ChevronDown class="h-3.5 w-3.5 rotate-90" /> Back
							</button>

							<h1 class="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
								Review &amp; confirm
							</h1>
							<p class="mt-1 text-sm text-gray-500">Check your details before continuing.</p>

							<!-- Summary -->
							<dl class="mt-5 divide-y divide-gray-100 rounded-xl border border-gray-200">
								<div class="flex justify-between gap-4 px-4 py-3">
									<dt class="text-sm text-gray-500">Name</dt>
									<dd class="text-sm font-medium text-gray-900">{firstName} {surname}</dd>
								</div>
								<div class="flex justify-between gap-4 px-4 py-3">
									<dt class="text-sm text-gray-500">Email</dt>
									<dd class="text-sm font-medium text-gray-900 break-all">{email}</dd>
								</div>
								<div class="flex justify-between gap-4 px-4 py-3">
									<dt class="text-sm text-gray-500">Phone</dt>
									<dd class="text-sm font-medium text-gray-900">{phone}</dd>
								</div>
								<div class="flex justify-between gap-4 px-4 py-3">
									<dt class="text-sm text-gray-500">Parish</dt>
									<dd class="text-sm font-medium text-gray-900 text-right">
										{parishId ? data.parishes.find((p) => p.id === parishId)?.name : parishOther}
									</dd>
								</div>
								{#if selectedHub}
									<div class="flex justify-between gap-4 px-4 py-3">
										<dt class="text-sm text-gray-500">Hub</dt>
										<dd class="text-sm font-medium text-gray-900 text-right">{selectedHub.name}</dd>
									</div>
								{/if}
							</dl>

							<!-- Price -->
							<div class="mt-5 flex items-center justify-between rounded-xl px-4 py-4" style="background-color: {accentDark}14;">
								<span class="text-sm font-semibold uppercase tracking-wide text-gray-600">Total</span>
								{#if currentPricing.isFree}
									<span class="text-2xl font-bold text-gray-900">Free</span>
								{:else}
									<span class="text-2xl font-bold text-gray-900">{formatPrice(currentPricing.amount, currentPricing.currency)}</span>
								{/if}
							</div>

							{#if !showEmbedded}
							<form onsubmit={handleSubmit} class="mt-5">
								<button
									type="submit"
									disabled={isSubmitting}
									class="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
									style="background-color: {accentDark};"
								>
									{#if isSubmitting}
										<Loader2 class="h-4 w-4 animate-spin" />
										Processing...
									{:else if currentPricing.isFree}
										Register Now
									{:else}
										Continue to Payment
									{/if}
								</button>
								{#if !currentPricing.isFree}
									<p class="mt-2 text-center text-xs text-gray-400">
									Secure payment, powered by Stripe.
									</p>
								{/if}
							</form>
							{:else}
							<!-- Stripe Embedded Checkout mounts here -->
							<div id="embedded-checkout" class="mt-5"></div>
							{/if}
						</div>
					{/if}

				{/if}
			</div>

			<!-- Footer pinned to bottom -->
			<p class="mt-6 text-xs text-gray-400">
				© {new Date().getFullYear()} Archdiocesan Ministries ·
				<a href="/privacy-policy" class="underline hover:text-gray-600">Data Policy</a>
			</p>
		</div>
	</div>

	<!-- Right side - dark info panel (desktop only) -->
	<div class="relative hidden lg:flex lg:w-1/2 lg:flex-col">
		{#if enrollmentBackgroundUrl}
			<div class="absolute inset-0 bg-cover bg-center" style="background-image: url('{enrollmentBackgroundUrl}');">
				<div class="absolute inset-0" style="background-color: {accentDarkest}cc;"></div>
			</div>
		{:else}
			<div class="absolute inset-0" style="background: linear-gradient(160deg, {accentDark} 0%, {accentDarkest} 100%);"></div>
		{/if}

		<div class="relative flex h-full flex-col justify-between p-10 text-white">
			<!-- Logo at top -->
			<div>
				{#if courseBranding.logoUrl}
					<img src={courseBranding.logoUrl} alt={data.course?.name} class="h-8 w-auto" />
				{:else}
					<span class="text-base font-semibold text-white/80">{data.course?.name}</span>
				{/if}
			</div>

			<!-- Course info in the middle -->
			<div class="-mt-16">
				<p class="text-xs font-semibold uppercase tracking-widest" style="color: {accentLight};">{data.course?.name}</p>
				<h2 class="mt-3 text-4xl font-bold leading-tight">{data.module?.name}</h2>

				{#if data.module?.description}
					<div class="mt-5">
						{#if isDescriptionLong && !showFullDescription}
							<p class="text-base leading-relaxed text-white/70">{truncatedDescription}</p>
							<button
								type="button"
								class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-white/60 hover:text-white"
								onclick={() => showFullDescription = true}
							>
								Read more <ChevronDown class="h-3.5 w-3.5" />
							</button>
						{:else}
							<p class="text-base leading-relaxed text-white/70">{data.module?.description}</p>
							{#if isDescriptionLong}
								<button
									type="button"
									class="mt-2 inline-flex items-center gap-1 text-sm font-medium text-white/60 hover:text-white"
									onclick={() => showFullDescription = false}
								>
									Show less <ChevronDown class="h-3.5 w-3.5 rotate-180" />
								</button>
							{/if}
						{/if}
					</div>
				{/if}
			</div>

			<!-- Bottom: cohort details + price -->
			<div class="space-y-5">
				<div class="flex flex-wrap gap-3">
					<div class="rounded-lg px-3.5 py-2.5" style="background-color: rgba(255,255,255,0.1);">
						<p class="text-[10px] font-semibold uppercase tracking-wider text-white/50">Cohort</p>
						<p class="mt-0.5 text-sm font-semibold">{data.cohort?.name}</p>
					</div>
					{#if data.cohort?.startDate}
						<div class="rounded-lg px-3.5 py-2.5" style="background-color: rgba(255,255,255,0.1);">
							<p class="text-[10px] font-semibold uppercase tracking-wider text-white/50">Starts</p>
							<p class="mt-0.5 text-sm font-semibold">
								{new Date(data.cohort.startDate).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
							</p>
						</div>
					{/if}
					{#if selectedHub}
						<div class="rounded-lg px-3.5 py-2.5" style="background-color: rgba(255,255,255,0.1);">
							<p class="text-[10px] font-semibold uppercase tracking-wider text-white/50">Location</p>
							<p class="mt-0.5 text-sm font-semibold">{selectedHub.name}</p>
						</div>
					{/if}
				</div>

				{#if step === 2}
					<div class="border-t pt-5" style="border-color: rgba(255,255,255,0.15);">
						<p class="text-xs font-semibold uppercase tracking-widest text-white/50">Enrollment</p>
						{#if currentPricing.isFree}
							<p class="mt-1 text-4xl font-bold">Free</p>
						{:else}
							<p class="mt-1 text-4xl font-bold">{formatPrice(currentPricing.amount, currentPricing.currency)}</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

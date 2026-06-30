<script lang="ts">
	import { goto } from '$app/navigation';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { formatPrice } from '$lib/utils/enrollment-links';
	import { Loader2, ChevronDown } from '$lib/icons';
	import EnrollmentProgressStepper from '$lib/components/EnrollmentProgressStepper.svelte';
	import FullPageLoadingOverlay from '$lib/components/FullPageLoadingOverlay.svelte';
	import { tick, onDestroy } from 'svelte';
	import { loadStripe } from '@stripe/stripe-js';

	let { data } = $props();

	type Participant = {
		firstName: string;
		surname: string;
		email: string;
		phone: string;
		parishOther: string;
		referralSource: string;
		referralOther: string;
		mailingAddress: string;
		isExisting: boolean;
	};

	// Course accent colors from settings
	let accentDark = $derived(data.course?.settings?.theme?.accentDark || '#334642');
	let accentDarkest = $derived(data.course?.settings?.theme?.accentDarkest || '#1e2322');
	let accentLight = $derived(data.course?.settings?.theme?.accentLight || '#c59a6b');

	// Multi-step flow: 1 = add people + hub, 2 = billing contact, 3 = review + confirm
	let step = $state(1);

	// The group being enrolled. The single-entry fields below are the "current entry"
	// being typed; once added they drop into this list and the fields reset.
	let participants = $state<Participant[]>([]);
	let editingIndex = $state<number | null>(null);

	// Billing contact: an attending participant, or a separate non-attending organiser
	let billingMode = $state<'participant' | 'organizer'>('participant');
	let billingParticipantIndex = $state(0);
	let organizerName = $state('');
	let organizerEmail = $state('');
	let organizerErrors = $state<Record<string, string>>({});

	// Hub selection — locked links keep their hub; general links let the user choose
	let selectedHubId = $state(data.lockedHubId || data.preselectedHubId || '');
	let hubLocked = $derived(!!data.lockedHubId);
	let hasHubs = $derived((data.hubs?.length || 0) > 0);
	let selectedHub = $derived(data.hubs?.find((h) => h.id === selectedHubId) || null);
	// The hub to surface in the summary panel / review: a chosen hub, or the
	// link's locked hub (which isn't in the selectable `hubs` list).
	let displayHub = $derived(selectedHub || (hubLocked ? data.hub : null));

	// Price depends on the selected hub. Computed server-side (authoritative) and chosen here.
	let currentPricing = $derived(selectedHub ? selectedHub.pricing : data.basePricing);
	let headcount = $derived(Math.max(participants.length, 1));
	let lineTotal = $derived(currentPricing.amount * headcount);

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

	// Current-entry form state (prefilled for a logged-in user as their own entry)
	let firstName = $state(data.existingUser?.full_name?.split(' ')[0] || '');
	let surname = $state(data.existingUser?.full_name?.split(' ').slice(1).join(' ') || '');
	let email = $state(data.existingUser?.email || '');
	let phone = $state(data.existingUser?.phone || '');
	let parishOther = $state('');
	let referralSource = $state('');
	let referralOther = $state('');
	let mailingAddress = $state('');

	// Email-first: detect whether the typed email already has an account so we can
	// skip collecting (and never echo) their details. The lookup returns a boolean only;
	// the server treats an existing profile as authoritative and ignores typed details.
	let emailStatus = $state<'idle' | 'checking' | 'registered' | 'new'>(data.existingUser ? 'registered' : 'idle');
	let emailToken = 0;
	let emailDebounce: ReturnType<typeof setTimeout> | null = null;
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	async function runEmailCheck() {
		const e = email.trim().toLowerCase();
		if (!emailRegex.test(e)) { emailStatus = 'idle'; return; }
		const token = ++emailToken;
		emailStatus = 'checking';
		try {
			const res = await fetch('/api/enroll/check-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: e })
			});
			const d = await res.json();
			if (token !== emailToken) return; // a newer check superseded this one
			emailStatus = d.registered ? 'registered' : 'new';
		} catch {
			if (token === emailToken) emailStatus = 'new'; // fail-open: collect details
		}
	}

	function onEmailInput() {
		emailStatus = 'idle';
		if (emailDebounce) clearTimeout(emailDebounce);
		emailDebounce = setTimeout(runEmailCheck, 450);
	}

	function displayName(p: Participant): string {
		const n = `${p.firstName} ${p.surname}`.trim();
		return n || p.email;
	}

	let isSubmitting = $state(false);
	let showPendingApproval = $state(false);
	let showInvitationsSent = $state(false);
	let invitedCount = $state(0);

	// Embedded Stripe checkout (mounted in-page on the paid path)
	let showEmbedded = $state(false);
	let embeddedCheckout: { mount: (sel: string) => void; destroy: () => void } | null = null;

	// Show warning if payment was cancelled
	$effect(() => {
		if (data.paymentCancelled) {
			toastError('Payment was cancelled. Please try again when ready.');
		}
	});

	// Current-entry validation
	let formErrors = $state<Record<string, string>>({});

	function validateForm(): boolean {
		formErrors = {};
		if (!firstName.trim()) formErrors.firstName = 'First name is required';
		if (!surname.trim()) formErrors.surname = 'Surname is required';
		if (!email.trim()) formErrors.email = 'Email is required';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) formErrors.email = 'Invalid email address';
		if (!phone.trim()) formErrors.phone = 'Phone number is required';
		if (!mailingAddress.trim()) formErrors.mailingAddress = 'Mailing address is required';
		return Object.keys(formErrors).length === 0;
	}

	function entryHasInput(): boolean {
		return !!(firstName.trim() || surname.trim() || email.trim() || phone.trim());
	}

	function resetEntry() {
		firstName = '';
		surname = '';
		email = '';
		phone = '';
		parishOther = '';
		referralSource = '';
		referralOther = '';
		mailingAddress = '';
		emailStatus = 'idle';
		if (emailDebounce) clearTimeout(emailDebounce);
		formErrors = {};
	}

	function scrollTop() {
		if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	// Validate the current entry and drop it into the participants list. For an email
	// that already has an account, the existing profile is authoritative server-side,
	// so we only require the email and store the entry as "existing".
	async function addCurrentEntry(): Promise<boolean> {
		formErrors = {};
		const normalizedEmail = email.trim().toLowerCase();
		if (!normalizedEmail) {
			formErrors.email = 'Email is required';
			toastError('Please enter an email');
			return false;
		}
		if (!emailRegex.test(normalizedEmail)) {
			formErrors.email = 'Invalid email address';
			toastError('Please fix the errors below');
			return false;
		}
		// Resolve the account-exists status if the debounce hasn't settled yet.
		if (emailStatus === 'idle' || emailStatus === 'checking') await runEmailCheck();
		const existing = emailStatus === 'registered';
		if (!existing) {
			if (!firstName.trim()) formErrors.firstName = 'First name is required';
			if (!surname.trim()) formErrors.surname = 'Surname is required';
			if (!phone.trim()) formErrors.phone = 'Phone number is required';
			if (!mailingAddress.trim()) formErrors.mailingAddress = 'Mailing address is required';
			if (Object.keys(formErrors).length > 0) {
				toastError('Please fix the errors below');
				return false;
			}
		}
		const dupe = participants.some((x, i) => x.email === normalizedEmail && i !== editingIndex);
		if (dupe) {
			formErrors = { ...formErrors, email: 'This email is already in the group' };
			toastError('That email is already in the group');
			return false;
		}
		const entry: Participant = {
			firstName: existing ? '' : firstName.trim(),
			surname: existing ? '' : surname.trim(),
			email: normalizedEmail,
			phone: existing ? '' : phone.trim(),
			parishOther: existing ? '' : parishOther.trim(),
			referralSource: existing ? '' : referralSource,
			referralOther: existing ? '' : referralOther.trim(),
			mailingAddress: existing ? '' : mailingAddress.trim(),
			isExisting: existing
		};
		if (editingIndex !== null) {
			participants = participants.map((x, i) => (i === editingIndex ? entry : x));
			editingIndex = null;
		} else {
			participants = [...participants, entry];
		}
		resetEntry();
		scrollTop();
		return true;
	}

	async function addAnotherPerson() {
		if (await addCurrentEntry()) {
			toastSuccess('Added — enter the next person');
		}
	}

	function editParticipant(i: number) {
		const p = participants[i];
		firstName = p.firstName;
		surname = p.surname;
		email = p.email;
		phone = p.phone;
		parishOther = p.parishOther;
		referralSource = p.referralSource;
		referralOther = p.referralOther;
		mailingAddress = p.mailingAddress;
		emailStatus = p.isExisting ? 'registered' : 'new';
		editingIndex = i;
		formErrors = {};
		scrollTop();
	}

	function removeParticipant(i: number) {
		participants = participants.filter((_, idx) => idx !== i);
		if (editingIndex === i) {
			editingIndex = null;
			resetEntry();
		} else if (editingIndex !== null && i < editingIndex) {
			editingIndex = editingIndex - 1;
		}
		if (billingParticipantIndex >= participants.length) billingParticipantIndex = 0;
	}

	// Step 1 -> billing (or straight to review for a single participant)
	async function proceedFromPeople() {
		if (entryHasInput()) {
			if (!(await addCurrentEntry())) return;
		}
		if (participants.length === 0) {
			toastError('Please add at least one participant');
			return;
		}
		if (billingParticipantIndex >= participants.length) billingParticipantIndex = 0;
		if (participants.length === 1) {
			billingMode = 'participant';
			billingParticipantIndex = 0;
			step = 3;
		} else {
			step = 2;
		}
		scrollTop();
	}

	function validateOrganizer(): boolean {
		organizerErrors = {};
		if (!organizerName.trim()) organizerErrors.name = 'Name is required';
		if (!organizerEmail.trim()) organizerErrors.email = 'Email is required';
		else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(organizerEmail))
			organizerErrors.email = 'Invalid email address';
		return Object.keys(organizerErrors).length === 0;
	}

	// Step 2 -> review
	function proceedFromBilling() {
		if (billingMode === 'organizer' && !validateOrganizer()) {
			toastError('Please fix the errors below');
			return;
		}
		step = 3;
		scrollTop();
	}

	function backFromReview() {
		if (showEmbedded) {
			cancelEmbedded();
			return;
		}
		step = participants.length > 1 ? 2 : 1;
	}

	let billingDisplay = $derived(() => {
		if (billingMode === 'organizer') {
			return { name: organizerName.trim(), email: organizerEmail.trim().toLowerCase() };
		}
		const p = participants[billingParticipantIndex];
		return p ? { name: displayName(p), email: p.email } : { name: '', email: '' };
	});

	// Mount Stripe Embedded Checkout into the page (real Stripe only)
	async function mountEmbeddedCheckout(clientSecret: string) {
		const pk = data.stripePublishableKey;
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

		// Safety: only submit from the review step with at least one participant
		if (step !== 3 || participants.length === 0) {
			proceedFromPeople();
			return;
		}

		isSubmitting = true;

		try {
			const payload = {
				participants: participants.map((p) => ({
					firstName: p.firstName,
					surname: p.surname,
					email: p.email,
					phone: p.phone,
					parishId: null,
					parishOther: p.parishOther || null,
					referralSource: p.referralSource || null,
					referralOther: p.referralOther || null,
					mailingAddress: p.mailingAddress || null
				})),
				billingContact:
					billingMode === 'organizer'
						? { participantIndex: null, name: organizerName.trim(), email: organizerEmail.trim().toLowerCase() }
						: { participantIndex: billingParticipantIndex, name: '', email: '' },
				enrollmentLinkId: data.enrollmentLink.id,
				cohortId: data.cohort.id,
				hubId: selectedHubId || null
			};

			const response = await fetch(`/api/enroll/${data.enrollmentLink.code}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
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
			} else if (result.invitationsSent) {
				invitedCount = result.participantCount || participants.length;
				showInvitationsSent = true;
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
							Your enrollment {participants.length > 1 ? 'requests are' : 'request is'} awaiting approval. We'll notify each participant by email once reviewed.
						</p>
						<div class="rounded-lg bg-gray-50 p-4 text-left text-sm text-gray-700">
							<p class="font-medium">What happens next?</p>
							<ul class="mt-2 list-inside list-disc space-y-1">
								<li>A course administrator will review the request</li>
								<li>Each participant receives an email once approved</li>
								<li>Then they can set up a password and access the course</li>
							</ul>
						</div>
					</div>

				{:else if showInvitationsSent}
					<div class="flex flex-col items-center justify-center py-10 text-center">
						<div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
							<svg class="h-7 w-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
							</svg>
						</div>
						<h2 class="mb-2 text-xl font-bold text-gray-900">Invitations Sent</h2>
						<p class="max-w-sm text-sm text-gray-600">
							We've emailed an account-setup link to all {invitedCount} participants. They can set their own password and access the course from that link.
						</p>
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
									{#if displayHub}
										<span>·</span>
										<span>{displayHub.name}</span>
									{/if}
								</div>
							</div>
							{#if step === 3}
								<div class="shrink-0">
									{#if currentPricing.isFree}
										<span class="inline-block rounded-full px-2.5 py-1 text-xs font-semibold text-white" style="background-color: {accentDark};">Free</span>
									{:else}
										<span class="text-base font-bold text-gray-900">{formatPrice(lineTotal, currentPricing.currency)}</span>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					{#if step === 1}
						<!-- STEP 1: Add people + hub -->
						<div class="mx-auto w-full max-w-sm">
							<h1 class="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
								Register for this course
							</h1>
							<p class="mt-1 text-sm text-gray-500">
								Start with the participant's email — if they already have an account we'll just add them. Enrolling a group? Add each person below.
							</p>

							<!-- Participants already added -->
							{#if participants.length > 0}
								<ul class="mt-5 space-y-2">
									{#each participants as p, i}
										<li class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5"
											class:ring-2={editingIndex === i}
											style={editingIndex === i ? `--tw-ring-color: ${accentDark};` : ''}>
											<div class="min-w-0">
												<p class="truncate text-sm font-medium text-gray-900">{displayName(p)}</p>
												{#if !p.isExisting}<p class="truncate text-xs text-gray-500">{p.email}</p>{/if}
												{#if p.isExisting}<p class="text-xs font-medium text-green-600">Has an account — they'll sign in</p>{/if}
											</div>
											<div class="flex shrink-0 items-center gap-2">
												<button type="button" class="text-xs font-medium text-gray-500 hover:text-gray-800" onclick={() => editParticipant(i)}>
													Edit
												</button>
												<button type="button" class="text-xs font-medium text-red-500 hover:text-red-700" onclick={() => removeParticipant(i)}>
													Remove
												</button>
											</div>
										</li>
									{/each}
								</ul>
								<p class="mt-2 text-xs font-medium text-gray-500">
									{participants.length} {participants.length === 1 ? 'participant' : 'participants'} added
								</p>
							{/if}

							<form onsubmit={(e) => { e.preventDefault(); proceedFromPeople(); }} class="mt-5 space-y-4">
								{#if editingIndex !== null}
									<p class="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
										Editing participant {editingIndex + 1}
									</p>
								{/if}
								<!-- Email (first) -->
								<div>
									<label for="email" class="block text-sm font-medium text-gray-900">
										Email <span class="text-red-500">*</span>
									</label>
									<input
										type="email"
										id="email"
										bind:value={email}
										oninput={onEmailInput}
										onblur={runEmailCheck}
										class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none"
										class:border-red-500={formErrors.email}
									/>
									{#if formErrors.email}
										<p class="mt-1 text-xs text-red-500">{formErrors.email}</p>
									{/if}
									{#if emailStatus === 'checking'}
										<p class="mt-1 text-xs text-gray-400">Checking…</p>
									{:else if emailStatus === 'registered'}
										<p class="mt-1 rounded-lg bg-green-50 px-3 py-2 text-xs font-medium text-green-700">
											✓ We found an account for this email. We'll add them — no other details needed; they'll sign in with their existing account.
										</p>
									{/if}
								</div>

								<!-- Details only needed for a new account -->
								{#if emailStatus !== 'registered'}
									<!-- Name fields -->
									<div class="grid gap-3 sm:grid-cols-2">
										<div>
											<label for="firstName" class="block text-sm font-medium text-gray-900">
												First Name <span class="text-red-500">*</span>
											</label>
											<input type="text" id="firstName" bind:value={firstName}
												class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none"
												class:border-red-500={formErrors.firstName} />
											{#if formErrors.firstName}<p class="mt-1 text-xs text-red-500">{formErrors.firstName}</p>{/if}
										</div>
										<div>
											<label for="surname" class="block text-sm font-medium text-gray-900">
												Surname <span class="text-red-500">*</span>
											</label>
											<input type="text" id="surname" bind:value={surname}
												class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none"
												class:border-red-500={formErrors.surname} />
											{#if formErrors.surname}<p class="mt-1 text-xs text-red-500">{formErrors.surname}</p>{/if}
										</div>
									</div>

									<!-- Phone -->
									<div>
										<label for="phone" class="block text-sm font-medium text-gray-900">
											Phone <span class="text-red-500">*</span>
										</label>
										<input type="tel" id="phone" bind:value={phone} placeholder="04XX XXX XXX"
											class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none"
											class:border-red-500={formErrors.phone} />
										{#if formErrors.phone}<p class="mt-1 text-xs text-red-500">{formErrors.phone}</p>{/if}
									</div>

									<!-- Parish -->
									<div>
										<label for="parishOther" class="block text-sm font-medium text-gray-900">
											Parish or Community
										</label>
										<input type="text" id="parishOther" bind:value={parishOther} placeholder="Parish or community (optional)"
											class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none" />
									</div>

									<!-- Mailing address -->
									<div>
										<label for="mailingAddress" class="block text-sm font-medium text-gray-900">
											Mailing Address <span class="text-red-500">*</span>
										</label>
										<textarea id="mailingAddress" bind:value={mailingAddress} rows="2" placeholder="Postal address"
											class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none"
											class:border-red-500={formErrors.mailingAddress}></textarea>
										{#if formErrors.mailingAddress}<p class="mt-1 text-xs text-red-500">{formErrors.mailingAddress}</p>{/if}
									</div>
								{/if}

								<!-- Hub / Location selection (only when participants choose; a
								     locked/preselected hub shows in the summary panel instead). -->
								{#if !hubLocked && hasHubs}
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
										<p class="mt-1 text-xs text-gray-400">The whole group attends the same location.</p>
									</div>
								{/if}

								<!-- Add another person -->
								<button
									type="button"
									onclick={addAnotherPerson}
									class="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-gray-50"
									style="border-color: {accentDark}; color: {accentDark};"
								>
									{editingIndex !== null ? 'Save participant' : '+ Add another person'}
								</button>

								<!-- Continue -->
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

					{:else if step === 2}
						<!-- STEP 2: Billing contact -->
						<div class="mx-auto w-full max-w-sm">
							<button
								type="button"
								class="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
								onclick={() => (step = 1)}
							>
								<ChevronDown class="h-3.5 w-3.5 rotate-90" /> Back
							</button>

							<h1 class="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">Who's paying?</h1>
							<p class="mt-1 text-sm text-gray-500">
								Choose who receives the receipt. They can be one of the participants or someone else.
							</p>

							<div class="mt-5 space-y-2">
								{#each participants as p, i}
									<label class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5"
										class:border-gray-200={!(billingMode === 'participant' && billingParticipantIndex === i)}
										style={billingMode === 'participant' && billingParticipantIndex === i ? `border-color:${accentDark};background-color:${accentDark}0d;` : ''}>
										<input
											type="radio"
											name="billing"
											checked={billingMode === 'participant' && billingParticipantIndex === i}
											onchange={() => { billingMode = 'participant'; billingParticipantIndex = i; }}
										/>
										<span class="min-w-0">
											<span class="block truncate text-sm font-medium text-gray-900">{displayName(p)}</span>
											<span class="block truncate text-xs text-gray-500">{p.email}</span>
										</span>
									</label>
								{/each}

								<label class="flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5"
									class:border-gray-200={billingMode !== 'organizer'}
									style={billingMode === 'organizer' ? `border-color:${accentDark};background-color:${accentDark}0d;` : ''}>
									<input
										type="radio"
										name="billing"
										checked={billingMode === 'organizer'}
										onchange={() => (billingMode = 'organizer')}
									/>
									<span class="text-sm font-medium text-gray-900">Someone else (not attending)</span>
								</label>
							</div>

							{#if billingMode === 'organizer'}
								<div class="mt-4 space-y-3 rounded-lg border border-gray-200 p-3">
									<div>
										<label for="organizerName" class="block text-sm font-medium text-gray-900">
											Billing name <span class="text-red-500">*</span>
										</label>
										<input
											type="text"
											id="organizerName"
											bind:value={organizerName}
											class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none"
											class:border-red-500={organizerErrors.name}
										/>
										{#if organizerErrors.name}
											<p class="mt-1 text-xs text-red-500">{organizerErrors.name}</p>
										{/if}
									</div>
									<div>
										<label for="organizerEmail" class="block text-sm font-medium text-gray-900">
											Billing email <span class="text-red-500">*</span>
										</label>
										<input
											type="email"
											id="organizerEmail"
											bind:value={organizerEmail}
											class="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:outline-none"
											class:border-red-500={organizerErrors.email}
										/>
										{#if organizerErrors.email}
											<p class="mt-1 text-xs text-red-500">{organizerErrors.email}</p>
										{/if}
									</div>
								</div>
							{/if}

							<button
								type="button"
								onclick={proceedFromBilling}
								class="mt-5 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus:outline-none"
								style="background-color: {accentDark};"
							>
								Continue
							</button>
						</div>

					{:else}
						<!-- STEP 3: Review + price + confirm -->
						<div class="mx-auto w-full max-w-sm">
							<button
								type="button"
								class="mb-3 inline-flex items-center gap-1 text-sm font-medium text-gray-500 hover:text-gray-800"
								onclick={backFromReview}
							>
								<ChevronDown class="h-3.5 w-3.5 rotate-90" /> Back
							</button>

							<h1 class="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
								Review &amp; confirm
							</h1>
							<p class="mt-1 text-sm text-gray-500">Check the details before continuing.</p>

							<!-- Participants -->
							<div class="mt-5 rounded-xl border border-gray-200">
								<div class="flex items-center justify-between border-b border-gray-100 px-4 py-2.5">
									<span class="text-xs font-semibold uppercase tracking-wide text-gray-500">
										{participants.length} {participants.length === 1 ? 'Participant' : 'Participants'}
									</span>
									{#if !showEmbedded}
										<button type="button" class="text-xs font-medium text-gray-500 hover:text-gray-800" onclick={() => (step = 1)}>
											Edit
										</button>
									{/if}
								</div>
								<ul class="divide-y divide-gray-100">
									{#each participants as p}
										<li class="flex items-center justify-between gap-3 px-4 py-2.5">
											<span class="min-w-0">
												<span class="block truncate text-sm font-medium text-gray-900">{displayName(p)}</span>
												<span class="block truncate text-xs text-gray-500">{p.email}</span>
											</span>
										</li>
									{/each}
								</ul>
							</div>

							<!-- Hub + billing summary -->
							<dl class="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-200">
								{#if displayHub}
									<div class="flex justify-between gap-4 px-4 py-3">
										<dt class="text-sm text-gray-500">Hub</dt>
										<dd class="text-sm font-medium text-gray-900 text-right">{displayHub.name}</dd>
									</div>
								{/if}
								<div class="flex justify-between gap-4 px-4 py-3">
									<dt class="text-sm text-gray-500">Billing contact</dt>
									<dd class="text-sm font-medium text-gray-900 text-right">
										{billingDisplay().name}
										<span class="block text-xs font-normal text-gray-500 break-all">{billingDisplay().email}</span>
									</dd>
								</div>
							</dl>

							<!-- Price -->
							<div class="mt-5 rounded-xl px-4 py-4" style="background-color: {accentDark}14;">
								<div class="flex items-center justify-between">
									<span class="text-sm font-semibold uppercase tracking-wide text-gray-600">Total</span>
									{#if currentPricing.isFree}
										<span class="text-2xl font-bold text-gray-900">Free</span>
									{:else}
										<span class="text-2xl font-bold text-gray-900">{formatPrice(lineTotal, currentPricing.currency)}</span>
									{/if}
								</div>
								{#if !currentPricing.isFree && participants.length > 1}
									<p class="mt-1 text-right text-xs text-gray-500">
										{participants.length} × {formatPrice(currentPricing.amount, currentPricing.currency)}
									</p>
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
					{#if displayHub}
						<div class="rounded-lg px-3.5 py-2.5" style="background-color: rgba(255,255,255,0.1);">
							<p class="text-[10px] font-semibold uppercase tracking-wider text-white/50">Location</p>
							<p class="mt-0.5 text-sm font-semibold">{displayHub.name}</p>
						</div>
					{/if}
				</div>

				{#if step === 3}
					<div class="border-t pt-5" style="border-color: rgba(255,255,255,0.15);">
						<p class="text-xs font-semibold uppercase tracking-widest text-white/50">
							{participants.length > 1 ? `Enrollment · ${participants.length} participants` : 'Enrollment'}
						</p>
						{#if currentPricing.isFree}
							<p class="mt-1 text-4xl font-bold">Free</p>
						{:else}
							<p class="mt-1 text-4xl font-bold">{formatPrice(lineTotal, currentPricing.currency)}</p>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	</div>
</div>

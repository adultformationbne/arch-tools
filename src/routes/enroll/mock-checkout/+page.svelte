<script lang="ts">
	import { goto } from '$app/navigation';
	import { Lock, AlertTriangle } from '$lib/icons';
	import EnrollmentProgressStepper from '$lib/components/EnrollmentProgressStepper.svelte';
	import FullPageLoadingOverlay from '$lib/components/FullPageLoadingOverlay.svelte';

	let { data } = $props();

	let isProcessing = $state(false);
	let cardNumber = $state('4242 4242 4242 4242');
	let expiry = $state('12/28');
	let cvc = $state('123');
	let showLoadingOverlay = $state(false);

	function formatPrice(cents: number, currency: string): string {
		return new Intl.NumberFormat('en-AU', {
			style: 'currency',
			currency: currency.toUpperCase()
		}).format(cents / 100);
	}

	async function handlePayment() {
		isProcessing = true;

		// Simulate payment processing delay
		await new Promise((resolve) => setTimeout(resolve, 1500));

		// Show loading overlay during redirect
		showLoadingOverlay = true;

		// Redirect to success URL
		goto(data.successUrl.replace('{CHECKOUT_SESSION_ID}', data.sessionId));
	}

	function handleCancel() {
		goto(data.cancelUrl);
	}
</script>

<svelte:head>
	<title>Mock Checkout - Test Payment</title>
</svelte:head>

<!-- Full page loading overlay -->
<FullPageLoadingOverlay
	show={showLoadingOverlay}
	message="Payment successful!"
	subMessage="Redirecting to complete your registration..."
/>

<div class="min-h-screen bg-gray-100 py-8 sm:py-12">
	<div class="mx-auto max-w-lg px-4">
		<!-- Progress stepper -->
		<div class="mb-6">
			<EnrollmentProgressStepper flow="paid" currentStep={2} />
		</div>

		<!-- Mock mode warning -->
		<div class="mb-6 flex items-center gap-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
			<AlertTriangle class="h-5 w-5 shrink-0 text-yellow-600" />
			<div class="text-sm">
				<p class="font-medium text-yellow-800">Mock Payment Mode</p>
				<p class="text-yellow-700">
					This is a simulated checkout for testing. No real payment will be processed.
				</p>
			</div>
		</div>

		<!-- Checkout card -->
		<div class="overflow-hidden rounded-xl bg-white shadow-lg">
			<!-- Header -->
			<div class="border-b bg-gray-50 px-6 py-4">
				<div class="flex items-center justify-between">
					<h1 class="text-lg font-semibold text-gray-900">Checkout</h1>
					<div class="flex items-center gap-1 text-sm text-gray-500">
						<Lock class="h-4 w-4" />
						<span>Secure</span>
					</div>
				</div>
			</div>

			<!-- Order summary -->
			<div class="border-b bg-gray-50 px-6 py-4">
				<div class="flex items-center justify-between">
					<div>
						<p class="font-medium text-gray-900">Course Enrollment</p>
						<p class="text-sm text-gray-500">{data.email}</p>
					</div>
					<p class="text-xl font-bold text-gray-900">
						{formatPrice(data.amount, data.currency)}
					</p>
				</div>
			</div>

			<!-- Payment form -->
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handlePayment();
				}}
				class="space-y-4 p-6"
			>
				<div>
					<label for="card" class="mb-1 block text-sm font-medium text-gray-700">
						Card number
					</label>
					<input
						type="text"
						id="card"
						bind:value={cardNumber}
						class="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
						placeholder="1234 1234 1234 1234"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="expiry" class="mb-1 block text-sm font-medium text-gray-700">
							Expiry
						</label>
						<input
							type="text"
							id="expiry"
							bind:value={expiry}
							class="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
							placeholder="MM/YY"
						/>
					</div>
					<div>
						<label for="cvc" class="mb-1 block text-sm font-medium text-gray-700">
							CVC
						</label>
						<input
							type="text"
							id="cvc"
							bind:value={cvc}
							class="block w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
							placeholder="123"
						/>
					</div>
				</div>

				<button
					type="submit"
					disabled={isProcessing}
					class="mt-4 w-full rounded-lg bg-blue-600 py-3 text-center font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if isProcessing}
						<span class="inline-flex items-center gap-2">
							<svg class="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
								<circle
									cx="12"
									cy="12"
									r="10"
									stroke="currentColor"
									stroke-width="4"
									class="opacity-25"
								/>
								<path
									fill="currentColor"
									d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
									class="opacity-75"
								/>
							</svg>
							Processing...
						</span>
					{:else}
						Pay {formatPrice(data.amount, data.currency)}
					{/if}
				</button>
			</form>

			<!-- Cancel link -->
			<div class="border-t px-6 py-4 text-center">
				<button onclick={handleCancel} class="text-sm text-gray-500 hover:text-gray-700 hover:underline">
					Cancel and return to enrollment
				</button>
			</div>
		</div>

		<!-- Test card info -->
		<div class="mt-6 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
			<p class="font-medium">Test Card Pre-filled</p>
			<p class="mt-1">
				The form is pre-filled with test card details. Just click "Pay" to simulate a successful
				payment.
			</p>
		</div>
	</div>
</div>

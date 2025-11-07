<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	export let data;
	const { supabase } = data;

	let code = $state('');
	let loading = $state(false);
	let errorMessage = $state('');

	// Auto-fill code from URL if present
	onMount(() => {
		const urlCode = $page.url.searchParams.get('code');
		if (urlCode) {
			code = urlCode.toUpperCase();
		}
	});

	// Format code as user types (ABC-123)
	function formatCode(value) {
		// Remove non-alphanumeric characters except dash
		let cleaned = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');

		// Remove existing dashes
		cleaned = cleaned.replace(/-/g, '');

		// Add dash after 3rd character
		if (cleaned.length > 3) {
			cleaned = cleaned.slice(0, 3) + '-' + cleaned.slice(3, 6);
		}

		return cleaned;
	}

	function handleCodeInput(e) {
		code = formatCode(e.target.value);
	}

	async function handleSubmit() {
		loading = true;
		errorMessage = '';

		try {
			// Validate code and send OTP
			const response = await fetch('/api/auth/redeem-invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Invalid invitation code');
			}

			// Code is valid - OTP has been sent to user's email
			// Redirect to /login for OTP verification
			// SECURITY: We don't get the email back from API (prevents harvesting)
			goto('/login?mode=otp&from=invite');
		} catch (error) {
			errorMessage = error.message;
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
	<div class="w-full max-w-md space-y-8">
		<div>
			<!-- Archdiocesan Cross Mark Logo -->
			<div class="flex justify-center mb-6">
				<img
					src="/archmin-mark.png"
					alt="Archdiocesan Ministry Tools"
					class="w-24 h-24 object-contain"
				/>
			</div>

			<h1 class="mb-2 text-center text-2xl font-semibold text-black">
				Redeem Invitation Code
			</h1>
			<p class="text-center text-sm text-neutral-600">
				Enter the invitation code you received
			</p>
		</div>

		<form class="mt-8 space-y-6" onsubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
			<div>
				<label for="code" class="block text-sm font-medium text-black mb-2">
					Invitation Code
				</label>
				<input
					id="code"
					type="text"
					bind:value={code}
					oninput={handleCodeInput}
					maxlength="7"
					placeholder="ABC-123"
					required
					class="block w-full border-2 border-black px-4 py-3 text-center text-2xl font-mono tracking-widest text-black placeholder-neutral-400 focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none uppercase"
					disabled={loading}
				/>
				<p class="mt-2 text-xs text-neutral-500 text-center">
					Format: ABC-123 (6 characters)
				</p>
			</div>

			{#if errorMessage}
				<div class="bg-red-50 p-3 text-center text-sm text-red-800 border-2 border-red-200">
					{errorMessage}
				</div>
			{/if}

			<div>
				<button
					type="submit"
					disabled={loading || code.length < 7}
					class="group relative flex w-full justify-center border-2 border-black bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 focus:ring-2 focus:ring-black/20 focus:ring-offset-2 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{loading ? 'Verifying...' : 'Continue'}
				</button>
			</div>

			<div class="text-center">
				<a href="/login" class="text-sm text-black hover:text-neutral-700 underline">
					← Back to login
				</a>
			</div>
		</form>

		<div class="mt-6 bg-neutral-100 p-4 border-2 border-neutral-300">
			<p class="text-xs text-neutral-700">
				<strong class="text-black">Don't have an invitation code?</strong> Contact your administrator to receive an invitation to the platform.
			</p>
		</div>
	</div>
</div>

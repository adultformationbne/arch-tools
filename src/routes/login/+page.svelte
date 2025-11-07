<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { data } = $props();
	const { supabase } = data;

	// Auth flow states
	type AuthStep = 'email' | 'password' | 'otp';
	let currentStep = $state<AuthStep>('email');

	let email = $state('');
	let password = $state('');
	let otp = $state('');

	let loading = $state(false);
	let errorMessage = $state('');
	let infoMessage = $state('');

	// Check for URL parameters on mount (e.g., from invite flow)
	onMount(async () => {
		const urlMode = $page.url.searchParams.get('mode');
		const fromInvite = $page.url.searchParams.get('from');

		if (urlMode === 'otp') {
			currentStep = 'otp';
			if (fromInvite === 'invite') {
				infoMessage = 'Please enter your email and the 6-digit code that was sent to you';
			} else {
				infoMessage = 'Please enter the 6-digit code sent to your email';
			}
		}

		// Handle legacy hash-based auth (backwards compatibility)
		const hash = window.location.hash;
		if (hash && hash.includes('access_token') && hash.includes('type=invite')) {
			loading = true;
			try {
				const { data: { session }, error } = await supabase.auth.getSession();
				if (error) throw error;
				if (session?.user) {
					const next = $page.url.searchParams.get('next') ?? '/profile';
					goto(`/login/setup-password?next=${encodeURIComponent(next)}`);
					return;
				}
			} catch (error) {
				console.error('Error handling invite:', error);
				errorMessage = error.message || 'Failed to process invitation';
			} finally {
				loading = false;
			}
		}
	});

	// Step 1: Check email and determine next step
	async function handleEmailSubmit() {
		if (!email) {
			errorMessage = 'Please enter your email address';
			return;
		}

		loading = true;
		errorMessage = '';
		infoMessage = '';

		try {
			const response = await fetch('/api/auth/check-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email })
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.message || 'Failed to check email');
			}

			// Move to appropriate next step
			if (result.nextStep === 'password') {
				// Existing user with password
				currentStep = 'password';
				infoMessage = result.message;
			} else if (result.nextStep === 'otp') {
				// Pending user or existing user without password - send OTP
				const { error: otpError } = await supabase.auth.signInWithOtp({
					email,
					options: { shouldCreateUser: false }
				});

				if (otpError) {
					errorMessage = 'Failed to send verification code. Please try again.';
					loading = false;
					return;
				}

				currentStep = 'otp';
				infoMessage = 'A 6-digit code has been sent to your email';
			} else {
				// User doesn't exist and no invitation found
				errorMessage = 'No invitation found for this email. Please contact your administrator or use an invitation code.';
			}
		} catch (error) {
			errorMessage = error.message || 'Failed to verify email';
		} finally {
			loading = false;
		}
	}

	// Step 2a: Password login
	async function handlePasswordSubmit() {
		loading = true;
		errorMessage = '';

		try {
			const { data: authData, error } = await supabase.auth.signInWithPassword({
				email,
				password
			});

			if (error) {
				// Password failed - offer OTP as fallback
				errorMessage = 'Incorrect password. Sending verification code instead...';

				const { error: otpError } = await supabase.auth.signInWithOtp({
					email,
					options: { shouldCreateUser: false }
				});

				if (otpError) {
					errorMessage = 'Failed to send verification code. Please try again.';
					loading = false;
					return;
				}

				currentStep = 'otp';
				infoMessage = 'A 6-digit code has been sent to your email';
				password = ''; // Clear password field
				loading = false;
				return;
			}

			// Success - redirect based on user modules
			const { data: profile } = await supabase
				.from('user_profiles')
				.select('modules')
				.eq('id', authData.user.id)
				.single();

			const modules = profile?.modules || [];
			const defaultRedirect = determineRedirect(modules);
			const next = $page.url.searchParams.get('next') ?? defaultRedirect;
			goto(next);
		} catch (error) {
			errorMessage = error.message;
		} finally {
			loading = false;
		}
	}

	// Step 2b: OTP verification
	async function handleOtpSubmit() {
		loading = true;
		errorMessage = '';

		try {
			const { data: authData, error } = await supabase.auth.verifyOtp({
				email,
				token: otp,
				type: 'email'
			});

			if (error) throw error;

			// Mark invitation as accepted if from invite flow
			try {
				await fetch('/api/auth/complete-invitation', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email })
				});
			} catch (err) {
				console.error('Error marking invitation accepted:', err);
			}

			// Check if user has password set
			const user = authData.user;
			const hasPassword = user?.confirmed_at !== null;

			if (hasPassword) {
				// Existing user - redirect to dashboard
				const { data: profile } = await supabase
					.from('user_profiles')
					.select('modules')
					.eq('id', user.id)
					.single();

				const modules = profile?.modules || [];
				const defaultRedirect = determineRedirect(modules);
				goto(defaultRedirect);
			} else {
				// New user - needs to set up password
				goto('/login/setup-password');
			}
		} catch (error) {
			errorMessage = error.message || 'Invalid or expired code';
		} finally {
			loading = false;
		}
	}

	async function resendOtp() {
		if (!email) {
			errorMessage = 'Please enter your email address first';
			return;
		}

		loading = true;
		errorMessage = '';

		try {
			const { error } = await supabase.auth.signInWithOtp({
				email,
				options: { shouldCreateUser: false }
			});

			if (error) throw error;

			infoMessage = 'A new code has been sent to your email';
		} catch (error) {
			errorMessage = error.message || 'Failed to resend code';
		} finally {
			loading = false;
		}
	}

	function determineRedirect(modules: string[]) {
		if (modules.includes('users')) return '/users';
		if (modules.includes('courses.admin') || modules.includes('courses.manager')) return '/courses';
		if (modules.includes('dgr')) return '/dgr';
		if (modules.includes('editor')) return '/editor';
		if (modules.includes('courses.participant')) return '/my-courses';
		return '/profile';
	}

	function goBackToEmail() {
		currentStep = 'email';
		password = '';
		otp = '';
		errorMessage = '';
		infoMessage = '';
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-neutral-50">
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
				Archdiocesan Ministry Tools
			</h1>
			<h2 class="text-center text-base text-neutral-600">
				{#if currentStep === 'email'}
					Sign in to your account
				{:else if currentStep === 'password'}
					Enter your password
				{:else if currentStep === 'otp'}
					Enter verification code
				{/if}
			</h2>
		</div>

		<!-- Step 1: Email Input -->
		{#if currentStep === 'email'}
			<form class="mt-8 space-y-6" onsubmit={(e) => { e.preventDefault(); handleEmailSubmit(); }}>
				<div>
					<input
						bind:value={email}
						type="email"
						required
						autofocus
						class="relative block w-full border-2 border-black px-4 py-3 text-black placeholder-neutral-400 focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none"
						placeholder="Email address"
					/>
				</div>

				{#if errorMessage}
					<div class="text-center text-sm text-red-600">{errorMessage}</div>
				{/if}
				{#if infoMessage}
					<div class="text-center text-sm text-neutral-700">{infoMessage}</div>
				{/if}

				<div>
					<button
						type="submit"
						disabled={loading}
						class="group relative flex w-full justify-center border-2 border-black bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 focus:ring-2 focus:ring-black/20 focus:ring-offset-2 focus:outline-none disabled:opacity-50 transition-colors"
					>
						{loading ? 'Checking...' : 'Continue'}
					</button>
				</div>

				<div class="text-center">
					<a
						href="/login/invite"
						class="text-sm text-black hover:text-neutral-700 underline"
					>
						Have an invitation code?
					</a>
				</div>
			</form>
		{/if}

		<!-- Step 2a: Password Input -->
		{#if currentStep === 'password'}
			<form class="mt-8 space-y-6" onsubmit={(e) => { e.preventDefault(); handlePasswordSubmit(); }}>
				<div class="text-center text-sm text-neutral-600 mb-4">
					Signing in as <strong class="text-black">{email}</strong>
				</div>

				<div>
					<input
						bind:value={password}
						type="password"
						required
						autofocus
						class="relative block w-full border-2 border-black px-4 py-3 text-black placeholder-neutral-400 focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none"
						placeholder="Password"
					/>
				</div>

				{#if errorMessage}
					<div class="text-center text-sm text-red-600">{errorMessage}</div>
				{/if}
				{#if infoMessage}
					<div class="text-center text-sm text-neutral-700">{infoMessage}</div>
				{/if}

				<div>
					<button
						type="submit"
						disabled={loading}
						class="group relative flex w-full justify-center border-2 border-black bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 focus:ring-2 focus:ring-black/20 focus:ring-offset-2 focus:outline-none disabled:opacity-50 transition-colors"
					>
						{loading ? 'Signing in...' : 'Sign in'}
					</button>
				</div>

				<div class="text-center">
					<button
						type="button"
						onclick={goBackToEmail}
						class="text-sm text-black hover:text-neutral-700 underline"
					>
						← Use a different email
					</button>
				</div>
			</form>
		{/if}

		<!-- Step 2b: OTP Input -->
		{#if currentStep === 'otp'}
			<form class="mt-8 space-y-6" onsubmit={(e) => { e.preventDefault(); handleOtpSubmit(); }}>
				<div class="text-center text-sm text-neutral-600 mb-4">
					Code sent to <strong class="text-black">{email}</strong>
				</div>

				<div>
					<input
						bind:value={otp}
						type="text"
						inputmode="numeric"
						pattern="[0-9]*"
						maxlength="6"
						required
						autofocus
						class="relative block w-full border-2 border-black px-4 py-4 text-black placeholder-neutral-300 text-center text-3xl tracking-[0.5em] font-mono focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none"
						placeholder="000000"
						autocomplete="one-time-code"
					/>
				</div>

				{#if errorMessage}
					<div class="text-center text-sm text-red-600">{errorMessage}</div>
				{/if}
				{#if infoMessage}
					<div class="text-center text-sm text-neutral-700">{infoMessage}</div>
				{/if}

				<div>
					<button
						type="submit"
						disabled={loading}
						class="group relative flex w-full justify-center border-2 border-black bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 focus:ring-2 focus:ring-black/20 focus:ring-offset-2 focus:outline-none disabled:opacity-50 transition-colors"
					>
						{loading ? 'Verifying...' : 'Verify Code'}
					</button>
				</div>

				<div class="flex justify-between text-sm">
					<button
						type="button"
						onclick={resendOtp}
						disabled={loading}
						class="text-black hover:text-neutral-700 underline disabled:opacity-50"
					>
						Resend code
					</button>
					<button
						type="button"
						onclick={goBackToEmail}
						class="text-black hover:text-neutral-700 underline"
					>
						← Change email
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>

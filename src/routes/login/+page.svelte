<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	let { data } = $props();
	const supabase = $derived(data.supabase);
	const platform = $derived(data.platform);
	const courseBranding = $derived(data.courseBranding);

	// Course-specific values (only used when courseBranding is present)
	const accentColor = $derived(courseBranding?.accentDark || null);

	// Auth flow states
	type AuthStep = 'email' | 'password' | 'otp';
	let currentStep = $state<AuthStep>('email');

	let email = $state('');
	let password = $state('');
	let otp = $state('');

	let loading = $state(false);
	let errorMessage = $state('');
	let infoMessage = $state('');

	// Track if user is a new/pending user (no password set yet)
	let isPendingUser = $state(false);

	// Track if user is in forgot password flow
	let isForgotPasswordFlow = $state(false);

	// Track if auto-send has been attempted (prevent duplicate sends)
	let autoSendAttempted = $state(false);

	// Track if we're in auto-send flow (for better UX messaging)
	let isAutoSendFlow = $state(false);

	// Helper: Validate email format
	function isValidEmail(email: string): boolean {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
	}

	// Helper: Clear sensitive params from URL without page reload
	function clearSensitiveParams() {
		const url = new URL(window.location.href);
		url.searchParams.delete('email');
		url.searchParams.delete('send');
		window.history.replaceState({}, '', url.toString());
	}

	// Helper: Generate unique key for session storage (prevents re-sends on refresh)
	function getAutoSendKey(email: string): string {
		return `login_auto_send_${email}_${Date.now().toString().slice(0, -4)}`; // 10-second buckets
	}

	// Check for URL parameters on mount
	onMount(async () => {
		// 1. First check if user is already authenticated
		try {
			const { data: { session } } = await supabase.auth.getSession();
			if (session?.user) {
				// Already logged in - redirect to appropriate destination
				const next = $page.url.searchParams.get('next');
				const courseParam = $page.url.searchParams.get('course');

				if (next) {
					goto(next);
				} else if (courseParam) {
					goto(`/courses/${courseParam}`);
				} else {
					// Determine redirect based on user profile
					const { data: profile } = await supabase
						.from('user_profiles')
						.select('modules')
						.eq('id', session.user.id)
						.single();

					const modules = profile?.modules || [];
					goto(determineRedirect(modules));
				}
				return;
			}
		} catch (e) {
			// Not authenticated, continue with login flow
		}

		// 2. Handle URL parameters
		const urlMode = $page.url.searchParams.get('mode');
		const urlEmail = $page.url.searchParams.get('email');
		const autoSend = $page.url.searchParams.get('send') === 'true';

		if (urlMode === 'otp') {
			currentStep = 'otp';
			infoMessage = 'Please enter the 6-digit code sent to your email';
		}

		// 3. Pre-fill and optionally auto-send
		if (urlEmail) {
			const decodedEmail = decodeURIComponent(urlEmail).trim().toLowerCase();

			// Validate email format
			if (!isValidEmail(decodedEmail)) {
				errorMessage = 'Invalid email format in link. Please enter your email manually.';
				clearSensitiveParams();
				return;
			}

			email = decodedEmail;

			// Auto-send OTP if send=true param is present
			if (autoSend && currentStep === 'email' && !autoSendAttempted) {
				// Check sessionStorage to prevent re-sends on page refresh/back button
				const autoSendKey = `login_auto_send_${decodedEmail}`;
				const lastAutoSend = sessionStorage.getItem(autoSendKey);
				const now = Date.now();

				// Only auto-send if we haven't sent in the last 30 seconds
				if (!lastAutoSend || (now - parseInt(lastAutoSend)) > 30000) {
					isAutoSendFlow = true;
					autoSendAttempted = true;
					sessionStorage.setItem(autoSendKey, now.toString());

					// Clear sensitive params from URL (email visible in browser history)
					clearSensitiveParams();

					// Small delay to ensure UI is ready, then auto-submit
					infoMessage = 'Checking your account...';
					loading = true;

					setTimeout(async () => {
						await handleAutoSend(decodedEmail);
					}, 200);
				} else {
					// Recent auto-send detected - just show the form with email pre-filled
					clearSensitiveParams();
					infoMessage = 'A verification code was recently sent to your email.';
				}
			} else {
				// Just pre-fill, don't auto-send
				clearSensitiveParams();
			}
		}

		// 4. Handle legacy hash-based auth (backwards compatibility)
		const hash = window.location.hash;
		if (hash && hash.includes('access_token') && hash.includes('type=invite')) {
			loading = true;
			try {
				const { data: { session }, error } = await supabase.auth.getSession();
				if (error) throw error;
				if (session?.user) {
					const next = $page.url.searchParams.get('next') ?? '/profile';
					const courseParam = $page.url.searchParams.get('course');
					const setupUrl = `/login/setup-password?next=${encodeURIComponent(next)}${courseParam ? `&course=${encodeURIComponent(courseParam)}` : ''}`;
					goto(setupUrl);
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

	// Dedicated auto-send handler with better error handling
	async function handleAutoSend(emailAddress: string) {
		try {
			// Check if email exists and get auth path
			const response = await fetch('/api/auth/check-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: emailAddress })
			});

			const result = await response.json();

			if (!response.ok || !result.exists) {
				// Email not found - show helpful error
				errorMessage = result.message || 'No account found with this email. Please contact your administrator.';
				loading = false;
				isAutoSendFlow = false;
				return;
			}

			if (result.nextStep === 'password') {
				// User has a password - don't auto-send OTP, let them enter password
				currentStep = 'password';
				isPendingUser = false;
				infoMessage = 'Welcome back! Enter your password to continue.';
				loading = false;
				isAutoSendFlow = false;
				return;
			}

			if (result.nextStep === 'otp') {
				// Pending user - send OTP automatically
				isPendingUser = true;

				const { error: otpError } = await supabase.auth.signInWithOtp({
					email: emailAddress,
					options: { shouldCreateUser: false }
				});

				if (otpError) {
					// Check for rate limiting
					if (otpError.message?.includes('rate') || otpError.status === 429) {
						errorMessage = 'Too many attempts. Please wait a moment before trying again.';
					} else {
						errorMessage = 'Failed to send verification code. Please try again.';
					}
					loading = false;
					isAutoSendFlow = false;
					return;
				}

				currentStep = 'otp';
				infoMessage = 'A 6-digit verification code has been sent to your email.';
				loading = false;
				// Keep isAutoSendFlow true so we can show appropriate messaging
			}
		} catch (error) {
			console.error('Auto-send error:', error);
			errorMessage = 'Something went wrong. Please try again.';
			loading = false;
			isAutoSendFlow = false;
		}
	}

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
				isPendingUser = false;
				infoMessage = result.message;
			} else if (result.nextStep === 'otp') {
				// Pending user (no password set yet) - send OTP
				isPendingUser = true;
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
				// User doesn't exist
				errorMessage = result.message || 'No account found. Please contact your administrator.';
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
				// Password failed - show error
				errorMessage = 'Incorrect password. Please try again or use a verification code instead.';
				loading = false;
				return;
			}

			// Track login for course enrollments (non-blocking)
			fetch('/api/auth/track-login', { method: 'POST' }).catch(() => {});

			// Success - redirect based on user modules
			const { data: profile } = await supabase
				.from('user_profiles')
				.select('modules')
				.eq('id', authData.user.id)
				.single();

			const modules = profile?.modules || [];
			let defaultRedirect = determineRedirect(modules);

			// If no module-based redirect, check for course enrollments
			if (defaultRedirect === '/profile') {
				const { data: enrollments } = await supabase
					.from('courses_enrollments')
					.select('id')
					.eq('email', email)
					.eq('status', 'active')
					.limit(1);

				if (enrollments && enrollments.length > 0) {
					defaultRedirect = '/my-courses';
				}
			}

			const next = $page.url.searchParams.get('next') ?? defaultRedirect;
			goto(next);
		} catch (error) {
			errorMessage = error.message;
		} finally {
			loading = false;
		}
	}

	// Send OTP code for password fallback
	async function sendOtpFallback() {
		loading = true;
		errorMessage = '';

		try {
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
			isPendingUser = false; // Existing user using OTP fallback
			isForgotPasswordFlow = false;
			infoMessage = 'A 6-digit code has been sent to your email';
			password = ''; // Clear password field
		} catch (error) {
			errorMessage = error.message || 'Failed to send code';
		} finally {
			loading = false;
		}
	}

	// Forgot password flow - send OTP to reset password
	async function handleForgotPassword() {
		loading = true;
		errorMessage = '';

		try {
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
			isForgotPasswordFlow = true;
			infoMessage = 'A 6-digit code has been sent to your email to reset your password';
			password = ''; // Clear password field
		} catch (error) {
			errorMessage = error.message || 'Failed to send code';
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

			// Check if user needs to set up password
			const user = authData.user;

			if (isPendingUser || isForgotPasswordFlow) {
				// New/pending user OR forgot password flow - needs to set/reset password
				// Determine best redirect based on user's modules
				const { data: profile } = await supabase
					.from('user_profiles')
					.select('modules')
					.eq('id', user.id)
					.single();

				const modules = profile?.modules || [];
				let defaultRedirect = determineRedirect(modules);

				// If no module-based redirect, check for course enrollments
				if (defaultRedirect === '/profile') {
					const { data: enrollments } = await supabase
						.from('courses_enrollments')
						.select('id')
						.eq('email', email)
						.eq('status', 'active')
						.limit(1);

					if (enrollments && enrollments.length > 0) {
						defaultRedirect = '/my-courses';
					}
				}

				const next = $page.url.searchParams.get('next') ?? defaultRedirect;
				const courseParam = $page.url.searchParams.get('course');
				const setupUrl = `/login/setup-password?next=${encodeURIComponent(next)}${courseParam ? `&course=${encodeURIComponent(courseParam)}` : ''}`;
				goto(setupUrl);
			} else {
				// Track login for course enrollments (non-blocking)
				fetch('/api/auth/track-login', { method: 'POST' }).catch(() => {});

				// Existing user logging in with OTP - redirect to dashboard
				const { data: profile } = await supabase
					.from('user_profiles')
					.select('modules')
					.eq('id', user.id)
					.single();

				const modules = profile?.modules || [];
				let defaultRedirect = determineRedirect(modules);

				// If no module-based redirect, check for course enrollments
				if (defaultRedirect === '/profile') {
					const { data: enrollments } = await supabase
						.from('courses_enrollments')
						.select('id')
						.eq('email', email)
						.eq('status', 'active')
						.limit(1);

					if (enrollments && enrollments.length > 0) {
						defaultRedirect = '/my-courses';
					}
				}

				const next = $page.url.searchParams.get('next') ?? defaultRedirect;
				goto(next);
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
		if (modules.includes('platform.admin')) return '/settings';
		if (modules.includes('courses.admin') || modules.includes('courses.manager')) return '/courses';
		if (modules.includes('dgr')) return '/dgr';
		if (modules.includes('courses.participant')) return '/my-courses';
		return '/profile';
	}

	function goBackToEmail() {
		currentStep = 'email';
		password = '';
		otp = '';
		errorMessage = '';
		infoMessage = '';
		isPendingUser = false;
		isForgotPasswordFlow = false;
	}
</script>

{#snippet loginForms()}
	<!-- Auto-send loading state - show when checking account from email link -->
	{#if currentStep === 'email' && isAutoSendFlow && loading}
		<div class="mt-8 space-y-6 text-center">
			<div class="flex justify-center">
				<svg class="animate-spin h-8 w-8 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
				</svg>
			</div>
			<div class="text-sm text-neutral-600">
				<p class="font-medium text-black">{email}</p>
				<p class="mt-1">Preparing your login...</p>
			</div>
			{#if errorMessage}
				<div class="text-center text-sm text-red-600">{errorMessage}</div>
			{/if}
			<div class="pt-4">
				<button
					type="button"
					onclick={() => { isAutoSendFlow = false; loading = false; }}
					class="text-xs text-neutral-500 hover:text-neutral-700 underline"
				>
					Taking too long? Enter email manually
				</button>
			</div>
		</div>
	<!-- Step 1: Email Input (normal flow) -->
	{:else if currentStep === 'email'}
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

			<div class="space-y-3">
				<button
					type="submit"
					disabled={loading}
					class="group relative flex w-full justify-center border-2 border-black bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 focus:ring-2 focus:ring-black/20 focus:ring-offset-2 focus:outline-none disabled:opacity-50 transition-colors"
				>
					{loading ? 'Signing in...' : 'Sign in'}
				</button>

				<button
					type="button"
					onclick={sendOtpFallback}
					disabled={loading}
					class="group relative flex w-full justify-center border-2 border-black bg-white px-4 py-3 text-sm font-semibold text-black hover:bg-neutral-50 focus:ring-2 focus:ring-black/20 focus:ring-offset-2 focus:outline-none disabled:opacity-50 transition-colors"
				>
					{loading ? 'Sending code...' : 'Send me a login code instead'}
				</button>
			</div>

			<div class="flex justify-between text-sm">
				<button
					type="button"
					onclick={handleForgotPassword}
					disabled={loading}
					class="text-black hover:text-neutral-700 underline disabled:opacity-50"
				>
					Forgot password?
				</button>
				<button
					type="button"
					onclick={goBackToEmail}
					class="text-black hover:text-neutral-700 underline"
				>
					← Use a different email
				</button>
			</div>
		</form>
	{/if}

	<!-- Step 2b: OTP Input -->
	{#if currentStep === 'otp'}
		<form class="mt-8 space-y-6" onsubmit={(e) => { e.preventDefault(); handleOtpSubmit(); }}>
			{#if email}
				<div class="text-center text-sm text-neutral-600 mb-4">
					Code sent to <strong class="text-black">{email}</strong>
				</div>
			{:else}
				<div class="text-center text-sm text-neutral-600 mb-4">
					Enter your email and the verification code sent to you
				</div>
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
			{/if}

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
{/snippet}

{#if courseBranding}
<!-- Course-branded layout -->
<div
	class="flex min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8"
	style:--accent-color={accentColor}
	style:background-color={accentColor || '#fafafa'}
>
	<div class="flex flex-col items-center w-full max-w-md -mt-24">
		<img
			src={courseBranding.logoUrl || platform.logoPath}
			alt={courseBranding.name}
			class="w-56 h-56 object-contain -mb-2"
		/>

		<div class="w-full space-y-6 bg-white p-8 shadow-lg rounded-lg">
			<div>
				<h1 class="mb-2 text-center text-2xl font-semibold text-black">
					{courseBranding.name}
				</h1>
				<h2 class="text-center text-base text-neutral-600">
					{#if currentStep === 'email' && isAutoSendFlow && loading}
						Welcome back
					{:else if currentStep === 'email'}
						Sign in to your account
					{:else if currentStep === 'password'}
						Enter your password
					{:else if currentStep === 'otp'}
						Enter verification code
					{/if}
				</h2>
			</div>

			{@render loginForms()}
		</div>
	</div>
</div>
{:else}
<!-- Original platform layout -->
<div class="flex min-h-screen items-center justify-center bg-neutral-50 px-4 sm:px-6 lg:px-8">
	<div class="w-full max-w-md space-y-8">
		<div>
			<div class="flex justify-center mb-6">
				<img
					src={platform.logoPath}
					alt={platform.name}
					class="w-24 h-24 object-contain"
				/>
			</div>

			<h1 class="mb-2 text-center text-2xl font-semibold text-black">
				{platform.name}
			</h1>
			<h2 class="text-center text-base text-neutral-600">
				{#if currentStep === 'email' && isAutoSendFlow && loading}
					Welcome back
				{:else if currentStep === 'email'}
					Sign in to your account
				{:else if currentStep === 'password'}
					Enter your password
				{:else if currentStep === 'otp'}
					Enter verification code
				{/if}
			</h2>
		</div>

		{@render loginForms()}
	</div>
</div>
{/if}

<style>
	/* Apply course accent color to primary buttons when available */
	:global([style*="--accent-color"]) button[type="submit"] {
		background-color: var(--accent-color, black);
		border-color: var(--accent-color, black);
	}
	:global([style*="--accent-color"]) button[type="submit"]:hover {
		filter: brightness(0.9);
	}
</style>

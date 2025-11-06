<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	export let data;
	const { supabase } = data;

	let email = '';
	let password = '';
	let otp = '';
	let isSignUp = false;
	let showOtpInput = false;
	let loading = false;
	let errorMessage = '';

	// Note: Invite links now use /auth/confirm route with token_hash
	// This legacy hash fragment handler is kept for backwards compatibility only
	onMount(async () => {
		const hash = window.location.hash;

		// Check if this is a legacy invite link with tokens in the hash
		if (hash && hash.includes('access_token') && hash.includes('type=invite')) {
			loading = true;

			try {
				// Get the current session (Supabase should auto-handle hash tokens)
				const { data: { session }, error } = await supabase.auth.getSession();

				if (error) throw error;

				if (session?.user) {
					// User is authenticated via invite - redirect to password setup
					const next = $page.url.searchParams.get('next') ?? '/profile';
					goto(`/auth/setup-password?next=${encodeURIComponent(next)}`);
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

	async function handleAuth() {
		loading = true;
		errorMessage = '';

		try {
			if (isSignUp) {
				const { error } = await supabase.auth.signUp({
					email,
					password,
					options: {
						// Supabase will append token_hash and type=signup to this URL
						emailRedirectTo: window.location.origin + '/auth/confirm'
					}
				});
				if (error) throw error;
				errorMessage = 'Check your email for the confirmation link!';
			} else if (showOtpInput) {
				// Verify OTP code
				const { data: authData, error } = await supabase.auth.verifyOtp({
					email,
					token: otp,
					type: 'email'
				});
				if (error) throw error;

				// Successfully verified OTP - now redirect to password setup
				goto('/auth/setup-password');
			} else {
				// Try password login first
				const { data: authData, error } = await supabase.auth.signInWithPassword({
					email,
					password
				});

				if (error) {
					// Check if this might be a pending user who needs OTP
					if (error.message.includes('Invalid login credentials') || error.message.includes('Email not confirmed')) {
						// Show OTP input instead
						showOtpInput = true;
						errorMessage = 'Please enter the 6-digit code sent to your email';
						loading = false;
						return;
					}
					throw error;
				}

				// Check user modules after login for proper routing
				const { data: profile, error: profileError } = await supabase
					.from('user_profiles')
					.select('modules')
					.eq('id', authData.user.id)
					.single();

				// Determine redirect based on modules
				const modules = profile?.modules || [];
				let defaultRedirect = '/';

				// User management → /users
				if (modules.includes('users')) {
					defaultRedirect = '/users';
				}
				// Course management → /courses
				else if (modules.includes('courses.admin') || modules.includes('courses.manager')) {
					defaultRedirect = '/courses';
				}
				// DGR → /dgr
				else if (modules.includes('dgr')) {
					defaultRedirect = '/dgr';
				}
				// Editor → /editor
				else if (modules.includes('editor')) {
					defaultRedirect = '/editor';
				}
				// Course participant → /my-courses
				else if (modules.includes('courses.participant')) {
					defaultRedirect = '/my-courses';
				}
				// Fallback → /profile
				else {
					defaultRedirect = '/profile';
				}

				const next = $page.url.searchParams.get('next') ?? defaultRedirect;
				goto(next);
			}
		} catch (error) {
			errorMessage = error.message;
		} finally {
			loading = false;
		}
	}

	function toggleOtpInput() {
		showOtpInput = !showOtpInput;
		errorMessage = '';
		otp = '';
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50">
	<div class="w-full max-w-md space-y-8">
		<div>
			<h1 class="mt-6 mb-2 text-center text-2xl font-bold text-gray-900">
				Archdiocesan Ministry Tools
			</h1>
			<h2 class="text-center text-xl text-gray-600">
				{isSignUp ? 'Create your account' : 'Sign in to your account'}
			</h2>
		</div>
		<form class="mt-8 space-y-6" on:submit|preventDefault={handleAuth}>
			<div class="-space-y-px rounded-md shadow-sm">
				<div>
					<input
						bind:value={email}
						type="email"
						required
						disabled={showOtpInput && !isSignUp}
						class="relative block w-full rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none disabled:bg-gray-100"
						placeholder="Email address"
					/>
				</div>

				{#if showOtpInput && !isSignUp}
					<div>
						<input
							bind:value={otp}
							type="text"
							inputmode="numeric"
							pattern="[0-9]*"
							maxlength="6"
							required
							class="relative block w-full rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 text-center text-2xl tracking-widest font-mono focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
							placeholder="000000"
							autocomplete="one-time-code"
						/>
					</div>
				{:else}
					<div>
						<input
							bind:value={password}
							type="password"
							required
							class="relative block w-full rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
							placeholder="Password"
						/>
					</div>
				{/if}
			</div>

			{#if errorMessage}
				<div class="text-center text-sm" class:text-red-500={!errorMessage.includes('Please enter')} class:text-blue-600={errorMessage.includes('Please enter')}>
					{errorMessage}
				</div>
			{/if}

			<div>
				<button
					type="submit"
					disabled={loading}
					class="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
				>
					{loading ? 'Loading...' : showOtpInput ? 'Verify Code' : isSignUp ? 'Sign up' : 'Sign in'}
				</button>
			</div>

			{#if !isSignUp}
				<div class="text-center">
					<button
						type="button"
						onclick={toggleOtpInput}
						class="text-sm text-blue-600 hover:text-blue-500"
					>
						{showOtpInput ? 'Back to password login' : 'Have an invitation code?'}
					</button>
				</div>
			{/if}

			<div class="text-center">
				<button
					type="button"
					onclick={() => { isSignUp = !isSignUp; showOtpInput = false; errorMessage = ''; }}
					class="text-blue-600 hover:text-blue-500"
				>
					{isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
				</button>
			</div>
		</form>
	</div>
</div>

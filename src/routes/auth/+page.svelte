<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	export let data;
	const { supabase } = data;

	let email = '';
	let password = '';
	let isSignUp = false;
	let loading = false;
	let errorMessage = '';

	// Handle invite link hash fragments (e.g., #access_token=...&type=invite)
	onMount(async () => {
		const hash = window.location.hash;

		// Check if this is an invite link with tokens in the hash
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
					password
				});
				if (error) throw error;
				errorMessage = 'Check your email for the confirmation link!';
			} else {
				const { data: authData, error } = await supabase.auth.signInWithPassword({
					email,
					password
				});
				if (error) throw error;

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
						class="relative block w-full rounded-t-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
						placeholder="Email address"
					/>
				</div>
				<div>
					<input
						bind:value={password}
						type="password"
						required
						class="relative block w-full rounded-b-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
						placeholder="Password"
					/>
				</div>
			</div>

			{#if errorMessage}
				<div class="text-center text-sm text-red-500">{errorMessage}</div>
			{/if}

			<div>
				<button
					type="submit"
					disabled={loading}
					class="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
				>
					{loading ? 'Loading...' : isSignUp ? 'Sign up' : 'Sign in'}
				</button>
			</div>

			<div class="text-center">
				<button
					type="button"
					on:click={() => (isSignUp = !isSignUp)}
					class="text-blue-600 hover:text-blue-500"
				>
					{isSignUp ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
				</button>
			</div>
		</form>
	</div>
</div>

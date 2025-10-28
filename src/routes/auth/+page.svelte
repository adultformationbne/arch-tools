<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	export let data;
	const { supabase } = data;

	let email = '';
	let password = '';
	let isSignUp = false;
	let loading = false;
	let errorMessage = '';

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

				// Check user role after login for proper routing
				const { data: profile, error: profileError } = await supabase
					.from('user_profiles')
					.select('role')
					.eq('id', authData.user.id)
					.single();

				let defaultRedirect = '/';
				if (profile && ['admin', 'admin'].includes(profile.role)) {
					defaultRedirect = '/admin';
				} else if (profile && profile.role === 'courses_student') {
					defaultRedirect = '/dashboard';
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

<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	export let data;
	const { supabase } = data;

	let email = '';
	let password = '';
	let loading = false;
	let errorMessage = '';

	async function handleLogin() {
		loading = true;
		errorMessage = '';

		try {
			const { data: authData, error } = await supabase.auth.signInWithPassword({
				email,
				password
			});

			if (error) throw error;

			// Check user role after login
			const { data: profile, error: profileError } = await supabase
				.from('user_profiles')
				.select('role')
				.eq('id', authData.user.id)
				.single();

			if (profileError) {
				console.error('Error fetching user profile:', profileError);
				errorMessage = 'Error loading user profile. Please contact support.';
				return;
			}

			// Verify user has appropriate role for ACCF platform
			if (!['courses_student', 'admin', 'admin'].includes(profile.role)) {
				await supabase.auth.signOut();
				errorMessage = 'You do not have access to the ACCF platform. Please contact your coordinator.';
				return;
			}

			// Redirect to next page or dashboard
			const next = $page.url.searchParams.get('next') ?? '/dashboard';
			goto(next);
		} catch (error) {
			errorMessage = error.message;
		} finally {
			loading = false;
		}
	}

	// Check for error messages in URL params
	$: {
		const urlError = $page.url.searchParams.get('error');
		if (urlError === 'insufficient_permissions') {
			errorMessage = 'You do not have permission to access that page.';
		}
	}
</script>

<div class="max-w-md mx-auto">
	<div class="bg-white border rounded-lg shadow-sm p-6" style="border-color: var(--accf-light);">
		<div class="text-center mb-6">
			<h1 class="text-2xl mb-2 tracking-wide" style="color: var(--accf-dark); font-weight: 700;">
				ACCF Student Login
			</h1>
			<p class="text-sm" style="color: var(--accf-darkest);">
				Archdiocesan Center for Catholic Formation
			</p>
		</div>

		<form class="space-y-4" on:submit|preventDefault={handleLogin}>
			<div>
				<label for="email" class="block text-sm font-medium mb-2" style="color: var(--accf-darkest);">
					Email Address
				</label>
				<input
					bind:value={email}
					type="email"
					id="email"
					required
					class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-opacity-20 focus:outline-none"
					style="background-color: var(--accf-lightest); border-color: var(--accf-light); focus:border-color: var(--accf-accent); focus:ring-color: var(--accf-accent);"
					placeholder="Enter your email"
				>
			</div>

			<div>
				<label for="password" class="block text-sm font-medium mb-2" style="color: var(--accf-darkest);">
					Password
				</label>
				<input
					bind:value={password}
					type="password"
					id="password"
					required
					class="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-opacity-20 focus:outline-none"
					style="background-color: var(--accf-lightest); border-color: var(--accf-light); focus:border-color: var(--accf-accent); focus:ring-color: var(--accf-accent);"
					placeholder="Enter your password"
				>
			</div>

			{#if errorMessage}
				<div class="text-center text-sm p-3 rounded-lg" style="background-color: #fef2f2; color: #dc2626;">
					{errorMessage}
				</div>
			{/if}

			<button
				type="submit"
				disabled={loading}
				class="w-full font-semibold px-6 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50"
				style="background-color: var(--accf-accent); color: var(--accf-darkest);"
			>
				{loading ? 'Signing In...' : 'Sign In'}
			</button>
		</form>

		<div class="mt-6 text-center">
			<p class="text-sm" style="color: var(--accf-darkest);">
				Need help? Contact your course coordinator.
			</p>
		</div>
	</div>
</div>
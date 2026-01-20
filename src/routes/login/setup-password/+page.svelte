<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { KeyRound, CheckCircle } from '$lib/icons';

	let { data } = $props();
	const { supabase, user, platform } = data;

	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let success = $state(false);

	function determineRedirect(modules) {
		if (modules.includes('platform.admin')) return '/settings';
		if (modules.includes('courses.admin') || modules.includes('courses.manager')) return '/courses';
		if (modules.includes('dgr')) return '/dgr';
		if (modules.includes('courses.participant')) return '/my-courses';
		return '/profile';
	}

	async function handleSetPassword(event) {
		event?.preventDefault();
		loading = true;
		errorMessage = '';

		// Validation
		if (password.length < 6) {
			errorMessage = 'Password must be at least 6 characters';
			loading = false;
			return;
		}

		if (password !== confirmPassword) {
			errorMessage = 'Passwords do not match';
			loading = false;
			return;
		}

		try {
			// Update the user's password and set flag that password setup is complete
			const { error } = await supabase.auth.updateUser({
				password: password,
				data: {
					password_setup_completed: true
				}
			});

			if (error) throw error;

			// Track first login for course enrollments
			try {
				await fetch('/api/auth/track-login', { method: 'POST' });
			} catch (e) {
				// Non-blocking - don't fail password setup if tracking fails
				console.warn('Failed to track login:', e);
			}

			success = true;

			// Fetch user's modules to determine the best redirect
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
					.eq('email', user.email)
					.eq('status', 'active')
					.limit(1);

				if (enrollments && enrollments.length > 0) {
					defaultRedirect = '/my-courses';
				}
			}

			// Use URL param if provided and not /profile, otherwise use smart default
			const nextParam = $page.url.searchParams.get('next');
			const next = (nextParam && nextParam !== '/profile') ? nextParam : defaultRedirect;

			// Wait a moment to show success message
			setTimeout(() => {
				goto(next);
			}, 1500);

		} catch (error) {
			errorMessage = error.message || 'Failed to set password';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<!-- Archdiocesan Cross Mark Logo -->
			<div class="flex justify-center mb-6">
				<img
					src={platform.logoPath}
					alt={platform.name}
					class="w-24 h-24 object-contain"
				/>
			</div>

			<h1 class="text-2xl font-semibold text-black">
				Welcome to {platform.shortName}
			</h1>
			<p class="mt-2 text-sm text-neutral-600">
				Please create a password to secure your account
			</p>
			{#if user?.email}
				<p class="mt-1 text-sm text-neutral-500">
					{user.email}
				</p>
			{/if}
		</div>

		{#if success}
			<div class="bg-green-50 p-4 text-center border-2 border-green-200">
				<CheckCircle class="mx-auto h-12 w-12 text-green-600" />
				<p class="mt-2 text-sm font-medium text-green-800">
					Password set successfully!
				</p>
				<p class="mt-1 text-xs text-green-600">
					Redirecting you now...
				</p>
			</div>
		{:else}
			<form class="mt-8 space-y-6" onsubmit={handleSetPassword}>
				<div class="space-y-4">
					<div>
						<label for="password" class="block text-sm font-medium text-black mb-1">
							New Password
						</label>
						<input
							bind:value={password}
							type="password"
							id="password"
							required
							minlength="6"
							class="relative block w-full border-2 border-black px-4 py-3 text-black placeholder-neutral-400 focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none"
							placeholder="Enter your password (min 6 characters)"
							disabled={loading}
						/>
					</div>
					<div>
						<label for="confirm-password" class="block text-sm font-medium text-black mb-1">
							Confirm Password
						</label>
						<input
							bind:value={confirmPassword}
							type="password"
							id="confirm-password"
							required
							minlength="6"
							class="relative block w-full border-2 border-black px-4 py-3 text-black placeholder-neutral-400 focus:border-black focus:ring-2 focus:ring-black/10 focus:outline-none"
							placeholder="Confirm your password"
							disabled={loading}
						/>
					</div>
				</div>

				{#if errorMessage}
					<div class="bg-red-50 p-3 text-center text-sm text-red-800 border-2 border-red-200">
						{errorMessage}
					</div>
				{/if}

				<div class="space-y-3">
					<button
						type="submit"
						disabled={loading}
						class="group relative flex w-full justify-center border-2 border-black bg-black px-4 py-3 text-sm font-semibold text-white hover:bg-neutral-800 focus:ring-2 focus:ring-black/20 focus:ring-offset-2 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
					>
						{loading ? 'Setting password...' : 'Set Password'}
					</button>

					<div class="bg-neutral-100 border-2 border-neutral-300 p-3">
						<p class="text-xs text-neutral-700">
							<strong class="text-black">Important:</strong> After setting your password, you can sign in anytime using your email and this password.
						</p>
					</div>
				</div>
			</form>
		{/if}
	</div>
</div>

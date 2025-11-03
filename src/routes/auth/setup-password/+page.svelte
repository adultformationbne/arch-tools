<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { KeyRound, CheckCircle } from 'lucide-svelte';

	let { data } = $props();
	const { supabase, user } = data;

	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);
	let errorMessage = $state('');
	let success = $state(false);

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
			// Update the user's password
			const { error } = await supabase.auth.updateUser({
				password: password
			});

			if (error) throw error;

			success = true;

			// Wait a moment to show success message
			setTimeout(() => {
				// Redirect to appropriate page based on user's modules
				const next = $page.url.searchParams.get('next') ?? '/profile';
				goto(next);
			}, 1500);

		} catch (error) {
			errorMessage = error.message || 'Failed to set password';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4">
	<div class="w-full max-w-md space-y-8">
		<div class="text-center">
			<div class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
				<KeyRound class="h-8 w-8 text-blue-600" />
			</div>
			<h1 class="mt-6 text-3xl font-bold text-gray-900">
				Welcome to Arch Tools
			</h1>
			<p class="mt-2 text-sm text-gray-600">
				Please create a password to secure your account
			</p>
			{#if user?.email}
				<p class="mt-1 text-sm text-gray-500">
					{user.email}
				</p>
			{/if}
		</div>

		{#if success}
			<div class="rounded-lg bg-green-50 p-4 text-center">
				<CheckCircle class="mx-auto h-12 w-12 text-green-500" />
				<p class="mt-2 text-sm font-medium text-green-800">
					Password set successfully!
				</p>
				<p class="mt-1 text-xs text-green-600">
					Redirecting you now...
				</p>
			</div>
		{:else}
			<form class="mt-8 space-y-6" onsubmit={handleSetPassword}>
				<div class="space-y-4 rounded-md shadow-sm">
					<div>
						<label for="password" class="block text-sm font-medium text-gray-700 mb-1">
							New Password
						</label>
						<input
							bind:value={password}
							type="password"
							id="password"
							required
							minlength="6"
							class="relative block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
							placeholder="Enter your password (min 6 characters)"
							disabled={loading}
						/>
					</div>
					<div>
						<label for="confirm-password" class="block text-sm font-medium text-gray-700 mb-1">
							Confirm Password
						</label>
						<input
							bind:value={confirmPassword}
							type="password"
							id="confirm-password"
							required
							minlength="6"
							class="relative block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:border-blue-500 focus:ring-blue-500 focus:outline-none"
							placeholder="Confirm your password"
							disabled={loading}
						/>
					</div>
				</div>

				{#if errorMessage}
					<div class="rounded-md bg-red-50 p-3 text-center text-sm text-red-800 border border-red-200">
						{errorMessage}
					</div>
				{/if}

				<div class="space-y-3">
					<button
						type="submit"
						disabled={loading}
						class="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
					>
						{loading ? 'Setting password...' : 'Set Password'}
					</button>

					<div class="bg-blue-50 border border-blue-200 rounded-md p-3">
						<p class="text-xs text-blue-800">
							<strong>Important:</strong> After setting your password, you can sign in anytime using your email and this password.
						</p>
					</div>
				</div>
			</form>
		{/if}
	</div>
</div>

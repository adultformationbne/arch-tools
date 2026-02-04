<script lang="ts">
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { toastError, toastSuccess } from '$lib/utils/toast-helpers.js';
	import { Loader2, CheckCircle, Eye, EyeOff } from '$lib/icons';

	let { data, form } = $props();

	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let isSubmitting = $state(false);

	// Password validation
	let passwordErrors = $derived(() => {
		const errors: string[] = [];
		if (password.length > 0 && password.length < 8) {
			errors.push('At least 8 characters');
		}
		if (confirmPassword.length > 0 && password !== confirmPassword) {
			errors.push('Passwords must match');
		}
		return errors;
	});

	let isValid = $derived(password.length >= 8 && password === confirmPassword);

	// Handle form result
	$effect(() => {
		if (form?.success && form?.redirectUrl) {
			toastSuccess('Account created! Redirecting to your course...');
			setTimeout(() => {
				goto(form.redirectUrl);
			}, 1500);
		} else if (form?.error) {
			toastError(form.error);
			isSubmitting = false;
		}
	});
</script>

<svelte:head>
	<title>Complete Your Registration | {data.course.name}</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12">
	<div class="w-full max-w-md">
		<div class="rounded-2xl bg-white p-8 shadow-xl">
			<!-- Success indicator -->
			<div class="mb-6 text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100"
				>
					<CheckCircle class="h-10 w-10 text-green-600" />
				</div>
				<h1 class="text-2xl font-bold text-gray-900">
					{#if data.type === 'paid'}
						Payment Successful!
					{:else}
						Registration Received!
					{/if}
				</h1>
				<p class="mt-2 text-gray-600">
					You're enrolled in <span class="font-medium">{data.module.name}</span>
				</p>
			</div>

			<!-- Enrollment details -->
			<div class="mb-6 rounded-lg bg-gray-50 p-4">
				<div class="space-y-2 text-sm">
					<div class="flex justify-between">
						<span class="text-gray-500">Course</span>
						<span class="font-medium">{data.course.name}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500">Module</span>
						<span class="font-medium">{data.module.name}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500">Cohort</span>
						<span class="font-medium">{data.cohort.name}</span>
					</div>
					<div class="flex justify-between">
						<span class="text-gray-500">Email</span>
						<span class="font-medium">{data.email}</span>
					</div>
				</div>
			</div>

			<!-- Password setup form -->
			<div class="border-t pt-6">
				<h2 class="mb-4 text-lg font-semibold text-gray-900">Set Your Password</h2>
				<p class="mb-4 text-sm text-gray-600">
					Create a password to access your course. You'll use your email and this password to log
					in.
				</p>

				<form
					method="POST"
					use:enhance={() => {
						isSubmitting = true;
						return async ({ update }) => {
							await update();
						};
					}}
					class="space-y-4"
				>
					<!-- Password field -->
					<div>
						<label for="password" class="mb-1 block text-sm font-medium text-gray-700">
							Password
						</label>
						<div class="relative">
							<input
								type={showPassword ? 'text' : 'password'}
								id="password"
								name="password"
								bind:value={password}
								minlength="8"
								required
								class="block w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 shadow-sm focus:border-blue-500 focus:ring-blue-500"
								placeholder="At least 8 characters"
							/>
							<button
								type="button"
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
								onclick={() => (showPassword = !showPassword)}
							>
								{#if showPassword}
									<EyeOff class="h-5 w-5" />
								{:else}
									<Eye class="h-5 w-5" />
								{/if}
							</button>
						</div>
					</div>

					<!-- Confirm password field -->
					<div>
						<label for="confirmPassword" class="mb-1 block text-sm font-medium text-gray-700">
							Confirm Password
						</label>
						<div class="relative">
							<input
								type={showConfirmPassword ? 'text' : 'password'}
								id="confirmPassword"
								name="confirmPassword"
								bind:value={confirmPassword}
								minlength="8"
								required
								class="block w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 shadow-sm focus:border-blue-500 focus:ring-blue-500"
								class:border-red-300={confirmPassword && password !== confirmPassword}
								placeholder="Re-enter your password"
							/>
							<button
								type="button"
								class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
								onclick={() => (showConfirmPassword = !showConfirmPassword)}
							>
								{#if showConfirmPassword}
									<EyeOff class="h-5 w-5" />
								{:else}
									<Eye class="h-5 w-5" />
								{/if}
							</button>
						</div>
					</div>

					<!-- Validation messages -->
					{#if passwordErrors().length > 0}
						<ul class="space-y-1 text-sm text-red-500">
							{#each passwordErrors() as err}
								<li>• {err}</li>
							{/each}
						</ul>
					{/if}

					<!-- Error message -->
					{#if form?.error}
						<div class="rounded-lg bg-red-50 p-3 text-sm text-red-600">
							{form.error}
						</div>
					{/if}

					<!-- Submit button -->
					<button
						type="submit"
						disabled={!isValid || isSubmitting}
						class="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSubmitting}
							<Loader2 class="h-5 w-5 animate-spin" />
							Creating account...
						{:else}
							Complete Registration
						{/if}
					</button>
				</form>
			</div>
		</div>

		<!-- Help text -->
		<p class="mt-6 text-center text-sm text-gray-500">
			Having trouble? Contact us at
			<a href="mailto:support@archmin.org" class="text-blue-600 hover:underline">
				support@archmin.org
			</a>
		</p>
	</div>
</div>

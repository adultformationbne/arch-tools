<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-svelte';

	let token = $state('');
	let loading = $state(true);
	let validatingToken = $state(true);
	let tokenValid = $state(false);
	let userData = $state(null);
	let error = $state('');

	// Form state
	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showConfirmPassword = $state(false);
	let submitting = $state(false);
	let passwordErrors = $state([]);

	onMount(async () => {
		// Get token from URL query params
		const urlParams = new URLSearchParams(window.location.search);
		token = urlParams.get('token') || '';

		if (!token) {
			error = 'Invalid invitation link. No token provided.';
			loading = false;
			validatingToken = false;
			return;
		}

		// Validate the token
		await validateToken();
	});

	async function validateToken() {
		try {
			const res = await fetch(`/signup/api?token=${token}`);
			const result = await res.json();

			if (result.success && result.data) {
				tokenValid = true;
				userData = result.data;
			} else {
				error = result.message || 'Invalid or expired invitation link.';
				tokenValid = false;
			}
		} catch (err) {
			console.error('Token validation error:', err);
			error = 'Failed to validate invitation. Please try again.';
			tokenValid = false;
		} finally {
			validatingToken = false;
			loading = false;
		}
	}

	function validatePassword() {
		const errors = [];

		if (password.length < 8) {
			errors.push('Password must be at least 8 characters long');
		}

		if (!/[A-Z]/.test(password)) {
			errors.push('Password must contain at least one uppercase letter');
		}

		if (!/[a-z]/.test(password)) {
			errors.push('Password must contain at least one lowercase letter');
		}

		if (!/[0-9]/.test(password)) {
			errors.push('Password must contain at least one number');
		}

		passwordErrors = errors;
		return errors.length === 0;
	}

	async function handleSubmit(e) {
		e.preventDefault();
		error = '';
		passwordErrors = [];

		// Validate passwords
		if (!validatePassword()) {
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		submitting = true;

		try {
			const res = await fetch('/signup/api', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					token: token,
					password: password
				})
			});

			const result = await res.json();

			if (result.success) {
				// Redirect to login page with success message
				await goto('/login?registered=true');
			} else {
				error = result.message || 'Failed to create account. Please try again.';
			}
		} catch (err) {
			console.error('Signup error:', err);
			error = 'An error occurred. Please try again.';
		} finally {
			submitting = false;
		}
	}

	function togglePasswordVisibility() {
		showPassword = !showPassword;
	}

	function toggleConfirmPasswordVisibility() {
		showConfirmPassword = !showConfirmPassword;
	}
</script>

<svelte:head>
	<title>Complete Your Registration - ACCF Platform</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
	/>
</svelte:head>

<div class="signup-container">
	<div class="signup-card">
		<!-- Header -->
		<div class="header">
			<h1>ACCF</h1>
			<p class="subtitle">Archdiocesan Center for Catholic Formation</p>
		</div>

		{#if validatingToken}
			<div class="loading-state">
				<div class="spinner"></div>
				<p>Validating your invitation...</p>
			</div>
		{:else if !tokenValid}
			<div class="error-state">
				<AlertCircle size={48} />
				<h2>Invalid Invitation</h2>
				<p>{error}</p>
				<a href="/login" class="btn-secondary">Go to Login</a>
			</div>
		{:else}
			<!-- Success: Show signup form -->
			<div class="success-state">
				<div class="welcome-message">
					<CheckCircle size={32} style="color: #28a745;" />
					<div>
						<h2>Welcome, {userData.full_name}!</h2>
						<p class="email">{userData.email}</p>
					</div>
				</div>

				{#if userData.cohort_name}
					<div class="cohort-info">
						<p>You've been invited to join:</p>
						<p class="cohort-name">{userData.cohort_name}</p>
					</div>
				{/if}

				<form onsubmit={handleSubmit}>
					<h3>Create Your Password</h3>

					<!-- Password Field -->
					<div class="form-group">
						<label for="password">Password</label>
						<div class="password-input">
							<input
								id="password"
								type={showPassword ? 'text' : 'password'}
								bind:value={password}
								oninput={validatePassword}
								required
								placeholder="Enter your password"
							/>
							<button
								type="button"
								class="toggle-password"
								onclick={togglePasswordVisibility}
								aria-label="Toggle password visibility"
							>
								{#if showPassword}
									<EyeOff size={20} />
								{:else}
									<Eye size={20} />
								{/if}
							</button>
						</div>

						{#if passwordErrors.length > 0}
							<ul class="password-requirements error">
								{#each passwordErrors as err}
									<li>{err}</li>
								{/each}
							</ul>
						{:else if password.length > 0}
							<ul class="password-requirements success">
								<li>✓ Password meets all requirements</li>
							</ul>
						{:else}
							<ul class="password-requirements">
								<li>At least 8 characters</li>
								<li>One uppercase letter</li>
								<li>One lowercase letter</li>
								<li>One number</li>
							</ul>
						{/if}
					</div>

					<!-- Confirm Password Field -->
					<div class="form-group">
						<label for="confirm-password">Confirm Password</label>
						<div class="password-input">
							<input
								id="confirm-password"
								type={showConfirmPassword ? 'text' : 'password'}
								bind:value={confirmPassword}
								required
								placeholder="Confirm your password"
							/>
							<button
								type="button"
								class="toggle-password"
								onclick={toggleConfirmPasswordVisibility}
								aria-label="Toggle confirm password visibility"
							>
								{#if showConfirmPassword}
									<EyeOff size={20} />
								{:else}
									<Eye size={20} />
								{/if}
							</button>
						</div>

						{#if confirmPassword && password !== confirmPassword}
							<p class="error-text">Passwords do not match</p>
						{/if}
					</div>

					{#if error}
						<div class="error-message">
							<AlertCircle size={20} />
							<span>{error}</span>
						</div>
					{/if}

					<button type="submit" class="btn-primary" disabled={submitting}>
						{submitting ? 'Creating Account...' : 'Complete Registration'}
					</button>
				</form>

				<div class="footer-note">
					<p>Already have an account? <a href="/login">Sign in here</a></p>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.signup-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, var(--accf-dark) 0%, var(--accf-darkest) 100%);
		padding: 20px;
	}

	.signup-card {
		background: white;
		border-radius: 16px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
		width: 100%;
		max-width: 500px;
		padding: 40px;
	}

	.header {
		text-align: center;
		margin-bottom: 32px;
		padding-bottom: 24px;
		border-bottom: 2px solid var(--accf-light);
	}

	.header h1 {
		font-weight: 700;
		font-size: 3rem;
		color: var(--accf-darkest);
		margin: 0 0 8px 0;
		letter-spacing: 2px;
	}

	.subtitle {
		font-size: 0.875rem;
		color: var(--accf-dark);
		margin: 0;
		letter-spacing: 0.5px;
	}

	.loading-state,
	.error-state {
		text-align: center;
		padding: 40px 20px;
	}

	.spinner {
		width: 48px;
		height: 48px;
		border: 4px solid var(--accf-light);
		border-top-color: var(--accf-accent);
		border-radius: 50%;
		margin: 0 auto 20px;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-state {
		color: var(--accf-dark);
	}

	.error-state h2 {
		margin: 20px 0 12px 0;
		color: var(--accf-darkest);
	}

	.error-state p {
		margin: 0 0 24px 0;
		color: var(--accf-dark);
	}

	.welcome-message {
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 20px;
		background: #f0f9ff;
		border-radius: 8px;
		margin-bottom: 24px;
	}

	.welcome-message h2 {
		margin: 0;
		font-size: 1.5rem;
		color: var(--accf-darkest);
	}

	.welcome-message .email {
		margin: 4px 0 0 0;
		font-size: 0.875rem;
		color: var(--accf-dark);
	}

	.cohort-info {
		text-align: center;
		padding: 16px;
		background: var(--accf-light);
		border-radius: 8px;
		margin-bottom: 32px;
	}

	.cohort-info p {
		margin: 0;
		color: var(--accf-dark);
	}

	.cohort-name {
		font-weight: 600;
		font-size: 1.125rem;
		color: var(--accf-darkest) !important;
		margin-top: 8px !important;
	}

	form {
		margin-top: 32px;
	}

	h3 {
		margin: 0 0 24px 0;
		font-size: 1.25rem;
		color: var(--accf-darkest);
	}

	.form-group {
		margin-bottom: 24px;
	}

	label {
		display: block;
		margin-bottom: 8px;
		font-weight: 600;
		color: var(--accf-darkest);
		font-size: 0.875rem;
	}

	.password-input {
		position: relative;
	}

	input {
		width: 100%;
		padding: 12px 40px 12px 12px;
		border: 1px solid var(--accf-light);
		border-radius: 8px;
		font-size: 1rem;
		transition: border-color 0.2s ease;
	}

	input:focus {
		outline: none;
		border-color: var(--accf-accent);
	}

	.toggle-password {
		position: absolute;
		right: 12px;
		top: 50%;
		transform: translateY(-50%);
		border: none;
		background: transparent;
		color: var(--accf-dark);
		cursor: pointer;
		padding: 4px;
		display: flex;
		align-items: center;
	}

	.toggle-password:hover {
		color: var(--accf-darkest);
	}

	.password-requirements {
		margin: 8px 0 0 0;
		padding-left: 20px;
		font-size: 0.8125rem;
		color: var(--accf-dark);
	}

	.password-requirements li {
		margin-bottom: 4px;
	}

	.password-requirements.error {
		color: #dc3545;
	}

	.password-requirements.success {
		color: #28a745;
		list-style: none;
		padding-left: 0;
	}

	.error-text {
		margin: 8px 0 0 0;
		font-size: 0.8125rem;
		color: #dc3545;
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		background: #fee;
		border: 1px solid #fcc;
		border-radius: 8px;
		color: #c00;
		font-size: 0.875rem;
		margin-bottom: 20px;
	}

	.btn-primary {
		width: 100%;
		padding: 14px;
		border: none;
		background: var(--accf-accent);
		color: var(--accf-darkest);
		font-size: 1rem;
		font-weight: 600;
		border-radius: 8px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--accf-dark);
		color: white;
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		display: inline-block;
		padding: 10px 24px;
		border: 1px solid var(--accf-accent);
		background: transparent;
		color: var(--accf-dark);
		text-decoration: none;
		border-radius: 8px;
		font-weight: 600;
		transition: all 0.2s ease;
	}

	.btn-secondary:hover {
		background: var(--accf-light);
	}

	.footer-note {
		margin-top: 24px;
		text-align: center;
		font-size: 0.875rem;
		color: var(--accf-dark);
	}

	.footer-note a {
		color: var(--accf-accent);
		text-decoration: none;
		font-weight: 600;
	}

	.footer-note a:hover {
		text-decoration: underline;
	}
</style>
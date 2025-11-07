<script>
	import { toastSuccess, toastError, toastInfo } from '$lib/utils/toast-helpers.js';

	let { data } = $props();
	let supabase = $derived(data.supabase);

	let testEmail = $state('');
	let inviteEmail = $state('');
	let inviteName = $state('');
	let resetEmail = $state('');
	let changeEmail = $state('');
	let loading = $state({
		invite: false,
		magic: false,
		reset: false,
		change: false
	});

	async function testInviteUser() {
		if (!inviteEmail) {
			toastError('Please enter an email address');
			return;
		}

		loading.invite = true;
		try {
			const response = await fetch('/api/test-emails/invite', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					email: inviteEmail,
					full_name: inviteName || undefined
				})
			});

			const result = await response.json();

			if (!response.ok) {
				throw new Error(result.error || 'Failed to send invite');
			}

			toastSuccess('Invite email sent to ' + inviteEmail);
			inviteEmail = '';
			inviteName = '';
		} catch (error) {
			toastError('Failed to send invite: ' + error.message);
		} finally {
			loading.invite = false;
		}
	}

	async function testMagicLink() {
		if (!testEmail) {
			toastError('Please enter an email address');
			return;
		}

		loading.magic = true;
		try {
			const { data, error } = await supabase.auth.signInWithOtp({
				email: testEmail,
				options: {
					shouldCreateUser: false // Don't create new users
				}
			});

			if (error) throw error;
			toastSuccess('Magic link sent to ' + testEmail);
			testEmail = '';
		} catch (error) {
			toastError('Failed to send magic link: ' + error.message);
		} finally {
			loading.magic = false;
		}
	}

	async function testResetPassword() {
		if (!resetEmail) {
			toastError('Please enter an email address');
			return;
		}

		loading.reset = true;
		try {
			const { data, error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
				// Supabase will append token_hash and type=recovery to this URL
				redirectTo: window.location.origin + '/login/confirm'
			});

			if (error) throw error;
			toastSuccess('Password reset email sent to ' + resetEmail);
			resetEmail = '';
		} catch (error) {
			toastError('Failed to send reset email: ' + error.message);
		} finally {
			loading.reset = false;
		}
	}

	async function testChangeEmail() {
		if (!changeEmail) {
			toastError('Please enter a new email address');
			return;
		}

		loading.change = true;
		try {
			const { data, error } = await supabase.auth.updateUser({
				email: changeEmail
			});

			if (error) throw error;
			toastSuccess('Email change confirmation sent to ' + changeEmail);
			changeEmail = '';
		} catch (error) {
			toastError('Failed to send email change: ' + error.message);
		} finally {
			loading.change = false;
		}
	}
</script>

<div class="max-w-4xl mx-auto p-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold text-gray-900 mb-2">Email Template Testing</h1>
		<p class="text-gray-600">Test all Supabase authentication email templates</p>
	</div>

	<div class="grid gap-6">
		<!-- 1. INVITE USER -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
					<span class="text-blue-600 font-semibold">1</span>
				</div>
				<div>
					<h2 class="text-xl font-semibold text-gray-900">Invite User</h2>
					<p class="text-sm text-gray-500">Subject: Welcome to Archdiocesan Tools - Set Up Your Account</p>
				</div>
			</div>

			<div class="space-y-3">
				<div>
					<label for="invite-email" class="block text-sm font-medium text-gray-700 mb-1">
						Email Address *
					</label>
					<input
						id="invite-email"
						type="email"
						bind:value={inviteEmail}
						placeholder="user@example.com"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<div>
					<label for="invite-name" class="block text-sm font-medium text-gray-700 mb-1">
						Full Name (optional)
					</label>
					<input
						id="invite-name"
						type="text"
						bind:value={inviteName}
						placeholder="John Doe"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>

				<button
					onclick={testInviteUser}
					disabled={loading.invite}
					class="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
				>
					{loading.invite ? 'Sending...' : 'Send Invite Email'}
				</button>
			</div>
		</div>

		<!-- 2. MAGIC LINK -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
					<span class="text-purple-600 font-semibold">2</span>
				</div>
				<div>
					<h2 class="text-xl font-semibold text-gray-900">Magic Link (Passwordless Login)</h2>
					<p class="text-sm text-gray-500">Subject: Your Login Link - Archdiocesan Tools</p>
				</div>
			</div>

			<div class="space-y-3">
				<div>
					<label for="magic-email" class="block text-sm font-medium text-gray-700 mb-1">
						Email Address *
					</label>
					<input
						id="magic-email"
						type="email"
						bind:value={testEmail}
						placeholder="user@example.com"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
					/>
				</div>

				<button
					onclick={testMagicLink}
					disabled={loading.magic}
					class="w-full bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
				>
					{loading.magic ? 'Sending...' : 'Send Magic Link'}
				</button>
			</div>
		</div>

		<!-- 3. RESET PASSWORD -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
					<span class="text-amber-600 font-semibold">3</span>
				</div>
				<div>
					<h2 class="text-xl font-semibold text-gray-900">Reset Password</h2>
					<p class="text-sm text-gray-500">Subject: Reset Your Password - Archdiocesan Tools</p>
				</div>
			</div>

			<div class="space-y-3">
				<div>
					<label for="reset-email" class="block text-sm font-medium text-gray-700 mb-1">
						Email Address *
					</label>
					<input
						id="reset-email"
						type="email"
						bind:value={resetEmail}
						placeholder="user@example.com"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500"
					/>
				</div>

				<button
					onclick={testResetPassword}
					disabled={loading.reset}
					class="w-full bg-amber-600 text-white px-4 py-2 rounded-md hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
				>
					{loading.reset ? 'Sending...' : 'Send Password Reset'}
				</button>
			</div>
		</div>

		<!-- 4. CHANGE EMAIL -->
		<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
			<div class="flex items-center gap-3 mb-4">
				<div class="w-10 h-10 rounded-full bg-cyan-100 flex items-center justify-center">
					<span class="text-cyan-600 font-semibold">4</span>
				</div>
				<div>
					<h2 class="text-xl font-semibold text-gray-900">Change Email Address</h2>
					<p class="text-sm text-gray-500">Subject: Confirm Your New Email - Archdiocesan Tools</p>
				</div>
			</div>

			<div class="space-y-3">
				<div>
					<label for="change-email" class="block text-sm font-medium text-gray-700 mb-1">
						New Email Address *
					</label>
					<input
						id="change-email"
						type="email"
						bind:value={changeEmail}
						placeholder="newemail@example.com"
						class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
					/>
				</div>

				<div class="bg-cyan-50 border border-cyan-200 rounded-md p-3">
					<p class="text-xs text-cyan-800">
						<strong>Note:</strong> This will change YOUR current email address. Make sure you have access to the new email!
					</p>
				</div>

				<button
					onclick={testChangeEmail}
					disabled={loading.change}
					class="w-full bg-cyan-600 text-white px-4 py-2 rounded-md hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
				>
					{loading.change ? 'Sending...' : 'Send Email Change Confirmation'}
				</button>
			</div>
		</div>

		<!-- INFO BOXES -->
		<div class="bg-blue-50 border border-blue-200 rounded-lg p-6">
			<h3 class="font-semibold text-blue-900 mb-2">📝 Notes:</h3>
			<ul class="text-sm text-blue-800 space-y-1 list-disc list-inside">
				<li><strong>Confirm Signup</strong> - Not available (signup disabled, invite-only)</li>
				<li><strong>Reauthentication</strong> - Triggered automatically during sensitive operations</li>
				<li>All emails will use the templates configured in Supabase Dashboard</li>
				<li>Make sure you've uploaded the logo to Supabase Storage first</li>
			</ul>
		</div>
	</div>
</div>

import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { isValidEmail } from '$lib/utils/form-validator.js';

/**
 * Simple in-memory rate limiter
 * Limits requests per IP to prevent abuse of the check-email endpoint
 * Note: Resets on server restart, use Redis for production at scale
 */
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP

function checkRateLimit(ip) {
	const now = Date.now();
	const windowStart = now - RATE_LIMIT_WINDOW_MS;

	// Get or create entry for this IP
	let entry = rateLimitMap.get(ip);
	if (!entry) {
		entry = { requests: [], blocked: false };
		rateLimitMap.set(ip, entry);
	}

	// Clean up old requests outside the window
	entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

	// Check if rate limited
	if (entry.requests.length >= RATE_LIMIT_MAX_REQUESTS) {
		return false; // Rate limited
	}

	// Add this request
	entry.requests.push(now);
	return true; // Allowed
}

// Clean up old entries periodically (every 5 minutes)
setInterval(() => {
	const now = Date.now();
	const windowStart = now - RATE_LIMIT_WINDOW_MS;
	for (const [ip, entry] of rateLimitMap.entries()) {
		entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);
		if (entry.requests.length === 0) {
			rateLimitMap.delete(ip);
		}
	}
}, 5 * 60 * 1000);

/**
 * Check user status and determine authentication method
 * Returns what the next step should be for this email
 */
export async function POST({ request, getClientAddress }) {
	// Rate limiting check
	const clientIp = getClientAddress();
	if (!checkRateLimit(clientIp)) {
		return json({
			exists: false,
			nextStep: 'error',
			message: 'Too many requests. Please wait a moment before trying again.'
		}, { status: 429 });
	}
	try {
		const { email } = await request.json();

		if (!email) {
			throw error(400, 'Email is required');
		}

		// Validate email format
		if (!isValidEmail(email)) {
			throw error(400, 'Invalid email format');
		}

		// Check if user exists in auth system
		// First, try to find the user ID from user_profiles (linked to auth.users)
		const { data: profile, error: profileError } = await supabaseAdmin
			.from('user_profiles')
			.select('id, email')
			.eq('email', email.toLowerCase())
			.maybeSingle();

		let fullUser = null;

		if (profile?.id) {
			// Found profile, get full auth user details
			const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
			if (authError) {
				console.error('[check-email] Error getting user by ID:', authError);
			}
			fullUser = user;
		}

		// Fallback: check if email exists directly in auth.users via SQL
		// (avoids listUsers() which is expensive and can fail with GoTrue scan errors)
		if (!fullUser) {
			const { data: authRecord } = await supabaseAdmin
				.from('user_profiles')
				.select('id')
				.ilike('email', email.toLowerCase())
				.maybeSingle();

			if (authRecord?.id) {
				const { data: { user }, error: authError } = await supabaseAdmin.auth.admin.getUserById(authRecord.id);
				if (!authError) {
					fullUser = user;
				}
			}
		}

		if (!fullUser) {
			// User doesn't exist in auth system
			console.log('[check-email] User not found:', email);
			return json({
				exists: false,
				nextStep: 'error',
				hasInvitation: false,
				message: 'No account found. Please contact your administrator.'
			});
		}

		// fullUser is already populated from the lookups above

		/**
		 * Determine if user has a password set
		 *
		 * Edge cases handled:
		 * 1. New pending users - no flag, no sign-in → OTP flow
		 * 2. Users who completed setup - has flag → Password flow
		 * 3. Users who verified OTP but never set password - no flag, has sign-in → OTP flow (fixed!)
		 * 4. Existing users (before flag was added) - no flag, has sign-in → Password flow (backward compat)
		 * 5. Forgot password users - will get flag set when they reset password
		 */

		// Priority 1: Check metadata flag (most reliable - set when password is actually created)
		// Note: Must explicitly be true, not just truthy (could be false for pending users)
		const hasPasswordSetupFlag = fullUser.user_metadata?.password_setup_completed === true;

		// Priority 2: For existing users (backward compatibility) - if they've signed in and don't have the flag,
		// assume they have a password (they were created before we added the flag)
		const hasPasswordProperty = fullUser.user_metadata && 'password_setup_completed' in fullUser.user_metadata;
		// Note: Use !! to handle both null AND undefined - Supabase returns undefined for users who never signed in
		const isExistingUserWithSignIn = !!fullUser.last_sign_in_at && !hasPasswordProperty;

		// User has password if:
		// 1. They have the password_setup_completed flag set to true (most reliable), OR
		// 2. They're an existing user who has signed in before (created before we added the flag)
		const hasPassword = hasPasswordSetupFlag || isExistingUserWithSignIn;

		// Debug logging
		console.log('[check-email]', email, {
			last_sign_in_at: fullUser.last_sign_in_at,
			user_metadata: fullUser.user_metadata,
			hasPasswordSetupFlag,
			hasPasswordProperty,
			isExistingUserWithSignIn,
			hasPassword,
			nextStep: hasPassword ? 'password' : 'otp'
		});

		if (hasPassword) {
			// User has password - allow password login
			return json({
				exists: true,
				nextStep: 'password',
				hasPassword: true,
				message: 'Enter your password to continue'
			});
		} else {
			// User exists but has no password - this is a pending invitation
			// Allow them to proceed with OTP
			return json({
				exists: true,
				nextStep: 'otp',
				hasPassword: false,
				message: 'A verification code will be sent to your email'
			});
		}

	} catch (err) {
		console.error('Error checking email:', err);

		if (err.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
}

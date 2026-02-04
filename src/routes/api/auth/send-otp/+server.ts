import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';

// OTP validity period in seconds (Supabase configured to 1 hour)
const OTP_VALIDITY_SECONDS = 3600;
// Buffer time - only send new OTP if less than this many seconds remain
const RESEND_BUFFER_SECONDS = 60;
// Minimum time between forced resends (prevents spam/DoS)
const FORCE_RESEND_COOLDOWN_SECONDS = 30;

/**
 * Rate limiter - same pattern as check-email endpoint
 */
const rateLimitMap = new Map<string, { requests: number[]; blocked: boolean }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 requests per minute per IP (stricter than check-email)

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const windowStart = now - RATE_LIMIT_WINDOW_MS;

	let entry = rateLimitMap.get(ip);
	if (!entry) {
		entry = { requests: [], blocked: false };
		rateLimitMap.set(ip, entry);
	}

	entry.requests = entry.requests.filter(timestamp => timestamp > windowStart);

	if (entry.requests.length >= RATE_LIMIT_MAX_REQUESTS) {
		return false;
	}

	entry.requests.push(now);
	return true;
}

// Cleanup old entries every 5 minutes
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
 * Send OTP with deduplication
 *
 * Security measures:
 * - Rate limiting per IP
 * - Deduplication prevents code invalidation from multiple clicks
 * - Force resend has cooldown to prevent DoS
 * - No timing information leaked in response
 */
export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	// Rate limiting
	const clientIp = getClientAddress();
	if (!checkRateLimit(clientIp)) {
		return json({
			success: false,
			error: 'Too many requests. Please wait a moment before trying again.'
		}, { status: 429 });
	}

	try {
		const { email, force } = await request.json();

		if (!email) {
			throw error(400, 'Email is required');
		}

		const normalizedEmail = email.toLowerCase().trim();
		const now = new Date();

		// Check for existing valid OTP
		const { data: existingOtp, error: fetchError } = await supabaseAdmin
			.from('auth_otp_tracker')
			.select('sent_at, expires_at')
			.eq('email', normalizedEmail)
			.single();

		if (fetchError && fetchError.code !== 'PGRST116') {
			console.error('[send-otp] Error checking tracker:', fetchError);
		}

		// Check if existing OTP is still valid
		if (existingOtp) {
			const expiresAt = new Date(existingOtp.expires_at);
			const sentAt = new Date(existingOtp.sent_at);
			const remainingSeconds = (expiresAt.getTime() - now.getTime()) / 1000;
			const secondsSinceSent = (now.getTime() - sentAt.getTime()) / 1000;

			if (remainingSeconds > RESEND_BUFFER_SECONDS) {
				// If force=true, check cooldown to prevent DoS
				if (force) {
					if (secondsSinceSent < FORCE_RESEND_COOLDOWN_SECONDS) {
						// Too soon to force resend - treat as normal dedup
						console.log('[send-otp] Force resend blocked (cooldown) for:', normalizedEmail);
						return json({
							success: true,
							alreadySent: true,
							message: 'A verification code was recently sent. Please wait before requesting a new one.'
						});
					}
					// Allow force resend after cooldown
				} else {
					// Normal dedup - don't send new code
					console.log('[send-otp] Existing valid OTP for:', normalizedEmail);
					return json({
						success: true,
						alreadySent: true,
						message: 'A verification code was already sent to your email. Please check your inbox.'
					});
				}
			}
		}

		// Send new OTP via Supabase
		const { error: otpError } = await supabaseAdmin.auth.signInWithOtp({
			email: normalizedEmail,
			options: { shouldCreateUser: false }
		});

		if (otpError) {
			console.error('[send-otp] Supabase OTP error:', otpError);

			if (otpError.message?.includes('rate') || otpError.status === 429) {
				return json({
					success: false,
					error: 'Too many attempts. Please wait a moment before trying again.'
				}, { status: 429 });
			}

			// Generic error - don't reveal if user exists
			return json({
				success: false,
				error: 'Failed to send verification code. Please try again.'
			}, { status: 500 });
		}

		// Update tracker (only after successful send)
		const expiresAt = new Date(now.getTime() + OTP_VALIDITY_SECONDS * 1000);

		const { error: upsertError } = await supabaseAdmin
			.from('auth_otp_tracker')
			.upsert({
				email: normalizedEmail,
				sent_at: now.toISOString(),
				expires_at: expiresAt.toISOString()
			}, {
				onConflict: 'email'
			});

		if (upsertError) {
			console.error('[send-otp] Error updating tracker:', upsertError);
		}

		console.log('[send-otp] New OTP sent to:', normalizedEmail);
		return json({
			success: true,
			alreadySent: false,
			message: 'A 6-digit verification code has been sent to your email.'
		});

	} catch (err) {
		console.error('[send-otp] Error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

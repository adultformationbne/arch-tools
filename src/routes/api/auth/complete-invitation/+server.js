import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * Mark a pending invitation as accepted after OTP verification
 * Called by client after successful OTP login
 */
export async function POST({ request }) {
	try {
		const { email } = await request.json();

		if (!email) {
			throw error(400, 'Email is required');
		}

		// Find pending invitation for this email
		const { data: invitation, error: findError } = await supabaseAdmin
			.from('pending_invitations')
			.select('id')
			.eq('email', email)
			.eq('status', 'pending')
			.single();

		// It's okay if no invitation is found - user might have logged in directly
		if (findError || !invitation) {
			return json({ success: true, found: false });
		}

		// Mark as accepted
		const { error: updateError } = await supabaseAdmin
			.from('pending_invitations')
			.update({
				status: 'accepted',
				accepted_at: new Date().toISOString()
			})
			.eq('id', invitation.id);

		if (updateError) {
			console.error('Error marking invitation as accepted:', updateError);
			throw error(500, 'Failed to update invitation status');
		}

		return json({ success: true, found: true });
	} catch (err) {
		console.error('Error completing invitation:', err);

		if (err.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
}

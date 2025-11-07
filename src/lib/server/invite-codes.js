/**
 * Invite Code Management Utilities
 * Handles generation, validation, and redemption of invitation codes
 */

import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * Generate a unique 6-character invite code (format: ABC-123)
 * Uses database function to ensure uniqueness
 * @returns {Promise<string>} Generated code
 */
export async function generateInviteCode() {
	const { data, error } = await supabaseAdmin.rpc('generate_invite_code');

	if (error) {
		console.error('Error generating invite code:', error);
		throw new Error('Failed to generate invite code');
	}

	return data;
}

/**
 * Create a new pending invitation with invite code
 * @param {Object} params
 * @param {string} params.email - Invitee email
 * @param {string[]} params.modules - Module permissions
 * @param {string} params.createdBy - User ID of inviter
 * @param {string} [params.userId] - Optional existing auth user ID
 * @returns {Promise<Object>} Created invitation record
 */
export async function createInvitation({ email, modules, createdBy, userId = null }) {
	// Opportunistic cleanup: Delete old invitations while we're here
	// This keeps the table clean without needing a cron job
	try {
		const thirtyDaysAgo = new Date();
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const { error: cleanupError } = await supabaseAdmin
			.from('pending_invitations')
			.delete()
			.or(`expires_at.lt.${new Date().toISOString()},and(status.eq.accepted,accepted_at.lt.${thirtyDaysAgo.toISOString()}),and(status.eq.cancelled,created_at.lt.${thirtyDaysAgo.toISOString()})`);

		if (cleanupError) {
			// Don't fail invitation creation if cleanup fails - just log it
			console.warn('Invitation cleanup failed (non-critical):', cleanupError);
		}
	} catch (cleanupErr) {
		// Cleanup is opportunistic - don't let it break invitation creation
		console.warn('Invitation cleanup error (non-critical):', cleanupErr);
	}

	const code = await generateInviteCode();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + 30); // 30 days

	const { data, error } = await supabaseAdmin
		.from('pending_invitations')
		.insert({
			code,
			email,
			modules,
			user_id: userId,
			created_by: createdBy,
			expires_at: expiresAt.toISOString(),
			status: 'pending',
			last_sent_at: new Date().toISOString(),
			send_count: 1
		})
		.select()
		.single();

	if (error) {
		console.error('Error creating invitation:', error);
		throw new Error('Failed to create invitation');
	}

	return data;
}

/**
 * Redeem an invite code
 * @param {string} code - Invite code to redeem
 * @returns {Promise<Object>} Invitation data if valid
 * @throws {Error} If code is invalid or expired
 */
export async function redeemInviteCode(code) {
	const normalizedCode = code.toUpperCase().trim();

	const { data, error } = await supabaseAdmin
		.from('pending_invitations')
		.select('*')
		.eq('code', normalizedCode)
		.eq('status', 'pending')
		.gt('expires_at', new Date().toISOString())
		.single();

	if (error || !data) {
		throw new Error('Invalid or expired invitation code');
	}

	return data;
}

/**
 * Mark invitation as accepted
 * @param {string} invitationId - Invitation ID
 * @returns {Promise<Object>} Updated invitation
 */
export async function markInvitationAccepted(invitationId) {
	const { data, error } = await supabaseAdmin
		.from('pending_invitations')
		.update({
			status: 'accepted',
			accepted_at: new Date().toISOString()
		})
		.eq('id', invitationId)
		.select()
		.single();

	if (error) {
		console.error('Error marking invitation as accepted:', error);
		throw new Error('Failed to update invitation status');
	}

	return data;
}

/**
 * Resend invitation email and increment send count
 * @param {string} invitationId - Invitation ID
 * @returns {Promise<Object>} Updated invitation
 */
export async function resendInvitation(invitationId) {
	// First get current send count
	const { data: currentInvite } = await supabaseAdmin
		.from('pending_invitations')
		.select('send_count')
		.eq('id', invitationId)
		.single();

	const newSendCount = (currentInvite?.send_count || 0) + 1;

	const { data, error } = await supabaseAdmin
		.from('pending_invitations')
		.update({
			last_sent_at: new Date().toISOString(),
			send_count: newSendCount
		})
		.eq('id', invitationId)
		.select()
		.single();

	if (error) {
		console.error('Error resending invitation:', error);
		throw new Error('Failed to resend invitation');
	}

	return data;
}

/**
 * Get all pending invitations (for admin dashboard)
 * @param {Object} [filters]
 * @param {string} [filters.status] - Filter by status
 * @param {string} [filters.email] - Filter by email
 * @returns {Promise<Array>} List of invitations
 */
export async function getPendingInvitations(filters = {}) {
	let query = supabaseAdmin
		.from('pending_invitations')
		.select(`
			*,
			created_by_profile:user_profiles!pending_invitations_created_by_fkey(id, full_name, email)
		`)
		.order('created_at', { ascending: false });

	if (filters.status) {
		query = query.eq('status', filters.status);
	}

	if (filters.email) {
		query = query.ilike('email', `%${filters.email}%`);
	}

	const { data, error } = await query;

	if (error) {
		console.error('Error fetching pending invitations:', error);
		throw new Error('Failed to fetch invitations');
	}

	return data || [];
}

/**
 * Cancel an invitation
 * @param {string} invitationId - Invitation ID
 * @returns {Promise<Object>} Updated invitation
 */
export async function cancelInvitation(invitationId) {
	const { data, error } = await supabaseAdmin
		.from('pending_invitations')
		.update({ status: 'cancelled' })
		.eq('id', invitationId)
		.select()
		.single();

	if (error) {
		console.error('Error cancelling invitation:', error);
		throw new Error('Failed to cancel invitation');
	}

	return data;
}

/**
 * Generate shareable invitation URL
 * @param {string} code - Invite code
 * @param {string} siteUrl - Base site URL
 * @returns {string} Full invitation URL
 */
export function getInvitationUrl(code, siteUrl) {
	return `${siteUrl}/login/invite?code=${code}`;
}

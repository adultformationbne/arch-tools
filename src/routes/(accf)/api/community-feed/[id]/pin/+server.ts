import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAccfUser } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

/**
 * PATCH - Toggle pin status for a feed item
 * Params:
 *   - id: Feed item ID (from URL)
 * Body:
 *   - pinned: boolean
 */
export const PATCH: RequestHandler = async (event) => {
	// Require ACCF user authentication
	const { user } = await requireAccfUser(event);

	try {
		// Verify user is admin
		const { data: profileData } = await supabaseAdmin
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const isAdmin = profileData?.role === 'accf_admin' || profileData?.role === 'admin';

		if (!isAdmin) {
			throw error(403, 'Only admins can pin/unpin feed items');
		}

		const { id } = event.params;
		const body = await event.request.json();
		const { pinned } = body;

		if (typeof pinned !== 'boolean') {
			throw error(400, 'pinned must be a boolean value');
		}

		// Verify feed item exists
		const { data: existingItem } = await supabaseAdmin
			.from('community_feed')
			.select('id, feed_type')
			.eq('id', id)
			.single();

		if (!existingItem) {
			throw error(404, 'Feed item not found');
		}

		// Update pin status
		const { data: updatedItem, error: updateError } = await supabaseAdmin
			.from('community_feed')
			.update({
				pinned,
				updated_at: new Date().toISOString()
			})
			.eq('id', id)
			.select()
			.single();

		if (updateError) {
			console.error('Pin update error:', updateError);
			throw error(500, 'Failed to update pin status');
		}

		return json({
			success: true,
			data: updatedItem,
			message: pinned ? 'Post pinned successfully' : 'Post unpinned successfully'
		});

	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

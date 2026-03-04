import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, getUserProfile } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const POST: RequestHandler = async (event) => {
	const { user } = await requireAuth(event);

	const body = await event.request.json();
	const name = body.name?.trim();

	if (!name || name.length === 0) {
		throw error(400, 'Name is required');
	}

	if (name.length > 200) {
		throw error(400, 'Name is too long');
	}

	// Get user's profile ID
	const profile = await getUserProfile(event, user.id);
	if (!profile) {
		throw error(404, 'Profile not found');
	}

	// Update user_profiles.full_name — DB trigger syncs to all enrollments
	const { error: updateError } = await supabaseAdmin
		.from('user_profiles')
		.update({ full_name: name })
		.eq('id', profile.id);

	if (updateError) {
		throw error(500, 'Failed to update profile');
	}

	return json({ success: true });
};

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

	const update: Record<string, string | null> = {
		full_name: name
	};

	if (body.phone !== undefined) update.phone = body.phone?.trim() || null;
	if (body.parish_community !== undefined) update.parish_community = body.parish_community?.trim() || null;
	if (body.parish_role !== undefined) update.parish_role = body.parish_role?.trim() || null;
	if (body.address !== undefined) update.address = body.address?.trim() || null;

	const { error: updateError } = await supabaseAdmin
		.from('user_profiles')
		.update(update)
		.eq('id', profile.id);

	if (updateError) {
		throw error(500, 'Failed to update profile');
	}

	return json({ success: true });
};

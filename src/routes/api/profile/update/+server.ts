import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, getUserProfile } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const POST: RequestHandler = async (event) => {
	const { user } = await requireAuth(event);

	const { name, phone, parish_community, parish_role, address } = await event.request.json();
	const trimmedName = name?.trim();

	if (!trimmedName || trimmedName.length === 0) {
		throw error(400, 'Name is required');
	}

	if (trimmedName.length > 200) {
		throw error(400, 'Name is too long');
	}

	// Get user's profile ID
	const profile = await getUserProfile(event, user.id);
	if (!profile) {
		throw error(404, 'Profile not found');
	}

	const update: Record<string, string | null> = {
		full_name: trimmedName
	};

	if (phone !== undefined) update.phone = phone?.trim() || null;
	if (parish_community !== undefined) update.parish_community = parish_community?.trim() || null;
	if (parish_role !== undefined) update.parish_role = parish_role?.trim() || null;
	if (address !== undefined) update.address = address?.trim() || null;

	const { error: updateError } = await supabaseAdmin
		.from('user_profiles')
		.update(update)
		.eq('id', profile.id);

	if (updateError) {
		throw error(500, 'Failed to update profile');
	}

	return json({ success: true });
};

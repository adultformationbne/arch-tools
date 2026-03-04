import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth, getUserProfile } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const POST: RequestHandler = async (event) => {
	const { user } = await requireAuth(event);

	const profile = await getUserProfile(event, user.id);
	if (!profile) {
		throw error(404, 'Profile not found');
	}

	// 1. Delete all enrollments for this user
	await supabaseAdmin
		.from('courses_enrollments')
		.delete()
		.eq('user_profile_id', profile.id);

	// 2. Null out references in other tables to avoid FK violations
	await supabaseAdmin
		.from('courses_attendance')
		.update({ marked_by: null })
		.eq('marked_by', profile.id);

	await supabaseAdmin
		.from('courses_reflection_responses')
		.update({ marked_by: null, reviewing_by: null })
		.or(`marked_by.eq.${profile.id},reviewing_by.eq.${profile.id}`);

	await supabaseAdmin
		.from('courses_enrollment_imports')
		.update({ imported_by: null })
		.eq('imported_by', profile.id);

	// 3. Delete community feed posts by this user
	await supabaseAdmin
		.from('courses_community_feed')
		.delete()
		.eq('author_id', profile.id);

	// 4. Delete the user_profile
	await supabaseAdmin
		.from('user_profiles')
		.delete()
		.eq('id', profile.id);

	// 5. Delete the auth user
	const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
	if (authError) {
		console.error(`Failed to delete auth user ${profile.id}:`, authError);
	}

	return json({ success: true });
};

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';

/**
 * POST /api/auth/track-login
 * Updates login tracking for the authenticated user's enrollments
 * Called after password setup (first login) and can be called on subsequent logins
 */
export const POST: RequestHandler = async (event) => {
	try {
		const { session } = await event.locals.safeGetSession();

		if (!session?.user) {
			return json({ error: 'Not authenticated' }, { status: 401 });
		}

		const userId = session.user.id;
		const now = new Date().toISOString();

		// Get current enrollments to increment login_count
		const { data: enrollments } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id, login_count')
			.eq('user_profile_id', userId);

		if (!enrollments || enrollments.length === 0) {
			return json({ success: true, enrollmentsUpdated: 0 });
		}

		// Update each enrollment with incremented login_count
		let updatedCount = 0;
		for (const enrollment of enrollments) {
			const { error } = await supabaseAdmin
				.from('courses_enrollments')
				.update({
					last_login_at: now,
					login_count: (enrollment.login_count || 0) + 1,
					status: 'active'
				})
				.eq('id', enrollment.id);

			if (!error) updatedCount++;
		}

		return json({
			success: true,
			enrollmentsUpdated: updatedCount
		});
	} catch (error) {
		console.error('Track login error:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

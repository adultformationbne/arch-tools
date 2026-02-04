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

		// Get current enrollments with cohort info to increment login_count and sync session
		const { data: enrollments } = await supabaseAdmin
			.from('courses_enrollments')
			.select(`
				id,
				login_count,
				current_session,
				cohort:cohort_id (
					current_session
				)
			`)
			.eq('user_profile_id', userId);

		if (!enrollments || enrollments.length === 0) {
			return json({ success: true, enrollmentsUpdated: 0 });
		}

		// Update each enrollment with incremented login_count and synced current_session
		let updatedCount = 0;
		for (const enrollment of enrollments) {
			// Sync current_session to cohort's session on first login (login_count was 0)
			// Only sync UP (catch up to cohort), never DOWN (preserve admin adjustments)
			// This ensures users who sign up after cohort has advanced start at the right session
			// while preserving cases where admin manually set a lower session for remediation
			const isFirstLogin = (enrollment.login_count || 0) === 0;
			const cohortSession = enrollment.cohort?.current_session || 1;
			const userSession = enrollment.current_session || 1;

			// Only update session if first login AND user is behind cohort
			const shouldSyncSession = isFirstLogin && userSession < cohortSession;
			const newCurrentSession = shouldSyncSession ? cohortSession : userSession;

			const { error } = await supabaseAdmin
				.from('courses_enrollments')
				.update({
					last_login_at: now,
					login_count: (enrollment.login_count || 0) + 1,
					status: 'active',
					current_session: newCurrentSession
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

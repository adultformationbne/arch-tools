import type { PageServerLoad } from './$types';
import { requireCourseRole } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const load: PageServerLoad = async (event) => {
	const { slug } = event.params;

	// Only coordinators and admins can access chat
	const { user, profile, enrollment } = await requireCourseRole(
		event,
		slug,
		['coordinator', 'admin'],
		{ mode: 'redirect', redirectTo: `/courses/${slug}` }
	);

	const cohortId = enrollment.cohort_id;

	// Fetch last 50 messages
	const { data: messages } = await supabaseAdmin
		.from('courses_chat_messages')
		.select('*')
		.eq('cohort_id', cohortId)
		.is('deleted_at', null)
		.order('created_at', { ascending: false })
		.limit(50);

	// Upsert read status
	await supabaseAdmin
		.from('courses_chat_read_status')
		.upsert(
			{
				cohort_id: cohortId,
				user_id: user.id,
				last_read_at: new Date().toISOString()
			},
			{ onConflict: 'cohort_id,user_id' }
		);

	// Get hub name for coordinator
	let hubName = null;
	if (enrollment.role === 'coordinator' && enrollment.hub_id) {
		const { data: hub } = await supabaseAdmin
			.from('courses_hubs')
			.select('name')
			.eq('id', enrollment.hub_id)
			.maybeSingle();
		hubName = hub?.name || null;
	}

	return {
		messages: (messages ?? []).reverse(), // oldest first
		cohortId,
		userMeta: {
			userId: user.id,
			userName: enrollment.full_name || profile?.full_name || profile?.display_name || 'User',
			userRole: enrollment.role,
			hubName
		}
	};
};

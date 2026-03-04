import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const load: PageServerLoad = async (event) => {
	// Auth is handled by the admin layout's requireCourseAdmin
	const layoutData = await event.parent();
	const cohortId = event.url.searchParams.get('cohort');
	const userId = layoutData.course ? (await event.locals.safeGetSession()).user?.id : null;

	const chatEnabled = layoutData.courseFeatures?.chatEnabled !== false;

	if (!cohortId || !userId) {
		return {
			messages: [],
			cohortId: null,
			chatEnabled,
			userMeta: null,
			noCohortSelected: !cohortId
		};
	}

	// Fetch last 50 messages
	const { data: messages } = await supabaseAdmin
		.from('courses_chat_messages')
		.select('*')
		.eq('cohort_id', cohortId)
		.order('created_at', { ascending: false })
		.limit(50);

	// Upsert read status
	await supabaseAdmin
		.from('courses_chat_read_status')
		.upsert(
			{
				cohort_id: cohortId,
				user_id: userId,
				last_read_at: new Date().toISOString()
			},
			{ onConflict: 'cohort_id,user_id' }
		);

	// Get admin's name
	const { data: profile } = await supabaseAdmin
		.from('user_profiles')
		.select('full_name, display_name')
		.eq('id', userId)
		.maybeSingle();

	return {
		messages: (messages ?? []).reverse(),
		cohortId,
		chatEnabled,
		userMeta: {
			userId,
			userName: profile?.full_name || profile?.display_name || 'Admin',
			userRole: 'admin',
			hubName: null
		},
		noCohortSelected: false
	};
};

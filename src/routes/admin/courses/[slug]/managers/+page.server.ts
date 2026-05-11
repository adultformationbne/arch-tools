import type { PageServerLoad } from './$types';
import { requireModuleLevel } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	try {
		await requireModuleLevel(event, 'courses.admin');
	} catch {
		throw redirect(303, `/admin/courses/${event.params.slug}`);
	}

	const layoutData = await event.parent();
	const courseId = layoutData.course.id;
	const courseSlug = event.params.slug;

	const [managersResult, adminsResult, allUsersResult] = await Promise.all([
		supabaseAdmin
			.from('user_profiles')
			.select('id, full_name, email, avatar_url, modules, assigned_course_ids')
			.filter('modules', 'cs', '{courses.manager}')
			.filter('assigned_course_ids', 'cs', `["${courseId}"]`)
			.order('full_name', { ascending: true }),
		supabaseAdmin
			.from('user_profiles')
			.select('id, full_name, email, avatar_url, modules')
			.filter('modules', 'cs', '{courses.admin}')
			.order('full_name', { ascending: true }),
		supabaseAdmin
			.from('user_profiles')
			.select('id, full_name, email, avatar_url, modules, assigned_course_ids')
			.order('full_name', { ascending: true })
	]);

	return {
		courseSlug,
		courseId,
		managers: managersResult.data || [],
		platformAdmins: adminsResult.data || [],
		allUsers: allUsersResult.data || []
	};
};

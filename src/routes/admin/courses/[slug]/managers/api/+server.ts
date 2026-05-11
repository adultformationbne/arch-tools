import { json } from '@sveltejs/kit';
import { requireModuleLevel } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	await requireModuleLevel(event, 'courses.admin');

	const courseSlug = event.params.slug;
	const { action, userId } = await event.request.json();

	if (!userId || !['add_manager', 'remove_manager'].includes(action)) {
		return json({ success: false, error: 'Invalid request' }, { status: 400 });
	}

	const { data: course } = await supabaseAdmin
		.from('courses')
		.select('id')
		.eq('slug', courseSlug)
		.single();

	if (!course) {
		return json({ success: false, error: 'Course not found' }, { status: 404 });
	}

	const { data: profile } = await supabaseAdmin
		.from('user_profiles')
		.select('id, modules, assigned_course_ids')
		.eq('id', userId)
		.single();

	if (!profile) {
		return json({ success: false, error: 'User not found' }, { status: 404 });
	}

	const currentModules: string[] = profile.modules || [];
	const currentAssigned: string[] = profile.assigned_course_ids || [];

	if (action === 'add_manager') {
		const newModules = currentModules.includes('courses.manager')
			? currentModules
			: [...currentModules, 'courses.manager'];
		const newAssigned = currentAssigned.includes(course.id)
			? currentAssigned
			: [...currentAssigned, course.id];

		const { error } = await supabaseAdmin
			.from('user_profiles')
			.update({ modules: newModules, assigned_course_ids: newAssigned })
			.eq('id', userId);

		if (error) return json({ success: false, error: 'Failed to add manager' }, { status: 500 });
	} else {
		const newAssigned = currentAssigned.filter((id) => id !== course.id);
		const newModules =
			newAssigned.length === 0
				? currentModules.filter((m) => m !== 'courses.manager')
				: currentModules;

		const { error } = await supabaseAdmin
			.from('user_profiles')
			.update({ modules: newModules, assigned_course_ids: newAssigned })
			.eq('id', userId);

		if (error) return json({ success: false, error: 'Failed to remove manager' }, { status: 500 });
	}

	return json({ success: true });
};

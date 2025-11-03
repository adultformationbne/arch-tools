import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { hasModule, hasModuleLevel } from '$lib/server/auth';

const ACTIVE_ENROLLMENT_STATUSES = ['active', 'invited', 'accepted'];

async function ensureSession(event) {
	const { session, user } = await event.locals.safeGetSession();
	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}
	return { session, user };
}

async function getUserModules(userId: string): Promise<string[]> {
	const { data, error: profileError } = await supabaseAdmin
		.from('user_profiles')
		.select('modules')
		.eq('id', userId)
		.single();

	if (profileError) {
		console.error('Error fetching user modules:', profileError);
		return [];
	}

	return Array.isArray(data?.modules) ? data.modules : [];
}

function isGlobalCourseAdmin(modules: string[]): boolean {
	return hasModule(modules, 'users') || hasModuleLevel(modules, 'courses.admin');
}


async function canManageCohort(userId: string, cohortId: string, modules: string[]): Promise<boolean> {
	// Global course admins can manage all cohorts
	if (isGlobalCourseAdmin(modules)) {
		return true;
	}

	// Course managers must be assigned to this course (NOT enrolled)
	if (!hasModuleLevel(modules, 'courses.manager')) {
		return false;
	}

	// Get the course ID for this cohort
	const { data: cohort } = await supabaseAdmin
		.from('courses_cohorts')
		.select('module_id')
		.eq('id', cohortId)
		.single();

	if (!cohort?.module_id) {
		return false;
	}

	const { data: module } = await supabaseAdmin
		.from('courses_modules')
		.select('course_id')
		.eq('id', cohort.module_id)
		.single();

	if (!module?.course_id) {
		return false;
	}

	// Check if this course is in user's assigned_course_ids
	const { data: userProfile } = await supabaseAdmin
		.from('user_profiles')
		.select('assigned_course_ids')
		.eq('id', userId)
		.single();

	const assignedCourseIds = userProfile?.assigned_course_ids || [];
	return Array.isArray(assignedCourseIds) && assignedCourseIds.includes(module.course_id);
}

export const PATCH: RequestHandler = async (event) => {
	const { user } = await ensureSession(event);

	try {
		const { id } = event.params;
		const body = await event.request.json();
		const { pinned } = body;

		if (typeof pinned !== 'boolean') {
			throw error(400, 'pinned must be a boolean value');
		}

		const { data: existingItem, error: fetchError } = await supabaseAdmin
			.from('courses_community_feed')
			.select('id, feed_type, cohort_id')
			.eq('id', id)
			.single();

		if (fetchError) {
			console.error('Feed fetch error:', fetchError);
			throw error(500, 'Failed to fetch feed item');
		}

		if (!existingItem) {
			throw error(404, 'Feed item not found');
		}

		const modules = await getUserModules(user.id);
		const canManage = await canManageCohort(user.id, existingItem.cohort_id, modules);

		if (!canManage) {
			throw error(403, 'Only course admins can pin or unpin feed items');
		}

		const { data: updatedItem, error: updateError } = await supabaseAdmin
			.from('courses_community_feed')
			.update({
				pinned,
				updated_at: new Date().toISOString()
			})
			.eq('id', id)
			.select()
			.single();

		if (updateError) {
			console.error('Pin update error:', updateError);
			throw error(500, 'Failed to update pin status');
		}

		return json({
			success: true,
			data: updatedItem,
			message: pinned ? 'Post pinned successfully' : 'Post unpinned successfully'
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

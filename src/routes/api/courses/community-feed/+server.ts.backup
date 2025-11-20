import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { hasModule, hasModuleLevel } from '$lib/server/auth';

const ACTIVE_ENROLLMENT_STATUSES = ['active', 'invited', 'accepted'];

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

async function getCohortEnrollment(userId: string, cohortId: string) {
	const { data, error } = await supabaseAdmin
		.from('courses_enrollments')
		.select('role, status')
		.eq('user_profile_id', userId)
		.eq('cohort_id', cohortId)
		.in('status', ACTIVE_ENROLLMENT_STATUSES)
		.maybeSingle();

	if (error) {
		console.error('Error checking cohort enrollment:', error);
	}

	return data ?? null;
}

function isGlobalCourseAdmin(modules: string[]): boolean {
	return hasModule(modules, 'platform.admin') || hasModuleLevel(modules, 'courses.admin');
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

async function ensureSession(event) {
	const { session, user } = await event.locals.safeGetSession();
	if (!session || !user) {
		throw error(401, 'Unauthorized');
	}
	return { session, user };
}

export const GET: RequestHandler = async (event) => {
	const { user } = await ensureSession(event);

	try {
		const cohortId = event.url.searchParams.get('cohort_id');
		const limit = parseInt(event.url.searchParams.get('limit') || '50', 10);
		const offset = parseInt(event.url.searchParams.get('offset') || '0', 10);

		if (!cohortId) {
			throw error(400, 'cohort_id is required');
		}

		const modules = await getUserModules(user.id);
		const enrollment = await getCohortEnrollment(user.id, cohortId);
		const isAdmin = isGlobalCourseAdmin(modules);

		if (!enrollment && !isAdmin) {
			throw error(403, 'Access denied to this cohort feed');
		}

		const { data: feedItems, error: feedError } = await supabaseAdmin
			.from('courses_community_feed')
			.select('*')
			.eq('cohort_id', cohortId)
			.order('pinned', { ascending: false })
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);

		if (feedError) {
			console.error('Feed fetch error:', feedError);
			throw error(500, 'Failed to fetch community feed');
		}

		return json({
			success: true,
			data: feedItems ?? [],
			pagination: {
				limit,
				offset,
				count: feedItems?.length ?? 0
			}
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

export const POST: RequestHandler = async (event) => {
	const { user } = await ensureSession(event);

	try {
		const body = await event.request.json();
		const { cohort_id, title, content, image_url, pinned, send_email_notification } = body;

		if (!cohort_id || !content?.trim()) {
			throw error(400, 'cohort_id and content are required');
		}

		const modules = await getUserModules(user.id);
		const canManage = await canManageCohort(user.id, cohort_id, modules);

		if (!canManage) {
			throw error(403, 'Only course admins can create feed updates');
		}

		const authorProfile = await supabaseAdmin
			.from('user_profiles')
			.select('full_name')
			.eq('id', user.id)
			.single();

		const authorName = authorProfile.data?.full_name || 'Course Admin';

		const { data: feedItem, error: insertError } = await supabaseAdmin
			.from('courses_community_feed')
			.insert({
				cohort_id,
				feed_type: 'admin_update',
				title: title?.trim() || null,
				content: content.trim(),
				author_id: user.id,
				author_name: authorName,
				image_url: image_url?.trim() || null,
				pinned: pinned || false,
				email_notification_sent: false
			})
			.select()
			.single();

		if (insertError) {
			console.error('Feed insert error:', insertError);
			throw error(500, 'Failed to create feed update');
		}

		// TODO: implement send_email_notification handling

		return json({
			success: true,
			data: feedItem,
			message: 'Feed update created successfully'
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

export const PATCH: RequestHandler = async (event) => {
	const { user } = await ensureSession(event);

	try {
		const body = await event.request.json();
		const { id, title, content, image_url, pinned } = body;

		if (!id) {
			throw error(400, 'id is required');
		}

		const { data: existingItem } = await supabaseAdmin
			.from('courses_community_feed')
			.select('author_id, feed_type, cohort_id')
			.eq('id', id)
			.single();

		if (!existingItem) {
			throw error(404, 'Feed item not found');
		}

		const modules = await getUserModules(user.id);
		const canManage = await canManageCohort(user.id, existingItem.cohort_id, modules);

		if (!canManage || existingItem.feed_type !== 'admin_update' || existingItem.author_id !== user.id) {
			throw error(403, 'Only the original course admin can update this feed item');
		}

		const updates: Record<string, unknown> = {
			updated_at: new Date().toISOString()
		};

		if (title !== undefined) updates.title = title?.trim() || null;
		if (content !== undefined) updates.content = content?.trim() || null;
		if (image_url !== undefined) updates.image_url = image_url?.trim() || null;
		if (pinned !== undefined) updates.pinned = Boolean(pinned);

		const { data: updatedItem, error: updateError } = await supabaseAdmin
			.from('courses_community_feed')
			.update(updates)
			.eq('id', id)
			.select()
			.single();

		if (updateError) {
			console.error('Feed update error:', updateError);
			throw error(500, 'Failed to update feed item');
		}

		return json({
			success: true,
			data: updatedItem,
			message: 'Feed item updated successfully'
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { user } = await ensureSession(event);

	try {
		const body = await event.request.json();
		const { id } = body;

		if (!id) {
			throw error(400, 'id is required');
		}

		const { data: existingItem } = await supabaseAdmin
			.from('courses_community_feed')
			.select('author_id, feed_type, cohort_id')
			.eq('id', id)
			.single();

		if (!existingItem) {
			throw error(404, 'Feed item not found');
		}

		const modules = await getUserModules(user.id);
		const canManage = await canManageCohort(user.id, existingItem.cohort_id, modules);

		if (!canManage || existingItem.feed_type !== 'admin_update' || existingItem.author_id !== user.id) {
			throw error(403, 'Only the original course admin can delete this feed item');
		}

		const { error: deleteError } = await supabaseAdmin
			.from('courses_community_feed')
			.delete()
			.eq('id', id);

		if (deleteError) {
			console.error('Feed delete error:', deleteError);
			throw error(500, 'Failed to delete feed item');
		}

		return json({
			success: true,
			message: 'Feed item deleted successfully'
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

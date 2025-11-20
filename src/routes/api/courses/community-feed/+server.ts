import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAuth, hasAnyModule } from '$lib/server/auth';

const ACTIVE_ENROLLMENT_STATUSES = ['active', 'invited', 'accepted'];

/**
 * Check if user can manage a specific cohort
 * - Global admins (platform.admin, courses.admin) can manage all cohorts
 * - Course managers (courses.manager) can manage cohorts for assigned courses
 */
async function canManageCohort(userId: string, cohortId: string, userProfile: any): Promise<boolean> {
	// Global course admins can manage all cohorts
	if (hasAnyModule(userProfile.modules, ['platform.admin', 'courses.admin'])) {
		return true;
	}

	// Course managers must be assigned to this course
	if (!hasAnyModule(userProfile.modules, ['courses.manager'])) {
		return false;
	}

	// Get the course ID for this cohort
	const { data: cohort } = await supabaseAdmin
		.from('courses_cohorts')
		.select('module:module_id(course_id)')
		.eq('id', cohortId)
		.single();

	if (!cohort?.module?.course_id) {
		return false;
	}

	// Check if this course is in user's assigned_course_ids
	const assignedCourseIds = userProfile.assigned_course_ids || [];
	return Array.isArray(assignedCourseIds) && assignedCourseIds.includes(cohort.module.course_id);
}

/**
 * GET - Fetch community feed for a cohort
 * Requires: User must be enrolled in cohort OR be a global course admin
 */
export const GET: RequestHandler = async (event) => {
	const { user, profile } = await requireAuth(event);

	try {
		const cohortId = event.url.searchParams.get('cohort_id');
		const limit = parseInt(event.url.searchParams.get('limit') || '50', 10);
		const offset = parseInt(event.url.searchParams.get('offset') || '0', 10);

		if (!cohortId) {
			throw error(400, 'cohort_id is required');
		}

		// Check authorization: enrollment OR global admin
		const isGlobalAdmin = hasAnyModule(profile.modules, ['platform.admin', 'courses.admin']);

		if (!isGlobalAdmin) {
			// Check enrollment
			const { data: enrollment } = await supabaseAdmin
				.from('courses_enrollments')
				.select('role, status')
				.eq('user_profile_id', user.id)
				.eq('cohort_id', cohortId)
				.in('status', ACTIVE_ENROLLMENT_STATUSES)
				.maybeSingle();

			if (!enrollment) {
				throw error(403, 'Access denied to this cohort feed');
			}
		}

		// Fetch feed items
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

/**
 * POST - Create new feed item
 * Requires: User must be able to manage the cohort (admin/manager)
 */
export const POST: RequestHandler = async (event) => {
	const { user, profile } = await requireAuth(event);

	try {
		const body = await event.request.json();
		const { cohort_id, title, content, image_url, pinned, send_email_notification } = body;

		if (!cohort_id || !content?.trim()) {
			throw error(400, 'cohort_id and content are required');
		}

		// Check authorization
		const canManage = await canManageCohort(user.id, cohort_id, profile);
		if (!canManage) {
			throw error(403, 'Only course admins can create feed updates');
		}

		// Get author name
		const authorName = profile.full_name || 'Course Admin';

		// Create feed item
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

/**
 * PATCH - Update existing feed item
 * Requires: User must be the original author AND have cohort management permissions
 */
export const PATCH: RequestHandler = async (event) => {
	const { user, profile } = await requireAuth(event);

	try {
		const body = await event.request.json();
		const { id, title, content, image_url, pinned } = body;

		if (!id) {
			throw error(400, 'id is required');
		}

		// Fetch existing item
		const { data: existingItem } = await supabaseAdmin
			.from('courses_community_feed')
			.select('author_id, feed_type, cohort_id')
			.eq('id', id)
			.single();

		if (!existingItem) {
			throw error(404, 'Feed item not found');
		}

		// Check authorization
		const canManage = await canManageCohort(user.id, existingItem.cohort_id, profile);

		if (!canManage || existingItem.feed_type !== 'admin_update' || existingItem.author_id !== user.id) {
			throw error(403, 'Only the original course admin can update this feed item');
		}

		// Build update object
		const updates: Record<string, unknown> = {
			updated_at: new Date().toISOString()
		};

		if (title !== undefined) updates.title = title?.trim() || null;
		if (content !== undefined) updates.content = content?.trim() || null;
		if (image_url !== undefined) updates.image_url = image_url?.trim() || null;
		if (pinned !== undefined) updates.pinned = Boolean(pinned);

		// Update item
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

/**
 * DELETE - Delete feed item
 * Requires: User must be the original author AND have cohort management permissions
 */
export const DELETE: RequestHandler = async (event) => {
	const { user, profile } = await requireAuth(event);

	try {
		const body = await event.request.json();
		const { id } = body;

		if (!id) {
			throw error(400, 'id is required');
		}

		// Fetch existing item
		const { data: existingItem } = await supabaseAdmin
			.from('courses_community_feed')
			.select('author_id, feed_type, cohort_id')
			.eq('id', id)
			.single();

		if (!existingItem) {
			throw error(404, 'Feed item not found');
		}

		// Check authorization
		const canManage = await canManageCohort(user.id, existingItem.cohort_id, profile);

		if (!canManage || existingItem.feed_type !== 'admin_update' || existingItem.author_id !== user.id) {
			throw error(403, 'Only the original course admin can delete this feed item');
		}

		// Delete item
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

import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCoursesUser } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

/**
 * GET - Fetch community feed for a cohort
 * Query params:
 *   - cohort_id: Required
 *   - limit: Optional (default 50)
 *   - offset: Optional (default 0)
 */
export const GET: RequestHandler = async (event) => {
	// Require ACCF user authentication
	const { user } = await requireCoursesUser(event);

	try {
		const cohortId = event.url.searchParams.get('cohort_id');
		const limit = parseInt(event.url.searchParams.get('limit') || '50');
		const offset = parseInt(event.url.searchParams.get('offset') || '0');

		if (!cohortId) {
			throw error(400, 'cohort_id is required');
		}

		// Verify user has access to this cohort
		const { data: accessCheck } = await supabaseAdmin
			.from('courses_enrollments')
			.select('cohort_id')
			.eq('user_profile_id', user.id)
			.eq('cohort_id', cohortId)
			.single();

		// Also check if user is admin
		const { data: profileData } = await supabaseAdmin
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const isAdmin = profileData?.role === 'courses_admin' || profileData?.role === 'admin';

		if (!accessCheck && !isAdmin) {
			throw error(403, 'Access denied to this cohort feed');
		}

		// Fetch feed items - pinned first, then by created_at DESC
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
			data: feedItems,
			pagination: {
				limit,
				offset,
				count: feedItems.length
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
 * POST - Create admin update in community feed
 * Body:
 *   - cohort_id: Required
 *   - title: Optional
 *   - content: Required
 *   - image_url: Optional
 *   - pinned: Optional (default false)
 *   - send_email_notification: Optional (default false) - NOT IMPLEMENTED YET
 */
export const POST: RequestHandler = async (event) => {
	// Require ACCF user authentication
	const { user } = await requireCoursesUser(event);

	try {
		// Verify user is admin
		const { data: profileData } = await supabaseAdmin
			.from('user_profiles')
			.select('role, full_name')
			.eq('id', user.id)
			.single();

		const isAdmin = profileData?.role === 'courses_admin' || profileData?.role === 'admin';

		if (!isAdmin) {
			throw error(403, 'Only admins can create feed updates');
		}

		const body = await event.request.json();
		const { cohort_id, title, content, image_url, pinned, send_email_notification } = body;

		// Validate required fields
		if (!cohort_id || !content?.trim()) {
			throw error(400, 'cohort_id and content are required');
		}

		// Create feed item
		const { data: feedItem, error: insertError } = await supabaseAdmin
			.from('courses_community_feed')
			.insert({
				cohort_id,
				feed_type: 'admin_update',
				title: title?.trim() || null,
				content: content.trim(),
				author_id: user.id,
				author_name: profileData.full_name || 'Admin',
				image_url: image_url?.trim() || null,
				pinned: pinned || false,
				email_notification_sent: false // Will be set to true when email is sent (future feature)
			})
			.select()
			.single();

		if (insertError) {
			console.error('Feed insert error:', insertError);
			throw error(500, 'Failed to create feed update');
		}

		// TODO: If send_email_notification is true, queue email to cohort members
		// This will be implemented when email system is ready

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
 * PATCH - Update admin's own feed item
 * Body:
 *   - id: Required
 *   - title: Optional
 *   - content: Optional
 *   - image_url: Optional
 *   - pinned: Optional
 */
export const PATCH: RequestHandler = async (event) => {
	// Require ACCF user authentication
	const { user } = await requireCoursesUser(event);

	try {
		// Verify user is admin
		const { data: profileData } = await supabaseAdmin
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const isAdmin = profileData?.role === 'courses_admin' || profileData?.role === 'admin';

		if (!isAdmin) {
			throw error(403, 'Only admins can update feed items');
		}

		const body = await event.request.json();
		const { id, title, content, image_url, pinned } = body;

		if (!id) {
			throw error(400, 'id is required');
		}

		// Verify this is the author's post and it's an admin_update
		const { data: existingItem } = await supabaseAdmin
			.from('courses_community_feed')
			.select('author_id, feed_type')
			.eq('id', id)
			.single();

		if (!existingItem) {
			throw error(404, 'Feed item not found');
		}

		if (existingItem.feed_type !== 'admin_update') {
			throw error(400, 'Cannot edit reflection posts');
		}

		if (existingItem.author_id !== user.id) {
			throw error(403, 'You can only edit your own posts');
		}

		// Build update object
		const updates: any = {
			updated_at: new Date().toISOString()
		};

		if (title !== undefined) updates.title = title?.trim() || null;
		if (content !== undefined) updates.content = content.trim();
		if (image_url !== undefined) updates.image_url = image_url?.trim() || null;
		if (pinned !== undefined) updates.pinned = pinned;

		// Update feed item
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
 * DELETE - Delete admin's own feed item
 * Query params:
 *   - id: Required
 */
export const DELETE: RequestHandler = async (event) => {
	// Require ACCF user authentication
	const { user } = await requireCoursesUser(event);

	try {
		// Verify user is admin
		const { data: profileData } = await supabaseAdmin
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		const isAdmin = profileData?.role === 'courses_admin' || profileData?.role === 'admin';

		if (!isAdmin) {
			throw error(403, 'Only admins can delete feed items');
		}

		const id = event.url.searchParams.get('id');

		if (!id) {
			throw error(400, 'id is required');
		}

		// Verify this is the author's post and it's an admin_update
		const { data: existingItem } = await supabaseAdmin
			.from('courses_community_feed')
			.select('author_id, feed_type')
			.eq('id', id)
			.single();

		if (!existingItem) {
			throw error(404, 'Feed item not found');
		}

		if (existingItem.feed_type !== 'admin_update') {
			throw error(400, 'Cannot delete reflection posts');
		}

		if (existingItem.author_id !== user.id) {
			throw error(403, 'You can only delete your own posts');
		}

		// Delete feed item
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

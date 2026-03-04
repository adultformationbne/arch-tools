import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAuth, getUserProfile, hasAnyModule } from '$lib/server/auth';

const ACTIVE_ENROLLMENT_STATUSES = ['active', 'invited', 'accepted'];

/**
 * Verify the user can access chat for the given cohort.
 * Returns enrollment data (or null for admins who aren't enrolled).
 */
async function verifyChatAccess(event: any, userId: string, cohortId: string) {
	const profile = await getUserProfile(event, userId);

	// Platform-level course admins can access any cohort's chat
	const isGlobalAdmin = hasAnyModule(profile?.modules ?? null, ['platform.admin', 'courses.admin']);

	if (isGlobalAdmin) {
		return { profile, enrollment: null, isAdmin: true };
	}

	// Check enrollment in this cohort with coordinator or admin role
	const { data: enrollment } = await supabaseAdmin
		.from('courses_enrollments')
		.select('id, role, status, cohort_id, hub_id, full_name')
		.eq('user_profile_id', userId)
		.eq('cohort_id', cohortId)
		.in('status', ACTIVE_ENROLLMENT_STATUSES)
		.in('role', ['coordinator', 'admin'])
		.maybeSingle();

	if (!enrollment) {
		throw error(403, 'Access denied to this chat');
	}

	return { profile, enrollment, isAdmin: false };
}

/**
 * GET - Fetch paginated chat messages for a cohort
 */
export const GET: RequestHandler = async (event) => {
	const { user } = await requireAuth(event);

	const cohortId = event.url.searchParams.get('cohort_id');
	const limit = Math.min(parseInt(event.url.searchParams.get('limit') || '50', 10), 100);
	const before = event.url.searchParams.get('before'); // cursor: created_at timestamp

	if (!cohortId) {
		throw error(400, 'cohort_id is required');
	}

	await verifyChatAccess(event, user.id, cohortId);

	let query = supabaseAdmin
		.from('courses_chat_messages')
		.select('*')
		.eq('cohort_id', cohortId)
		.is('deleted_at', null)
		.order('created_at', { ascending: false })
		.limit(limit + 1); // fetch one extra to check hasMore

	if (before) {
		query = query.lt('created_at', before);
	}

	const { data: messages, error: fetchError } = await query;

	if (fetchError) {
		console.error('Chat fetch error:', fetchError);
		throw error(500, 'Failed to fetch chat messages');
	}

	const hasMore = (messages?.length ?? 0) > limit;
	const trimmed = (messages ?? []).slice(0, limit).reverse(); // oldest first

	return json({
		success: true,
		data: trimmed,
		hasMore
	});
};

/**
 * POST - Send a chat message
 */
export const POST: RequestHandler = async (event) => {
	const { user } = await requireAuth(event);

	const body = await event.request.json();
	const { content, cohort_id } = body;

	if (!cohort_id) {
		throw error(400, 'cohort_id is required');
	}

	const trimmed = content?.trim();
	if (!trimmed) {
		throw error(400, 'Message content is required');
	}
	if (trimmed.length > 2000) {
		throw error(400, 'Message must be 2000 characters or less');
	}

	const { profile, enrollment, isAdmin } = await verifyChatAccess(event, user.id, cohort_id);

	// Determine sender metadata — prefer enrollment name (admin-editable) over profile
	let senderName = enrollment?.full_name || profile?.full_name || profile?.display_name || 'Unknown';
	let senderRole: string;
	let hubName: string | null = null;

	if (isAdmin) {
		senderRole = 'admin';
	} else {
		senderRole = enrollment!.role === 'admin' ? 'admin' : 'coordinator';

		// Look up hub name for coordinators via enrollment.hub_id
		if (senderRole === 'coordinator' && enrollment?.hub_id) {
			const { data: hubData } = await supabaseAdmin
				.from('courses_hubs')
				.select('name')
				.eq('id', enrollment.hub_id)
				.maybeSingle();

			hubName = hubData?.name || null;
		}
	}

	const { data: message, error: insertError } = await supabaseAdmin
		.from('courses_chat_messages')
		.insert({
			cohort_id: cohort_id,
			sender_id: user.id,
			sender_name: senderName,
			sender_role: senderRole,
			hub_name: hubName,
			content: trimmed
		})
		.select()
		.single();

	if (insertError) {
		console.error('Chat insert error:', insertError);
		throw error(500, 'Failed to send message');
	}

	return json({
		success: true,
		data: message
	});
};

/**
 * PATCH - Edit a message (own messages only)
 */
export const PATCH: RequestHandler = async (event) => {
	const { user } = await requireAuth(event);

	const body = await event.request.json();
	const { message_id, cohort_id, content } = body;

	if (!cohort_id || !message_id) {
		throw error(400, 'cohort_id and message_id are required');
	}

	const trimmed = content?.trim();
	if (!trimmed) {
		throw error(400, 'Message content is required');
	}
	if (trimmed.length > 2000) {
		throw error(400, 'Message must be 2000 characters or less');
	}

	await verifyChatAccess(event, user.id, cohort_id);

	// Verify the user owns this message
	const { data: existing } = await supabaseAdmin
		.from('courses_chat_messages')
		.select('sender_id')
		.eq('id', message_id)
		.eq('cohort_id', cohort_id)
		.is('deleted_at', null)
		.maybeSingle();

	if (!existing) {
		throw error(404, 'Message not found');
	}
	if (existing.sender_id !== user.id) {
		throw error(403, 'You can only edit your own messages');
	}

	const { data: updated, error: updateError } = await supabaseAdmin
		.from('courses_chat_messages')
		.update({ content: trimmed })
		.eq('id', message_id)
		.select()
		.single();

	if (updateError) {
		console.error('Chat edit error:', updateError);
		throw error(500, 'Failed to edit message');
	}

	return json({ success: true, data: updated });
};

/**
 * DELETE - Delete a single message or clear all messages for a cohort
 * Admin-only operation.
 * Query params:
 *   - message_id: delete a single message
 *   - cohort_id + clear_all=true: clear all messages for the cohort
 */
export const DELETE: RequestHandler = async (event) => {
	const { user } = await requireAuth(event);

	const body = await event.request.json();
	const { message_id, cohort_id, clear_all } = body;

	if (!cohort_id) {
		throw error(400, 'cohort_id is required');
	}

	const { isAdmin, enrollment } = await verifyChatAccess(event, user.id, cohort_id);

	// Only platform admins or enrolled admins can delete messages
	const isEnrolledAdmin = enrollment?.role === 'admin';
	if (!isAdmin && !isEnrolledAdmin) {
		throw error(403, 'Only admins can delete messages');
	}

	if (clear_all) {
		// Soft-delete all messages in the cohort
		const { error: deleteError } = await supabaseAdmin
			.from('courses_chat_messages')
			.update({ deleted_at: new Date().toISOString() })
			.eq('cohort_id', cohort_id)
			.is('deleted_at', null);

		if (deleteError) {
			console.error('Chat clear error:', deleteError);
			throw error(500, 'Failed to clear messages');
		}

		return json({ success: true, cleared: true });
	}

	if (message_id) {
		// Soft-delete a single message
		const { error: deleteError } = await supabaseAdmin
			.from('courses_chat_messages')
			.update({ deleted_at: new Date().toISOString() })
			.eq('id', message_id)
			.eq('cohort_id', cohort_id);

		if (deleteError) {
			console.error('Chat delete error:', deleteError);
			throw error(500, 'Failed to delete message');
		}

		return json({ success: true, deleted: message_id });
	}

	throw error(400, 'Provide message_id or clear_all');
};

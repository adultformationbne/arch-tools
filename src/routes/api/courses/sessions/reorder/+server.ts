import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAuth } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

/**
 * PATCH /api/courses/sessions/reorder
 * Reorder sessions within a module by updating their session_numbers
 *
 * Body: { module_id: string, session_order: string[] }
 * session_order is an array of session IDs in the desired order
 */
export const PATCH: RequestHandler = async (event) => {
	await requireAuth(event);

	const { module_id, session_order } = await event.request.json();

	if (!module_id || !session_order || !Array.isArray(session_order)) {
		throw error(400, 'module_id and session_order array are required');
	}

	if (session_order.length === 0) {
		return json({ success: true, order: [] });
	}

	try {
		// Get ALL sessions for this module to handle unique constraint properly
		const { data: allSessions, error: fetchError } = await supabaseAdmin
			.from('courses_sessions')
			.select('id, session_number')
			.eq('module_id', module_id)
			.order('session_number', { ascending: true });

		if (fetchError) {
			console.error('Error fetching sessions:', fetchError);
			throw error(500, 'Failed to fetch sessions');
		}

		if (!allSessions || allSessions.length === 0) {
			return json({ success: true, order: [] });
		}

		// Validate all provided IDs belong to this module
		const sessionIdSet = new Set(allSessions.map(s => s.id));
		for (const id of session_order) {
			if (!sessionIdSet.has(id)) {
				throw error(400, `Session ${id} does not belong to module ${module_id}`);
			}
		}

		// Build the new order:
		// - Sessions in session_order get positions 0, 1, 2, ... based on their array index
		// - Sessions NOT in session_order keep their relative order after the reordered ones
		const reorderedSet = new Set(session_order);
		const notReordered = allSessions.filter(s => !reorderedSet.has(s.id));

		// Final order: reordered sessions first (in specified order), then others
		const finalOrder = [
			...session_order.map((id, index) => ({ id, session_number: index })),
			...notReordered.map((s, index) => ({ id: s.id, session_number: session_order.length + index }))
		];

		console.log('[Reorder] Final order:', finalOrder.map(f => `${f.id.slice(0,8)}→${f.session_number}`).join(', '));

		// Two-phase update to avoid unique constraint conflicts
		// Phase 1: Move all to temp positions (50-99 range)
		console.log('[Reorder] Phase 1: Moving to temp positions 50+');
		for (let i = 0; i < finalOrder.length; i++) {
			const tempPos = 50 + i;
			const { error: tempError } = await supabaseAdmin
				.from('courses_sessions')
				.update({ session_number: tempPos })
				.eq('id', finalOrder[i].id);

			if (tempError) {
				console.error(`[Reorder] Error moving ${finalOrder[i].id} to temp ${tempPos}:`, tempError);
				throw error(500, `Failed to reorder sessions: ${tempError.message}`);
			}
		}

		// Phase 2: Set final positions
		console.log('[Reorder] Phase 2: Setting final positions');
		for (const update of finalOrder) {
			const { error: finalError } = await supabaseAdmin
				.from('courses_sessions')
				.update({ session_number: update.session_number })
				.eq('id', update.id);

			if (finalError) {
				console.error(`[Reorder] Error setting ${update.id} to final ${update.session_number}:`, finalError);
				throw error(500, `Failed to reorder sessions: ${finalError.message}`);
			}
		}
		console.log('[Reorder] Success!');

		return json({ success: true, order: finalOrder });
	} catch (err) {
		console.error('Error in PATCH /api/courses/sessions/reorder:', err);
		if (err instanceof Error && 'status' in err) throw err;
		throw error(500, 'Failed to reorder sessions');
	}
};

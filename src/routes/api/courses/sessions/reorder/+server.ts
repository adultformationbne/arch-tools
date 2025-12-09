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
	const startTime = Date.now();
	console.log('[Reorder] ====== START ======');

	await requireAuth(event);
	console.log(`[Reorder] Auth: ${Date.now() - startTime}ms`);

	const { module_id, session_order } = await event.request.json();
	console.log(`[Reorder] Module: ${module_id}, Sessions to reorder: ${session_order?.length}`);

	if (!module_id || !session_order || !Array.isArray(session_order)) {
		throw error(400, 'module_id and session_order array are required');
	}

	if (session_order.length === 0) {
		return json({ success: true, order: [] });
	}

	try {
		// Get ALL sessions for this module to handle unique constraint properly
		const fetchStart = Date.now();
		const { data: allSessions, error: fetchError } = await supabaseAdmin
			.from('courses_sessions')
			.select('id, session_number')
			.eq('module_id', module_id)
			.order('session_number', { ascending: true });
		console.log(`[Reorder] Fetch sessions: ${Date.now() - fetchStart}ms, found ${allSessions?.length}`);

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

		// Phase 1: Move all to temp positions in PARALLEL (much faster than sequential)
		// Use offset of 50 to avoid unique constraint conflicts during transition
		const phase1Start = Date.now();
		console.log(`[Reorder] Phase 1: Moving ${finalOrder.length} sessions to temp positions (parallel)...`);

		const tempPromises = finalOrder.map(({ id, session_number }) =>
			supabaseAdmin
				.from('courses_sessions')
				.update({ session_number: session_number + 50 })
				.eq('id', id)
		);

		const tempResults = await Promise.all(tempPromises);
		console.log(`[Reorder] Phase 1 complete: ${Date.now() - phase1Start}ms`);

		const tempError = tempResults.find(r => r.error);
		if (tempError?.error) {
			console.error('[Reorder] Temp phase error:', tempError.error);
			throw error(500, `Failed to reorder sessions: ${tempError.error.message}`);
		}

		// Phase 2: Set final positions in PARALLEL
		const phase2Start = Date.now();
		console.log(`[Reorder] Phase 2: Setting final positions (parallel)...`);

		const finalPromises = finalOrder.map(({ id, session_number }) =>
			supabaseAdmin
				.from('courses_sessions')
				.update({ session_number })
				.eq('id', id)
		);

		const finalResults = await Promise.all(finalPromises);
		console.log(`[Reorder] Phase 2 complete: ${Date.now() - phase2Start}ms`);

		const finalError = finalResults.find(r => r.error);
		if (finalError?.error) {
			console.error('[Reorder] Final phase error:', finalError.error);
			throw error(500, `Failed to reorder sessions: ${finalError.error.message}`);
		}

		console.log(`[Reorder] ====== SUCCESS ====== Total: ${Date.now() - startTime}ms`);

		return json({ success: true, order: finalOrder });
	} catch (err) {
		console.error('Error in PATCH /api/courses/sessions/reorder:', err);
		if (err instanceof Error && 'status' in err) throw err;
		throw error(500, 'Failed to reorder sessions');
	}
};

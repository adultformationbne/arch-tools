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
		const fetchStart = Date.now();
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


		// Single SQL query approach - much faster than multiple requests
		const sqlStart = Date.now();

		// Build VALUES list for the update: ('id1', 0), ('id2', 1), ...
		const valuesList = finalOrder
			.map(({ id, session_number }) => `('${id}'::uuid, ${session_number})`)
			.join(', ');

		// Use a CTE to do atomic update - PostgreSQL checks constraints at statement end
		const sql = `
			WITH new_order(id, new_session_number) AS (
				VALUES ${valuesList}
			)
			UPDATE courses_sessions cs
			SET session_number = no.new_session_number,
			    updated_at = NOW()
			FROM new_order no
			WHERE cs.id = no.id
		`;


		const { error: sqlError } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });

		// If RPC doesn't exist, fall back to parallel updates
		if (sqlError?.code === '42883' || sqlError?.message?.includes('function')) {

			// Phase 1: Temp positions
			const phase1Start = Date.now();
			const tempPromises = finalOrder.map(({ id, session_number }) =>
				supabaseAdmin.from('courses_sessions').update({ session_number: session_number + 50 }).eq('id', id)
			);
			const tempResults = await Promise.all(tempPromises);

			const tempError = tempResults.find(r => r.error);
			if (tempError?.error) throw error(500, `Reorder failed: ${tempError.error.message}`);

			// Phase 2: Final positions
			const phase2Start = Date.now();
			const finalPromises = finalOrder.map(({ id, session_number }) =>
				supabaseAdmin.from('courses_sessions').update({ session_number }).eq('id', id)
			);
			const finalResults = await Promise.all(finalPromises);

			const finalError = finalResults.find(r => r.error);
			if (finalError?.error) throw error(500, `Reorder failed: ${finalError.error.message}`);
		} else if (sqlError) {
			console.error('[Reorder] SQL error:', sqlError);
			throw error(500, `Failed to reorder: ${sqlError.message}`);
		} else {
		}


		return json({ success: true, order: finalOrder });
	} catch (err) {
		console.error('Error in PATCH /api/courses/sessions/reorder:', err);
		if (err instanceof Error && 'status' in err) throw err;
		throw error(500, 'Failed to reorder sessions');
	}
};

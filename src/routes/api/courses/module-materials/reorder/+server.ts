import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAuth } from '$lib/server/auth.js';
import type { RequestHandler } from './$types';

/**
 * PATCH /api/courses/module-materials/reorder
 * Reorder materials within a session by updating their display_order
 *
 * Body: { session_id: string, material_order: string[] }
 * material_order is an array of material IDs in the desired order
 */
export const PATCH: RequestHandler = async (event) => {
	await requireAuth(event);

	const { session_id, material_order } = await event.request.json();

	if (!session_id || !material_order || !Array.isArray(material_order)) {
		throw error(400, 'session_id and material_order array are required');
	}

	if (material_order.length === 0) {
		return json({ success: true, order: [] });
	}

	try {
		// Get all materials for this session
		const { data: allMaterials, error: fetchError } = await supabaseAdmin
			.from('courses_materials')
			.select('id, display_order')
			.eq('session_id', session_id)
			.order('display_order', { ascending: true });

		if (fetchError) {
			console.error('Error fetching materials:', fetchError);
			throw error(500, 'Failed to fetch materials');
		}

		if (!allMaterials || allMaterials.length === 0) {
			return json({ success: true, order: [] });
		}

		// Validate all provided IDs belong to this session
		const materialIdSet = new Set(allMaterials.map(m => m.id));
		for (const id of material_order) {
			if (!materialIdSet.has(id)) {
				throw error(400, `Material ${id} does not belong to session ${session_id}`);
			}
		}

		// Build the new order
		const reorderedSet = new Set(material_order);
		const notReordered = allMaterials.filter(m => !reorderedSet.has(m.id));

		// Final order: reordered materials in specified order, then others
		const finalOrder = [
			...material_order.map((id, index) => ({ id, display_order: index + 1 })),
			...notReordered.map((m, index) => ({ id: m.id, display_order: material_order.length + index + 1 }))
		];

		// Two-phase update to avoid any potential conflicts
		// Phase 1: Move all to temp positions
		const tempBase = Date.now() % 1000000 + 10000;
		for (let i = 0; i < finalOrder.length; i++) {
			const tempPos = tempBase + i;
			const { error: tempError } = await supabaseAdmin
				.from('courses_materials')
				.update({ display_order: tempPos })
				.eq('id', finalOrder[i].id);

			if (tempError) {
				console.error(`[Materials Reorder] Error moving ${finalOrder[i].id} to temp ${tempPos}:`, tempError);
				throw error(500, `Failed to reorder materials: ${tempError.message}`);
			}
		}

		// Phase 2: Set final positions
		for (const update of finalOrder) {
			const { error: finalError } = await supabaseAdmin
				.from('courses_materials')
				.update({ display_order: update.display_order })
				.eq('id', update.id);

			if (finalError) {
				console.error(`[Materials Reorder] Error setting ${update.id} to final ${update.display_order}:`, finalError);
				throw error(500, `Failed to reorder materials: ${finalError.message}`);
			}
		}

		return json({ success: true, order: finalOrder });
	} catch (err) {
		console.error('Error in PATCH /api/courses/module-materials/reorder:', err);
		if (err instanceof Error && 'status' in err) throw err;
		throw error(500, 'Failed to reorder materials');
	}
};

/**
 * Material Status Endpoint
 *
 * Returns the current Mux status for a material.
 * Used for polling during video processing.
 */

import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { safeGetSession } }) => {
	try {
		const { session } = await safeGetSession();
		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const materialId = url.searchParams.get('id');

		if (!materialId) {
			return json({ error: 'Material id is required' }, { status: 400 });
		}

		const { data, error } = await supabaseAdmin
			.from('courses_materials')
			.select('id, mux_status, mux_playback_id, mux_asset_id')
			.eq('id', materialId)
			.single();

		if (error) {
			console.error('Error fetching material status:', error);
			return json({ error: 'Failed to fetch material status' }, { status: 500 });
		}

		return json({ material: data });
	} catch (error) {
		console.error('Error in material status endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

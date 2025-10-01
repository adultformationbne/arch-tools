import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { safeGetSession } }) => {
	try {
		// Authentication check - students can read materials
		const { session } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		const moduleId = url.searchParams.get('module_id');
		const sessionNumber = url.searchParams.get('session_number');
		const sessionId = url.searchParams.get('session_id');

		// Need either session_id OR module_id
		if (!sessionId && !moduleId) {
			return json({ error: 'session_id or module_id is required' }, { status: 400 });
		}

		let query = supabaseAdmin
			.from('module_materials')
			.select(`
				*,
				module_sessions!inner (
					id,
					session_number,
					module_id,
					title,
					description
				)
			`)
			.order('display_order', { ascending: true });

		if (sessionId) {
			query = query.eq('session_id', sessionId);
		} else if (moduleId) {
			query = query.eq('module_sessions.module_id', moduleId);

			if (sessionNumber) {
				query = query.eq('module_sessions.session_number', parseInt(sessionNumber));
			}
		}

		const { data: materials, error } = await query;

		// Sort by session number in code (can't order by joined columns in Supabase)
		materials?.sort((a, b) => {
			const sessionDiff = a.module_sessions.session_number - b.module_sessions.session_number;
			if (sessionDiff !== 0) return sessionDiff;
			return a.display_order - b.display_order;
		});

		if (error) {
			console.error('Error fetching module materials:', error);
			return json({ error: 'Failed to fetch module materials' }, { status: 500 });
		}

		return json({ materials: materials || [] });

	} catch (error) {
		console.error('Error in module materials GET endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals: { safeGetSession, supabase } }) => {
	try {
		// Authentication check - only admins can create materials
		const { session, user } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		// Check if user has admin role
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if (!profile || !['accf_admin', 'admin'].includes(profile.role)) {
			throw error(403, 'Forbidden - Admin access required');
		}

		const body = await request.json();
		const { session_id, type, title, content, display_order } = body;

		// Validate required fields (now using session_id instead of module_id + session_number)
		if (!session_id || !type || !title || !content) {
			return json({
				error: 'Missing required fields: session_id, type, title, content'
			}, { status: 400 });
		}

		// Validate type
		const validTypes = ['video', 'document', 'link', 'native', 'image'];
		if (!validTypes.includes(type)) {
			return json({
				error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
			}, { status: 400 });
		}

		const { data: material, error } = await supabaseAdmin
			.from('module_materials')
			.insert({
				session_id,
				type,
				title,
				content,
				display_order: display_order || 0
			})
			.select()
			.single();

		if (error) {
			console.error('Error creating module material:', error);
			return json({ error: 'Failed to create module material' }, { status: 500 });
		}

		return json({ material }, { status: 201 });

	} catch (error) {
		console.error('Error in module materials POST endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, locals: { safeGetSession, supabase } }) => {
	try {
		// Authentication check - only admins can update materials
		const { session, user } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		// Check if user has admin role
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if (!profile || !['accf_admin', 'admin'].includes(profile.role)) {
			throw error(403, 'Forbidden - Admin access required');
		}

		const body = await request.json();
		const { id, type, title, content, display_order } = body;

		if (!id) {
			return json({ error: 'Material id is required' }, { status: 400 });
		}

		const updates: any = { updated_at: new Date().toISOString() };

		// Only update provided fields
		if (type !== undefined) {
			const validTypes = ['video', 'document', 'link', 'native', 'image'];
			if (!validTypes.includes(type)) {
				return json({
					error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
				}, { status: 400 });
			}
			updates.type = type;
		}
		if (title !== undefined) updates.title = title;
		if (content !== undefined) updates.content = content;
		if (display_order !== undefined) updates.display_order = display_order;

		const { data: material, error } = await supabaseAdmin
			.from('module_materials')
			.update(updates)
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('Error updating module material:', error);
			return json({ error: 'Failed to update module material' }, { status: 500 });
		}

		return json({ material });

	} catch (error) {
		console.error('Error in module materials PUT endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, locals: { safeGetSession, supabase } }) => {
	try {
		// Authentication check - only admins can delete materials
		const { session, user } = await safeGetSession();
		if (!session) {
			throw error(401, 'Unauthorized');
		}

		// Check if user has admin role
		const { data: profile } = await supabase
			.from('user_profiles')
			.select('role')
			.eq('id', user.id)
			.single();

		if (!profile || !['accf_admin', 'admin'].includes(profile.role)) {
			throw error(403, 'Forbidden - Admin access required');
		}

		const body = await request.json();
		const { id } = body;

		if (!id) {
			return json({ error: 'Material id is required' }, { status: 400 });
		}

		const { error } = await supabaseAdmin
			.from('module_materials')
			.delete()
			.eq('id', id);

		if (error) {
			console.error('Error deleting module material:', error);
			return json({ error: 'Failed to delete module material' }, { status: 500 });
		}

		return json({ success: true });

	} catch (error) {
		console.error('Error in module materials DELETE endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

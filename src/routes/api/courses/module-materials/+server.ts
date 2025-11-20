import { json } from '@sveltejs/kit';
import { CourseQueries, CourseMutations } from '$lib/server/course-data.js';
import type { RequestHandler } from './$types';
import { requireAnyModule } from '$lib/server/auth';

export const GET: RequestHandler = async ({ url, locals: { safeGetSession } }) => {
	try {
		// Authentication check - students can read materials
		const { session } = await safeGetSession();
		if (!session) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const sessionId = url.searchParams.get('session_id');
		const moduleId = url.searchParams.get('module_id');
		const sessionNumber = url.searchParams.get('session_number');

		// Handle session_id case
		if (sessionId) {
			const { data, error } = await CourseQueries.getMaterials([sessionId]);

			if (error) {
				console.error('Error fetching materials:', error);
				return json({ error: 'Failed to fetch module materials' }, { status: 500 });
			}

			return json({ materials: data || [] });
		}

		// Handle module_id case
		if (moduleId) {
			// Get all sessions for module first
			const { data: sessions, error: sessionsError } = await CourseQueries.getSessions(moduleId);

			if (sessionsError) {
				console.error('Error fetching sessions:', sessionsError);
				return json({ error: 'Failed to fetch sessions' }, { status: 500 });
			}

			let sessionIds = sessions?.map(s => s.id) || [];

			// Filter by session_number if provided
			if (sessionNumber && sessions) {
				const targetSession = sessions.find(s => s.session_number === parseInt(sessionNumber));
				sessionIds = targetSession ? [targetSession.id] : [];
			}

			const { data, error } = await CourseQueries.getMaterials(sessionIds);

			if (error) {
				console.error('Error fetching materials:', error);
				return json({ error: 'Failed to fetch module materials' }, { status: 500 });
			}

			// Sort by session number then display order
			const materials = (data || []).sort((a, b) => {
				const sessionDiff = (a.session?.session_number || 0) - (b.session?.session_number || 0);
				if (sessionDiff !== 0) return sessionDiff;
				return a.display_order - b.display_order;
			});

			return json({ materials });
		}

		return json({ error: 'session_id or module_id required' }, { status: 400 });

	} catch (error) {
		console.error('Error in module materials GET endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		await requireAnyModule(event, ['courses.admin', 'platform.admin']);

		const body = await event.request.json();
		const { session_id, type, title, content, display_order } = body;

		// Validate required fields
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

		const { data, error } = await CourseMutations.createMaterial({
			sessionId: session_id,
			type,
			title,
			content,
			displayOrder: display_order
		});

		if (error) {
			console.error('Error creating module material:', error);
			return json({ error: 'Failed to create module material' }, { status: 500 });
		}

		return json({ material: data }, { status: 201 });

	} catch (error) {
		console.error('Error in module materials POST endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async (event) => {
	try {
		await requireAnyModule(event, ['courses.admin', 'platform.admin']);

		const body = await event.request.json();
		const { id, type, title, content, display_order } = body;

		if (!id) {
			return json({ error: 'Material id is required' }, { status: 400 });
		}

		// Validate type if provided
		if (type !== undefined) {
			const validTypes = ['video', 'document', 'link', 'native', 'image'];
			if (!validTypes.includes(type)) {
				return json({
					error: `Invalid type. Must be one of: ${validTypes.join(', ')}`
				}, { status: 400 });
			}
		}

		const { data, error } = await CourseMutations.updateMaterial(id, {
			type,
			title,
			content,
			displayOrder: display_order
		});

		if (error) {
			console.error('Error updating module material:', error);
			return json({ error: 'Failed to update module material' }, { status: 500 });
		}

		if (!data) {
			return json({ error: 'Material not found' }, { status: 404 });
		}

		return json({ material: data });

	} catch (error) {
		console.error('Error in module materials PUT endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	try {
		await requireAnyModule(event, ['courses.admin', 'platform.admin']);

		const body = await event.request.json();
		const { id } = body;

		if (!id) {
			return json({ error: 'Material id is required' }, { status: 400 });
		}

		const { error } = await CourseMutations.deleteMaterial(id);

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

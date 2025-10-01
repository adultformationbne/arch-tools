import { json, error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals: { safeGetSession } }) => {
	try {
		// Authentication check - students can read questions
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
			.from('module_reflection_questions')
			.select(`
				*,
				module_sessions!inner (
					id,
					session_number,
					module_id,
					title,
					description
				)
			`);

		if (sessionId) {
			query = query.eq('session_id', sessionId);
		} else if (moduleId) {
			query = query.eq('module_sessions.module_id', moduleId);

			if (sessionNumber) {
				query = query.eq('module_sessions.session_number', parseInt(sessionNumber));
			}
		}

		const { data: questions, error } = await query;

		// Sort by session number in code (can't order by joined columns in Supabase)
		questions?.sort((a, b) =>
			a.module_sessions.session_number - b.module_sessions.session_number
		);

		if (error) {
			console.error('Error fetching module reflection questions:', error);
			return json({ error: 'Failed to fetch module reflection questions' }, { status: 500 });
		}

		return json({ questions: questions || [] });

	} catch (error) {
		console.error('Error in module reflection questions GET endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals: { safeGetSession, supabase } }) => {
	try {
		// Authentication check - only admins can create questions
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
		const { session_id, question_text } = body;

		// Validate required fields (now using session_id instead of module_id + session_number)
		if (!session_id || !question_text) {
			return json({
				error: 'Missing required fields: session_id, question_text'
			}, { status: 400 });
		}

		const { data: question, error } = await supabaseAdmin
			.from('module_reflection_questions')
			.insert({
				session_id,
				question_text
			})
			.select()
			.single();

		if (error) {
			console.error('Error creating module reflection question:', error);
			return json({ error: 'Failed to create module reflection question' }, { status: 500 });
		}

		return json({ question }, { status: 201 });

	} catch (error) {
		console.error('Error in module reflection questions POST endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request, locals: { safeGetSession, supabase } }) => {
	try {
		// Authentication check - only admins can update questions
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
		const { id, question_text } = body;

		if (!id || !question_text) {
			return json({ error: 'Both id and question_text are required' }, { status: 400 });
		}

		const { data: question, error } = await supabaseAdmin
			.from('module_reflection_questions')
			.update({
				question_text,
				updated_at: new Date().toISOString()
			})
			.eq('id', id)
			.select()
			.single();

		if (error) {
			console.error('Error updating module reflection question:', error);
			return json({ error: 'Failed to update module reflection question' }, { status: 500 });
		}

		return json({ question });

	} catch (error) {
		console.error('Error in module reflection questions PUT endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ request, locals: { safeGetSession, supabase } }) => {
	try {
		// Authentication check - only admins can delete questions
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
			return json({ error: 'Question id is required' }, { status: 400 });
		}

		const { error } = await supabaseAdmin
			.from('module_reflection_questions')
			.delete()
			.eq('id', id);

		if (error) {
			console.error('Error deleting module reflection question:', error);
			return json({ error: 'Failed to delete module reflection question' }, { status: 500 });
		}

		return json({ success: true });

	} catch (error) {
		console.error('Error in module reflection questions DELETE endpoint:', error);
		return json({ error: 'Internal server error' }, { status: 500 });
	}
};

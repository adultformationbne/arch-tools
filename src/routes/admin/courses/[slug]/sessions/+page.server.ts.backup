import { error, redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Mark this load function as dependent on 'app:sessions-data'
	// so we can invalidate it when reflection questions are updated
	event.depends('app:sessions-data');

	// Get layout data (modules already loaded, auth already checked)
	const layoutData = await event.parent();
	const modules = layoutData?.modules || [];
	const courseInfo = layoutData?.courseInfo || {};
	const moduleIds = modules?.map(m => m.id) || [];

	// Auto-select first module if none selected
	const moduleParam = event.url.searchParams.get('module');
	if (!moduleParam && modules.length > 0) {
		throw redirect(303, `/admin/courses/${courseSlug}/sessions?module=${modules[0].id}`);
	}

	try {
		// Only fetch page-specific data (sessions, materials, reflection questions)
		let sessions = [];
		let materials = [];
		let reflectionQuestions = [];

		if (moduleIds.length > 0) {
			// Fetch sessions
			const { data: sessionsData, error: sessionsError } = await supabaseAdmin
				.from('courses_sessions')
				.select('*')
				.in('module_id', moduleIds)
				.order('session_number', { ascending: true});

			if (sessionsError) {
				console.error('Error fetching sessions:', sessionsError);
			} else {
				sessions = sessionsData || [];
			}

			// Fetch materials and questions in parallel using session IDs
			const sessionIds = sessions.map(s => s.id);

			if (sessionIds.length > 0) {
				const [materialsResult, questionsResult] = await Promise.all([
					supabaseAdmin
						.from('courses_materials')
						.select('*')
						.in('session_id', sessionIds)
						.order('display_order', { ascending: true }),
					supabaseAdmin
						.from('courses_reflection_questions')
						.select('*')
						.in('session_id', sessionIds)
				]);

				materials = materialsResult.data || [];
				reflectionQuestions = questionsResult.data || [];
			}
		}

		return {
			course: courseInfo,
			modules,
			sessions,
			materials,
			reflectionQuestions
		};

	} catch (err) {
		console.error('Error in sessions page load:', err);
		throw error(500, 'Failed to load sessions data');
	}
};

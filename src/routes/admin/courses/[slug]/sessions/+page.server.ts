import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const startTime = Date.now();
	const courseSlug = event.params.slug;
	console.log(`[SESSIONS PAGE] Loading...`);

	// Auth is already done in layout - no need to check again!
	// await requireCourseAdmin(event, courseSlug); // REMOVED - redundant

	// Get layout data (modules already loaded, auth already checked)
	const parentStart = Date.now();
	const layoutData = await event.parent();
	console.log(`[SESSIONS PAGE] ⚡ Parent data (cached): ${Date.now() - parentStart}ms`);

	const modules = layoutData?.modules || [];
	const courseInfo = layoutData?.courseInfo || {};
	const moduleIds = modules?.map(m => m.id) || [];

	try {
		// Only fetch page-specific data (sessions, materials, reflection questions)
		let sessions = [];
		let materials = [];
		let reflectionQuestions = [];

		if (moduleIds.length > 0) {
			// First, fetch sessions
			const sessionsStart = Date.now();
			const { data: sessionsData, error: sessionsError } = await supabaseAdmin
				.from('courses_sessions')
				.select('*')
				.in('module_id', moduleIds)
				.order('session_number', { ascending: true});
			console.log(`[SESSIONS PAGE] Sessions query: ${Date.now() - sessionsStart}ms`);

			if (sessionsError) {
				console.error('Error fetching sessions:', sessionsError);
			} else {
				sessions = sessionsData || [];
			}

			// Then fetch materials and questions in parallel using session IDs
			const sessionIds = sessions.map(s => s.id);

			if (sessionIds.length > 0) {
				const parallelStart = Date.now();
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
				console.log(`[SESSIONS PAGE] Materials + Questions (parallel): ${Date.now() - parallelStart}ms`);

				materials = materialsResult.data || [];
				reflectionQuestions = questionsResult.data || [];
			}
		}

		console.log(`[SESSIONS PAGE] ✅ Complete in ${Date.now() - startTime}ms (${sessions.length} sessions, ${materials.length} materials)\n`);

		return {
			course: courseInfo, // Pass course info from layout
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

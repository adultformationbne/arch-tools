import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require course admin authentication
	await requireCourseAdmin(event, courseSlug);

	try {
		// Get the course ID from slug
		const { data: course } = await supabaseAdmin
			.from('courses')
			.select('id, name')
			.eq('slug', courseSlug)
			.single();

		if (!course) {
			throw error(404, 'Course not found');
		}

		// Get modules for this course
		const { data: modules, error: modulesError } = await supabaseAdmin
			.from('courses_modules')
			.select('*')
			.eq('course_id', course.id)
			.order('order_number', { ascending: true });

		if (modulesError) {
			console.error('Error fetching modules:', modulesError);
			throw error(500, 'Failed to load modules');
		}

		// Get sessions for each module
		const moduleIds = modules?.map(m => m.id) || [];
		let sessions = [];

		if (moduleIds.length > 0) {
			const { data: sessionsData, error: sessionsError } = await supabaseAdmin
				.from('courses_sessions')
				.select('*')
				.in('module_id', moduleIds)
				.order('session_number', { ascending: true });

			if (sessionsError) {
				console.error('Error fetching sessions:', sessionsError);
			} else {
				sessions = sessionsData || [];
			}
		}

		// Get materials for each session
		const sessionIds = sessions.map(s => s.id);
		let materials = [];

		if (sessionIds.length > 0) {
			const { data: materialsData, error: materialsError } = await supabaseAdmin
				.from('courses_materials')
				.select('*')
				.in('session_id', sessionIds)
				.order('display_order', { ascending: true });

			if (materialsError) {
				console.error('Error fetching materials:', materialsError);
			} else {
				materials = materialsData || [];
			}
		}

		// Get reflection questions for each session
		let reflectionQuestions = [];

		if (sessionIds.length > 0) {
			const { data: questionsData, error: questionsError } = await supabaseAdmin
				.from('courses_reflection_questions')
				.select('*')
				.in('session_id', sessionIds);

			if (questionsError) {
				console.error('Error fetching reflection questions:', questionsError);
			} else {
				reflectionQuestions = questionsData || [];
			}
		}

		return {
			course,
			modules: modules || [],
			sessions: sessions || [],
			materials: materials || [],
			reflectionQuestions: reflectionQuestions || []
		};

	} catch (err) {
		console.error('Error in modules page load:', err);
		throw error(500, 'Failed to load modules data');
	}
};

/**
 * Admin Sessions Editor - Server Load Function
 *
 * Loads session data (sessions, materials, reflection questions) for module management.
 * Uses CourseAggregates.getSessionData() for optimized parallel queries.
 *
 * Depends on parent layout for auth check and module list.
 */

import { error, redirect } from '@sveltejs/kit';
import { CourseAggregates } from '$lib/server/course-data.js';
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

	// Auto-select first module if none selected
	const moduleParam = event.url.searchParams.get('module');
	if (!moduleParam && modules.length > 0) {
		throw redirect(303, `/admin/courses/${courseSlug}/sessions?module=${modules[0].id}`);
	}

	// Return empty state if no modules exist
	if (!moduleParam || modules.length === 0) {
		return {
			course: courseInfo,
			modules,
			sessions: [],
			materials: [],
			reflectionQuestions: []
		};
	}

	try {
		// Load session data using repository aggregate
		const result = await CourseAggregates.getSessionData(moduleParam);

		if (result.error) {
			console.error('Error fetching session data:', result.error);
			throw error(500, 'Failed to load sessions data');
		}

		return {
			course: courseInfo,
			modules,
			sessions: result.data?.sessions || [],
			materials: result.data?.materials || [],
			reflectionQuestions: result.data?.questions || []
		};
	} catch (err) {
		console.error('Error in sessions page load:', err);
		throw error(500, 'Failed to load sessions data');
	}
};

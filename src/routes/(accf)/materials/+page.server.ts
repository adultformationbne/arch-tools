import { supabaseAdmin } from '$lib/server/supabase.js';
import { getDevUserFromRequest, defaultDevUser } from '$lib/server/dev-user.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	// Get current user from dev mode cookies - in production this would come from auth
	const devUser = getDevUserFromRequest(request) || defaultDevUser;
	const currentUserId = devUser.id;

	// Get user's enrollment to determine cohort and current session
	const { data: enrollment, error: enrollmentError } = await supabaseAdmin
		.from('accf_users')
		.select('cohort_id, current_session')
		.eq('user_profile_id', currentUserId)
		.single();

	if (enrollmentError || !enrollment) {
		console.error('Error fetching enrollment:', enrollmentError);
		return {
			materials: [],
			materialsBySession: {},
			currentSession: 1,
			error: 'User enrollment not found'
		};
	}

	const cohortId = enrollment.cohort_id;
	const currentSession = enrollment.current_session;

	// Get cohort's module_id
	const { data: cohort, error: cohortError } = await supabaseAdmin
		.from('cohorts')
		.select('module_id')
		.eq('id', cohortId)
		.single();

	if (cohortError || !cohort?.module_id) {
		console.error('Error fetching cohort or no module_id:', cohortError);
		return {
			materials: [],
			materialsBySession: {},
			currentSession,
			error: 'Failed to load cohort data'
		};
	}

	const moduleId = cohort.module_id;

	// Fetch all materials for the module's sessions
	const { data: materials, error } = await supabaseAdmin
		.from('module_materials')
		.select(`
			*,
			module_sessions!inner (
				session_number,
				module_id,
				title
			)
		`)
		.eq('module_sessions.module_id', moduleId)
		.order('display_order', { ascending: true });

	// Sort by session number in code since we can't order by joined columns
	materials?.sort((a, b) => {
		const sessionDiff = a.module_sessions.session_number - b.module_sessions.session_number;
		if (sessionDiff !== 0) return sessionDiff;
		return a.display_order - b.display_order;
	});

	if (error) {
		console.error('Error fetching materials:', error);
		return {
			materials: [],
			materialsBySession: {},
			currentSession,
			error: 'Failed to load materials'
		};
	}

	// Group materials by session
	const materialsBySession: Record<number, any[]> = {};
	materials?.forEach(material => {
		const sessionNumber = material.module_sessions.session_number;
		if (!materialsBySession[sessionNumber]) {
			materialsBySession[sessionNumber] = [];
		}
		materialsBySession[sessionNumber].push({
			...material,
			session_number: sessionNumber // Add for compatibility
		});
	});

	return {
		materials: materials || [],
		materialsBySession,
		currentSession
	};
};
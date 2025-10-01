import { supabaseAdmin } from '$lib/server/supabase.js';
import { getDevUserFromRequest, defaultDevUser } from '$lib/server/dev-user.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ request }) => {
	// Get current user from dev mode cookies - in production this would come from auth
	const devUser = getDevUserFromRequest(request) || defaultDevUser;

	// Verify admin access
	if (devUser.role !== 'accf_admin') {
		throw new Error('Unauthorized: Admin access required');
	}

	try {
		// Fetch all modules
		const { data: modules, error: modulesError } = await supabaseAdmin
			.from('modules')
			.select('*')
			.order('order_number', { ascending: true });

		if (modulesError) {
			console.error('Error fetching modules:', modulesError);
			throw modulesError;
		}

		// Fetch all cohorts with related data
		const { data: cohorts, error: cohortsError } = await supabaseAdmin
			.from('cohorts')
			.select(`
				*,
				modules (
					id,
					name,
					description
				)
			`)
			.order('created_at', { ascending: false });

		if (cohortsError) {
			console.error('Error fetching cohorts:', cohortsError);
			throw cohortsError;
		}

		// Get student counts for each cohort from accf_users
		const cohortIds = cohorts?.map(c => c.id) || [];

		// Count all users in each cohort
		const { data: userCounts, error: userCountError } = await supabaseAdmin
			.from('accf_users')
			.select('cohort_id')
			.in('cohort_id', cohortIds);

		if (userCountError) {
			console.error('Error fetching user counts:', userCountError);
		}

		// Process cohort data
		const processedCohorts = cohorts?.map(cohort => {
			const studentCount = userCounts?.filter(u => u.cohort_id === cohort.id).length || 0;

			// Determine status with automatic transitions
			const startDate = new Date(cohort.start_date);
			const endDate = new Date(cohort.end_date);
			const now = new Date();
			let status = cohort.status;

			// Auto-transition: scheduled → active when start date passes
			if (status === 'scheduled' && now >= startDate) {
				status = 'active';
			}

			// Auto-transition: active → completed when end date passes
			if (status === 'active' && now > endDate) {
				status = 'completed';
			}

			return {
				id: cohort.id,
				name: cohort.name,
				module: cohort.modules?.name || 'Unknown Module',
				moduleId: cohort.module_id,
				startDate: cohort.start_date,
				endDate: cohort.end_date,
				status: status,
				currentSession: cohort.current_session || 1, // Use manually set value
				totalSessions: 8, // All ACCF modules are 8 sessions
				students: studentCount,
				description: cohort.description || '',
				createdAt: cohort.created_at
			};
		}) || [];

		return {
			modules: modules || [],
			cohorts: processedCohorts,
			currentUserId: devUser.id
		};

	} catch (error) {
		console.error('Error in admin cohorts load function:', error);
		return {
			modules: [],
			cohorts: [],
			currentUserId: devUser.id,
			error: 'Failed to load cohorts data'
		};
	}
};
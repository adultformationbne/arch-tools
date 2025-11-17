import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// ✅ OPTIMIZATION: Auth already done in layout - no need to check again!
	const courseSlug = event.params.slug;
	const { user } = await event.locals.safeGetSession();

	// Get layout data (modules and cohorts already loaded)
	const layoutData = await event.parent();
	const modules = layoutData?.modules || [];
	const cohorts = layoutData?.cohorts || [];

	try {
		// Get student counts for each cohort from courses_enrollments
		const cohortIds = cohorts.map(c => c.id);

		// ✅ OPTIMIZATION: Fetch both counts AND full enrollments for initial selected cohort
		const cohortParam = event.url.searchParams.get('cohort');
		const initialCohortId = cohortParam || cohorts[0]?.id;

		const [userCountsResult, enrollmentsResult] = await Promise.all([
			supabaseAdmin
				.from('courses_enrollments')
				.select('cohort_id')
				.in('cohort_id', cohortIds),
			// Preload students for initial cohort to avoid client-side API call
			initialCohortId
				? supabaseAdmin
						.from('courses_enrollments')
						.select('*, courses_cohorts(name), courses_hubs(name)')
						.eq('cohort_id', initialCohortId)
						.order('created_at', { ascending: false })
				: Promise.resolve({ data: null })
		]);

		const { data: userCounts } = userCountsResult;
		const initialStudents = enrollmentsResult.data || [];

		// Enrich cohort data with student counts
		const enrichedCohorts = cohorts.map(cohort => {
			const studentCount = userCounts?.filter(u => u.cohort_id === cohort.id).length || 0;

			// Determine status based on session progression
			let status = cohort.status;
			const currentSession = cohort.current_session || 0;

			if (currentSession === 0 && status !== 'completed') {
				status = 'upcoming';
			} else if (currentSession >= 1 && status !== 'completed') {
				status = 'active';
			}

			return {
				...cohort,
				status: status,
				students: studentCount
			};
		});

		// Determine initial selected cohort from URL or default to first
		const initialSelectedCohort = cohortParam || (enrichedCohorts.length > 0 ? enrichedCohorts[0].id : null);

		return {
			modules,
			cohorts: enrichedCohorts,
			currentUserId: user.id,
			courseSlug,
			initialSelectedCohort,
			initialStudents // ✅ Preload students to avoid API call
		};

	} catch (error) {
		console.error('Error in admin cohorts load function:', error);
		return {
			modules: [],
			cohorts: [],
			currentUserId: user.id,
			courseSlug,
			error: 'Failed to load cohorts data'
		};
	}
};
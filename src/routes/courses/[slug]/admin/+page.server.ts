import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require course admin role (or platform admin)
	const { user } = await requireCourseAdmin(event, courseSlug);

	try {
		// Get the course ID from slug
		const { data: course } = await supabaseAdmin
			.from('courses')
			.select('id')
			.eq('slug', courseSlug)
			.single();

		if (!course) {
			return {
				modules: [],
				cohorts: [],
				currentUserId: user.id,
				courseSlug
			};
		}

		// Fetch modules for this course only
		const { data: modules, error: modulesError } = await supabaseAdmin
			.from('courses_modules')
			.select('*')
			.eq('course_id', course.id)
			.order('order_number', { ascending: true });

		if (modulesError) {
			console.error('Error fetching modules:', modulesError);
			throw modulesError;
		}

		const moduleIds = modules?.map(m => m.id) || [];

		// Fetch cohorts for this course's modules only
		const { data: cohorts, error: cohortsError } = await supabaseAdmin
			.from('courses_cohorts')
			.select(`
				*,
				courses_modules (
					id,
					name,
					description
				)
			`)
			.in('module_id', moduleIds)
			.order('created_at', { ascending: false});

		if (cohortsError) {
			console.error('Error fetching cohorts:', cohortsError);
			throw cohortsError;
		}

		// Get student counts for each cohort from courses_enrollments
		const cohortIds = cohorts?.map(c => c.id) || [];

		// Count all users in each cohort
		const { data: userCounts, error: userCountError } = await supabaseAdmin
			.from('courses_enrollments')
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
				module: cohort.courses_modules?.name || 'Unknown Module',
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
			currentUserId: user.id,
			courseSlug
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
import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAdmin } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	// Restrict to admins only
	const { user } = await requireAdmin(event);

	try {
		// Fetch all reflection responses with related data
		const { data: reflections, error: reflectionsError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.select(`
				*,
				enrollment:enrollment_id (
					id,
					user_profile:user_profile_id (
						full_name,
						email
					),
					hub:hub_id (
						name
					)
				),
				cohort:cohort_id (
					id,
					name,
					module:module_id (
						name
					)
				),
				question:courses_reflection_questions!question_id (
					question_text,
					courses_sessions!inner (
						session_number
					)
				),
				marked_by_user:marked_by (
					full_name
				)
			`)
			.order('created_at', { ascending: false });

		if (reflectionsError) {
			console.error('Error fetching reflections:', reflectionsError);
			throw error(500, 'Failed to load reflections');
		}

		// Get all cohorts for filter dropdown
		const { data: cohorts, error: cohortsError } = await supabaseAdmin
			.from('courses_cohorts')
			.select(`
				id,
				name,
				module:module_id (
					name
				)
			`)
			.order('start_date', { ascending: false });

		if (cohortsError) {
			console.error('Error fetching cohorts:', cohortsError);
		}

		// Process reflections for display
		const processedReflections = reflections?.map(r => {
			// Calculate display status for UI filtering
			const dbStatus = r.status || 'submitted';
			let displayStatus = 'pending';

				if (dbStatus === 'passed') {
					displayStatus = 'marked';
				} else if (dbStatus === 'submitted' || dbStatus === 'needs_revision' || dbStatus === 'resubmitted') {
					// Check if overdue (submitted more than 7 days ago without marking)
					const submittedDate = new Date(r.created_at);
					const daysSinceSubmission = (Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24);
					displayStatus = daysSinceSubmission > 7 ? 'overdue' : 'pending';
				}

				// Map status to grade for UI compatibility
				const grade = dbStatus === 'passed' ? 'pass' : (dbStatus === 'needs_revision' ? 'fail' : null);

			return {
				id: r.id,
				student: {
					id: r.enrollment?.id,
					name: r.enrollment?.user_profile?.full_name || 'Unknown',
					email: r.enrollment?.user_profile?.email || '',
					hub: r.enrollment?.hub?.name || 'No Hub'
				},
				cohort: {
					id: r.cohort?.id,
					name: r.cohort?.name || 'Unknown Cohort',
					moduleName: r.cohort?.module?.name || 'Unknown Module'
				},
				session: r.question?.courses_sessions?.session_number || r.session_number || 0,
				question: r.question?.question_text || '',
				content: r.response_text || '',
				isPublic: r.is_public || false,
				submittedAt: r.created_at,
				status: displayStatus,
				dbStatus: dbStatus, // Keep original status for reference
				grade: grade,
				feedback: r.feedback || '',
				markedAt: r.marked_at,
				markedBy: r.marked_by_user?.full_name || null,
				assignedTo: r.assigned_admin_id // TODO: Implement admin assignment system
			};
		}) || [];

		// Get cohort options for filter
		const cohortOptions = cohorts?.map(c => ({
			id: c.id,
			name: c.name,
			moduleName: c.module?.name || ''
		})) || [];

		return {
			reflections: processedReflections,
			cohorts: cohortOptions,
			currentUserId: user.id
		};

	} catch (err) {
		console.error('Error in admin reflections load:', err);
		throw error(500, 'Failed to load reflections data');
	}
};

import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Auth is already done in layout - no need to check again!
	const { user } = await event.locals.safeGetSession();

	// Get current user's display name for the marking modal
	const { data: currentUserProfile } = await supabaseAdmin
		.from('user_profiles')
		.select('full_name')
		.eq('id', user.id)
		.single();

	try {
		// Get layout data (modules, cohorts, hubs already loaded and cached)
		const layoutData = await event.parent();

		const courseInfo = layoutData?.courseInfo || {};
		const courseId = courseInfo.id;
		const cohorts = layoutData?.cohorts || [];

		if (!courseId) {
			throw error(404, 'Course not found');
		}

		const cohortIds = cohorts.map(c => c.id);

		if (cohortIds.length === 0) {
			return {
				reflections: [],
				cohorts: [],
				currentUserId: user.id,
				courseSlug
			};
		}

		// Query reflections directly using cohort IDs from layout (avoids re-fetching cohorts)
		const { data: allReflections, error: reflectionsError } = await supabaseAdmin
			.from('courses_reflection_responses')
			.select(
				`
				*,
				question:question_id (
					id,
					question_text,
					session:session_id (
						id,
						session_number,
						title
					)
				),
				enrollment:enrollment_id (
					id,
					user_profile:user_profile_id (
						id,
						full_name,
						email
					)
				),
				marked_by_profile:marked_by (
					full_name
				),
				reviewing_by_profile:reviewing_by (
					full_name
				)
			`
			)
			.in('cohort_id', cohortIds)
			.order('created_at', { ascending: false });

		if (reflectionsError) {
			console.error('Error fetching reflections:', reflectionsError);
			throw error(500, 'Failed to load reflections');
		}

		// Process reflections for display
		const processedReflections = (allReflections || []).map(r => {
			// Calculate display status for UI filtering
			const dbStatus = r.status || 'submitted';
			let displayStatus = 'pending';

			if (dbStatus === 'passed') {
				displayStatus = 'marked';
			} else if (dbStatus === 'submitted' || dbStatus === 'needs_revision' || dbStatus === 'resubmitted') {
				displayStatus = 'pending';
			}

			// Map status to grade for UI compatibility
			const grade = dbStatus === 'passed' ? 'pass' : (dbStatus === 'needs_revision' ? 'fail' : null);

			// Check if currently being reviewed by someone else
			const reviewingBy = r.reviewing_by;
			const reviewingStartedAt = r.reviewing_started_at;
			const isBeingReviewed = reviewingBy && reviewingBy !== user?.id;

			// Calculate if review claim is still fresh (within 5 minutes)
			let reviewClaimFresh = false;
			if (isBeingReviewed && reviewingStartedAt) {
				const claimAgeMinutes = (Date.now() - new Date(reviewingStartedAt).getTime()) / 1000 / 60;
				reviewClaimFresh = claimAgeMinutes < 5;
			}

			return {
				id: r.id,
				student: {
					id: r.enrollment?.id,
					name: r.enrollment?.user_profile?.full_name || 'Unknown',
					email: r.enrollment?.user_profile?.email || '',
					hub: 'No Hub' // Hub info not included in aggregate
				},
				cohort: {
					id: r.cohort_id,
					name: cohorts.find(c => c.id === r.cohort_id)?.name || 'Unknown Cohort',
					moduleName: cohorts.find(c => c.id === r.cohort_id)?.module?.name || 'Unknown Module'
				},
				session: r.question?.session?.session_number || 0,
				question: r.question?.question_text || '',
				content: r.response_text || '',
				isPublic: r.is_public || false,
				submittedAt: r.created_at,
				status: displayStatus,
				dbStatus: dbStatus,
				grade: grade,
				feedback: r.feedback || '',
				markedAt: r.marked_at,
				markedBy: r.marked_by_profile?.full_name || null,
				assignedTo: r.assigned_admin_id,
				// Review locking info
				reviewingBy: reviewingBy,
				reviewingByName: r.reviewing_by_profile?.full_name || null,
				reviewingStartedAt: reviewingStartedAt,
				isBeingReviewed: isBeingReviewed && reviewClaimFresh
			};
		});

		// Get cohort options for filter (use layout data)
		const cohortOptions = cohorts.map(c => ({
			id: c.id,
			name: c.name,
			moduleName: c.module?.name || ''
		}));

		return {
			reflections: processedReflections,
			cohorts: cohortOptions,
			currentUserId: user.id,
			currentUserName: currentUserProfile?.full_name || 'Unknown',
			courseSlug
		};

	} catch (err) {
		console.error('Error in admin reflections load:', err);
		throw error(500, 'Failed to load reflections data');
	}
};

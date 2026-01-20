import { error } from '@sveltejs/kit';
import { CourseQueries, CourseAggregates } from '$lib/server/course-data.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const startTime = Date.now();
	const courseSlug = event.params.slug;

	// Auth is already done in layout - no need to check again!
	// Get user from locals instead of re-authenticating
	const { user } = await event.locals.safeGetSession();

	try {
		// Get layout data (modules and cohorts already loaded, auth already checked)
		const parentStart = Date.now();
		const layoutData = await event.parent();

		const courseInfo = layoutData?.courseInfo || {};
		const courseId = courseInfo.id;

		if (!courseId) {
			throw error(404, 'Course not found');
		}

		// Get admin reflections data using repository aggregate
		const reflectionsStart = Date.now();
		const result = await CourseAggregates.getAdminReflections(courseId);

		if (result.error || !result.data) {
			console.error('Error fetching reflections:', result.error);
			throw error(500, 'Failed to load reflections');
		}

		const { cohorts, reflections } = result.data;

		// Process reflections for display
		const processedReflections = reflections.map(r => {
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

		// Get cohort options for filter
		const cohortOptions = cohorts.map(c => ({
			id: c.id,
			name: c.name,
			moduleName: c.module?.name || ''
		}));


		return {
			reflections: processedReflections,
			cohorts: cohortOptions,
			currentUserId: user.id,
			courseSlug
		};

	} catch (err) {
		console.error('Error in admin reflections load:', err);
		throw error(500, 'Failed to load reflections data');
	}
};

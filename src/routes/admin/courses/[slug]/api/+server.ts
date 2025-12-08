import { error, json } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth';
import { CourseMutations, CourseQueries } from '$lib/server/course-data';
import { supabaseAdmin } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

/**
 * POST handler for course admin actions
 * Delegates all operations to the course data repository
 */
export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;

	// Require admin authentication
	const { user, profile } = await requireCourseAdmin(event, courseSlug);
	const actorName = profile.full_name || user.email || 'Admin';

	try {
		const { action, ...data } = await event.request.json();

		switch (action) {
			// ================================================================
			// MODULE MANAGEMENT
			// ================================================================
			case 'create_module': {
				const result = await CourseMutations.createModule({
					courseId: data.courseId,
					name: data.name,
					description: data.description,
					orderNumber: data.orderNumber,
					sessionCount: data.sessionCount
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to create module');
				}

				return json({
					success: true,
					data: result.data,
					message: `Module created successfully with ${data.sessionCount || 8} sessions`
				});
			}

			case 'update_module': {
				const result = await CourseMutations.updateModule({
					moduleId: data.moduleId,
					name: data.name,
					description: data.description,
					orderNumber: data.orderNumber
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to update module');
				}

				return json({
					success: true,
					data: result.data,
					message: 'Module updated successfully'
				});
			}

			case 'delete_module': {
				const result = await CourseMutations.deleteModule(data.moduleId);

				if (result.error) {
					throw error(400, result.error.message || 'Failed to delete module');
				}

				return json({
					success: true,
					message: 'Module deleted successfully'
				});
			}

			// ================================================================
			// HUB MANAGEMENT
			// ================================================================
			case 'create_hub': {
				const result = await CourseMutations.createHub({
					courseId: data.courseId,
					name: data.name,
					location: data.location
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to create hub');
				}

				return json({
					success: true,
					data: result.data,
					message: 'Hub created successfully'
				});
			}

			case 'update_hub': {
				const result = await CourseMutations.updateHub({
					hubId: data.hubId,
					name: data.name,
					location: data.location
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to update hub');
				}

				return json({
					success: true,
					data: result.data,
					message: 'Hub updated successfully'
				});
			}

			case 'delete_hub': {
				const result = await CourseMutations.deleteHub(data.hubId);

				if (result.error) {
					throw error(500, result.error.message || 'Failed to delete hub');
				}

				return json({
					success: true,
					message: 'Hub deleted successfully'
				});
			}

			case 'assign_hub_coordinator': {
				// Assign a user as coordinator to a hub
				// This sets their role to 'coordinator' and hub_id to the specified hub
				const result = await CourseMutations.updateEnrollment({
					userId: data.enrollmentId,
					updates: {
						role: 'coordinator',
						hub_id: data.hubId
					}
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to assign coordinator');
				}

				return json({
					success: true,
					data: result.data,
					message: 'Coordinator assigned successfully'
				});
			}

			case 'remove_hub_coordinator': {
				// Remove coordinator from hub (set role back to student, clear hub_id)
				const result = await CourseMutations.updateEnrollment({
					userId: data.enrollmentId,
					updates: {
						role: 'student',
						hub_id: null
					}
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to remove coordinator');
				}

				return json({
					success: true,
					data: result.data,
					message: 'Coordinator removed successfully'
				});
			}

			// ================================================================
			// COHORT MANAGEMENT
			// ================================================================
			case 'create_cohort': {
				const result = await CourseMutations.createCohort({
					name: data.name,
					moduleId: data.moduleId,
					startDate: data.startDate,
					endDate: data.endDate
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to create cohort');
				}

				return json({
					success: true,
					data: result.data,
					message: 'Cohort created successfully'
				});
			}

			case 'update_cohort': {
				const result = await CourseMutations.updateCohort({
					cohortId: data.cohortId,
					name: data.name,
					moduleId: data.moduleId,
					startDate: data.startDate,
					endDate: data.endDate,
					currentSession: data.currentSession,
					actorName
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to update cohort');
				}

				return json({
					success: true,
					data: result.data,
					message: 'Cohort updated successfully'
				});
			}

			case 'delete_cohort': {
				const result = await CourseMutations.deleteCohort(data.cohortId);

				if (result.error) {
					throw error(400, result.error.message || 'Failed to delete cohort');
				}

				return json({
					success: true,
					message: 'Cohort deleted successfully'
				});
			}

			case 'duplicate_cohort': {
				const result = await CourseMutations.duplicateCohort(data.cohortId);

				if (result.error) {
					throw error(500, result.error.message || 'Failed to duplicate cohort');
				}

				return json({
					success: true,
					data: result.data,
					message: 'Cohort duplicated successfully'
				});
			}

			case 'update_cohort_status': {
				const result = await CourseMutations.updateCohortStatus(data.cohortId, data.status);

				if (result.error) {
					throw error(500, result.error.message || 'Failed to update cohort status');
				}

				return json({
					success: true,
					data: result.data,
					message: 'Cohort status updated successfully'
				});
			}

			// ================================================================
			// ENROLLMENT MANAGEMENT
			// ================================================================
			case 'upload_csv': {
				const result = await CourseMutations.uploadCSV({
					filename: data.filename,
					rows: data.data,
					cohortId: data.cohortId,
					importedBy: user.id
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to upload CSV');
				}

				return json({
					success: true,
					data: result.data,
					message: `Processed ${result.data?.total} rows: ${result.data?.successful} successful, ${result.data?.errors} errors`
				});
			}

			case 'update_enrollment': {
				const result = await CourseMutations.updateEnrollment({
					userId: data.userId,
					updates: data.updates
				});

				if (result.error) {
					throw error(400, result.error.message || 'Failed to update user');
				}

				return json({
					success: true,
					data: result.data,
					message: 'User updated successfully'
				});
			}

			case 'delete_enrollment': {
				const result = await CourseMutations.deleteEnrollment(data.userId);

				if (result.error) {
					throw error(400, result.error.message || 'Failed to delete user');
				}

				return json({
					success: true,
					message: 'User deleted successfully'
				});
			}

			case 'advance_students': {
				if (!data.studentIds || data.studentIds.length === 0) {
					throw error(400, 'No students selected');
				}

				if (data.targetSession < 0 || data.targetSession > 8) {
					throw error(400, 'Invalid session number');
				}

				const result = await CourseMutations.advanceStudents({
					cohortId: data.cohortId,
					studentIds: data.studentIds,
					targetSession: data.targetSession,
					sendEmail: data.sendEmail,
					actorName
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to advance students');
				}

				return json({
					success: true,
					message: `Advanced ${data.studentIds.length} students to Session ${data.targetSession}`,
					data: {
						studentIds: data.studentIds,
						targetSession: data.targetSession,
						emailSent: data.sendEmail
					}
				});
			}

			case 'update_student_session': {
				if (data.sessionNumber < 0 || data.sessionNumber > 8) {
					throw error(400, 'Invalid session number');
				}

				const result = await CourseMutations.updateEnrollment({
					userId: data.enrollmentId,
					updates: {
						current_session: data.sessionNumber
					}
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to update session');
				}

				return json({
					success: true,
					data: result.data,
					message: 'Session updated successfully'
				});
			}

			case 'bulk_assign_hub': {
				if (!data.enrollmentIds || data.enrollmentIds.length === 0) {
					throw error(400, 'No participants selected');
				}

				// Update all selected enrollments with the hub_id
				const { error: updateError } = await supabaseAdmin
					.from('courses_enrollments')
					.update({ hub_id: data.hubId || null })
					.in('id', data.enrollmentIds);

				if (updateError) {
					throw error(500, updateError.message || 'Failed to assign hub');
				}

				const hubName = data.hubId ? 'hub' : 'no hub';
				return json({
					success: true,
					message: `${data.enrollmentIds.length} participant(s) assigned to ${hubName}`
				});
			}

			default:
				throw error(400, 'Invalid action');
		}
	} catch (err: any) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

/**
 * GET handler for course admin queries
 * Delegates all queries to the course data repository
 */
export const GET: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;

	// Require admin authentication
	await requireCourseAdmin(event, courseSlug);

	const { url } = event;
	const endpoint = url.searchParams.get('endpoint');
	const cohortId = url.searchParams.get('cohort_id');

	try {
		// Handle courses_enrollments endpoint
		if (endpoint === 'courses_enrollments') {
			const result = await CourseQueries.getEnrollments(cohortId || undefined);

			if (result.error) {
				throw error(500, result.error.message || 'Failed to fetch users');
			}

			return json({
				success: true,
				data: result.data
			});
		}

		// Handle attendance endpoint
		if (endpoint === 'attendance' && cohortId) {
			const result = await CourseQueries.getAttendanceRecords(cohortId);

			if (result.error) {
				throw error(500, result.error.message || 'Failed to fetch attendance');
			}

			return json({
				success: true,
				data: result.data || []
			});
		}

		// Handle reflection_responses endpoint
		if (endpoint === 'reflection_responses' && cohortId) {
			const result = await CourseQueries.getReflectionResponsesForCohort(cohortId);

			if (result.error) {
				throw error(500, result.error.message || 'Failed to fetch reflections');
			}

			return json({
				success: true,
				data: result.data || []
			});
		}

		// Handle sessions_with_questions endpoint
		if (endpoint === 'sessions_with_questions') {
			const moduleId = url.searchParams.get('module_id');
			if (!moduleId) {
				throw error(400, 'module_id is required');
			}

			const result = await CourseQueries.getSessionsWithReflectionQuestions(moduleId);

			if (result.error) {
				throw error(500, result.error.message || 'Failed to fetch sessions with questions');
			}

			return json({
				success: true,
				data: result.data || []
			});
		}

		// Handle recent activity endpoint
		if (endpoint === 'recent_activity' && cohortId) {
			const result = await CourseQueries.getRecentActivity(cohortId);

			if (result.error) {
				throw error(500, result.error.message || 'Failed to fetch recent activity');
			}

			// Map activity_type to icon type expected by component
			const formattedActivities = (result.data || []).map((a) => ({
				type:
					a.activity_type === 'reflections_marked'
						? 'reflection'
						: a.activity_type === 'advancement_email_sent'
							? 'email'
							: a.activity_type === 'session_changed'
								? 'advancement'
								: a.activity_type === 'attendance_submitted'
									? 'attendance'
									: 'reflection',
				description: a.description,
				created_at: a.created_at
			}));

			return json({
				success: true,
				data: formattedActivities
			});
		}

		// Handle hubs endpoint
		if (endpoint === 'hubs') {
			const { data: course } = await CourseQueries.getCourse(courseSlug);
			if (!course) {
				throw error(404, 'Course not found');
			}

			const result = await CourseQueries.getHubs(course.id);

			if (result.error) {
				throw error(500, result.error.message || 'Failed to fetch hubs');
			}

			return json({
				success: true,
				data: result.data || []
			});
		}

		// Default: fetch cohorts (for course overview)
		const { data: course } = await CourseQueries.getCourse(courseSlug);

		if (!course) {
			throw error(404, 'Course not found');
		}

		const result = await CourseQueries.getCohorts(course.id);

		if (result.error) {
			throw error(500, result.error.message || 'Failed to fetch cohorts');
		}

		return json({
			success: true,
			data: result.data || []
		});
	} catch (err: any) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

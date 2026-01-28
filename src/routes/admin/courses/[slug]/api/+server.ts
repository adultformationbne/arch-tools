import { error, json } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth';
import { CourseMutations, CourseQueries } from '$lib/server/course-data';
import { supabaseAdmin } from '$lib/server/supabase';
import {
	buildVariableContext,
	renderTemplateForRecipient,
	sendBulkEmails,
	getCourseEmailTemplate,
	createEmailButton
} from '$lib/utils/email-service.js';
import { generateEmailFromMjml } from '$lib/email/compiler.js';
import { RESEND_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

// ================================================================
// VALIDATION HELPERS - Ensure entities belong to the current course
// ================================================================

/**
 * Get course ID from slug (cached per request)
 */
async function getCourseIdFromSlug(courseSlug: string): Promise<string | null> {
	const { data } = await supabaseAdmin
		.from('courses')
		.select('id')
		.eq('slug', courseSlug)
		.single();
	return data?.id || null;
}

/**
 * Validate that a module belongs to the specified course
 */
async function validateModuleBelongsToCourse(moduleId: string, courseSlug: string): Promise<boolean> {
	// Get course ID from slug first
	const courseId = await getCourseIdFromSlug(courseSlug);
	if (!courseId) return false;

	// Then check if module belongs to that course
	const { data } = await supabaseAdmin
		.from('courses_modules')
		.select('id')
		.eq('id', moduleId)
		.eq('course_id', courseId)
		.single();
	return !!data;
}

/**
 * Validate that a cohort belongs to the specified course (via module)
 */
async function validateCohortBelongsToCourse(cohortId: string, courseSlug: string): Promise<boolean> {
	const { data } = await supabaseAdmin
		.from('courses_cohorts')
		.select(`
			id,
			module:module_id!inner (
				course:course_id!inner (slug)
			)
		`)
		.eq('id', cohortId)
		.eq('module.course.slug', courseSlug)
		.single();
	return !!data;
}

/**
 * Validate that a hub belongs to the specified course
 */
async function validateHubBelongsToCourse(hubId: string, courseSlug: string): Promise<boolean> {
	const { data } = await supabaseAdmin
		.from('courses_hubs')
		.select(`
			id,
			course:course_id!inner (slug)
		`)
		.eq('id', hubId)
		.eq('course.slug', courseSlug)
		.single();
	return !!data;
}

/**
 * Validate that an enrollment belongs to the specified course (via cohort via module)
 */
async function validateEnrollmentBelongsToCourse(enrollmentId: string, courseSlug: string): Promise<boolean> {
	const { data } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			id,
			cohort:cohort_id!inner (
				module:module_id!inner (
					course:course_id!inner (slug)
				)
			)
		`)
		.eq('id', enrollmentId)
		.eq('cohort.module.course.slug', courseSlug)
		.single();
	return !!data;
}

/**
 * Validate that all enrollments in a list belong to the specified course
 */
async function validateEnrollmentsBelongToCourse(enrollmentIds: string[], courseSlug: string): Promise<boolean> {
	if (!enrollmentIds || enrollmentIds.length === 0) return true;

	const { data } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			id,
			cohort:cohort_id!inner (
				module:module_id!inner (
					course:course_id!inner (slug)
				)
			)
		`)
		.in('id', enrollmentIds)
		.eq('cohort.module.course.slug', courseSlug);

	// All enrollment IDs should be found
	return data?.length === enrollmentIds.length;
}

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
				// Validate courseId matches the current course slug
				const courseId = await getCourseIdFromSlug(courseSlug);
				if (!courseId || courseId !== data.courseId) {
					throw error(403, 'Cannot create module for a different course');
				}

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
				// Validate module belongs to this course
				if (!await validateModuleBelongsToCourse(data.moduleId, courseSlug)) {
					throw error(403, 'Module does not belong to this course');
				}

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
				// Validate module belongs to this course
				if (!await validateModuleBelongsToCourse(data.moduleId, courseSlug)) {
					throw error(403, 'Module does not belong to this course');
				}

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
				// Validate courseId matches the current course slug
				const courseId = await getCourseIdFromSlug(courseSlug);
				if (!courseId || courseId !== data.courseId) {
					throw error(403, 'Cannot create hub for a different course');
				}

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
				// Validate hub belongs to this course
				if (!await validateHubBelongsToCourse(data.hubId, courseSlug)) {
					throw error(403, 'Hub does not belong to this course');
				}

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
				// Validate hub belongs to this course
				if (!await validateHubBelongsToCourse(data.hubId, courseSlug)) {
					throw error(403, 'Hub does not belong to this course');
				}

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
				// Validate enrollment and hub belong to this course
				if (!await validateEnrollmentBelongsToCourse(data.enrollmentId, courseSlug)) {
					throw error(403, 'Enrollment does not belong to this course');
				}
				if (!await validateHubBelongsToCourse(data.hubId, courseSlug)) {
					throw error(403, 'Hub does not belong to this course');
				}

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
				// Validate enrollment belongs to this course
				if (!await validateEnrollmentBelongsToCourse(data.enrollmentId, courseSlug)) {
					throw error(403, 'Enrollment does not belong to this course');
				}

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
				// Validate module belongs to this course
				if (!await validateModuleBelongsToCourse(data.moduleId, courseSlug)) {
					throw error(403, 'Module does not belong to this course');
				}

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
				// Validate cohort belongs to this course
				if (!await validateCohortBelongsToCourse(data.cohortId, courseSlug)) {
					throw error(403, 'Cohort does not belong to this course');
				}
				// If changing module, validate new module also belongs to this course
				if (data.moduleId && !await validateModuleBelongsToCourse(data.moduleId, courseSlug)) {
					throw error(403, 'Target module does not belong to this course');
				}

				// Note: status is computed from session progress, not stored
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
				// Validate cohort belongs to this course
				if (!await validateCohortBelongsToCourse(data.cohortId, courseSlug)) {
					throw error(403, 'Cohort does not belong to this course');
				}

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
				// Validate cohort belongs to this course
				if (!await validateCohortBelongsToCourse(data.cohortId, courseSlug)) {
					throw error(403, 'Cohort does not belong to this course');
				}

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

			// Note: update_cohort_status removed - status is now computed from session progress

			// ================================================================
			// ENROLLMENT MANAGEMENT
			// ================================================================
			case 'upload_csv': {
				// Validate cohort belongs to this course
				if (!await validateCohortBelongsToCourse(data.cohortId, courseSlug)) {
					throw error(403, 'Cohort does not belong to this course');
				}

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

			case 'send_welcome_emails': {
				// Validate cohort belongs to this course
				if (!await validateCohortBelongsToCourse(data.cohortId, courseSlug)) {
					throw error(403, 'Cohort does not belong to this course');
				}
				// Validate all enrollments belong to this course
				if (!await validateEnrollmentsBelongToCourse(data.enrollmentIds, courseSlug)) {
					throw error(403, 'Some enrollments do not belong to this course');
				}

				const result = await CourseMutations.sendWelcomeEmails({
					enrollmentIds: data.enrollmentIds,
					cohortId: data.cohortId,
					sentBy: user.id,
					courseSlug
				});

				if (result.error) {
					throw error(500, result.error.message || 'Failed to send welcome emails');
				}

				return json({
					success: true,
					data: result.data,
					message: `Welcome emails sent to ${result.data?.sent} participants`
				});
			}

			case 'update_enrollment': {
				// Validate enrollment belongs to this course
				if (!await validateEnrollmentBelongsToCourse(data.userId, courseSlug)) {
					throw error(403, 'Enrollment does not belong to this course');
				}

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
				// Validate enrollment belongs to this course
				if (!await validateEnrollmentBelongsToCourse(data.userId, courseSlug)) {
					throw error(403, 'Enrollment does not belong to this course');
				}

				const result = await CourseMutations.deleteEnrollment(data.userId);

				if (result.error) {
					throw error(400, result.error.message || 'Failed to delete user');
				}

				return json({
					success: true,
					message: 'User deleted successfully'
				});
			}

			case 'bulk_delete_enrollments': {
				if (!data.enrollmentIds || data.enrollmentIds.length === 0) {
					throw error(400, 'No participants selected');
				}

				// Validate all enrollments belong to this course
				if (!await validateEnrollmentsBelongToCourse(data.enrollmentIds, courseSlug)) {
					throw error(403, 'Some enrollments do not belong to this course');
				}

				const forceDelete = data.forceDelete === true;
				const result = await CourseMutations.bulkDeleteEnrollments(data.enrollmentIds, forceDelete);

				if (result.error) {
					throw error(500, result.error.message || 'Failed to delete participants');
				}

				const { deleted, skipped, skippedNames } = result.data!;

				let message = '';
				if (deleted > 0 && skipped === 0) {
					message = `Successfully removed ${deleted} participant(s)`;
				} else if (deleted > 0 && skipped > 0) {
					message = `Removed ${deleted} participant(s). ${skipped} could not be removed (already signed up)`;
				} else if (deleted === 0 && skipped > 0) {
					message = `Could not remove any participants. ${skipped} have already signed up and cannot be deleted`;
				} else {
					message = 'No participants to remove';
				}

				return json({
					success: true,
					data: { deleted, skipped, skippedNames },
					message
				});
			}

			case 'delete_user_accounts': {
				if (!data.enrollmentIds || data.enrollmentIds.length === 0) {
					throw error(400, 'No participants selected');
				}

				// Validate all enrollments belong to this course
				if (!await validateEnrollmentsBelongToCourse(data.enrollmentIds, courseSlug)) {
					throw error(403, 'Some enrollments do not belong to this course');
				}

				const result = await CourseMutations.deleteUserAccounts(data.enrollmentIds);

				if (result.error && !result.data) {
					throw error(500, result.error.message || 'Failed to delete user accounts');
				}

				const { deleted, accountsDeleted, enrollmentsDeleted, errors } = result.data!;

				let message = '';
				if (accountsDeleted > 0 && errors.length === 0) {
					message = `Permanently deleted ${accountsDeleted} user account(s)`;
					if (enrollmentsDeleted > 0) {
						message += ` and ${enrollmentsDeleted} pending enrollment(s)`;
					}
				} else if (accountsDeleted > 0 && errors.length > 0) {
					message = `Deleted ${accountsDeleted} account(s), but ${errors.length} failed`;
				} else if (enrollmentsDeleted > 0) {
					message = `Removed ${enrollmentsDeleted} pending enrollment(s) (no accounts to delete)`;
				} else {
					message = 'No accounts or enrollments to delete';
				}

				return json({
					success: true,
					data: { deleted, accountsDeleted, enrollmentsDeleted, errors },
					message
				});
			}

			case 'advance_students': {
				if (!data.studentIds || data.studentIds.length === 0) {
					throw error(400, 'No students selected');
				}

				if (data.targetSession < 0 || data.targetSession > 8) {
					throw error(400, 'Invalid session number');
				}

				// Validate cohort belongs to this course
				if (!await validateCohortBelongsToCourse(data.cohortId, courseSlug)) {
					throw error(403, 'Cohort does not belong to this course');
				}
				// Validate all student enrollments belong to this course
				if (!await validateEnrollmentsBelongToCourse(data.studentIds, courseSlug)) {
					throw error(403, 'Some students do not belong to this course');
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

				// Send advancement emails if requested
				let emailResults = { sent: 0, failed: 0 };
				if (data.sendEmail) {
					try {
						// Get course info (include email_branding_config for reply-to)
						const { data: course } = await supabaseAdmin
							.from('courses')
							.select('id, name, slug, settings, email_branding_config')
							.eq('slug', courseSlug)
							.single();

						if (course) {
							// Get cohort info
							const { data: cohort } = await supabaseAdmin
								.from('courses_cohorts')
								.select('id, name, module_id')
								.eq('id', data.cohortId)
								.single();

							// Get session info for the target session
							const { data: session } = await supabaseAdmin
								.from('courses_sessions')
								.select('id, title, session_number')
								.eq('module_id', cohort?.module_id)
								.eq('session_number', data.targetSession)
								.single();

							// Get the session_materials_ready template
							const template = await getCourseEmailTemplate(
								supabaseAdmin,
								course.id,
								'session_materials_ready'
							);

							if (template) {
								// Get enrollments for the advanced students
								const { data: enrollments } = await supabaseAdmin
									.from('courses_enrollments')
									.select(`
										id,
										email,
										full_name,
										current_session,
										courses_hubs (id, name)
									`)
									.in('id', data.studentIds);

								if (enrollments && enrollments.length > 0) {
									const courseSettings = course.settings || {};
									const themeSettings = courseSettings.theme || {};
									const brandingSettings = courseSettings.branding || {};
									const courseColors = {
										accentDark: themeSettings.accentDark || '#334642',
										accentLight: themeSettings.accentLight || '#eae2d9',
										accentDarkest: themeSettings.accentDarkest || '#1e2322'
									};
									const courseLogoUrl = brandingSettings.logoUrl || null;

									const siteUrl = event.url.origin;
									const emailsToSend: Array<{
										to: string;
										subject: string;
										html: string;
										metadata: Record<string, unknown>;
										referenceId: string;
									}> = [];

									for (const enrollment of enrollments) {
										// Build variable context
										const variables = buildVariableContext({
											enrollment: {
												full_name: enrollment.full_name,
												email: enrollment.email,
												hub_name: enrollment.courses_hubs?.name || null,
												current_session: data.targetSession
											},
											course: {
												name: course.name,
												slug: course.slug
											},
											cohort: cohort ? {
												name: cohort.name,
												start_date: null,
												current_session: data.targetSession
											} : null,
											session: session ? {
												session_number: session.session_number,
												title: session.title
											} : { session_number: data.targetSession, title: `Session ${data.targetSession}` },
											siteUrl
										});

										// Add login button linking to dashboard
										variables.loginButton = createEmailButton(
											'Go to Course',
											variables.dashboardLink,
											courseColors.accentDark
										);

										// Render template
										const rendered = renderTemplateForRecipient({
											subjectTemplate: template.subject_template,
											bodyTemplate: template.body_template,
											variables
										});

										// Compile with MJML
										const compiledHtml = generateEmailFromMjml({
											bodyContent: rendered.body,
											courseName: course.name,
											logoUrl: courseLogoUrl,
											colors: courseColors
										});

										emailsToSend.push({
											to: enrollment.email,
											subject: rendered.subject,
											html: compiledHtml,
											referenceId: enrollment.id,
											metadata: {
												context: 'course',
												course_id: course.id,
												cohort_id: data.cohortId,
												enrollment_id: enrollment.id,
												template_id: template.id,
												session_number: data.targetSession
											}
										});
									}

									// Send emails
									if (emailsToSend.length > 0) {
										// Get course-specific reply-to email
										const courseReplyTo = course.email_branding_config?.reply_to_email || null;
										console.log('[advance_students] course.email_branding_config:', course.email_branding_config);
										console.log('[advance_students] courseReplyTo:', courseReplyTo);

										emailResults = await sendBulkEmails({
											emails: emailsToSend,
											emailType: 'session_advance',
											resendApiKey: RESEND_API_KEY,
											supabase: supabaseAdmin,
											options: {
												replyTo: courseReplyTo,
												commonMetadata: {
													sentBy: user.id,
													sentAt: new Date().toISOString()
												}
											}
										});
									}
								}
							} else {
								console.warn('session_materials_ready template not found for course', course.id);
							}
						}
					} catch (emailError) {
						console.error('Error sending advancement emails:', emailError);
						// Don't fail the whole operation if email fails
					}
				}

				return json({
					success: true,
					message: `Advanced ${data.studentIds.length} students to Session ${data.targetSession}${data.sendEmail ? ` (${emailResults.sent} emails sent)` : ''}`,
					data: {
						studentIds: data.studentIds,
						targetSession: data.targetSession,
						emailSent: data.sendEmail,
						emailResults
					}
				});
			}

			case 'update_student_session': {
				if (data.sessionNumber < 0 || data.sessionNumber > 8) {
					throw error(400, 'Invalid session number');
				}

				// Validate enrollment belongs to this course
				if (!await validateEnrollmentBelongsToCourse(data.enrollmentId, courseSlug)) {
					throw error(403, 'Enrollment does not belong to this course');
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

				// Validate all enrollments belong to this course
				if (!await validateEnrollmentsBelongToCourse(data.enrollmentIds, courseSlug)) {
					throw error(403, 'Some enrollments do not belong to this course');
				}
				// Validate hub belongs to this course (if assigning to a hub)
				if (data.hubId && !await validateHubBelongsToCourse(data.hubId, courseSlug)) {
					throw error(403, 'Hub does not belong to this course');
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
			// If cohortId provided, validate it belongs to this course
			if (cohortId && !await validateCohortBelongsToCourse(cohortId, courseSlug)) {
				throw error(403, 'Cohort does not belong to this course');
			}

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
			// Validate cohort belongs to this course
			if (!await validateCohortBelongsToCourse(cohortId, courseSlug)) {
				throw error(403, 'Cohort does not belong to this course');
			}

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
			// Validate cohort belongs to this course
			if (!await validateCohortBelongsToCourse(cohortId, courseSlug)) {
				throw error(403, 'Cohort does not belong to this course');
			}

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

			// Validate module belongs to this course
			if (!await validateModuleBelongsToCourse(moduleId, courseSlug)) {
				throw error(403, 'Module does not belong to this course');
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
			// Validate cohort belongs to this course
			if (!await validateCohortBelongsToCourse(cohortId, courseSlug)) {
				throw error(403, 'Cohort does not belong to this course');
			}

			const result = await CourseQueries.getRecentActivity(cohortId);

			if (result.error) {
				throw error(500, result.error.message || 'Failed to fetch recent activity');
			}

			// Map activity_type to icon type expected by component
			const getActivityType = (activityType) => {
				const typeMap = {
					'reflection_submitted': 'reflection',
					'reflection_resubmitted': 'reflection',
					'reflection_passed': 'reflection',
					'reflection_needs_revision': 'reflection',
					'reflections_marked': 'reflection',
					'attendance_marked': 'attendance',
					'attendance_submitted': 'attendance',
					'session_changed': 'advancement',
					'advancement_email_sent': 'email'
				};
				return typeMap[activityType] || 'reflection';
			};

			const formattedActivities = (result.data || []).map((a) => ({
				type: getActivityType(a.activity_type),
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

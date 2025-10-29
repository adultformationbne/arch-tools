import { error, json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireAdmin } from '$lib/server/auth.js';
import { sendBulkInvitations } from '$lib/server/resend.js';
import type { RequestHandler } from './$types';

// Helper function to log cohort activities
async function logActivity(
	cohortId: string,
	activityType: 'reflection_submitted' | 'reflections_marked' | 'attendance_submitted' | 'session_changed' | 'advancement_email_sent',
	actorId: string | null,
	actorName: string,
	description: string,
	metadata?: Record<string, any>
) {
	await supabaseAdmin.from('courses_activity_log').insert({
		cohort_id: cohortId,
		activity_type: activityType,
		actor_id: actorId,
		actor_name: actorName,
		description,
		metadata: metadata || null
	});
}

export const POST: RequestHandler = async (event) => {
	// Require admin authentication
	const { user, profile } = await requireAdmin(event);

	try {
		const { action, ...data } = await event.request.json();

		switch (action) {
			case 'create_cohort':
				return await createCohort(data);
			case 'update_cohort':
				return await updateCohort(data, profile.full_name || user.email || 'Admin');
			case 'delete_cohort':
				return await deleteCohort(data.cohortId);
			case 'duplicate_cohort':
				return await duplicateCohort(data.cohortId);
			case 'update_cohort_status':
				return await updateCohortStatus(data.cohortId, data.status);
			case 'upload_csv':
				return await uploadCSV(data, user.id);
			case 'update_enrollment':
				return await updateEnrollment(data);
			case 'delete_enrollment':
				return await deleteEnrollment(data.userId);
			case 'send_invitations':
				return await sendInvitations(data.userIds);
			case 'advance_students':
				return await advanceStudents(data, profile.full_name || user.email || 'Admin');
			default:
				throw error(400, 'Invalid action');
		}

	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

async function createCohort(data: any) {
	const { name, moduleId, startDate, endDate } = data;

	// Validate required fields
	if (!name || !moduleId || !startDate) {
		throw error(400, 'Missing required fields: name, moduleId, startDate');
	}

	// Calculate end date if not provided (assume 8 weeks)
	const calculatedEndDate = endDate || calculateEndDate(startDate);

	// Create the cohort
	const { data: newCohort, error: cohortError } = await supabaseAdmin
		.from('courses_cohorts')
		.insert({
			name,
			module_id: moduleId,
			start_date: startDate,
			end_date: calculatedEndDate,
			current_session: 1,
			status: 'draft',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.select()
		.single();

	if (cohortError) {
		console.error('Error creating cohort:', cohortError);
		throw error(500, 'Failed to create cohort');
	}

	// Create reflection questions for each week
	await ensureModuleReflectionQuestions(moduleId);

	return json({
		success: true,
		data: newCohort,
		message: 'Cohort created successfully'
	});
}

async function deleteCohort(cohortId: string) {
	if (!cohortId) {
		throw error(400, 'Missing cohortId');
	}

	// Check if cohort has any enrollments
	const { data: enrollments, error: enrollmentCheckError } = await supabaseAdmin
		.from('courses_enrollments')
		.select('id')
		.eq('cohort_id', cohortId)
		.limit(1);

	if (enrollmentCheckError) {
		console.error('Error checking enrollments:', enrollmentCheckError);
		throw error(500, 'Failed to check cohort enrollments');
	}

	if (enrollments && enrollments.length > 0) {
		throw error(400, 'Cannot delete cohort with enrolled students');
	}

	// Delete the cohort
	const { error: deleteError } = await supabaseAdmin
		.from('courses_cohorts')
		.delete()
		.eq('id', cohortId);

	if (deleteError) {
		console.error('Error deleting cohort:', deleteError);
		throw error(500, 'Failed to delete cohort');
	}

	return json({
		success: true,
		message: 'Cohort deleted successfully'
	});
}

async function duplicateCohort(cohortId: string) {
	if (!cohortId) {
		throw error(400, 'Missing cohortId');
	}

	// Get the original cohort
	const { data: originalCohort, error: fetchError } = await supabaseAdmin
		.from('courses_cohorts')
		.select('*')
		.eq('id', cohortId)
		.single();

	if (fetchError || !originalCohort) {
		throw error(404, 'Cohort not found');
	}

	// Create duplicate cohort
	const { data: newCohort, error: createError } = await supabaseAdmin
		.from('courses_cohorts')
		.insert({
			name: `${originalCohort.name} (Copy)`,
			module_id: originalCohort.module_id,
			start_date: '', // Will be set by admin later
			end_date: '', // Will be calculated when start date is set
			status: 'draft',
			created_at: new Date().toISOString(),
			updated_at: new Date().toISOString()
		})
		.select()
		.single();

	if (createError) {
		console.error('Error duplicating cohort:', createError);
		throw error(500, 'Failed to duplicate cohort');
	}

	// Ensure module-level reflection questions exist
	await ensureModuleReflectionQuestions(originalCohort.module_id);

	return json({
		success: true,
		data: newCohort,
		message: 'Cohort duplicated successfully'
	});
}

async function ensureModuleReflectionQuestions(moduleId: string) {
	// Default reflection prompts mapped by session index
	const defaultQuestions = [
		'What is the reason you look to God for answers over cultural sources and making prayer central to your life?',
		'How do you see God working in your daily life through small moments and ordinary experiences?',
		'Reflect on a time when you experienced God\'s mercy in your life.',
		'How has your understanding of the Trinity deepened through this week\'s materials?',
		'What does it mean to you to be part of the Body of Christ?',
		'How has your understanding of the Eucharist deepened through this week\'s materials?',
		'Describe a moment when you felt particularly close to God in prayer.',
		'How will you continue to grow in your faith after completing this module?'
	];

	const { data: sessions, error: sessionsError } = await supabaseAdmin
		.from('courses_sessions')
		.select('id, session_number')
		.eq('module_id', moduleId)
		.order('session_number', { ascending: true });

	if (sessionsError) {
		console.error('Error fetching module sessions for reflection questions:', sessionsError);
		throw error(500, 'Failed to load module sessions');
	}

	if (!sessions || sessions.length === 0) {
		return;
	}

	const sessionIds = sessions.map(session => session.id);

	const { data: existingQuestions, error: existingError } = await supabaseAdmin
		.from('courses_reflection_questions')
		.select('session_id')
		.in('session_id', sessionIds);

	if (existingError) {
		console.error('Error checking existing reflection questions:', existingError);
		throw error(500, 'Failed to check reflection questions');
	}

	const existingSessionIds = new Set((existingQuestions || []).map(q => q.session_id));
	const now = new Date().toISOString();
	const questionsToInsert = sessions
		.filter(session => !existingSessionIds.has(session.id))
		.map((session, index) => ({
			session_id: session.id,
			question_text: defaultQuestions[index] || defaultQuestions[defaultQuestions.length - 1],
			created_at: now,
			updated_at: now
		}));

	if (questionsToInsert.length === 0) {
		return;
	}

	const { error: insertError } = await supabaseAdmin
		.from('courses_reflection_questions')
		.insert(questionsToInsert);

	if (insertError) {
		console.error('Error inserting default reflection questions:', insertError);
		throw error(500, 'Failed to insert reflection questions');
	}
}

async function updateCohort(data: any, actorName: string) {
	const { cohortId, name, moduleId, startDate, endDate, currentSession } = data;

	if (!cohortId) {
		throw error(400, 'Missing cohortId');
	}

	// Get current cohort state to detect session changes
	const { data: currentCohort } = await supabaseAdmin
		.from('courses_cohorts')
		.select('current_session')
		.eq('id', cohortId)
		.single();

	const updateData: any = {
		updated_at: new Date().toISOString()
	};

	if (name) updateData.name = name;
	if (moduleId) updateData.module_id = moduleId;
	if (startDate) updateData.start_date = startDate;
	if (endDate) updateData.end_date = endDate;
	if (currentSession !== undefined) updateData.current_session = currentSession;

	const { data: updatedCohort, error: updateError } = await supabaseAdmin
		.from('courses_cohorts')
		.update(updateData)
		.eq('id', cohortId)
		.select()
		.single();

	if (updateError) {
		console.error('Error updating cohort:', updateError);
		throw error(500, 'Failed to update cohort');
	}

	// Log activity if session was changed
	if (currentSession !== undefined && currentSession !== currentCohort?.current_session) {
		await logActivity(
			cohortId,
			'session_changed',
			null,
			actorName,
			`Current session changed from ${currentCohort?.current_session || 1} to ${currentSession}`,
			{ old_session: currentCohort?.current_session, new_session: currentSession }
		);
	}

	return json({
		success: true,
		data: updatedCohort,
		message: 'Cohort updated successfully'
	});
}

async function updateCohortStatus(cohortId: string, status: string) {
	if (!cohortId || !status) {
		throw error(400, 'Missing cohortId or status');
	}

	const { data: updatedCohort, error: updateError } = await supabaseAdmin
		.from('courses_cohorts')
		.update({ status: status })
		.eq('id', cohortId)
		.select()
		.single();

	if (updateError) {
		console.error('Error updating cohort status:', updateError);
		throw error(500, 'Failed to update cohort status');
	}

	return json({
		success: true,
		data: updatedCohort,
		message: 'Cohort status updated successfully'
	});
}

function calculateEndDate(startDate: string): string {
	const start = new Date(startDate);
	const end = new Date(start.getTime() + (8 * 7 * 24 * 60 * 60 * 1000)); // 8 weeks
	return end.toISOString().split('T')[0];
}

// Enrollment Management Functions

async function uploadCSV(data: any, importedBy: string) {
	const { filename, data: rows, cohortId } = data;

	if (!rows || rows.length === 0) {
		throw error(400, 'No data provided');
	}

	if (!cohortId) {
		throw error(400, 'Cohort ID required');
	}

	// Create import tracking record
	const { data: importRecord, error: importError } = await supabaseAdmin
		.from('accf_user_imports')
		.insert({
			imported_by: importedBy,
			filename: filename,
			total_rows: rows.length,
			status: 'processing'
		})
		.select()
		.single();

	if (importError) {
		console.error('Error creating import record:', importError);
		throw error(500, 'Failed to create import record');
	}

	let successCount = 0;
	let errorCount = 0;
	const results = [];
	const errorDetails = [];

	// Process each row
	for (const row of rows) {
		try {
			// Check if already in courses_enrollments for THIS SPECIFIC COHORT
			const { data: existingInCohort } = await supabaseAdmin
				.from('courses_enrollments')
				.select('email')
				.eq('email', row.email)
				.eq('cohort_id', cohortId)
				.single();

			if (existingInCohort) {
				const errorMsg = `${row.full_name} (${row.email}): Already in this cohort`;
				results.push({
					email: row.email,
					status: 'skipped',
					message: 'Already in this cohort'
				});
				errorDetails.push(errorMsg);
				errorCount++;
				continue;
			}

			// Auto-create or find hub if hub name provided
			let hubId = null;
			if (row.hub && row.hub.trim()) {
				const hubName = row.hub.trim();

				// Check if hub exists (case-insensitive)
				const { data: existingHub } = await supabaseAdmin
					.from('courses_hubs')
					.select('id')
					.ilike('name', hubName)
					.single();

				if (existingHub) {
					hubId = existingHub.id;
				} else {
					// Create new hub
					const { data: newHub, error: hubError } = await supabaseAdmin
						.from('courses_hubs')
						.insert({ name: hubName })
						.select('id')
						.single();

					if (!hubError && newHub) {
						hubId = newHub.id;
					}
				}
			}

			// Insert into courses_enrollments (invitation_token is auto-generated as UUID by database)
			const { error: insertError } = await supabaseAdmin.from('courses_enrollments').insert({
				email: row.email,
				full_name: row.full_name,
				role: row.role || 'courses_student',
				hub_id: hubId,
				cohort_id: cohortId,
				imported_by: importedBy,
				status: 'pending'
			});

			if (insertError) {
				console.error('Error inserting user:', insertError);
				const errorMsg = `${row.full_name} (${row.email}): ${insertError.message}`;
				results.push({
					email: row.email,
					status: 'error',
					message: insertError.message
				});
				errorDetails.push(errorMsg);
				errorCount++;
			} else {
				results.push({
					email: row.email,
					status: 'success',
					message: 'Added to cohort'
				});
				successCount++;
			}
		} catch (err) {
			console.error('Error processing row:', err);
			const errorMsg = `${row.full_name} (${row.email}): ${err.message || 'Unknown error'}`;
			results.push({
				email: row.email,
				status: 'error',
				message: err.message || 'Unknown error'
			});
			errorDetails.push(errorMsg);
			errorCount++;
		}
	}

	// Update import record
	await supabaseAdmin
		.from('accf_user_imports')
		.update({
			successful_rows: successCount,
			error_rows: errorCount,
			status: 'completed'
		})
		.eq('id', importRecord.id);

	return json({
		success: true,
		data: {
			importId: importRecord.id,
			total: rows.length,
			successful: successCount,
			errors: errorCount,
			errorDetails: errorDetails,
			results: results
		},
		message: `Processed ${rows.length} rows: ${successCount} successful, ${errorCount} errors`
	});
}

async function updateEnrollment(data: any) {
	const { userId, updates } = data;

	if (!userId) {
		throw error(400, 'Missing userId');
	}

	const allowedFields = [
		'full_name',
		'role',
		'hub_id',
		'assigned_admin_id',
		'current_session',
		'status'
	];

	const updateData: any = {
		updated_at: new Date().toISOString()
	};

	for (const field of allowedFields) {
		if (updates[field] !== undefined) {
			updateData[field] = updates[field];
		}
	}

	if (Object.keys(updateData).length === 1) { // Only updated_at
		throw error(400, 'No valid updates provided');
	}

	const { data: updatedUser, error: updateError } = await supabaseAdmin
		.from('courses_enrollments')
		.update(updateData)
		.eq('id', userId)
		.select()
		.single();

	if (updateError) {
		console.error('Error updating enrollment:', updateError);
		throw error(500, 'Failed to update user');
	}

	return json({
		success: true,
		data: updatedUser,
		message: 'User updated successfully'
	});
}

async function deleteEnrollment(userId: string) {
	if (!userId) {
		throw error(400, 'Missing userId');
	}

	// Only allow deletion if user hasn't signed up yet (no auth_user_id)
	const { data: user } = await supabaseAdmin
		.from('courses_enrollments')
		.select('auth_user_id')
		.eq('id', userId)
		.single();

	if (user?.auth_user_id) {
		throw error(400, 'Cannot delete user who has completed signup');
	}

	const { error: deleteError } = await supabaseAdmin
		.from('courses_enrollments')
		.delete()
		.eq('id', userId);

	if (deleteError) {
		console.error('Error deleting enrollment:', deleteError);
		throw error(500, 'Failed to delete user');
	}

	return json({
		success: true,
		message: 'User deleted successfully'
	});
}

async function advanceStudents(data: any, actorName: string) {
	const { cohortId, studentIds, targetSession, sendEmail } = data;

	if (!studentIds || studentIds.length === 0) {
		throw error(400, 'No students selected');
	}

	if (targetSession < 1 || targetSession > 8) {
		throw error(400, 'Invalid session number');
	}

	if (!cohortId) {
		throw error(400, 'Cohort ID required');
	}

	// Update students' current session
	const { error: updateError } = await supabaseAdmin
		.from('courses_enrollments')
		.update({
			current_session: targetSession,
			updated_at: new Date().toISOString()
		})
		.in('id', studentIds)
		.eq('cohort_id', cohortId);

	if (updateError) {
		console.error('Error advancing students:', updateError);
		throw error(500, 'Failed to advance students');
	}

	// TODO: Send session notification emails if requested
	// This will be implemented when email system is ready
	if (sendEmail) {
		// const { data: students } = await supabaseAdmin
		// 	.from('courses_enrollments')
		// 	.select('email, full_name, cohorts(name)')
		// 	.in('id', studentIds);
		// await sendSessionNotifications(students, targetSession);

		// Log email activity
		await logActivity(
			cohortId,
			'advancement_email_sent',
			null,
			actorName,
			`Advancement emails sent to ${studentIds.length} student${studentIds.length > 1 ? 's' : ''} for Session ${targetSession}`,
			{ student_count: studentIds.length, session: targetSession }
		);
	}

	return json({
		success: true,
		message: `Advanced ${studentIds.length} students to Session ${targetSession}`,
		data: {
			studentIds,
			targetSession,
			emailSent: sendEmail
		}
	});
}

async function sendInvitations(userIds: string[]) {
	if (!userIds || userIds.length === 0) {
		throw error(400, 'No user IDs provided');
	}

	// Get pending users with cohort info
	const { data: users, error: fetchError } = await supabaseAdmin
		.from('courses_enrollments')
		.select('*, courses_cohorts(name)')
		.in('id', userIds)
		.eq('status', 'pending');

	if (fetchError) {
		console.error('Error fetching users:', fetchError);
		throw error(500, 'Failed to fetch users');
	}

	if (!users || users.length === 0) {
		throw error(400, 'No pending users found to invite');
	}

		// Prepare user data for email sending
		const usersToInvite = users.map(user => ({
			email: user.email,
			full_name: user.full_name,
			invitation_token: user.invitation_token,
			cohort_name: user.courses_cohorts?.name || 'Course Cohort'
		}));

	// Send emails via Resend
	let emailResults;
	try {
		emailResults = await sendBulkInvitations(usersToInvite);
	} catch (err) {
		console.error('Error sending bulk invitations:', err);
		throw error(500, 'Failed to send invitation emails');
	}

	// Update status for successfully sent invitations
	const successfulEmails = usersToInvite
		.filter((_, index) => !emailResults.errors.some(e => e.email === usersToInvite[index].email))
		.map(u => u.email);

	if (successfulEmails.length > 0) {
		await supabaseAdmin
			.from('courses_enrollments')
			.update({
				status: 'invited',
				invitation_sent_at: new Date().toISOString()
			})
			.in('email', successfulEmails);
	}

	// Mark failed ones with error
	if (emailResults.errors.length > 0) {
		for (const errorItem of emailResults.errors) {
			await supabaseAdmin
				.from('courses_enrollments')
				.update({
					status: 'error',
					error_message: errorItem.error
				})
				.eq('email', errorItem.email);
		}
	}

	return json({
		success: true,
		data: {
			total: emailResults.total,
			sent: emailResults.sent,
			failed: emailResults.failed,
			errors: emailResults.errors
		},
		message: `Successfully sent ${emailResults.sent} invitations. ${emailResults.failed} failed.`
	});
}

export const GET: RequestHandler = async (event) => {
	// Require admin authentication
	await requireAdmin(event);

	const { url } = event;
	const endpoint = url.searchParams.get('endpoint');
	const cohortId = url.searchParams.get('cohort_id');

	try {
		// Handle courses_enrollments endpoint
		if (endpoint === 'courses_enrollments') {
			let query = supabaseAdmin
				.from('courses_enrollments')
				.select('*, cohorts(name), hubs(name)')
				.order('created_at', { ascending: false });

			if (cohortId) {
				query = query.eq('cohort_id', cohortId);
			}

				const { data: users, error: fetchError } = await query;

				if (fetchError) {
					console.error('Error fetching enrollments:', fetchError);
				throw error(500, 'Failed to fetch users');
			}

			return json({
				success: true,
				data: users
			});
		}

		// Handle attendance endpoint
		if (endpoint === 'attendance' && cohortId) {
			const { data: attendance, error: fetchError } = await supabaseAdmin
				.from('courses_attendance')
				.select('enrollment_id, session_number, present')
				.eq('cohort_id', cohortId)
				.order('session_number', { ascending: true });

			if (fetchError) {
				console.error('Error fetching attendance:', fetchError);
				throw error(500, 'Failed to fetch attendance');
			}

			return json({
				success: true,
				data: attendance || []
			});
		}

		// Handle reflection_responses endpoint
		if (endpoint === 'reflection_responses' && cohortId) {
			const { data: reflections, error: fetchError } = await supabaseAdmin
				.from('courses_reflection_responses')
				.select('enrollment_id, session_number, status, marked_at, created_at, feedback')
				.eq('cohort_id', cohortId)
				.order('session_number', { ascending: true });

			if (fetchError) {
				console.error('Error fetching reflections:', fetchError);
				throw error(500, 'Failed to fetch reflections');
			}

			return json({
				success: true,
				data: reflections || []
			});
		}

		// Handle recent activity endpoint
		if (endpoint === 'recent_activity' && cohortId) {
			// Get recent activity from activity log (last 7 days)
			const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

			const { data: activities, error: fetchError } = await supabaseAdmin
				.from('courses_activity_log')
				.select('*')
				.eq('cohort_id', cohortId)
				.gte('created_at', sevenDaysAgo)
				.order('created_at', { ascending: false })
				.limit(20);

			if (fetchError) {
				console.error('Error fetching recent activity:', fetchError);
				throw error(500, 'Failed to fetch recent activity');
			}

			// Map activity_type to icon type expected by component
			const formattedActivities = (activities || []).map(a => ({
				type: a.activity_type === 'reflections_marked' ? 'reflection' :
				      a.activity_type === 'advancement_email_sent' ? 'email' :
				      a.activity_type === 'session_changed' ? 'advancement' :
				      a.activity_type === 'attendance_submitted' ? 'attendance' :
				      'reflection',
				description: a.description,
				created_at: a.created_at
			}));

			return json({
				success: true,
				data: formattedActivities
			});
		}

		// Default: fetch cohorts with manually set current_session
		const { data: cohorts, error: fetchError } = await supabaseAdmin
			.from('courses_cohorts')
			.select('id, name, module_id, start_date, end_date, current_session, status, created_at')
			.order('start_date', { ascending: false });

		if (fetchError) {
			console.error('Error fetching cohorts:', fetchError);
			throw error(500, 'Failed to fetch cohorts');
		}

		return json({
			success: true,
			data: cohorts || []
		});
	} catch (err) {
		console.error('API error:', err);

		if (err?.status) {
			throw err;
		}

		throw error(500, 'Internal server error');
	}
};

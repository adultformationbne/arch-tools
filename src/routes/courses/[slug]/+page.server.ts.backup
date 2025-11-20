import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAccess } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require user to be enrolled in this course (any role)
	const { user } = await requireCourseAccess(event, courseSlug);
	const currentUserId = user.id;

	// Get user's enrollment to determine cohort and current session
	const { data: enrollment, error: enrollmentError } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			id,
			cohort_id,
			current_session,
			role,
			hub_id,
			full_name,
			user_profiles!user_profile_id (
				full_name,
				email
			)
		`)
		.eq('user_profile_id', user.id)
		.single();

	if (!enrollment || enrollmentError) {
		throw error(404, 'User enrollment not found. Please contact an administrator.');
	}

	const cohortId = enrollment.cohort_id;
	const currentSession = enrollment.current_session;
	const enrollmentId = enrollment.id;

	try {
		// First get the cohort to find its module_id
		const { data: cohort, error: cohortError } = await supabaseAdmin
			.from('courses_cohorts')
			.select(`
				*,
				courses_modules (
					id,
					name,
					description
				)
			`)
			.eq('id', cohortId)
			.single();

		if (cohortError) {
			console.error('Error fetching cohort:', cohortError);
			throw cohortError;
		}

		const moduleId = cohort.module_id;

		// Fetch all sessions for the module
		const { data: sessions, error: sessionsError } = await supabaseAdmin
			.from('courses_sessions')
			.select('*')
			.eq('module_id', moduleId)
			.order('session_number', { ascending: true });

		if (sessionsError) {
			console.error('Error fetching sessions:', sessionsError);
			throw sessionsError;
		}

		// Fetch all materials for the module's sessions
		const { data: materials, error: materialsError } = await supabaseAdmin
			.from('courses_materials')
			.select(`
				*,
				courses_sessions!inner (
					session_number,
					module_id
				)
			`)
			.eq('courses_sessions.module_id', moduleId)
			.order('display_order', { ascending: true });

		// Sort by session number in code (can't order by joined columns in Supabase)
		materials?.sort((a, b) => {
			const sessionDiff = a.courses_sessions.session_number - b.courses_sessions.session_number;
			if (sessionDiff !== 0) return sessionDiff;
			return a.display_order - b.display_order;
		});

		if (materialsError) {
			console.error('Error fetching materials:', materialsError);
			throw materialsError;
		}

		// Fetch all reflection questions for this module's sessions
		const { data: reflectionQuestions, error: questionsError } = await supabaseAdmin
			.from('courses_reflection_questions')
			.select(`
				*,
				courses_sessions!inner (
					session_number,
					module_id,
					reflections_enabled
				)
			`)
			.eq('courses_sessions.module_id', moduleId);

		// Sort by session number in code (can't order by joined columns in Supabase)
		reflectionQuestions?.sort((a, b) =>
			a.courses_sessions.session_number - b.courses_sessions.session_number
		);

		if (questionsError) {
			console.error('Error fetching reflection questions:', questionsError);
			throw questionsError;
		}

		// Fetch user's reflection responses
		let reflectionResponses = [];
		if (enrollmentId) {
			const { data, error: responsesError } = await supabaseAdmin
				.from('courses_reflection_responses')
				.select(`
					*,
					courses_reflection_questions!question_id (
						session_number,
						question_text
					),
					marked_by_user:marked_by (
						full_name
					)
				`)
				.eq('enrollment_id', enrollmentId)
				.order('created_at', { ascending: false });

			if (!responsesError && data) {
				reflectionResponses = data;
			}
		}

		// Fetch public reflections from same cohort
		let publicReflections = [];
		if (cohortId) {
			const { data, error: publicError } = await supabaseAdmin
				.from('courses_reflection_responses')
				.select(`
					*,
					courses_reflection_questions!question_id (
						session_number,
						question_text
					),
					courses_enrollments!enrollment_id (
						user_profiles!user_profile_id (
							full_name
						)
					)
				`)
				.eq('cohort_id', cohortId)
				.eq('is_public', true)
				.neq('enrollment_id', enrollmentId || '')
				.order('created_at', { ascending: false })
				.limit(20);

			if (!publicError && data) {
				publicReflections = data;
			}
		}

		// Create session lookups
		const sessionsByNumber: Record<number, any> = {};
		sessions?.forEach(session => {
			sessionsByNumber[session.session_number] = session;
		});

		// Group materials by session
		const materialsBySession: Record<number, any[]> = {};
		materials?.forEach(material => {
			const sessionNum = material.courses_sessions.session_number;
			if (!materialsBySession[sessionNum]) {
				materialsBySession[sessionNum] = [];
			}

			// Transform to dashboard format
			materialsBySession[sessionNum].push({
				id: material.id,
				type: material.type,
				title: material.title,
				content: material.content,
				url: material.content, // For compatibility with existing component
				viewable: true // All materials are viewable for now
			});
		});

		// Create reflection questions lookup with IDs
		// Only include questions from sessions where reflections_enabled is true
		const questionsBySession: Record<number, { id: string, text: string }> = {};
		reflectionQuestions?.forEach(question => {
			const sessionNum = question.courses_sessions.session_number;
			const reflectionsEnabled = question.courses_sessions.reflections_enabled ?? true;

			// Only add question if reflections are enabled for this session
			if (reflectionsEnabled) {
				questionsBySession[sessionNum] = {
					id: question.id,
					text: question.question_text
				};
			}
		});

		// Process reflection responses for PastReflectionsSection
		const pastReflections = reflectionResponses?.map(response => {
			const formatDate = (dateString) => {
				const date = new Date(dateString);
				const now = new Date();
				const diffTime = Math.abs(now.getTime() - date.getTime());
				const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

				if (diffDays === 1) return '1 day ago';
				if (diffDays < 7) return `${diffDays} days ago`;
				if (diffDays < 14) return '1 week ago';
				if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
				return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
			};

			return {
				session: response.courses_reflection_questions?.session_number || response.session_number || 0,
				title: `Session ${response.courses_reflection_questions?.session_number || response.session_number || 0} Reflection`,
				question: response.courses_reflection_questions?.question_text || '',
				status: response.status === 'passed' ? 'graded' : response.status,
				submittedDate: response.created_at ? formatDate(response.created_at) : 'Not submitted',
				response: response.response_text || '',
				feedback: response.feedback || null,
				grade: response.status === 'passed' ? 'Pass' : (response.status === 'needs_revision' ? 'Needs Work' : null),
				instructor: response.marked_by_user?.full_name || null
			};
		}) || [];

		// Process public reflections for PublicReflectionsFeed
		const processedPublicReflections = publicReflections?.map(response => {
			const formatDate = (dateString) => {
				const date = new Date(dateString);
				const now = new Date();
				const diffTime = Math.abs(now.getTime() - date.getTime());
				const diffHours = Math.floor(diffTime / (1000 * 60 * 60));
				const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

				if (diffHours < 1) return 'Just now';
				if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
				if (diffDays === 1) return '1 day ago';
				if (diffDays < 7) return `${diffDays} days ago`;
				if (diffDays < 14) return '1 week ago';
				return `${Math.floor(diffDays / 7)} weeks ago`;
			};

			const getInitials = (fullName) => {
				if (!fullName) return 'AN';
				return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
			};

			const truncateContent = (content, maxLength = 200) => {
				if (!content || content.length <= maxLength) return content;
				return content.substring(0, maxLength) + '...';
			};

			// Get student name from the correct path
			const studentName = response.courses_enrollments?.user_profiles?.full_name || 'Anonymous';

			return {
				id: response.id,
				studentName,
				studentInitials: getInitials(studentName),
				cohortName: cohort.courses_modules?.name || 'Unknown Module',
				sessionNumber: response.courses_reflection_questions?.session_number || response.session_number || 0,
				reflectionExcerpt: truncateContent(response.response_text),
				submittedAt: response.created_at ? formatDate(response.created_at) : 'Unknown',
				likes: 0,
				comments: 0,
				question: response.courses_reflection_questions?.question_text || '',
				response: response.response_text || '',
				status: response.status || 'submitted'
			};
		}) || [];

		// Convert current session materials to dashboard format
		const currentSessionMaterials = materialsBySession[currentSession] || [];
		const currentSessionInfo = sessionsByNumber[currentSession];

		// Handle session 0 (cohort not started yet)
		let currentSessionData;
		if (currentSession === 0) {
			// For Week 0, load actual materials and session info from the database
			const sessionInfo = sessionsByNumber[0];
			const sessionMaterials = materialsBySession[0] || [];

			currentSessionData = {
				sessionNumber: 0,
				sessionTitle: sessionInfo?.title || "Welcome",
				sessionOverview: sessionInfo?.description || `This course begins on ${new Date(cohort.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Review the materials below to prepare for Session 1.`,
				materials: sessionMaterials,
				reflectionQuestion: null, // No reflection for Week 0
				reflectionStatus: null,
				isUpcoming: true // Flag to indicate cohort hasn't started
			};
		} else {
			// Check if reflections are enabled for this session (default to true if no question exists)
			const reflectionQuestion = questionsBySession[currentSession] || null;

			// Get actual reflection status for current session
			let reflectionStatus = null;
			if (reflectionQuestion && enrollmentId) {
				const existingResponse = reflectionResponses?.find(
					r => r.session_number === currentSession
				);
				reflectionStatus = existingResponse ? existingResponse.status : 'not_started';
			}

			currentSessionData = {
				sessionNumber: currentSession,
				sessionTitle: currentSessionInfo?.title || `Session ${currentSession}`,
				sessionOverview: currentSessionInfo?.description || `Session ${currentSession} content and materials`,
				materials: currentSessionMaterials,
				reflectionQuestion: reflectionQuestion,
				reflectionStatus: reflectionStatus,
				isUpcoming: false
			};
		}

		const courseData = {
			title: cohort.courses_modules?.name || "Foundations of Faith",
			description: cohort.courses_modules?.description || "",
			cohortName: cohort.name,
			startDate: cohort.start_date,
			endDate: cohort.end_date,
			status: cohort.status,
			currentSessionData
		};

		// If user is a hub coordinator, load hub data
		let hubData = null;
		if (enrollment.role === 'coordinator' && enrollment.hub_id) {
			// Get hub details
			const { data: hub } = await supabaseAdmin
				.from('courses_hubs')
				.select('id, name, location')
				.eq('id', enrollment.hub_id)
				.single();

			if (hub) {
				// Get all students in this hub
				const { data: hubStudents } = await supabaseAdmin
					.from('courses_enrollments')
					.select(
						`
						id,
						full_name,
						email,
						current_session,
						user_profile_id,
						user_profiles!user_profile_id (
							full_name,
							email
						)
					`
					)
					.eq('hub_id', enrollment.hub_id)
					.eq('cohort_id', enrollment.cohort_id)
					.eq('role', 'student')
					.order('full_name');

				// For each student, get their reflection and attendance status for current session
				const studentsWithStatus = await Promise.all(
					(hubStudents || []).map(async (student) => {
						const studentName =
							student.user_profiles?.full_name || student.full_name || student.email;

						// Get reflection status for current session
						let reflectionStatus = 'not_started';
						if (cohort.current_session > 0) {
							const { data: reflection } = await supabaseAdmin
								.from('courses_reflection_responses')
								.select('status')
								.eq('enrollment_id', student.id)
								.eq('session_number', cohort.current_session)
								.single();

							if (reflection) {
								reflectionStatus = reflection.status;
							}
						}

						// Get attendance for current session
						let attendanceStatus = null;
						if (cohort.current_session > 0) {
							const { data: attendance } = await supabaseAdmin
								.from('courses_attendance')
								.select('present')
								.eq('enrollment_id', student.id)
								.eq('session_number', cohort.current_session)
								.single();

							if (attendance) {
								attendanceStatus = attendance.present ? 'present' : 'absent';
							}
						}

						return {
							id: student.id,
							name: studentName,
							email: student.email,
							currentSession: student.current_session,
							reflectionStatus,
							attendanceStatus
						};
					})
				);

				hubData = {
					hubName: hub.name,
					hubLocation: hub.location,
					coordinatorName: enrollment.user_profiles?.full_name || enrollment.full_name,
					currentSession: cohort.current_session,
					students: studentsWithStatus
				};
			}
		}

		return {
			materials: materials || [],
			materialsBySession,
			currentSession,
			courseData,
			questionsBySession,
			sessionsByNumber,
			pastReflections,
			publicReflections: processedPublicReflections,
			currentUserId,
			courseSlug,
			hubData
		};

	} catch (err) {
		console.error('Error in dashboard load function:', err);
		return {
			materials: [],
			materialsBySession: {},
			currentSession,
			courseData: {
				title: "Course Dashboard",
				currentSessionData: {
					sessionNumber: currentSession,
					sessionTitle: `Session ${currentSession}`,
					sessionOverview: "Failed to load course data. Please try refreshing the page.",
					materials: [],
					reflectionQuestion: null,
					reflectionStatus: null,
					isUpcoming: false
				}
			},
			questionsBySession: {},
			sessionsByNumber: {},
			pastReflections: [],
			publicReflections: [],
			currentUserId,
			courseSlug,
			hubData: null,
			error: 'Failed to load course data'
		};
	}
};

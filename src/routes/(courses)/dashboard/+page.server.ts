import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCoursesUser } from '$lib/server/auth.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	console.log('=== DASHBOARD PAGE SERVER LOAD ===');
	console.log('URL:', event.url.pathname);

	// Require ACCF user authentication
	const { user } = await requireCoursesUser(event);
	console.log('Dashboard authenticated user:', user.email);

	// Check for dev mode user
	const { getDevUserFromRequest } = await import('$lib/server/dev-user.js');
	const devUser = getDevUserFromRequest(event.request);
	const isDevMode = process.env.NODE_ENV === 'development' && devUser;

	// Use dev user ID if in dev mode, otherwise use authenticated user ID
	const currentUserId = isDevMode ? devUser.id : user.id;
	console.log('Using user ID for enrollment lookup:', currentUserId, isDevMode ? '(dev mode)' : '(real user)');

	// Get user's enrollment to determine cohort and current session
	const { data: enrollment, error: enrollmentError} = await supabaseAdmin
		.from('courses_users')
		.select('cohort_id, current_session')
		.eq('user_profile_id', currentUserId)
		.single();

	console.log('Enrollment query result:', { enrollment, enrollmentError });

	if (!enrollment || enrollmentError) {
		console.error('Enrollment error:', enrollmentError);
		throw error(404, 'User enrollment not found. Please contact an administrator.');
	}

	const cohortId = enrollment.cohort_id;
	const currentSession = enrollment.current_session;

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
					module_id
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

		// Get student's courses_users record for reflection queries
		const { data: studentRecord } = await supabaseAdmin
			.from('courses_users')
			.select('id')
			.eq('user_profile_id', currentUserId)
			.single();

		const accfUserId = studentRecord?.id;

		// Fetch user's reflection responses
		let reflectionResponses = [];
		if (accfUserId) {
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
				.eq('accf_user_id', accfUserId)
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
					student:accf_user_id (
						full_name
					)
				`)
				.eq('cohort_id', cohortId)
				.eq('is_public', true)
				.neq('accf_user_id', accfUserId || '')
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
		const questionsBySession: Record<number, { id: string, text: string }> = {};
		reflectionQuestions?.forEach(question => {
			const sessionNum = question.courses_sessions.session_number;
			questionsBySession[sessionNum] = {
				id: question.id,
				text: question.question_text
			};
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

			return {
				id: response.id,
				studentName: response.student?.full_name || 'Anonymous',
				studentInitials: getInitials(response.student?.full_name),
				cohortName: cohort.courses_modules?.name || 'Unknown Module',
				sessionNumber: response.courses_reflection_questions?.session_number || response.session_number || 0,
				reflectionExcerpt: truncateContent(response.response_text),
				submittedAt: response.created_at ? formatDate(response.created_at) : 'Unknown',
				likes: 0, // TODO: Implement likes system
				comments: 0, // TODO: Implement comments system
				question: response.courses_reflection_questions?.question_text || '',
				response: response.response_text || '',
				status: response.status || 'submitted'
			};
		}) || [];

		// Convert current session materials to dashboard format
		const currentSessionMaterials = materialsBySession[currentSession] || [];
		const currentSessionInfo = sessionsByNumber[currentSession];

		const courseData = {
			title: cohort.courses_modules?.name || "Foundations of Faith",
			description: cohort.courses_modules?.description || "",
			cohortName: cohort.name,
			startDate: cohort.start_date,
			endDate: cohort.end_date,
			status: cohort.status,
			currentSessionData: {
				sessionNumber: currentSession,
				sessionTitle: currentSessionInfo?.title || `Session ${currentSession}`,
				sessionOverview: currentSessionInfo?.description || `Session ${currentSession} content and materials`,
				materials: currentSessionMaterials,
				reflectionQuestion: questionsBySession[currentSession] || { id: null, text: "Reflect on this session's materials and their impact on your faith journey." },
				reflectionStatus: "not_started" // TODO: Get from user's reflection responses
			}
		};

		return {
			materials: materials || [],
			materialsBySession,
			currentSession,
			courseData,
			questionsBySession,
			sessionsByNumber,
			pastReflections,
			publicReflections: processedPublicReflections,
			currentUserId
		};

	} catch (error) {
		console.error('Error in dashboard load function:', error);
		console.error('Dashboard load error:', error);
		return {
			materials: [],
			materialsBySession: {},
			currentSession,
			courseData: getDefaultCourseData(currentSession),
			questionsBySession: {},
			sessionOverviews: {},
			pastReflections: [],
			publicReflections: [],
			currentUserId,
			error: 'Failed to load course data'
		};
	}

	console.log('Dashboard load successful');
};

function getDefaultCourseData(currentSession: number) {
	return {
		title: "Foundations of Faith",
		currentSessionData: {
			sessionNumber: currentSession,
			sessionOverview: "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonummy nibh euismod tincidunt ut laoreet dolore magna aliquam erat volutpat. Ut wisi enim ad minim",
			materials: [],
			reflectionQuestion: { id: null, text: "What is the reason you look to God for answers over cultural sources and making prayer central to your life?" },
			reflectionStatus: "not_started"
		}
	};
}
import { error } from '@sveltejs/kit';
import { requireCourseAccess } from '$lib/server/auth.js';
import {
	CourseQueries,
	CourseAggregates,
	groupMaterialsBySession,
	groupQuestionsBySession
} from '$lib/server/course-data.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { isComplete, normalizeStatus } from '$lib/utils/reflection-status.js';
import { getUserInitials } from '$lib/utils/avatar.js';
import { getCourseSettings } from '$lib/types/course-settings.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require user to be enrolled in this course (any role)
	const { user } = await requireCourseAccess(event, courseSlug);

	// Activate any enrollments that haven't been touched by the login flow yet
	supabaseAdmin
		.from('courses_enrollments')
		.update({ status: 'active', last_login_at: new Date().toISOString(), login_count: 1 })
		.eq('user_profile_id', user.id)
		.is('last_login_at', null)
		.then(() => {});

	// Get course ID to read the active cohort cookie
	const { data: course } = await CourseQueries.getCourse(courseSlug);
	const cohortId = course ? event.cookies.get(`active_cohort_${course.id}`) : undefined;

	// Get course settings for feature toggles and coordinator access
	const courseSettings = getCourseSettings(course?.settings);
	const featureSettings = courseSettings.features;
	const coordinatorAccessAhead = courseSettings.coordinatorAccess?.sessionsAhead ?? 'all';

	// Get all dashboard data in one optimized call
	const result = await CourseAggregates.getStudentDashboard(user.id, courseSlug, cohortId);

	if (result.error || !result.data) {
		throw error(500, 'Failed to load dashboard data');
	}

	const { enrollment, sessions, materials, questions, responses, publicReflections, hubData } =
		result.data;

	// Clear stale cohort cookie if it didn't match the actual enrollment
	if (course && cohortId && enrollment.cohort_id !== cohortId) {
		event.cookies.delete(`active_cohort_${course.id}`, { path: '/' });
	}

	// Group data by session
	const materialsBySession = groupMaterialsBySession(materials);
	const questionsBySession = groupQuestionsBySession(questions);

	// Create session lookups
	const sessionsByNumber = sessions.reduce(
		(acc, session) => {
			acc[session.session_number] = session;
			return acc;
		},
		{} as Record<number, any>
	);

	// Process reflection responses for PastReflectionsSection
	const pastReflections = responses.map((response) => {
		const formatDate = (dateString: string) => {
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

		const sessionNumber = response.question?.session?.session_number || 0;
		// Normalize status - default to 'submitted' if null/undefined (consistent with admin parsing)
		const dbStatus = response.status || 'submitted';

		return {
			session: sessionNumber,
			title: `Session ${sessionNumber} Reflection`,
			question: response.question?.question_text || '',
			status: dbStatus === 'passed' ? 'passed' : dbStatus,
			submittedDate: response.created_at ? formatDate(response.created_at) : 'Not submitted',
			response: response.response_text || '',
			feedback: response.feedback || null,
			grade:
				dbStatus === 'passed'
					? 'Pass'
					: dbStatus === 'needs_revision'
						? 'Needs Work'
						: null,
			instructor: response.marked_by_profile?.full_name || null
		};
	});

	// Process public reflections for PublicReflectionsFeed
	const processedPublicReflections = publicReflections.map((response) => {
		const formatDate = (dateString: string) => {
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

		// Strip HTML tags for plain text excerpts (add space to preserve word boundaries)
		const stripHtml = (html: string) => {
			if (!html) return '';
			return html
				.replace(/<[^>]*>/g, ' ')  // Replace tags with space
				.replace(/\s+/g, ' ')       // Collapse multiple spaces
				.trim();
		};

		const truncateContent = (content: string, maxLength = 200) => {
			// Strip HTML first for clean excerpt
			const plainText = stripHtml(content);
			if (!plainText || plainText.length <= maxLength) return plainText;
			return plainText.substring(0, maxLength) + '...';
		};

		const studentName = response.enrollment?.user_profile?.full_name || 'Anonymous';
		const sessionNumber = response.question?.session?.session_number || 0;

		return {
			id: response.id,
			studentName,
			studentInitials: getUserInitials(studentName),
			sessionNumber,
			reflectionExcerpt: truncateContent(response.response_text),
			submittedAt: response.created_at ? formatDate(response.created_at) : 'Unknown',
			question: response.question?.question_text || '',
			response: response.response_text || ''
		};
	});

	// Build current session data
	const currentSession = enrollment.current_session;
	const currentSessionMaterials = materialsBySession[currentSession] || [];
	const currentSessionInfo = sessionsByNumber[currentSession];

	const userRole = enrollment.role || 'student';
	const isStaff = userRole === 'coordinator' || userRole === 'admin';
	const userHubId = enrollment.hub_id;

	const canSeeMaterial = (m: any) => {
		if (m.min_role === 'coordinator' && !isStaff) return false;
		const hubRestrictions = (m.hub_visibility || []) as { hub_id: string }[];
		if (hubRestrictions.length === 0) return true;
		if (!userHubId) return false;
		return hubRestrictions.some((h: { hub_id: string }) => h.hub_id === userHubId);
	};

	const filterMaterials = (materialsList: any[]) => {
		return materialsList
			.filter(canSeeMaterial)
			.map((m) => ({
				id: m.id,
				type: m.type,
				title: m.title,
				content: m.content,
				url: m.content,
				viewable: true,
				coordinatorOnly: m.min_role === 'coordinator',
				isRestricted: m.min_role === 'coordinator' || (m.hub_visibility || []).length > 0,
				restrictionLabel: m.min_role === 'coordinator'
					? 'Coordinator access only'
					: 'Hub-restricted'
			}));
	};

	// Calculate total sessions (excluding pre-start session 0) - needed before currentSessionData
	const regularSessions = sessions.filter(s => s.session_number > 0);
	const totalSessions = regularSessions.length;
	const maxSessionNumber = Math.max(...regularSessions.map(s => s.session_number), 0);

	let currentSessionData;
	if (currentSession === 0) {
		// Week 0 (Pre-start)
		const sessionInfo = sessionsByNumber[0];
		const sessionMaterials = materialsBySession[0] || [];
		const reflectionQuestion = questionsBySession[0] || null;

		// Get reflection status for session 0 (same logic as other sessions)
		let reflectionStatus = null;
		if (reflectionQuestion) {
			const existingResponse = responses.find(
				(r) => r.question?.session?.session_number === 0
			);

			if (!existingResponse) {
				reflectionStatus = 'not_started';
			} else {
				reflectionStatus = existingResponse.status || 'submitted';
			}
		}

		const nextSessionEarlyMaterials0 = filterMaterials(
			(materialsBySession[1] || []).filter((m: any) => m.available_early)
		);
		currentSessionData = {
			sessionNumber: 0,
			sessionTitle: sessionInfo?.title || 'Welcome',
			sessionOverview:
				sessionInfo?.description ||
				`This course begins on ${new Date(enrollment.cohort.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Review the materials below to prepare for Session 1.`,
			materials: filterMaterials(sessionMaterials),
			nextSessionMaterials: nextSessionEarlyMaterials0,
			reflectionQuestion,
			reflectionStatus,
			isUpcoming: true
		};
	} else {
		// Active session
		const reflectionQuestion = questionsBySession[currentSession] || null;

		// Get reflection status for current session (raw database status)
		let reflectionStatus = null;
		if (reflectionQuestion) {
			const existingResponse = responses.find(
				(r) => r.question?.session?.session_number === currentSession
			);

			if (!existingResponse) {
				reflectionStatus = 'not_started';
			} else {
				reflectionStatus = existingResponse.status || 'submitted';
			}
		}

		const nextSessionNum = currentSession + 1;
		const nextSessionEarlyMaterials = nextSessionNum <= maxSessionNumber
			? filterMaterials((materialsBySession[nextSessionNum] || []).filter((m: any) => m.available_early))
			: [];
		currentSessionData = {
			sessionNumber: currentSession,
			sessionTitle: currentSessionInfo?.title || `Session ${currentSession}`,
			sessionOverview:
				currentSessionInfo?.description || `Session ${currentSession} content and materials`,
			materials: filterMaterials(currentSessionMaterials),
			nextSessionMaterials: nextSessionEarlyMaterials,
			reflectionQuestion,
			reflectionStatus,
			isUpcoming: false
		};
	}

	const courseData = {
		title: enrollment.cohort.module.name || 'Foundations of Faith',
		description: enrollment.cohort.module.description || '',
		cohortName: enrollment.cohort.name,
		startDate: enrollment.cohort.start_date,
		endDate: enrollment.cohort.end_date,
		status: enrollment.cohort.status,
		currentSessionData,
		totalSessions,
		maxSessionNumber
	};

	// Format hub data if available
	const cohortCurrentSession = enrollment.cohort.current_session;
	// Check if current session has a reflection question
	const currentSessionHasQuestion = !!questionsBySession[cohortCurrentSession];

	const formattedHubData = hubData
		? {
				hubName: hubData.hub.name,
				hubLocation: hubData.hub.location,
				coordinatorName: enrollment.user_profile?.full_name || enrollment.full_name,
				currentSession: cohortCurrentSession,
				students: hubData.students.map((student) => {
					// If no reflection question for this session, show null
					if (!currentSessionHasQuestion) {
						return {
							id: student.id,
							name: student.user_profile?.full_name || student.full_name || student.email,
							email: student.email,
							currentSession: student.current_session,
							reflectionStatus: null, // No reflection required for this session
							attendanceStatus: null
						};
					}

					// Find reflection response for cohort's current session
					const studentResponses = student.courses_reflection_responses || [];
					const currentSessionResponse = studentResponses.find(
						(r: any) => r.question?.session?.session_number === cohortCurrentSession
					);

					// Get raw database status (utility handles display)
					let reflectionStatus: string | null = 'not_started';
					if (currentSessionResponse) {
						reflectionStatus = currentSessionResponse.status || 'submitted';
					}

					return {
						id: student.id,
						name: student.user_profile?.full_name || student.full_name || student.email,
						email: student.email,
						currentSession: student.current_session,
						reflectionStatus,
						attendanceStatus: null // TODO: fetch from attendance
					};
				})
			}
		: null;

	// Load quiz data for all sessions: quizzesBySession[sessionNumber] = { id, mode, title, question_count, latestAttempt }
	const sessionIds = sessions.map(s => s.id);
	let quizzesBySession: Record<number, any> = {};
	if (featureSettings?.quizzesEnabled !== false && sessionIds.length > 0) {
		const { data: quizzes } = await supabaseAdmin
			.from('courses_quizzes')
			.select('id, session_id, mode, title, require_pass_to_advance, allow_retakes, max_attempts, pass_threshold')
			.in('session_id', sessionIds)
			.eq('published', true);

		if (quizzes && quizzes.length > 0) {
			const quizIds = quizzes.map(q => q.id);

			// Get all attempts for this enrollment
			const { data: attempts } = await supabaseAdmin
				.from('courses_quiz_attempts')
				.select('id, quiz_id, attempt_number, status, score, overall_feedback, submitted_at, marked_at')
				.eq('enrollment_id', enrollment.id)
				.in('quiz_id', quizIds)
				.order('attempt_number', { ascending: false });

			// Get question counts
			const { data: questionCounts } = await supabaseAdmin
				.from('courses_quiz_questions')
				.select('quiz_id')
				.in('quiz_id', quizIds);

			const countByQuiz: Record<string, number> = {};
			for (const qc of questionCounts ?? []) {
				countByQuiz[qc.quiz_id] = (countByQuiz[qc.quiz_id] ?? 0) + 1;
			}

			// Group attempts by quiz_id (already sorted desc by attempt_number)
			const attemptsByQuiz: Record<string, any[]> = {};
			for (const a of attempts ?? []) {
				if (!attemptsByQuiz[a.quiz_id]) attemptsByQuiz[a.quiz_id] = [];
				attemptsByQuiz[a.quiz_id].push(a);
			}

			// Build quizzesBySession
			for (const quiz of quizzes) {
				const session = sessions.find(s => s.id === quiz.session_id);
				if (!session) continue;
				const quizAttempts = attemptsByQuiz[quiz.id] ?? [];
				const latestAttempt = quizAttempts[0] ?? null;
				quizzesBySession[session.session_number] = {
					id: quiz.id,
					mode: quiz.mode,
					title: quiz.title,
					require_pass_to_advance: quiz.require_pass_to_advance,
					allow_retakes: quiz.allow_retakes,
					max_attempts: quiz.max_attempts,
					pass_threshold: quiz.pass_threshold,
					question_count: countByQuiz[quiz.id] ?? 0,
					latestAttempt,
					allAttempts: quizAttempts
				};
			}
		}
	}

	const filteredMaterialsBySession = Object.fromEntries(
		Object.entries(materialsBySession).map(([sessionNum, mats]) => [
			sessionNum,
			(mats as any[]).filter(canSeeMaterial)
		])
	);

	// Calculate available sessions based on role and coordinator access settings
	// - Students: only up to their current_session
	// - Coordinators: based on settings (all or N sessions ahead)
	// - Admins: all sessions
	let availableSessions: number;
	if (userRole === 'admin') {
		availableSessions = maxSessionNumber;
	} else if (userRole === 'coordinator') {
		if (coordinatorAccessAhead === 'all') {
			availableSessions = maxSessionNumber;
		} else {
			availableSessions = Math.min(currentSession + coordinatorAccessAhead, maxSessionNumber);
		}
	} else {
		availableSessions = currentSession;

		// Quiz gating: if a session has a quiz with require_pass_to_advance = true
		// and the participant hasn't passed it, cap availableSessions at that session.
		// Check sessions 1..currentSession in order; the first unblocked session caps the advance.
		for (let s = 1; s <= currentSession; s++) {
			const quizForSession = quizzesBySession[s];
			if (quizForSession?.require_pass_to_advance) {
				const hasPassed = quizForSession.allAttempts?.some((a: any) => a.status === 'passed');
				if (!hasPassed) {
					// Participant is blocked from advancing beyond session s
					availableSessions = Math.min(availableSessions, s);
					break;
				}
			}
		}
	}

	return {
		materials: materials.filter(canSeeMaterial),
		materialsBySession: filteredMaterialsBySession,
		currentSession,
		availableSessions,
		courseData,
		questionsBySession,
		sessionsByNumber,
		pastReflections,
		publicReflections: processedPublicReflections,
		currentUserId: user.id,
		courseSlug,
		hubData: formattedHubData,
		totalSessions,
		maxSessionNumber,
		featureSettings,
		quizzesBySession
	};
};

import { error } from '@sveltejs/kit';
import { requireCourseAccess } from '$lib/server/auth.js';
import {
	CourseAggregates,
	groupMaterialsBySession,
	groupQuestionsBySession
} from '$lib/server/course-data.js';
import { isComplete, normalizeStatus } from '$lib/utils/reflection-status.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const courseSlug = event.params.slug;

	// Require user to be enrolled in this course (any role)
	const { user } = await requireCourseAccess(event, courseSlug);

	// Get all dashboard data in one optimized call
	const result = await CourseAggregates.getStudentDashboard(user.id, courseSlug);

	if (result.error || !result.data) {
		throw error(500, 'Failed to load dashboard data');
	}

	const { enrollment, sessions, materials, questions, responses, publicReflections, hubData } =
		result.data;

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

		const getInitials = (fullName?: string) => {
			if (!fullName) return 'AN';
			return fullName
				.split(' ')
				.map((n) => n[0])
				.join('')
				.toUpperCase()
				.slice(0, 2);
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
			studentInitials: getInitials(studentName),
			cohortName: enrollment.cohort.module.name || 'Unknown Module',
			sessionNumber,
			reflectionExcerpt: truncateContent(response.response_text),
			submittedAt: response.created_at ? formatDate(response.created_at) : 'Unknown',
			likes: 0,
			comments: 0,
			question: response.question?.question_text || '',
			response: response.response_text || '',
			status: response.status || 'submitted'
		};
	});

	// Build current session data
	const currentSession = enrollment.current_session;
	const currentSessionMaterials = materialsBySession[currentSession] || [];
	const currentSessionInfo = sessionsByNumber[currentSession];

	// Check if user can see coordinator-only materials
	const userRole = enrollment.role || 'student';
	const canSeeCoordinatorMaterials = userRole === 'coordinator' || userRole === 'admin';

	// Filter materials based on coordinator_only flag and user role
	const filterMaterials = (materialsList: any[]) => {
		return materialsList
			.filter((m) => !m.coordinator_only || canSeeCoordinatorMaterials)
			.map((m) => ({
				id: m.id,
				type: m.type,
				title: m.title,
				content: m.content,
				url: m.content,
				viewable: true
			}));
	};

	let currentSessionData;
	if (currentSession === 0) {
		// Week 0 (Pre-start)
		const sessionInfo = sessionsByNumber[0];
		const sessionMaterials = materialsBySession[0] || [];

		currentSessionData = {
			sessionNumber: 0,
			sessionTitle: sessionInfo?.title || 'Welcome',
			sessionOverview:
				sessionInfo?.description ||
				`This course begins on ${new Date(enrollment.cohort.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Review the materials below to prepare for Session 1.`,
			materials: filterMaterials(sessionMaterials),
			reflectionQuestion: null,
			reflectionStatus: null,
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

		currentSessionData = {
			sessionNumber: currentSession,
			sessionTitle: currentSessionInfo?.title || `Session ${currentSession}`,
			sessionOverview:
				currentSessionInfo?.description || `Session ${currentSession} content and materials`,
			materials: filterMaterials(currentSessionMaterials),
			reflectionQuestion,
			reflectionStatus,
			isUpcoming: false
		};
	}

	// Calculate total sessions (excluding pre-start session 0)
	const regularSessions = sessions.filter(s => s.session_number > 0);
	const totalSessions = regularSessions.length;
	const maxSessionNumber = Math.max(...regularSessions.map(s => s.session_number), 0);

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

	// Filter materialsBySession for coordinator-only materials
	const filteredMaterialsBySession = Object.fromEntries(
		Object.entries(materialsBySession).map(([sessionNum, mats]) => [
			sessionNum,
			(mats as any[]).filter((m) => !m.coordinator_only || canSeeCoordinatorMaterials)
		])
	);

	return {
		materials: materials.filter((m) => !m.coordinator_only || canSeeCoordinatorMaterials),
		materialsBySession: filteredMaterialsBySession,
		currentSession,
		courseData,
		questionsBySession,
		sessionsByNumber,
		pastReflections,
		publicReflections: processedPublicReflections,
		currentUserId: user.id,
		courseSlug,
		hubData: formattedHubData,
		totalSessions,
		maxSessionNumber
	};
};

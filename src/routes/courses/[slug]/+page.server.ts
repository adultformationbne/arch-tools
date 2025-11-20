import { error } from '@sveltejs/kit';
import { requireCourseAccess } from '$lib/server/auth.js';
import {
	CourseAggregates,
	groupMaterialsBySession,
	groupQuestionsBySession
} from '$lib/server/course-data.js';
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

		return {
			session: sessionNumber,
			title: `Session ${sessionNumber} Reflection`,
			question: response.question?.question_text || '',
			status: response.status === 'passed' ? 'graded' : response.status,
			submittedDate: response.created_at ? formatDate(response.created_at) : 'Not submitted',
			response: response.response_text || '',
			feedback: response.feedback || null,
			grade:
				response.status === 'passed'
					? 'Pass'
					: response.status === 'needs_revision'
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

		const truncateContent = (content: string, maxLength = 200) => {
			if (!content || content.length <= maxLength) return content;
			return content.substring(0, maxLength) + '...';
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
			materials: sessionMaterials.map((m) => ({
				id: m.id,
				type: m.type,
				title: m.title,
				content: m.content,
				url: m.content,
				viewable: true
			})),
			reflectionQuestion: null,
			reflectionStatus: null,
			isUpcoming: true
		};
	} else {
		// Active session
		const reflectionQuestion = questionsBySession[currentSession] || null;

		// Get reflection status for current session
		let reflectionStatus = null;
		if (reflectionQuestion) {
			const existingResponse = responsesWithSessionNum.find(
				(r) => r.session_number === currentSession
			);
			reflectionStatus = existingResponse ? existingResponse.status : 'not_started';
		}

		currentSessionData = {
			sessionNumber: currentSession,
			sessionTitle: currentSessionInfo?.title || `Session ${currentSession}`,
			sessionOverview:
				currentSessionInfo?.description || `Session ${currentSession} content and materials`,
			materials: currentSessionMaterials.map((m) => ({
				id: m.id,
				type: m.type,
				title: m.title,
				content: m.content,
				url: m.content,
				viewable: true
			})),
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
		currentSessionData
	};

	// Format hub data if available
	const formattedHubData = hubData
		? {
				hubName: hubData.hub.name,
				hubLocation: hubData.hub.location,
				coordinatorName: enrollment.user_profile?.full_name || enrollment.full_name,
				currentSession: enrollment.cohort.current_session,
				students: hubData.students.map((student) => ({
					id: student.id,
					name: student.user_profile?.full_name || student.full_name || student.email,
					email: student.email,
					currentSession: student.current_session,
					reflectionStatus: 'not_started', // TODO: fetch from responses
					attendanceStatus: null // TODO: fetch from attendance
				}))
			}
		: null;

	return {
		materials,
		materialsBySession,
		currentSession,
		courseData,
		questionsBySession,
		sessionsByNumber,
		pastReflections,
		publicReflections: processedPublicReflections,
		currentUserId: user.id,
		courseSlug,
		hubData: formattedHubData
	};
};

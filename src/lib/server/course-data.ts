/**
 * Course Data Repository
 *
 * Centralized data access layer for all course-related database operations.
 * Provides consistent, type-safe interfaces for both read and write operations.
 *
 * Architecture:
 * - Layer 1: Core Queries - Raw database operations
 * - Layer 2: Aggregates - Combined queries with business logic
 * - Layer 3: Mutations - Write operations
 */

import { supabaseAdmin } from './supabase.js';
import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Helper type for query results
 */
type QueryResult<T> = {
	data: T | null;
	error: PostgrestError | null;
};

// ============================================================================
// LAYER 1: CORE QUERIES (Read Operations)
// ============================================================================

/**
 * Core read operations - return raw database records
 */
export const CourseQueries = {
	/**
	 * Get course by slug
	 */
	async getCourse(slug: string) {
		return supabaseAdmin
			.from('courses')
			.select('*')
			.eq('slug', slug)
			.single();
	},

	/**
	 * Get user enrollment for a specific course (via cohort join)
	 */
	async getEnrollment(userId: string, courseSlug: string) {
		return supabaseAdmin
			.from('courses_enrollments')
			.select(`
				*,
				cohort:cohort_id (
					*,
					module:module_id (
						*,
						course:course_id (
							id,
							slug
						)
					)
				),
				hub:hub_id (*),
				user_profile:user_profile_id (*)
			`)
			.eq('user_profile_id', userId)
			.eq('cohort.module.course.slug', courseSlug)
			.single();
	},

	/**
	 * Get all enrollments for a user
	 */
	async getUserEnrollments(userId: string) {
		return supabaseAdmin
			.from('courses_enrollments')
			.select(`
				*,
				cohort:cohort_id (
					*,
					module:module_id (
						*,
						course:course_id (*)
					)
				)
			`)
			.eq('user_profile_id', userId);
	},

	/**
	 * Get modules for a course
	 */
	async getModules(courseId: string) {
		return supabaseAdmin
			.from('courses_modules')
			.select('*')
			.eq('course_id', courseId)
			.order('order_number', { ascending: true });
	},

	/**
	 * Get cohorts for a course (via modules)
	 */
	async getCohorts(courseId: string) {
		return supabaseAdmin
			.from('courses_cohorts')
			.select(`
				*,
				module:module_id (
					id,
					name,
					description,
					course_id
				)
			`)
			.eq('module.course_id', courseId)
			.order('start_date', { ascending: false });
	},

	/**
	 * Get sessions for a module
	 */
	async getSessions(moduleId: string) {
		return supabaseAdmin
			.from('courses_sessions')
			.select('*')
			.eq('module_id', moduleId)
			.order('session_number', { ascending: true });
	},

	/**
	 * Get materials for specific sessions
	 */
	async getMaterials(sessionIds: string[]) {
		if (sessionIds.length === 0) {
			return { data: [], error: null };
		}

		return supabaseAdmin
			.from('courses_materials')
			.select(`
				*,
				session:session_id (
					id,
					session_number,
					module_id,
					title
				)
			`)
			.in('session_id', sessionIds)
			.order('display_order', { ascending: true });
	},

	/**
	 * Get reflection questions for specific sessions
	 */
	async getReflectionQuestions(sessionIds: string[]) {
		if (sessionIds.length === 0) {
			return { data: [], error: null };
		}

		return supabaseAdmin
			.from('courses_reflection_questions')
			.select(`
				*,
				session:session_id (
					id,
					session_number,
					module_id,
					reflections_enabled
				)
			`)
			.in('session_id', sessionIds);
	},

	/**
	 * Get reflection responses for an enrollment
	 * Now includes session_number via join (no longer stored in table)
	 */
	async getReflectionResponses(enrollmentId: string) {
		return supabaseAdmin
			.from('courses_reflection_responses')
			.select(`
				*,
				question:question_id (
					id,
					question_text,
					session:session_id (
						id,
						session_number,
						module_id
					)
				),
				marked_by_profile:marked_by (
					full_name
				)
			`)
			.eq('enrollment_id', enrollmentId)
			.order('created_at', { ascending: false });
	},

	/**
	 * Get public reflections for a cohort
	 */
	async getPublicReflections(cohortId: string, excludeEnrollmentId?: string) {
		let query = supabaseAdmin
			.from('courses_reflection_responses')
			.select(`
				*,
				question:question_id (
					id,
					question_text,
					session:session_id (
						id,
						session_number
					)
				),
				enrollment:enrollment_id (
					id,
					user_profile:user_profile_id (
						full_name
					)
				)
			`)
			.eq('cohort_id', cohortId)
			.eq('is_public', true)
			.order('created_at', { ascending: false })
			.limit(20);

		if (excludeEnrollmentId) {
			query = query.neq('enrollment_id', excludeEnrollmentId);
		}

		return query;
	},

	/**
	 * Get attendance records for an enrollment
	 */
	async getAttendance(enrollmentId: string) {
		return supabaseAdmin
			.from('courses_attendance')
			.select('*')
			.eq('enrollment_id', enrollmentId)
			.order('session_number', { ascending: true });
	},

	/**
	 * Get hub data for a coordinator
	 */
	async getHubData(hubId: string, cohortId: string) {
		// Get hub details
		const hubQuery = supabaseAdmin
			.from('courses_hubs')
			.select('id, name, location')
			.eq('id', hubId)
			.single();

		// Get students in the hub
		const studentsQuery = supabaseAdmin
			.from('courses_enrollments')
			.select(`
				id,
				full_name,
				email,
				current_session,
				user_profile_id,
				user_profile:user_profile_id (
					full_name,
					email
				)
			`)
			.eq('hub_id', hubId)
			.eq('cohort_id', cohortId)
			.eq('role', 'student')
			.order('full_name');

		// Execute in parallel
		const [hub, students] = await Promise.all([hubQuery, studentsQuery]);

		return {
			hub: hub.data,
			students: students.data || [],
			error: hub.error || students.error
		};
	}
};

// ============================================================================
// LAYER 2: AGGREGATES (Business Logic)
// ============================================================================

/**
 * Higher-level functions that combine multiple queries
 */
export const CourseAggregates = {
	/**
	 * Get complete student dashboard data
	 * Optimized with parallel queries
	 */
	async getStudentDashboard(userId: string, courseSlug: string) {
		// Step 1: Get enrollment (must be first to get cohort/module info)
		const { data: enrollment, error: enrollmentError } = await CourseQueries.getEnrollment(
			userId,
			courseSlug
		);

		if (enrollmentError || !enrollment) {
			return { data: null, error: enrollmentError || new Error('Enrollment not found') };
		}

		const moduleId = enrollment.cohort.module.id;
		const cohortId = enrollment.cohort_id;
		const enrollmentId = enrollment.id;

		// Step 2: Get sessions for the module
		const { data: sessions, error: sessionsError } = await CourseQueries.getSessions(moduleId);

		if (sessionsError || !sessions) {
			return { data: null, error: sessionsError };
		}

		const sessionIds = sessions.map((s) => s.id);

		// Step 3: Parallel fetch all session-related data
		const [materials, questions, responses, publicReflections, hubDataResult] =
			await Promise.all([
				CourseQueries.getMaterials(sessionIds),
				CourseQueries.getReflectionQuestions(sessionIds),
				CourseQueries.getReflectionResponses(enrollmentId),
				CourseQueries.getPublicReflections(cohortId, enrollmentId),
				enrollment.role === 'coordinator' && enrollment.hub_id
					? CourseQueries.getHubData(enrollment.hub_id, cohortId)
					: Promise.resolve({ hub: null, students: [], error: null })
			]);

		// Combine results
		return {
			data: {
				enrollment,
				sessions: sessions || [],
				materials: materials.data || [],
				questions: questions.data || [],
				responses: responses.data || [],
				publicReflections: publicReflections.data || [],
				hubData:
					hubDataResult.hub && !hubDataResult.error
						? {
								hub: hubDataResult.hub,
								students: hubDataResult.students
							}
						: null
			},
			error: null
		};
	},

	/**
	 * Get admin course overview data
	 * Returns modules and cohorts for admin dashboard
	 */
	async getAdminCourseData(courseId: string) {
		// Parallel fetch modules and cohorts
		const [modulesResult, cohortsResult] = await Promise.all([
			CourseQueries.getModules(courseId),
			CourseQueries.getCohorts(courseId)
		]);

		// Flatten cohorts and attach module info
		const cohorts = (cohortsResult.data || []).map((cohort) => ({
			...cohort,
			courses_modules: cohort.module
		}));

		return {
			data: {
				modules: modulesResult.data || [],
				cohorts: cohorts
			},
			error: modulesResult.error || cohortsResult.error
		};
	},

	/**
	 * Get session materials grouped by session number
	 * Used by admin sessions editor
	 */
	async getSessionData(moduleId: string) {
		const [sessionsResult, materialsResult, questionsResult] = await Promise.all([
			CourseQueries.getSessions(moduleId),
			CourseQueries.getMaterials([moduleId]), // Will need session IDs
			CourseQueries.getReflectionQuestions([moduleId]) // Will need session IDs
		]);

		// Note: This needs session IDs first, so we need a two-step process
		const sessions = sessionsResult.data || [];
		const sessionIds = sessions.map((s) => s.id);

		if (sessionIds.length === 0) {
			return {
				data: { sessions: [], materials: [], questions: [] },
				error: null
			};
		}

		// Now fetch materials and questions with actual session IDs
		const [materials, questions] = await Promise.all([
			CourseQueries.getMaterials(sessionIds),
			CourseQueries.getReflectionQuestions(sessionIds)
		]);

		return {
			data: {
				sessions,
				materials: materials.data || [],
				questions: questions.data || []
			},
			error: sessionsResult.error || materials.error || questions.error
		};
	},

	/**
	 * Get student reflections page data
	 * Optimized for reflections view with all necessary data
	 */
	async getReflectionsPage(userId: string, courseSlug: string) {
		// Step 1: Get enrollment
		const { data: enrollment, error: enrollmentError } = await CourseQueries.getEnrollment(
			userId,
			courseSlug
		);

		if (enrollmentError || !enrollment) {
			return { data: null, error: enrollmentError || new Error('Enrollment not found') };
		}

		const moduleId = enrollment.cohort.module.id;
		const cohortId = enrollment.cohort_id;
		const enrollmentId = enrollment.id;

		// Step 2: Get sessions
		const { data: sessions, error: sessionsError } = await CourseQueries.getSessions(moduleId);

		if (sessionsError || !sessions) {
			return { data: null, error: sessionsError };
		}

		const sessionIds = sessions.map((s) => s.id);

		// Step 3: Parallel fetch reflection-specific data
		const [questions, responses, publicReflections] = await Promise.all([
			CourseQueries.getReflectionQuestions(sessionIds),
			CourseQueries.getReflectionResponses(enrollmentId),
			CourseQueries.getPublicReflections(cohortId, enrollmentId)
		]);

		return {
			data: {
				enrollment,
				sessions: sessions || [],
				questions: questions.data || [],
				responses: responses.data || [],
				publicReflections: publicReflections.data || []
			},
			error: null
		};
	},

	/**
	 * Get admin reflections data
	 * For admin reflections management page
	 */
	async getAdminReflections(courseId: string, cohortIds?: string[]) {
		// Get all cohorts for the course
		const { data: cohorts, error: cohortsError } = await CourseQueries.getCohorts(courseId);

		if (cohortsError || !cohorts) {
			return { data: null, error: cohortsError };
		}

		// Filter cohorts if specific ones requested
		const targetCohorts = cohortIds
			? cohorts.filter((c) => cohortIds.includes(c.id))
			: cohorts;

		// Get all reflection responses for these cohorts
		const reflectionsPromises = targetCohorts.map((cohort) =>
			supabaseAdmin
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
					)
				`
				)
				.eq('cohort_id', cohort.id)
				.order('created_at', { ascending: false })
		);

		const reflectionsResults = await Promise.all(reflectionsPromises);

		// Combine all reflections
		const allReflections = reflectionsResults.flatMap((result) => result.data || []);

		return {
			data: {
				cohorts: targetCohorts,
				reflections: allReflections
			},
			error: null
		};
	},

	/**
	 * Get attendance grid data
	 * For admin and coordinator attendance management
	 */
	async getAttendanceGrid(cohortId: string) {
		// Get cohort details with module info
		const { data: cohort, error: cohortError } = await supabaseAdmin
			.from('courses_cohorts')
			.select(
				`
				*,
				module:module_id (
					id,
					name,
					description
				)
			`
			)
			.eq('id', cohortId)
			.single();

		if (cohortError || !cohort) {
			return { data: null, error: cohortError };
		}

		const moduleId = cohort.module.id;

		// Parallel fetch: enrollments, sessions, attendance records, hubs
		const [enrollments, sessions, attendance, hubs] = await Promise.all([
			supabaseAdmin
				.from('courses_enrollments')
				.select(
					`
					id,
					user_profile_id,
					full_name,
					email,
					role,
					hub_id,
					current_session,
					user_profile:user_profile_id (
						full_name,
						email
					)
				`
				)
				.eq('cohort_id', cohortId)
				.order('full_name', { ascending: true }),

			CourseQueries.getSessions(moduleId),

			supabaseAdmin
				.from('courses_attendance')
				.select('*')
				.eq('cohort_id', cohortId)
				.order('session_number', { ascending: true }),

			supabaseAdmin.from('courses_hubs').select('id, name, location').eq('cohort_id', cohortId)
		]);

		// Build attendance map for quick lookup
		const attendanceMap: Record<string, Record<number, boolean>> = {};
		(attendance.data || []).forEach((record) => {
			if (!attendanceMap[record.enrollment_id]) {
				attendanceMap[record.enrollment_id] = {};
			}
			attendanceMap[record.enrollment_id][record.session_number] = record.present;
		});

		return {
			data: {
				cohort,
				enrollments: enrollments.data || [],
				sessions: sessions.data || [],
				attendanceMap,
				hubs: hubs.data || []
			},
			error: enrollments.error || sessions.error || attendance.error || hubs.error
		};
	}
};

// ============================================================================
// LAYER 3: MUTATIONS (Write Operations)
// ============================================================================

/**
 * Write operations with validation
 */
export const CourseMutations = {
	/**
	 * Submit or update a reflection response
	 */
	async submitReflection(params: {
		enrollmentId: string;
		cohortId: string;
		questionId: string;
		content: string;
		isPublic?: boolean;
		status?: 'draft' | 'submitted';
	}) {
		return supabaseAdmin
			.from('courses_reflection_responses')
			.upsert(
				{
					enrollment_id: params.enrollmentId,
					cohort_id: params.cohortId,
					question_id: params.questionId,
					response_text: params.content,
					is_public: params.isPublic || false,
					status: params.status || 'submitted',
					updated_at: new Date().toISOString()
				},
				{
					onConflict: 'enrollment_id,question_id'
				}
			)
			.select()
			.single();
	},

	/**
	 * Mark a reflection (admin only)
	 */
	async markReflection(
		reflectionId: string,
		grade: 'pass' | 'fail',
		feedback: string,
		markedBy: string
	) {
		return supabaseAdmin
			.from('courses_reflection_responses')
			.update({
				status: grade === 'pass' ? 'passed' : 'needs_revision',
				feedback,
				marked_at: new Date().toISOString(),
				marked_by: markedBy,
				updated_at: new Date().toISOString()
			})
			.eq('id', reflectionId)
			.select()
			.single();
	},

	/**
	 * Mark attendance (admin or coordinator)
	 */
	async markAttendance(params: {
		enrollmentId: string;
		cohortId: string;
		sessionNumber: number;
		present: boolean;
		markedBy: string;
	}) {
		return supabaseAdmin
			.from('courses_attendance')
			.upsert(
				{
					enrollment_id: params.enrollmentId,
					cohort_id: params.cohortId,
					session_number: params.sessionNumber,
					present: params.present,
					marked_by: params.markedBy,
					attendance_type: 'flagship',
					updated_at: new Date().toISOString()
				},
				{
					onConflict: 'enrollment_id,cohort_id,session_number'
				}
			);
	}
};

// ============================================================================
// DATA TRANSFORMERS (View Layer Adapters)
// ============================================================================

/**
 * Transform database response to include computed session_number
 * for backward compatibility with existing UI components
 */
export function addSessionNumber(reflection: any) {
	if (!reflection) return null;

	return {
		...reflection,
		// Add computed session_number from joined data
		session_number: reflection.question?.session?.session_number || 0
	};
}

/**
 * Transform array of reflections to add session numbers
 */
export function addSessionNumbers(reflections: any[]) {
	return reflections.map(addSessionNumber);
}

/**
 * Group materials by session number
 */
export function groupMaterialsBySession(materials: any[]) {
	const grouped: Record<number, any[]> = {};

	materials.forEach((material) => {
		const sessionNumber = material.session?.session_number;
		if (sessionNumber !== undefined) {
			if (!grouped[sessionNumber]) {
				grouped[sessionNumber] = [];
			}
			grouped[sessionNumber].push(material);
		}
	});

	return grouped;
}

/**
 * Group questions by session number
 */
export function groupQuestionsBySession(questions: any[]) {
	const grouped: Record<number, any> = {};

	questions.forEach((question) => {
		const sessionNumber = question.session?.session_number;
		if (sessionNumber !== undefined && question.session?.reflections_enabled !== false) {
			grouped[sessionNumber] = {
				id: question.id,
				text: question.question_text,
				sessionId: question.session.id
			};
		}
	});

	return grouped;
}

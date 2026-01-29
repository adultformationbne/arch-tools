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
	 * If cohortId is provided, returns that specific enrollment
	 * Otherwise, if user has multiple enrollments (different cohorts), returns the most recent one
	 */
	async getEnrollment(userId: string, courseSlug: string, cohortId?: string) {
		let query = supabaseAdmin
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
			.in('status', ['active', 'invited', 'accepted']);

		// If specific cohort requested, filter by it
		if (cohortId) {
			query = query.eq('cohort_id', cohortId);
		}

		const { data, error } = await query
			.order('created_at', { ascending: false })
			.limit(1);

		// Return in same format as .single() for compatibility
		return {
			data: data && data.length > 0 ? data[0] : null,
			error
		};
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
	 * Get user enrollments with full course details
	 * Optimized for course listing page
	 */
	async getUserEnrollmentsWithCourses(userId: string) {
		return supabaseAdmin
			.from('courses_enrollments')
			.select(`
				id,
				cohort_id,
				cohort:cohort_id (
					id,
					name,
					module:module_id (
						id,
						name,
						course:course_id (
							id,
							name,
							short_name,
							slug,
							description,
							settings
						)
					)
				)
			`)
			.eq('user_profile_id', userId)
			.in('status', ['active', 'invited', 'accepted']);
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
	 * @param includeArchived - Include archived cohorts (default: false)
	 */
	async getCohorts(courseId: string, includeArchived = false) {
		let query = supabaseAdmin
			.from('courses_cohorts')
			.select(`
				*,
				module:module_id!inner (
					id,
					name,
					description,
					course_id
				)
			`)
			.eq('module.course_id', courseId);

		if (!includeArchived) {
			query = query.neq('status', 'archived');
		}

		return query.order('start_date', { ascending: false });
	},

	/**
	 * Get hubs for a course
	 */
	async getHubs(courseId: string) {
		return supabaseAdmin
			.from('courses_hubs')
			.select('id, name, location')
			.eq('course_id', courseId)
			.order('name');
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
	async getPublicReflections(cohortId: string) {
		return supabaseAdmin
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
			.eq('status', 'passed')
			.order('created_at', { ascending: false })
			.limit(20);
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

		// Get students in the hub with their reflection responses
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
				),
				courses_reflection_responses (
					id,
					status,
					question:question_id (
						id,
						session:session_id (
							session_number
						)
					)
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
	},

	/**
	 * Get enrollments for a cohort (with optional filtering)
	 */
	async getEnrollments(cohortId?: string) {
		let query = supabaseAdmin
			.from('courses_enrollments')
			.select(`
				*,
				courses_cohorts(name, start_date, current_session),
				courses_hubs(name),
				user_profile:user_profile_id(phone, parish_community, parish_role, address)
			`)
			.order('created_at', { ascending: false });

		if (cohortId) {
			query = query.eq('cohort_id', cohortId);
		}

		return query;
	},

	/**
	 * Get attendance records for a cohort
	 */
	async getAttendanceRecords(cohortId: string) {
		return supabaseAdmin
			.from('courses_attendance')
			.select('enrollment_id, session_number, present')
			.eq('cohort_id', cohortId)
			.order('session_number', { ascending: true });
	},

	/**
	 * Get reflection responses for a cohort
	 */
	async getReflectionResponsesForCohort(cohortId: string) {
		return supabaseAdmin
			.from('courses_reflection_responses')
			.select(`
				enrollment_id,
				status,
				marked_at,
				created_at,
				feedback,
				enrollment:enrollment_id (
					user_profile_id
				),
				question:question_id (
					id,
					session:session_id (
						id,
						session_number
					)
				)
			`)
			.eq('cohort_id', cohortId)
			.order('created_at', { ascending: true });
	},

	/**
	 * Get session numbers that have reflection questions for a module
	 */
	async getSessionsWithReflectionQuestions(moduleId: string) {
		const { data, error } = await supabaseAdmin
			.from('courses_sessions')
			.select(`
				session_number,
				courses_reflection_questions!inner (id)
			`)
			.eq('module_id', moduleId)
			.order('session_number', { ascending: true });

		if (error) {
			return { data: [], error };
		}

		// Extract just the session numbers
		const sessionNumbers = (data || []).map((s) => s.session_number);
		return { data: sessionNumbers, error: null };
	},

	/**
	 * Get recent activity for a cohort (last 7 days)
	 */
	async getRecentActivity(cohortId: string) {
		const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

		return supabaseAdmin
			.from('courses_activity_log')
			.select('*')
			.eq('cohort_id', cohortId)
			.gte('created_at', sevenDaysAgo)
			.order('created_at', { ascending: false })
			.limit(20);
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
	 * @param cohortId - Optional cohort ID to select a specific enrollment
	 */
	async getStudentDashboard(userId: string, courseSlug: string, selectedCohortId?: string) {
		// Step 1: Get enrollment (must be first to get cohort/module info)
		const { data: enrollment, error: enrollmentError } = await CourseQueries.getEnrollment(
			userId,
			courseSlug,
			selectedCohortId
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
				CourseQueries.getPublicReflections(cohortId),
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
		// Parallel fetch modules, cohorts, and session counts
		const [modulesResult, cohortsResult] = await Promise.all([
			CourseQueries.getModules(courseId),
			CourseQueries.getCohorts(courseId)
		]);

		const modules = modulesResult.data || [];
		const moduleIds = modules.map((m) => m.id);

		// Get session counts for each module to compute total_sessions
		let sessionCountMap = new Map<string, number>();
		if (moduleIds.length > 0) {
			const { data: sessionCounts } = await supabaseAdmin
				.from('courses_sessions')
				.select('module_id')
				.in('module_id', moduleIds);

			sessionCounts?.forEach((s) => {
				sessionCountMap.set(s.module_id, (sessionCountMap.get(s.module_id) || 0) + 1);
			});
		}

		// Flatten cohorts and attach module info + total_sessions
		// Provide both 'modules' and 'courses_modules' for compatibility
		const cohorts = (cohortsResult.data || []).map((cohort) => ({
			...cohort,
			courses_modules: cohort.module,
			modules: cohort.module, // Alias for attendance page compatibility
			total_sessions: sessionCountMap.get(cohort.module_id) || 0
		}));

		return {
			data: {
				modules: modules,
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
	 * @param selectedCohortId - Optional cohort ID to select a specific enrollment
	 */
	async getReflectionsPage(userId: string, courseSlug: string, selectedCohortId?: string) {
		// Step 1: Get enrollment
		const { data: enrollment, error: enrollmentError } = await CourseQueries.getEnrollment(
			userId,
			courseSlug,
			selectedCohortId
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
					),
					reviewing_by_profile:reviewing_by (
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
		// Get cohort details with module and course info
		const { data: cohort, error: cohortError } = await supabaseAdmin
			.from('courses_cohorts')
			.select(
				`
				*,
				module:module_id (
					id,
					name,
					description,
					course:course_id (
						id
					)
				)
			`
			)
			.eq('id', cohortId)
			.single();

		if (cohortError || !cohort) {
			return { data: null, error: cohortError };
		}

		const moduleId = cohort.module.id;
		const courseId = cohort.module.course.id;

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

			supabaseAdmin.from('courses_hubs').select('id, name, location').eq('course_id', courseId)
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
// PLATFORM AGGREGATES (Cross-Course Operations)
// ============================================================================

/**
 * Platform-wide aggregates for admin operations
 */
export const PlatformAggregates = {
	/**
	 * Get all platform data for admin settings page
	 * Optimized with parallel queries
	 */
	async getAdminSettings() {
		// Parallel fetch all platform data
		const [users, enrollments, courses, cohorts] = await Promise.all([
			supabaseAdmin
				.from('user_profiles')
				.select('*')
				.order('created_at', { ascending: false }),

			supabaseAdmin
				.from('courses_enrollments')
				.select(`
					id,
					user_profile_id,
					role,
					cohort:cohort_id (
						id,
						name,
						module:module_id (
							id,
							name,
							course:course_id (
								id,
								name,
								slug
							)
						)
					)
				`)
				.order('created_at', { ascending: false }),

			supabaseAdmin.from('courses').select('id, name, slug').order('name'),

			supabaseAdmin
				.from('courses_cohorts')
				.select(`
					id,
					name,
					module:module_id (
						id,
						name,
						course:course_id (
							id,
							name,
							slug
						)
					)
				`)
				.order('name')
		]);

		return {
			data: {
				users: users.data || [],
				enrollments: enrollments.data || [],
				courses: courses.data || [],
				cohorts: cohorts.data || []
			},
			error: users.error || enrollments.error || courses.error || cohorts.error
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
	},

	// ========================================================================
	// MODULE MANAGEMENT
	// ========================================================================

	/**
	 * Create a new module with auto-generated sessions
	 */
	async createModule(params: {
		courseId: string;
		name: string;
		description?: string;
		orderNumber?: number;
		sessionCount?: number;
	}) {
		const { courseId, name, description, orderNumber, sessionCount } = params;
		const numSessions = sessionCount || 8;

		// Create the module
		const { data: newModule, error: moduleError } = await supabaseAdmin
			.from('courses_modules')
			.insert({
				course_id: courseId,
				name: name,
				description: description || '',
				order_number: orderNumber || 1
			})
			.select()
			.single();

		if (moduleError) {
			return { data: null, error: moduleError };
		}

		// Auto-create session placeholders (including Pre-Start at session 0)
		const sessionsToCreate = [];

		// Create Pre-Start (session 0)
		sessionsToCreate.push({
			module_id: newModule.id,
			session_number: 0,
			title: `Welcome to ${name}`,
			description: 'Review these materials to prepare for Session 1.',
			learning_objectives: []
		});

		// Create regular sessions (1 through numSessions)
		for (let i = 1; i <= numSessions; i++) {
			sessionsToCreate.push({
				module_id: newModule.id,
				session_number: i,
				title: `Session ${i}`,
				description: '',
				learning_objectives: []
			});
		}

		const { data: createdSessions, error: sessionsError } = await supabaseAdmin
			.from('courses_sessions')
			.insert(sessionsToCreate)
			.select('id, session_number');

		// Note: Reflection questions are NOT auto-created - add them manually in course admin

		return { data: newModule, error: null };
	},

	/**
	 * Update a module
	 */
	async updateModule(params: {
		moduleId: string;
		name?: string;
		description?: string;
		orderNumber?: number;
	}) {
		const { moduleId, name, description, orderNumber } = params;

		const updateData: any = {};
		if (name) updateData.name = name;
		if (description !== undefined) updateData.description = description;
		if (orderNumber !== undefined) updateData.order_number = orderNumber;

		return supabaseAdmin
			.from('courses_modules')
			.update(updateData)
			.eq('id', moduleId)
			.select()
			.single();
	},

	/**
	 * Delete a module (checks for cohorts first)
	 */
	async deleteModule(moduleId: string) {
		// Check if module has any cohorts
		const { data: cohorts } = await supabaseAdmin
			.from('courses_cohorts')
			.select('id')
			.eq('module_id', moduleId)
			.limit(1);

		if (cohorts && cohorts.length > 0) {
			return {
				data: null,
				error: { message: 'Cannot delete module with existing cohorts' } as any
			};
		}

		// Delete the module (sessions will cascade delete)
		return supabaseAdmin.from('courses_modules').delete().eq('id', moduleId);
	},

	// ========================================================================
	// HUB MANAGEMENT
	// ========================================================================

	/**
	 * Create a new hub
	 */
	async createHub(params: {
		courseId: string;
		name: string;
		location?: string;
	}) {
		const { courseId, name, location } = params;

		return supabaseAdmin
			.from('courses_hubs')
			.insert({
				course_id: courseId,
				name: name,
				location: location || null
			})
			.select()
			.single();
	},

	/**
	 * Update a hub
	 */
	async updateHub(params: {
		hubId: string;
		name?: string;
		location?: string;
	}) {
		const { hubId, name, location } = params;

		const updateData: any = {
			updated_at: new Date().toISOString()
		};

		if (name) updateData.name = name;
		if (location !== undefined) updateData.location = location || null;

		return supabaseAdmin
			.from('courses_hubs')
			.update(updateData)
			.eq('id', hubId)
			.select()
			.single();
	},

	/**
	 * Delete a hub (cleans up enrollments)
	 */
	async deleteHub(hubId: string) {
		// Set hub_id to NULL for any enrollments using this hub
		await supabaseAdmin
			.from('courses_enrollments')
			.update({ hub_id: null })
			.eq('hub_id', hubId);

		// Delete the hub
		return supabaseAdmin.from('courses_hubs').delete().eq('id', hubId);
	},

	// ========================================================================
	// COHORT MANAGEMENT
	// ========================================================================

	/**
	 * Create a new cohort
	 */
	async createCohort(params: {
		name: string;
		moduleId: string;
		startDate: string;
		endDate?: string;
	}) {
		const { name, moduleId, startDate, endDate } = params;

		// Calculate end date if not provided (assume 8 weeks)
		const calculatedEndDate =
			endDate ||
			new Date(new Date(startDate).getTime() + 8 * 7 * 24 * 60 * 60 * 1000)
				.toISOString()
				.split('T')[0];

		// Create the cohort
		const { data: newCohort, error: cohortError } = await supabaseAdmin
			.from('courses_cohorts')
			.insert({
				name,
				module_id: moduleId,
				start_date: startDate,
				end_date: calculatedEndDate,
				current_session: 0,
				status: 'draft',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			})
			.select()
			.single();

		if (cohortError) {
			return { data: null, error: cohortError };
		}

		return { data: newCohort, error: null };
	},

	/**
	 * Update a cohort (with activity logging for session changes)
	 * Note: status is computed from session progress, not stored
	 */
	async updateCohort(params: {
		cohortId: string;
		name?: string;
		moduleId?: string;
		startDate?: string | null;
		endDate?: string | null;
		currentSession?: number;
		actorName?: string;
	}) {
		const { cohortId, name, moduleId, startDate, endDate, currentSession, actorName } =
			params;

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
		if (startDate !== undefined) updateData.start_date = startDate;
		if (endDate !== undefined) updateData.end_date = endDate;
		if (currentSession !== undefined) updateData.current_session = currentSession;

		const result = await supabaseAdmin
			.from('courses_cohorts')
			.update(updateData)
			.eq('id', cohortId)
			.select()
			.single();

		// Log activity if session was changed
		if (
			currentSession !== undefined &&
			currentSession !== currentCohort?.current_session &&
			actorName
		) {
			await supabaseAdmin.from('courses_activity_log').insert({
				cohort_id: cohortId,
				activity_type: 'session_changed',
				actor_id: null,
				actor_name: actorName,
				description: `Current session changed from ${currentCohort?.current_session ?? 0} to ${currentSession}`,
				metadata: {
					old_session: currentCohort?.current_session,
					new_session: currentSession
				}
			});
		}

		return result;
	},

	/**
	 * Delete a cohort (cascade deletes enrollments, then deletes cohort)
	 */
	async deleteCohort(cohortId: string) {
		// Delete all enrollments for this cohort
		const { error: deleteEnrollmentsError } = await supabaseAdmin
			.from('courses_enrollments')
			.delete()
			.eq('cohort_id', cohortId);

		if (deleteEnrollmentsError) {
			return { data: null, error: deleteEnrollmentsError };
		}

		// Delete the cohort
		return supabaseAdmin.from('courses_cohorts').delete().eq('id', cohortId);
	},

	/**
	 * Duplicate a cohort
	 */
	async duplicateCohort(cohortId: string) {
		// Get the original cohort
		const { data: originalCohort, error: fetchError } = await supabaseAdmin
			.from('courses_cohorts')
			.select('*')
			.eq('id', cohortId)
			.single();

		if (fetchError || !originalCohort) {
			return { data: null, error: fetchError };
		}

		// Create duplicate cohort
		const { data: newCohort, error: createError } = await supabaseAdmin
			.from('courses_cohorts')
			.insert({
				name: `${originalCohort.name} (Copy)`,
				module_id: originalCohort.module_id,
				start_date: '',
				end_date: '',
				current_session: 0,
				status: 'upcoming',
				created_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			})
			.select()
			.single();

		if (createError) {
			return { data: null, error: createError };
		}

		return { data: newCohort, error: null };
	},

	// ========================================================================
	// ENROLLMENT MANAGEMENT
	// ========================================================================

	/**
	 * Create a new enrollment
	 */
	async createEnrollment(params: {
		userId: string;
		cohortId: string;
		role: 'student' | 'coordinator';
	}) {
		const { userId, cohortId, role } = params;

		// Fetch user profile for email and full_name
		const { data: userProfile } = await supabaseAdmin
			.from('user_profiles')
			.select('email, full_name')
			.eq('id', userId)
			.single();

		if (!userProfile) {
			return {
				data: null,
				error: { message: 'User profile not found' } as any
			};
		}

		// Check if enrollment already exists
		const { data: existing } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id')
			.eq('user_profile_id', userId)
			.eq('cohort_id', cohortId)
			.maybeSingle();

		if (existing) {
			return {
				data: null,
				error: { message: 'User is already enrolled in this cohort' } as any
			};
		}

		// Create enrollment
		return supabaseAdmin
			.from('courses_enrollments')
			.insert({
				user_profile_id: userId,
				cohort_id: cohortId,
				role: role,
				email: userProfile.email,
				full_name: userProfile.full_name,
				status: 'active'
			})
			.select()
			.single();
	},

	/**
	 * Update an enrollment
	 */
	async updateEnrollment(params: {
		userId: string;
		updates: {
			full_name?: string;
			notes?: string;
			role?: string;
			hub_id?: string;
			assigned_admin_id?: string;
			current_session?: number;
			status?: string;
		};
	}) {
		const { userId, updates } = params;

		const allowedFields = [
			'full_name',
			'notes',
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

		if (Object.keys(updateData).length === 1) {
			return {
				data: null,
				error: { message: 'No valid updates provided' } as any
			};
		}

		return supabaseAdmin
			.from('courses_enrollments')
			.update(updateData)
			.eq('id', userId)
			.select()
			.single();
	},

	/**
	 * Delete an enrollment (only if user hasn't signed up yet)
	 */
	async deleteEnrollment(userId: string) {
		// Only allow deletion if user hasn't signed up yet (no user_profile_id)
		const { data: user } = await supabaseAdmin
			.from('courses_enrollments')
			.select('user_profile_id')
			.eq('id', userId)
			.single();

		if (user?.user_profile_id) {
			return {
				data: null,
				error: { message: 'Cannot delete user who has completed signup' } as any
			};
		}

		return supabaseAdmin.from('courses_enrollments').delete().eq('id', userId);
	},

	/**
	 * Bulk delete enrollments
	 * If forceDelete is true, deletes all enrollments regardless of signup status
	 * If forceDelete is false, only deletes enrollments where user hasn't signed up yet
	 * Returns counts of deleted and skipped enrollments
	 */
	async bulkDeleteEnrollments(enrollmentIds: string[], forceDelete: boolean = false) {
		if (!enrollmentIds || enrollmentIds.length === 0) {
			return {
				data: { deleted: 0, skipped: 0, skippedNames: [] },
				error: null
			};
		}

		// Get all enrollments to check which ones can be deleted
		const { data: enrollments, error: fetchError } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id, user_profile_id, full_name')
			.in('id', enrollmentIds);

		if (fetchError) {
			return { data: null, error: fetchError };
		}

		let deletableIds: string[];
		let skipped: typeof enrollments = [];

		if (forceDelete) {
			// Force delete: delete all enrollments
			deletableIds = enrollments?.map((e) => e.id) || [];
		} else {
			// Normal mode: only delete enrollments where user hasn't signed up
			const deletable = enrollments?.filter((e) => !e.user_profile_id) || [];
			skipped = enrollments?.filter((e) => e.user_profile_id) || [];
			deletableIds = deletable.map((e) => e.id);
		}

		if (deletableIds.length === 0) {
			return {
				data: {
					deleted: 0,
					skipped: skipped.length,
					skippedNames: skipped.map((e) => e.full_name)
				},
				error: null
			};
		}

		// Delete the enrollments
		const { error: deleteError } = await supabaseAdmin
			.from('courses_enrollments')
			.delete()
			.in('id', deletableIds);

		if (deleteError) {
			return { data: null, error: deleteError };
		}

		return {
			data: {
				deleted: deletableIds.length,
				skipped: skipped.length,
				skippedNames: skipped.map((e) => e.full_name)
			},
			error: null
		};
	},

	/**
	 * Permanently delete user accounts
	 * This deletes the user_profile, auth user, and all associated data
	 * Only works for users linked to the given enrollment IDs
	 */
	async deleteUserAccounts(enrollmentIds: string[]) {
		if (!enrollmentIds || enrollmentIds.length === 0) {
			return {
				data: { deleted: 0, skipped: 0, skippedNames: [] },
				error: null
			};
		}

		// Get enrollments with their user_profile_ids
		const { data: enrollments, error: fetchError } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id, user_profile_id, full_name')
			.in('id', enrollmentIds);

		if (fetchError) {
			return { data: null, error: fetchError };
		}

		// Separate users with accounts from those without
		const withAccounts = enrollments?.filter((e) => e.user_profile_id) || [];
		const withoutAccounts = enrollments?.filter((e) => !e.user_profile_id) || [];

		// Get unique user_profile_ids (a user might have multiple enrollments)
		const userProfileIds = [...new Set(withAccounts.map((e) => e.user_profile_id))];

		if (userProfileIds.length === 0) {
			// No accounts to delete, just delete the enrollments
			if (withoutAccounts.length > 0) {
				await supabaseAdmin
					.from('courses_enrollments')
					.delete()
					.in('id', withoutAccounts.map((e) => e.id));
			}
			return {
				data: {
					deleted: withoutAccounts.length,
					skipped: 0,
					skippedNames: []
				},
				error: null
			};
		}

		// Get auth user IDs from user_profiles
		const { data: profiles } = await supabaseAdmin
			.from('user_profiles')
			.select('id, email')
			.in('id', userProfileIds);

		const deletedCount = { accounts: 0, enrollments: 0 };
		const errors: string[] = [];

		// Delete each user account
		for (const profile of profiles || []) {
			try {
				// 1. Delete all enrollments for this user (across all cohorts)
				await supabaseAdmin
					.from('courses_enrollments')
					.delete()
					.eq('user_profile_id', profile.id);

				// 2. Delete reflection responses (they reference enrollment which is gone)
				// The enrollments are deleted, but responses might have been orphaned

				// 3. Null out references in other tables to avoid FK violations
				await supabaseAdmin
					.from('courses_attendance')
					.update({ marked_by: null })
					.eq('marked_by', profile.id);

				await supabaseAdmin
					.from('courses_reflection_responses')
					.update({ marked_by: null, reviewing_by: null })
					.or(`marked_by.eq.${profile.id},reviewing_by.eq.${profile.id}`);

				await supabaseAdmin
					.from('courses_enrollment_imports')
					.update({ imported_by: null })
					.eq('imported_by', profile.id);

				// 4. Delete community feed posts by this user
				await supabaseAdmin
					.from('courses_community_feed')
					.delete()
					.eq('author_id', profile.id);

				// 5. Delete the user_profile
				await supabaseAdmin
					.from('user_profiles')
					.delete()
					.eq('id', profile.id);

				// 6. Delete the auth user
				const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
				if (authError) {
					console.error(`Failed to delete auth user ${profile.id}:`, authError);
					// Continue anyway - the profile is already deleted
				}

				deletedCount.accounts++;
			} catch (err) {
				console.error(`Failed to delete user ${profile.id}:`, err);
				errors.push(profile.email || profile.id);
			}
		}

		// Also delete enrollments for users without accounts
		if (withoutAccounts.length > 0) {
			await supabaseAdmin
				.from('courses_enrollments')
				.delete()
				.in('id', withoutAccounts.map((e) => e.id));
			deletedCount.enrollments = withoutAccounts.length;
		}

		return {
			data: {
				deleted: deletedCount.accounts + deletedCount.enrollments,
				accountsDeleted: deletedCount.accounts,
				enrollmentsDeleted: deletedCount.enrollments,
				errors
			},
			error: errors.length > 0 ? { message: `Failed to delete some users: ${errors.join(', ')}` } : null
		};
	},

	/**
	 * Advance students to a target session
	 */
	async advanceStudents(params: {
		cohortId: string;
		studentIds: string[];
		targetSession: number;
		sendEmail?: boolean;
		actorName?: string;
	}) {
		const { cohortId, studentIds, targetSession, sendEmail, actorName } = params;

		// Update students' current session
		const result = await supabaseAdmin
			.from('courses_enrollments')
			.update({
				current_session: targetSession,
				updated_at: new Date().toISOString()
			})
			.in('id', studentIds)
			.eq('cohort_id', cohortId);

		// Log email activity if requested
		if (sendEmail && actorName) {
			await supabaseAdmin.from('courses_activity_log').insert({
				cohort_id: cohortId,
				activity_type: 'advancement_email_sent',
				actor_id: null,
				actor_name: actorName,
				description: `Advancement emails sent to ${studentIds.length} student${studentIds.length > 1 ? 's' : ''} for Session ${targetSession}`,
				metadata: { student_count: studentIds.length, session: targetSession }
			});
		}

		return result;
	},

	/**
	 * Bulk import enrollments from CSV
	 */
	async uploadCSV(params: {
		filename: string;
		rows: any[];
		cohortId: string;
		importedBy: string;
	}) {
		const { filename, rows, cohortId, importedBy } = params;

		if (!rows || rows.length === 0) {
			return {
				data: null,
				error: { message: 'No data provided' } as any
			};
		}

		// Get course_id from cohort for hub creation
		const { data: cohort } = await supabaseAdmin
			.from('courses_cohorts')
			.select('module_id, courses_modules!inner(course_id)')
			.eq('id', cohortId)
			.single();

		const courseId = cohort?.courses_modules?.course_id;
		if (!courseId) {
			return {
				data: null,
				error: { message: 'Could not determine course for this cohort' } as any
			};
		}

		// Create import tracking record
		const { data: importRecord, error: importError } = await supabaseAdmin
			.from('courses_enrollment_imports')
			.insert({
				imported_by: importedBy,
				filename: filename,
				total_rows: rows.length,
				status: 'processing'
			})
			.select()
			.single();

		if (importError) {
			return { data: null, error: importError };
		}

		// ========== BATCH PREFETCH FOR PERFORMANCE ==========

		// 1. Get all emails from CSV
		const csvEmails = rows.map(r => r.email.toLowerCase());

		// 2. Batch check existing enrollments in this cohort
		const { data: existingEnrollments } = await supabaseAdmin
			.from('courses_enrollments')
			.select('email')
			.eq('cohort_id', cohortId)
			.in('email', csvEmails);
		const existingEnrollmentEmails = new Set((existingEnrollments || []).map(e => e.email.toLowerCase()));

		// 3. Fetch ALL auth users once (not per row!)
		const { data: { users: allAuthUsers } } = await supabaseAdmin.auth.admin.listUsers();
		const authUsersByEmail = new Map((allAuthUsers || []).map(u => [u.email?.toLowerCase(), u]));

		// 4. Fetch existing user profiles
		const { data: existingProfiles } = await supabaseAdmin
			.from('user_profiles')
			.select('id, email')
			.in('email', csvEmails);
		const profilesByEmail = new Map((existingProfiles || []).map(p => [p.email?.toLowerCase(), p]));

		// 5. Get all hubs for this course and prepare hub cache
		const { data: existingHubs } = await supabaseAdmin
			.from('courses_hubs')
			.select('id, name')
			.eq('course_id', courseId);
		const hubsByName = new Map((existingHubs || []).map(h => [h.name.toLowerCase(), h.id]));

		// 6. Pre-create any missing hubs in batch
		const uniqueHubNames = [...new Set(rows.filter(r => r.hub?.trim()).map(r => r.hub.trim()))];
		const missingHubs = uniqueHubNames.filter(name => !hubsByName.has(name.toLowerCase()));

		if (missingHubs.length > 0) {
			const { data: newHubs } = await supabaseAdmin
				.from('courses_hubs')
				.insert(missingHubs.map(name => ({ name, course_id: courseId })))
				.select('id, name');

			(newHubs || []).forEach(h => hubsByName.set(h.name.toLowerCase(), h.id));
		}

		// ========== PROCESS ROWS ==========
		let successCount = 0;
		let errorCount = 0;
		const results: any[] = [];
		const errorDetails: string[] = [];
		const newUsersToCreate: any[] = [];

		// First pass: identify which users need auth accounts created
		for (const row of rows) {
			const emailLower = row.email.toLowerCase();

			// Skip if already enrolled
			if (existingEnrollmentEmails.has(emailLower)) {
				const errorMsg = `${row.full_name} (${row.email}): Already in this cohort`;
				results.push({ email: row.email, status: 'skipped', message: 'Already in this cohort' });
				errorDetails.push(errorMsg);
				errorCount++;
				continue;
			}

			// Check if user needs to be created
			if (!authUsersByEmail.has(emailLower)) {
				newUsersToCreate.push(row);
			}
		}

		// Create new auth users (can't batch this, but at least we're not fetching all users each time)
		const createdUsers = new Map<string, string>();
		for (const row of newUsersToCreate) {
			try {
				const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
					type: 'invite',
					email: row.email,
					options: {
						data: {
							full_name: row.full_name || null,
							invited_by: importedBy
						}
					}
				});

				if (linkError) {
					throw new Error(`Failed to create auth account: ${linkError.message}`);
				}

				createdUsers.set(row.email.toLowerCase(), linkData.user.id);
			} catch (err: any) {
				const errorMsg = `${row.full_name} (${row.email}): ${err.message}`;
				results.push({ email: row.email, status: 'error', message: err.message });
				errorDetails.push(errorMsg);
				errorCount++;
			}
		}

		// Brief wait for triggers to create profiles (one wait for all, not per user)
		if (createdUsers.size > 0) {
			await new Promise(resolve => setTimeout(resolve, 300));
		}

		// Batch create missing profiles
		const profilesToCreate: any[] = [];
		for (const [email, userId] of createdUsers) {
			if (!profilesByEmail.has(email)) {
				profilesToCreate.push({
					id: userId,
					email: email,
					full_name: rows.find(r => r.email.toLowerCase() === email)?.full_name || null,
					modules: ['courses.participant']
				});
			}
		}

		if (profilesToCreate.length > 0) {
			await supabaseAdmin.from('user_profiles').upsert(profilesToCreate, { onConflict: 'id' });
		}

		// Update all user profiles with CSV data (only non-empty fields)
		// This handles both new and existing users
		for (const row of rows) {
			const emailLower = row.email.toLowerCase();
			const existingAuthUser = authUsersByEmail.get(emailLower);
			const newlyCreatedUserId = createdUsers.get(emailLower);
			const userId = existingAuthUser?.id || newlyCreatedUserId;

			if (!userId) continue;

			// Build update object with only non-empty CSV values
			const profileUpdate: any = {};
			if (row.first_name) profileUpdate.first_name = row.first_name;
			if (row.last_name) profileUpdate.last_name = row.last_name;
			if (row.full_name) profileUpdate.full_name = row.full_name;
			if (row.phone) profileUpdate.phone = row.phone;
			if (row.address) profileUpdate.address = row.address;
			if (row.parish_community) profileUpdate.parish_community = row.parish_community;
			if (row.parish_role) profileUpdate.parish_role = row.parish_role;

			// Only update if we have fields to update
			if (Object.keys(profileUpdate).length > 0) {
				// Ensure courses.participant module is present
				const { data: existingProfile } = await supabaseAdmin
					.from('user_profiles')
					.select('modules')
					.eq('id', userId)
					.single();

				const currentModules = existingProfile?.modules || [];
				if (!currentModules.includes('courses.participant')) {
					profileUpdate.modules = [...currentModules, 'courses.participant'];
				}

				await supabaseAdmin
					.from('user_profiles')
					.update(profileUpdate)
					.eq('id', userId);
			} else {
				// Still ensure courses.participant module
				const { data: existingProfile } = await supabaseAdmin
					.from('user_profiles')
					.select('modules')
					.eq('id', userId)
					.single();

				const currentModules = existingProfile?.modules || [];
				if (!currentModules.includes('courses.participant')) {
					await supabaseAdmin
						.from('user_profiles')
						.update({ modules: [...currentModules, 'courses.participant'] })
						.eq('id', userId);
				}
			}
		}

		// Build enrollments to insert
		const enrollmentsToInsert: any[] = [];
		for (const row of rows) {
			const emailLower = row.email.toLowerCase();

			// Skip already processed errors
			if (results.find(r => r.email === row.email)) continue;

			// Get user ID - check if existing user or newly created
			const existingAuthUser = authUsersByEmail.get(emailLower);
			const newlyCreatedUserId = createdUsers.get(emailLower);
			const userId = existingAuthUser?.id || newlyCreatedUserId;

			if (!userId) {
				// User creation must have failed - track this as an error
				const errorMsg = `${row.full_name} (${row.email}): Could not find or create user account`;
				results.push({ email: row.email, status: 'error', message: 'Could not find or create user account' });
				errorDetails.push(errorMsg);
				errorCount++;
				continue;
			}

			// Get hub ID
			const hubId = row.hub?.trim() ? hubsByName.get(row.hub.trim().toLowerCase()) || null : null;

			// Determine status: existing users (already have account) start as 'active'
			// New users (just created) start as 'pending' until they set password
			const isExistingUser = existingAuthUser && !newlyCreatedUserId;
			const now = new Date().toISOString();

			enrollmentsToInsert.push({
				user_profile_id: userId,
				email: row.email,
				full_name: row.full_name,
				notes: row.notes || null, // Only enrollment-specific field
				role: row.role || 'student',
				hub_id: hubId,
				cohort_id: cohortId,
				imported_by: importedBy,
				status: isExistingUser ? 'active' : 'pending',
				// For existing users, they've already "signed up" - set login tracking
				last_login_at: isExistingUser ? now : null,
				login_count: isExistingUser ? 1 : 0
			});
		}

		// Batch insert enrollments
		if (enrollmentsToInsert.length > 0) {
			const { data: insertedEnrollments, error: batchError } = await supabaseAdmin
				.from('courses_enrollments')
				.insert(enrollmentsToInsert)
				.select('email');

			if (batchError) {
				// If batch fails, try individual inserts to identify which ones failed
				for (const enrollment of enrollmentsToInsert) {
					const { error: insertError } = await supabaseAdmin
						.from('courses_enrollments')
						.insert(enrollment);

					if (insertError) {
						const errorMsg = `${enrollment.full_name} (${enrollment.email}): ${insertError.message}`;
						results.push({ email: enrollment.email, status: 'error', message: insertError.message });
						errorDetails.push(errorMsg);
						errorCount++;
					} else {
						results.push({ email: enrollment.email, status: 'success', message: 'Added to cohort' });
						successCount++;
					}
				}
			} else {
				// Batch succeeded
				for (const enrollment of enrollmentsToInsert) {
					results.push({ email: enrollment.email, status: 'success', message: 'Added to cohort' });
					successCount++;
				}
			}
		}

		// Update import record
		await supabaseAdmin
			.from('courses_enrollment_imports')
			.update({
				successful_rows: successCount,
				error_rows: errorCount,
				status: 'completed'
			})
			.eq('id', importRecord.id);

		return {
			data: {
				importId: importRecord.id,
				total: rows.length,
				successful: successCount,
				errors: errorCount,
				errorDetails: errorDetails,
				results: results
			},
			error: null
		};
	},

	/**
	 * Send welcome emails to enrollments
	 */
	async sendWelcomeEmails(params: {
		enrollmentIds: string[];
		cohortId: string;
		sentBy: string;
		courseSlug: string;
	}) {
		const { enrollmentIds, cohortId, sentBy, courseSlug } = params;

		if (!enrollmentIds || enrollmentIds.length === 0) {
			return { data: { sent: 0, failed: 0 }, error: null };
		}

		// Get enrollments with cohort and course info
		const { data: enrollments, error: fetchError } = await supabaseAdmin
			.from('courses_enrollments')
			.select(`
				id, email, full_name, user_profile_id,
				courses_cohorts(
					name, start_date,
					courses_modules(
						name,
						courses(name, slug)
					)
				)
			`)
			.in('id', enrollmentIds)
			.is('welcome_email_sent_at', null);

		if (fetchError) {
			return { data: null, error: fetchError };
		}

		let sentCount = 0;
		let failedCount = 0;

		// Import email service
		const { sendCourseEmail } = await import('$lib/utils/email-service.js');

		for (const enrollment of enrollments || []) {
			try {
				const cohortData = enrollment.courses_cohorts as any;
				const moduleData = cohortData?.courses_modules as any;
				const courseData = moduleData?.courses as any;

				// Generate magic link for the user
				const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
					type: 'magiclink',
					email: enrollment.email,
					options: {
						redirectTo: `${process.env.PUBLIC_SITE_URL || 'https://arch-tools.vercel.app'}/courses/${courseSlug}/dashboard`
					}
				});

				if (linkError) {
					console.error(`Failed to generate link for ${enrollment.email}:`, linkError);
					failedCount++;
					continue;
				}

				// Send welcome email
				await sendCourseEmail({
					to: enrollment.email,
					templateSlug: 'welcome',
					courseSlug: courseSlug,
					context: {
						recipientName: enrollment.full_name,
						recipientEmail: enrollment.email,
						cohortName: cohortData?.name || 'Your Cohort',
						courseName: courseData?.name || 'Course',
						moduleName: moduleData?.name || 'Module',
						startDate: cohortData?.start_date,
						magicLink: linkData.properties?.action_link || '#'
					}
				});

				// Update enrollment with sent timestamp
				await supabaseAdmin
					.from('courses_enrollments')
					.update({
						welcome_email_sent_at: new Date().toISOString(),
						welcome_email_sent_by: sentBy,
						status: 'invited'
					})
					.eq('id', enrollment.id);

				sentCount++;
			} catch (err) {
				console.error(`Failed to send welcome email to ${enrollment.email}:`, err);
				failedCount++;
			}
		}

		return {
			data: { sent: sentCount, failed: failedCount },
			error: null
		};
	},

	// ========================================================================
	// MATERIALS MANAGEMENT
	// ========================================================================

	/**
	 * Create new course material
	 */
	async createMaterial(params: {
		sessionId: string;
		type: 'video' | 'document' | 'link' | 'native' | 'image' | 'embed' | 'mux_video';
		title: string;
		content: string;
		description?: string | null;
		displayOrder?: number;
		coordinatorOnly?: boolean;
		muxUploadId?: string;
		muxAssetId?: string;
		muxPlaybackId?: string;
		muxStatus?: 'uploading' | 'processing' | 'ready' | 'errored';
	}) {
		return supabaseAdmin
			.from('courses_materials')
			.insert({
				session_id: params.sessionId,
				type: params.type,
				title: params.title,
				content: params.content,
				description: params.description || null,
				display_order: params.displayOrder || 0,
				coordinator_only: params.coordinatorOnly || false,
				mux_upload_id: params.muxUploadId || null,
				mux_asset_id: params.muxAssetId || null,
				mux_playback_id: params.muxPlaybackId || null,
				mux_status: params.muxStatus || null
			})
			.select()
			.single();
	},

	/**
	 * Update existing material
	 */
	async updateMaterial(
		id: string,
		updates: {
			type?: string;
			title?: string;
			content?: string;
			description?: string | null;
			displayOrder?: number;
			coordinatorOnly?: boolean;
			muxUploadId?: string;
			muxAssetId?: string;
			muxPlaybackId?: string;
			muxStatus?: 'uploading' | 'processing' | 'ready' | 'errored' | null;
		}
	) {
		const payload: any = { updated_at: new Date().toISOString() };

		if (updates.type) payload.type = updates.type;
		if (updates.title) payload.title = updates.title;
		if (updates.content) payload.content = updates.content;
		if (updates.description !== undefined) payload.description = updates.description;
		if (updates.displayOrder !== undefined) payload.display_order = updates.displayOrder;
		if (updates.coordinatorOnly !== undefined) payload.coordinator_only = updates.coordinatorOnly;
		if (updates.muxUploadId !== undefined) payload.mux_upload_id = updates.muxUploadId;
		if (updates.muxAssetId !== undefined) payload.mux_asset_id = updates.muxAssetId;
		if (updates.muxPlaybackId !== undefined) payload.mux_playback_id = updates.muxPlaybackId;
		if (updates.muxStatus !== undefined) payload.mux_status = updates.muxStatus;

		return supabaseAdmin
			.from('courses_materials')
			.update(payload)
			.eq('id', id)
			.select()
			.maybeSingle();
	},

	/**
	 * Delete material
	 */
	async deleteMaterial(id: string) {
		return supabaseAdmin.from('courses_materials').delete().eq('id', id);
	},

	// ========================================================================
	// REFLECTION QUESTION MANAGEMENT
	// ========================================================================

	/**
	 * Create reflection question
	 */
	async createReflectionQuestion(params: {
		sessionId: string;
		questionText: string;
	}) {
		return supabaseAdmin
			.from('courses_reflection_questions')
			.insert({
				session_id: params.sessionId,
				question_text: params.questionText
			})
			.select()
			.single();
	},

	/**
	 * Update reflection question
	 */
	async updateReflectionQuestion(
		id: string,
		updates: {
			questionText?: string;
		}
	) {
		const payload: any = { updated_at: new Date().toISOString() };

		if (updates.questionText) payload.question_text = updates.questionText;

		return supabaseAdmin
			.from('courses_reflection_questions')
			.update(payload)
			.eq('id', id)
			.select()
			.maybeSingle();
	},

	/**
	 * Delete reflection question
	 */
	async deleteReflectionQuestion(id: string) {
		return supabaseAdmin.from('courses_reflection_questions').delete().eq('id', id);
	},

	// ========================================================================
	// SESSION MANAGEMENT
	// ========================================================================

	/**
	 * Create session
	 */
	async createSession(params: {
		moduleId: string;
		sessionNumber: number;
		title: string;
		description?: string;
		reflectionsEnabled?: boolean;
	}) {
		return supabaseAdmin
			.from('courses_sessions')
			.insert({
				module_id: params.moduleId,
				session_number: params.sessionNumber,
				title: params.title,
				description: params.description || null,
				reflections_enabled: params.reflectionsEnabled ?? true
			})
			.select()
			.single();
	},

	/**
	 * Update session
	 */
	async updateSession(
		id: string,
		updates: {
			title?: string;
			description?: string;
			reflectionsEnabled?: boolean;
		}
	) {
		const payload: any = { updated_at: new Date().toISOString() };

		if (updates.title) payload.title = updates.title;
		if (updates.description !== undefined) payload.description = updates.description;
		if (updates.reflectionsEnabled !== undefined)
			payload.reflections_enabled = updates.reflectionsEnabled;

		return supabaseAdmin
			.from('courses_sessions')
			.update(payload)
			.eq('id', id)
			.select()
			.maybeSingle();
	},

	/**
	 * Delete session
	 */
	async deleteSession(id: string) {
		return supabaseAdmin.from('courses_sessions').delete().eq('id', id);
	},

	// ========================================================================
	// HELPER FUNCTIONS
	// ========================================================================

	/**
	 * Ensure module has reflection questions for all sessions
	 * (Internal helper function)
	 */
	async ensureModuleReflectionQuestions(moduleId: string) {
		// Default reflection prompts mapped by session index
		const defaultQuestions = [
			'What is the reason you look to God for answers over cultural sources and making prayer central to your life?',
			'How do you see God working in your daily life through small moments and ordinary experiences?',
			"Reflect on a time when you experienced God's mercy in your life.",
			"How has your understanding of the Trinity deepened through this week's materials?",
			'What does it mean to you to be part of the Body of Christ?',
			"How has your understanding of the Eucharist deepened through this week's materials?",
			'Describe a moment when you felt particularly close to God in prayer.',
			'How will you continue to grow in your faith after completing this module?'
		];

		const { data: sessions } = await supabaseAdmin
			.from('courses_sessions')
			.select('id, session_number')
			.eq('module_id', moduleId)
			.order('session_number', { ascending: true });

		if (!sessions || sessions.length === 0) {
			return;
		}

		const sessionIds = sessions.map((session) => session.id);

		const { data: existingQuestions } = await supabaseAdmin
			.from('courses_reflection_questions')
			.select('session_id')
			.in('session_id', sessionIds);

		const existingSessionIds = new Set((existingQuestions || []).map((q) => q.session_id));
		const now = new Date().toISOString();
		const questionsToInsert = sessions
			.filter((session) => !existingSessionIds.has(session.id))
			.map((session) => ({
				session_id: session.id,
				question_text:
					defaultQuestions[Math.max(0, session.session_number - 1)] ||
					defaultQuestions[defaultQuestions.length - 1],
				created_at: now,
				updated_at: now
			}));

		if (questionsToInsert.length === 0) {
			return;
		}

		await supabaseAdmin.from('courses_reflection_questions').insert(questionsToInsert);
	}
};

// ============================================================================
// DATA TRANSFORMERS (View Layer Adapters)
// ============================================================================

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

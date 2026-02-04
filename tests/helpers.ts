import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * Test helper utilities for course integration tests
 * These work directly with the database, not the UI
 */

export const testHelpers = {
	/**
	 * Clean up test data after tests
	 */
	async cleanup() {
		// Get test courses
		const { data: testCourses } = await supabaseAdmin
			.from('courses')
			.select('id')
			.like('slug', 'test-%');

		if (testCourses && testCourses.length > 0) {
			const courseIds = testCourses.map(c => c.id);

			// Get modules for these courses
			const { data: modules } = await supabaseAdmin
				.from('courses_modules')
				.select('id')
				.in('course_id', courseIds);

			if (modules && modules.length > 0) {
				const moduleIds = modules.map(m => m.id);

				// Get cohorts
				const { data: cohorts } = await supabaseAdmin
					.from('courses_cohorts')
					.select('id')
					.in('module_id', moduleIds);

				if (cohorts && cohorts.length > 0) {
					const cohortIds = cohorts.map(c => c.id);

					// Delete enrollments
					await supabaseAdmin.from('courses_enrollments').delete().in('cohort_id', cohortIds);

					// Delete cohorts
					await supabaseAdmin.from('courses_cohorts').delete().in('id', cohortIds);
				}

				// Get sessions
				const { data: sessions } = await supabaseAdmin
					.from('courses_sessions')
					.select('id')
					.in('module_id', moduleIds);

				if (sessions && sessions.length > 0) {
					const sessionIds = sessions.map(s => s.id);

					// Get reflection questions
					const { data: questions } = await supabaseAdmin
						.from('courses_reflection_questions')
						.select('id')
						.in('session_id', sessionIds);

					if (questions && questions.length > 0) {
						const questionIds = questions.map(q => q.id);

						// Delete reflection responses
						await supabaseAdmin.from('courses_reflection_responses').delete().in('question_id', questionIds);

						// Delete reflection questions
						await supabaseAdmin.from('courses_reflection_questions').delete().in('id', questionIds);
					}

					// Delete materials
					await supabaseAdmin.from('courses_materials').delete().in('session_id', sessionIds);

					// Delete sessions
					await supabaseAdmin.from('courses_sessions').delete().in('id', sessionIds);
				}

				// Delete modules
				await supabaseAdmin.from('courses_modules').delete().in('id', moduleIds);
			}

			// Delete courses
			await supabaseAdmin.from('courses').delete().in('id', courseIds);
		}

		// Clean up test users
		await supabaseAdmin
			.from('user_profiles')
			.delete()
			.like('email', 'test-%@example.com');
	},

	/**
	 * Create a test course
	 */
	async createCourse(data?: Partial<{ name: string; slug: string; description: string }>) {
		const slug = data?.slug || `test-course-${Date.now()}`;

		const { data: course, error } = await supabaseAdmin
			.from('courses')
			.insert({
				name: data?.name || 'Test Course',
				slug,
				description: data?.description || 'A test course',
				settings: {
					theme: {
						accentDark: '#334642',
						accentLight: '#c59a6b',
						fontFamily: 'Inter'
					}
				}
			})
			.select()
			.single();

		if (error) throw error;
		return course;
	},

	/**
	 * Create a test module
	 */
	async createModule(courseId: string, data?: Partial<{ name: string; description: string; order_number: number }>) {
		// Use timestamp + random to ensure unique order_number
		const uniqueOrder = data?.order_number ?? (Date.now() % 1000000 + Math.floor(Math.random() * 1000));

		const { data: module, error} = await supabaseAdmin
			.from('courses_modules')
			.insert({
				course_id: courseId,
				name: data?.name || 'Test Module',
				description: data?.description || 'A test module',
				order_number: uniqueOrder
			})
			.select()
			.single();

		if (error) throw error;
		return module;
	},

	/**
	 * Create test sessions for a module
	 */
	async createSessions(moduleId: string, count: number = 8) {
		const sessions = [];
		for (let i = 1; i <= count; i++) {
			const { data: session, error } = await supabaseAdmin
				.from('courses_sessions')
				.insert({
					module_id: moduleId,
					session_number: i,
					title: `Session ${i}`,
					description: `Test session ${i}`
				})
				.select()
				.single();

			if (error) throw error;
			sessions.push(session);
		}
		return sessions;
	},

	/**
	 * Create a test cohort
	 */
	async createCohort(moduleId: string, data?: Partial<{ name: string; start_date: string; end_date: string; current_session: number; status: string }>) {
		const { data: cohort, error } = await supabaseAdmin
			.from('courses_cohorts')
			.insert({
				module_id: moduleId,
				name: data?.name || 'Test Cohort',
				start_date: data?.start_date || new Date().toISOString().split('T')[0],
				end_date: data?.end_date || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
				current_session: data?.current_session ?? 1,
				status: data?.status || null
			})
			.select()
			.single();

		if (error) throw error;
		return cohort;
	},

	/**
	 * Create a test user
	 */
	async createUser(data?: Partial<{ email: string; full_name: string; modules: string[] }>) {
		const email = data?.email || `test-user-${Date.now()}@example.com`;

		const { data: user, error } = await supabaseAdmin
			.from('user_profiles')
			.insert({
				email,
				full_name: data?.full_name || 'Test User',
				modules: data?.modules || []
			})
			.select()
			.single();

		if (error) throw error;
		return user;
	},

	/**
	 * Create a test enrollment
	 */
	async createEnrollment(userId: string, cohortId: string, data?: Partial<{ role: 'student' | 'coordinator'; status: string; current_session: number }>) {
		// Fetch cohort's current_session if not explicitly provided
		let currentSession = data?.current_session;
		if (currentSession === undefined) {
			const { data: cohort } = await supabaseAdmin
				.from('courses_cohorts')
				.select('current_session')
				.eq('id', cohortId)
				.single();
			currentSession = cohort?.current_session || 1;
		}

		const { data: enrollment, error } = await supabaseAdmin
			.from('courses_enrollments')
			.insert({
				user_profile_id: userId,
				cohort_id: cohortId,
				role: data?.role || 'student',
				email: 'test@example.com',
				full_name: 'Test User',
				status: data?.status || 'active',
				current_session: currentSession
			})
			.select()
			.single();

		if (error) throw error;
		return enrollment;
	},

	/**
	 * Create test material for a session
	 */
	async createMaterial(sessionId: string, data?: Partial<{ type: string; title: string; content: string; display_order: number }>) {
		const { data: material, error } = await supabaseAdmin
			.from('courses_materials')
			.insert({
				session_id: sessionId,
				type: data?.type || 'link',
				title: data?.title || 'Test Material',
				content: data?.content || 'https://example.com',
				display_order: data?.display_order ?? 0
			})
			.select()
			.single();

		if (error) throw error;
		return material;
	},

	/**
	 * Create test reflection question
	 */
	async createReflectionQuestion(sessionId: string, data?: Partial<{ question_text: string }>) {
		const { data: question, error } = await supabaseAdmin
			.from('courses_reflection_questions')
			.insert({
				session_id: sessionId,
				question_text: data?.question_text || 'What did you learn?'
			})
			.select()
			.single();

		if (error) throw error;
		return question;
	}
};

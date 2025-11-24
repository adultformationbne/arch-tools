import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { testHelpers } from './helpers.js';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * Course Platform Integration Tests
 *
 * These tests validate the core CRUD operations for the courses platform.
 * They test the database layer directly, making them resilient to UI changes.
 */

describe('Course Management', () => {
	afterEach(async () => {
		await testHelpers.cleanup();
	});

	describe('Course CRUD Operations', () => {
		it('should create a course with theme settings', async () => {
			const course = await testHelpers.createCourse({
				name: 'Test Catholic Formation',
				slug: 'test-tcf',
				description: 'A test formation program'
			});

			expect(course).toBeDefined();
			expect(course.slug).toBe('test-tcf');
			expect(course.name).toBe('Test Catholic Formation');
			expect(course.settings?.theme).toBeDefined();
			expect(course.settings.theme.accentDark).toBe('#334642');
		});

		it('should retrieve a course by slug', async () => {
			const created = await testHelpers.createCourse({ slug: 'test-retrieve' });

			const { data: retrieved, error } = await supabaseAdmin
				.from('courses')
				.select('*')
				.eq('slug', 'test-retrieve')
				.single();

			expect(error).toBeNull();
			expect(retrieved).toBeDefined();
			expect(retrieved?.id).toBe(created.id);
		});

		it('should update course settings', async () => {
			const course = await testHelpers.createCourse({ slug: 'test-update' });

			const { data: updated, error } = await supabaseAdmin
				.from('courses')
				.update({
					settings: {
						theme: {
							accentDark: '#000000',
							accentLight: '#ffffff',
							fontFamily: 'Georgia'
						}
					}
				})
				.eq('id', course.id)
				.select()
				.single();

			expect(error).toBeNull();
			expect(updated?.settings.theme.accentDark).toBe('#000000');
			expect(updated?.settings.theme.fontFamily).toBe('Georgia');
		});

		it('should delete a course (cascade deletes modules)', async () => {
			const course = await testHelpers.createCourse({ slug: 'test-delete' });
			const module = await testHelpers.createModule(course.id);

			const { error } = await supabaseAdmin
				.from('courses')
				.delete()
				.eq('id', course.id);

			expect(error).toBeNull();

			// Verify module was cascade deleted
			const { data: deletedModule } = await supabaseAdmin
				.from('courses_modules')
				.select('*')
				.eq('id', module.id)
				.maybeSingle();

			expect(deletedModule).toBeNull();
		});
	});

	describe('Module Operations', () => {
		it('should create a module for a course', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id, {
				name: 'Foundations of Faith',
				description: 'Learn the basics',
				order_number: 1
			});

			expect(module).toBeDefined();
			expect(module.name).toBe('Foundations of Faith');
			expect(module.course_id).toBe(course.id);
		});

		it('should retrieve modules for a course in order', async () => {
			const course = await testHelpers.createCourse();
			await testHelpers.createModule(course.id, { name: 'Module 2', order_number: 2 });
			await testHelpers.createModule(course.id, { name: 'Module 1', order_number: 1 });

			const { data: modules } = await supabaseAdmin
				.from('courses_modules')
				.select('*')
				.eq('course_id', course.id)
				.order('order_number', { ascending: true });

			expect(modules).toHaveLength(2);
			expect(modules?.[0].name).toBe('Module 1');
			expect(modules?.[1].name).toBe('Module 2');
		});

		it('should update module details', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);

			const { data: updated, error } = await supabaseAdmin
				.from('courses_modules')
				.update({ name: 'Updated Module Name', description: 'New description' })
				.eq('id', module.id)
				.select()
				.single();

			expect(error).toBeNull();
			expect(updated?.name).toBe('Updated Module Name');
			expect(updated?.description).toBe('New description');
		});
	});

	describe('Session Management', () => {
		it('should create sessions for a module', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const sessions = await testHelpers.createSessions(module.id, 4);

			expect(sessions).toHaveLength(4);
			expect(sessions[0].session_number).toBe(1);
			expect(sessions[3].session_number).toBe(4);
		});

		it('should retrieve sessions for a module', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			await testHelpers.createSessions(module.id, 8);

			const { data: sessions } = await supabaseAdmin
				.from('courses_sessions')
				.select('*')
				.eq('module_id', module.id)
				.order('session_number', { ascending: true });

			expect(sessions).toHaveLength(8);
			expect(sessions?.[0].session_number).toBe(1);
			expect(sessions?.[7].session_number).toBe(8);
		});
	});

	describe('Material Management', () => {
		it('should add materials to a session', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const sessions = await testHelpers.createSessions(module.id, 1);
			const session = sessions[0];

			const video = await testHelpers.createMaterial(session.id, {
				type: 'video',
				title: 'Introduction Video',
				content: 'https://youtube.com/watch?v=abc123',
				display_order: 0
			});

			const pdf = await testHelpers.createMaterial(session.id, {
				type: 'link',
				title: 'Reading Guide',
				content: 'https://example.com/guide.pdf',
				display_order: 1
			});

			expect(video.type).toBe('video');
			expect(pdf.type).toBe('link');
		});

		it('should retrieve materials for a session in order', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const sessions = await testHelpers.createSessions(module.id, 1);
			const session = sessions[0];

			await testHelpers.createMaterial(session.id, { display_order: 2, title: 'Third' });
			await testHelpers.createMaterial(session.id, { display_order: 0, title: 'First' });
			await testHelpers.createMaterial(session.id, { display_order: 1, title: 'Second' });

			const { data: materials } = await supabaseAdmin
				.from('courses_materials')
				.select('*')
				.eq('session_id', session.id)
				.order('display_order', { ascending: true });

			expect(materials).toHaveLength(3);
			expect(materials?.[0].title).toBe('First');
			expect(materials?.[1].title).toBe('Second');
			expect(materials?.[2].title).toBe('Third');
		});

		it('should delete a material', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const sessions = await testHelpers.createSessions(module.id, 1);
			const material = await testHelpers.createMaterial(sessions[0].id);

			const { error } = await supabaseAdmin
				.from('courses_materials')
				.delete()
				.eq('id', material.id);

			expect(error).toBeNull();
		});
	});

	describe('Reflection Questions', () => {
		it('should create a reflection question for a session', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const sessions = await testHelpers.createSessions(module.id, 1);

			const question = await testHelpers.createReflectionQuestion(sessions[0].id, {
				question_text: 'How do you understand faith in your daily life?'
			});

			expect(question).toBeDefined();
			expect(question.question_text).toContain('faith');
		});

		it('should update a reflection question', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const sessions = await testHelpers.createSessions(module.id, 1);
			const question = await testHelpers.createReflectionQuestion(sessions[0].id);

			const { data: updated, error } = await supabaseAdmin
				.from('courses_reflection_questions')
				.update({ question_text: 'Updated question prompt' })
				.eq('id', question.id)
				.select()
				.single();

			expect(error).toBeNull();
			expect(updated?.question_text).toBe('Updated question prompt');
		});
	});

	describe('Cohort Management', () => {
		it('should create a cohort for a module', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);

			const cohort = await testHelpers.createCohort(module.id, {
				name: 'Spring 2025 - Foundations',
				current_session: 1
			});

			expect(cohort).toBeDefined();
			expect(cohort.name).toBe('Spring 2025 - Foundations');
			expect(cohort.current_session).toBe(1);
		});

		it('should advance cohort session', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const cohort = await testHelpers.createCohort(module.id, { current_session: 1 });

			// Advance to session 2
			const { data: updated, error } = await supabaseAdmin
				.from('courses_cohorts')
				.update({ current_session: 2 })
				.eq('id', cohort.id)
				.select()
				.single();

			expect(error).toBeNull();
			expect(updated?.current_session).toBe(2);
			// Status transitions handled by application logic
		});

		it('should update cohort status', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const cohort = await testHelpers.createCohort(module.id, { current_session: 8 });

			const { data: updated, error } = await supabaseAdmin
				.from('courses_cohorts')
				.update({ status: 'active' })
				.eq('id', cohort.id)
				.select()
				.single();

			expect(error).toBeNull();
			expect(updated?.status).toBe('active');
		});
	});

	describe('Enrollment Workflow', () => {
		it('should enroll a student in a cohort', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const cohort = await testHelpers.createCohort(module.id);
			const user = await testHelpers.createUser({
				email: 'test-student@example.com',
				modules: ['courses.participant']
			});

			const enrollment = await testHelpers.createEnrollment(user.id, cohort.id, {
				role: 'student',
				status: 'active'
			});

			expect(enrollment).toBeDefined();
			expect(enrollment.role).toBe('student');
			expect(enrollment.status).toBe('active');
		});

		it('should retrieve enrollments for a cohort', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const cohort = await testHelpers.createCohort(module.id);

			const user1 = await testHelpers.createUser({ email: 'test-student1@example.com' });
			const user2 = await testHelpers.createUser({ email: 'test-student2@example.com' });

			await testHelpers.createEnrollment(user1.id, cohort.id);
			await testHelpers.createEnrollment(user2.id, cohort.id);

			const { data: enrollments } = await supabaseAdmin
				.from('courses_enrollments')
				.select('*')
				.eq('cohort_id', cohort.id);

			expect(enrollments).toHaveLength(2);
		});

		it('should update enrollment status', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const cohort = await testHelpers.createCohort(module.id);
			const user = await testHelpers.createUser();
			const enrollment = await testHelpers.createEnrollment(user.id, cohort.id, {
				status: 'pending'
			});

			const { data: updated, error } = await supabaseAdmin
				.from('courses_enrollments')
				.update({ status: 'active' })
				.eq('id', enrollment.id)
				.select()
				.single();

			expect(error).toBeNull();
			expect(updated?.status).toBe('active');
		});

		it('should delete an enrollment (unenroll student)', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const cohort = await testHelpers.createCohort(module.id);
			const user = await testHelpers.createUser();
			const enrollment = await testHelpers.createEnrollment(user.id, cohort.id);

			const { error } = await supabaseAdmin
				.from('courses_enrollments')
				.delete()
				.eq('id', enrollment.id);

			expect(error).toBeNull();
		});
	});

	describe('Reflection Submission & Grading', () => {
		it('should submit a reflection response', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const sessions = await testHelpers.createSessions(module.id, 1);
			const question = await testHelpers.createReflectionQuestion(sessions[0].id);
			const cohort = await testHelpers.createCohort(module.id);
			const user = await testHelpers.createUser();
			const enrollment = await testHelpers.createEnrollment(user.id, cohort.id);

			const { error } = await supabaseAdmin
				.from('courses_reflection_responses')
				.insert({
					question_id: question.id,
					enrollment_id: enrollment.id,
					cohort_id: cohort.id,
					response_text: 'This is my reflection on faith...',
					is_public: true,
					status: 'submitted'
				});

			expect(error).toBeNull();
		});

		it('should mark a reflection as passed', async () => {
			const course = await testHelpers.createCourse();
			const module = await testHelpers.createModule(course.id);
			const sessions = await testHelpers.createSessions(module.id, 1);
			const question = await testHelpers.createReflectionQuestion(sessions[0].id);
			const cohort = await testHelpers.createCohort(module.id);
			const user = await testHelpers.createUser();
			const enrollment = await testHelpers.createEnrollment(user.id, cohort.id);

			// Insert a reflection response
			const { error: insertError } = await supabaseAdmin
				.from('courses_reflection_responses')
				.insert({
					question_id: question.id,
					enrollment_id: enrollment.id,
					cohort_id: cohort.id,
					response_text: 'My reflection',
					status: 'submitted'
				});

			expect(insertError).toBeNull();

			// Get the response ID by querying for it
			const { data: responses } = await supabaseAdmin
				.from('courses_reflection_responses')
				.select('id')
				.eq('enrollment_id', enrollment.id)
				.eq('question_id', question.id);

			expect(responses).toBeDefined();
			expect(responses?.length).toBeGreaterThan(0);
			const responseId = responses![0].id;

			// Mark as passed
			const { error } = await supabaseAdmin
				.from('courses_reflection_responses')
				.update({
					status: 'passed',
					feedback: 'Great work!',
					marked_at: new Date().toISOString()
				})
				.eq('id', responseId);

			expect(error).toBeNull();
		});
	});
});

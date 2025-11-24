import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const supabase = createClient(
	process.env.PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Cleaning up test data...');

// Get test courses
const { data: testCourses } = await supabase
	.from('courses')
	.select('id')
	.like('slug', 'test-%');

if (testCourses && testCourses.length > 0) {
	const courseIds = testCourses.map(c => c.id);
	console.log(`Found ${courseIds.length} test courses to delete`);

	// Delete in order: reflection responses, enrollments, cohorts, materials, sessions, reflection questions, modules, courses

	// Get modules for these courses
	const { data: modules } = await supabase
		.from('courses_modules')
		.select('id')
		.in('course_id', courseIds);

	if (modules && modules.length > 0) {
		const moduleIds = modules.map(m => m.id);
		console.log(`Found ${moduleIds.length} test modules`);

		// Get cohorts
		const { data: cohorts } = await supabase
			.from('courses_cohorts')
			.select('id')
			.in('module_id', moduleIds);

		if (cohorts && cohorts.length > 0) {
			const cohortIds = cohorts.map(c => c.id);
			console.log(`Found ${cohortIds.length} test cohorts`);

			// Delete enrollments
			await supabase.from('courses_enrollments').delete().in('cohort_id', cohortIds);
			console.log('Deleted enrollments');

			// Delete cohorts
			await supabase.from('courses_cohorts').delete().in('id', cohortIds);
			console.log('Deleted cohorts');
		}

		// Get sessions
		const { data: sessions } = await supabase
			.from('courses_sessions')
			.select('id')
			.in('module_id', moduleIds);

		if (sessions && sessions.length > 0) {
			const sessionIds = sessions.map(s => s.id);
			console.log(`Found ${sessionIds.length} test sessions`);

			// Get reflection questions
			const { data: questions } = await supabase
				.from('courses_reflection_questions')
				.select('id')
				.in('session_id', sessionIds);

			if (questions && questions.length > 0) {
				const questionIds = questions.map(q => q.id);

				// Delete reflection responses
				await supabase.from('courses_reflection_responses').delete().in('question_id', questionIds);
				console.log('Deleted reflection responses');

				// Delete reflection questions
				await supabase.from('courses_reflection_questions').delete().in('id', questionIds);
				console.log('Deleted reflection questions');
			}

			// Delete materials
			await supabase.from('courses_materials').delete().in('session_id', sessionIds);
			console.log('Deleted materials');

			// Delete sessions
			await supabase.from('courses_sessions').delete().in('id', sessionIds);
			console.log('Deleted sessions');
		}

		// Delete modules
		await supabase.from('courses_modules').delete().in('id', moduleIds);
		console.log('Deleted modules');
	}

	// Delete courses
	await supabase.from('courses').delete().in('id', courseIds);
	console.log('Deleted courses');
}

// Delete test users
const { data: users, error: usersError } = await supabase
	.from('user_profiles')
	.delete()
	.like('email', 'test-%@example.com')
	.select();

if (!usersError) {
	console.log(`Deleted ${users?.length || 0} test users`);
}

console.log('Cleanup complete!');

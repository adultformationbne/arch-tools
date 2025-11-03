import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireModuleLevel } from '$lib/server/auth';

export const load: PageServerLoad = async (event) => {
	// Require participant module to access My Courses
	const { profile: userProfile } = await requireModuleLevel(event, 'courses.participant', {
		mode: 'redirect',
		redirectTo: '/auth'
	});

	if (!userProfile) {
		throw redirect(303, '/auth');
	}

	const userId = userProfile.id;
	const userModules: string[] = userProfile.modules ?? [];

	const derivedRole = userModules.some((mod) => mod === 'courses.manager' || mod === 'courses.admin' || mod === 'users')
		? 'admin'
		: 'student';

	// Fetch user's course enrollments
	const { data: enrollments, error: enrollmentError } = await supabaseAdmin
		.from('courses_enrollments')
		.select(`
			id,
			cohort_id,
			courses_cohorts!inner (
				id,
				name,
				module_id,
				courses_modules!inner (
					id,
					name,
					course_id,
					courses!inner (
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

	if (enrollmentError) {
		console.error('Error fetching enrollments:', enrollmentError);
	}

	// Extract unique courses from enrollments
	const coursesMap = new Map();

	if (enrollments) {
		for (const enrollment of enrollments) {
			const course = enrollment.courses_cohorts?.courses_modules?.courses;
			if (course && !coursesMap.has(course.id)) {
				coursesMap.set(course.id, {
					id: course.id,
					name: course.name,
					short_name: course.short_name,
					slug: course.slug,
					description: course.description,
					settings: course.settings
				});
			}
		}
	}

	const userCourses = Array.from(coursesMap.values());

	// If user is enrolled in exactly one course, redirect directly to it
	if (userCourses.length === 1) {
		const course = userCourses[0];
		throw redirect(303, `/courses/${course.slug}`);
	}

	// Multiple courses or no courses - show selector
	return {
		courses: userCourses,
		userRole: derivedRole,
		noEnrollments: userCourses.length === 0
	};
};

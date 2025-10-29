import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';

export const load: PageServerLoad = async ({ parent }) => {
	const { userProfile } = await parent();

	if (!userProfile) {
		// Not logged in - redirect to login (we'll need a generic login or course selection)
		throw redirect(303, '/login');
	}

	const userId = userProfile.id;
	const userRole = userProfile.role;

	// If admin, show all active courses
	if (userRole === 'admin') {
		const { data: courses, error: coursesError } = await supabaseAdmin
			.from('courses')
			.select('id, name, short_name, slug, description')
			.eq('is_active', true)
			.order('name');

		return {
			courses: courses || [],
			userRole: 'admin'
		};
	}

	// For students and hub coordinators, show courses they're enrolled in
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
						description
					)
				)
			)
		`)
		.eq('user_profile_id', userId)
		.in('status', ['active', 'invited', 'accepted']);

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
					description: course.description
				});
			}
		}
	}

	const userCourses = Array.from(coursesMap.values());

	// If user is enrolled in exactly one course, redirect directly to it
	if (userCourses.length === 1) {
		const course = userCourses[0];
		throw redirect(303, `/courses/${course.slug}/dashboard`);
	}

	// If no enrollments, show empty state
	if (userCourses.length === 0) {
		return {
			courses: [],
			userRole,
			noEnrollments: true
		};
	}

	// Multiple courses - let user choose
	return {
		courses: userCourses,
		userRole
	};
};

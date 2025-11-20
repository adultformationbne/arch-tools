import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { requireModuleLevel } from '$lib/server/auth';
import { CourseQueries } from '$lib/server/course-data';

export const load: PageServerLoad = async (event) => {
	// Require participant module to access My Courses
	const { profile: userProfile } = await requireModuleLevel(event, 'courses.participant', {
		mode: 'redirect',
		redirectTo: '/login'
	});

	if (!userProfile) {
		throw redirect(303, '/login');
	}

	const userId = userProfile.id;
	const userModules: string[] = userProfile.modules ?? [];

	const derivedRole = userModules.some(
		(mod) => mod === 'courses.manager' || mod === 'courses.admin' || mod === 'platform.admin'
	)
		? 'admin'
		: 'student';

	// Fetch user's course enrollments with full course details
	const { data: enrollments, error: enrollmentError } =
		await CourseQueries.getUserEnrollmentsWithCourses(userId);

	if (enrollmentError) {
		console.error('Error fetching enrollments:', enrollmentError);
	}

	// Extract unique courses from enrollments
	const coursesMap = new Map();

	if (enrollments) {
		for (const enrollment of enrollments) {
			const course = enrollment.cohort?.module?.course;
			if (course && !coursesMap.has(course.id)) {
				coursesMap.set(course.id, course);
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

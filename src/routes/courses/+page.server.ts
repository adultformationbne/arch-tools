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

	// Build course data with their enrollments
	const coursesMap = new Map<string, {
		course: any;
		enrollments: any[];
	}>();

	if (enrollments) {
		for (const enrollment of enrollments) {
			const course = enrollment.cohort?.module?.course;
			if (course) {
				if (!coursesMap.has(course.id)) {
					coursesMap.set(course.id, { course, enrollments: [] });
				}
				coursesMap.get(course.id)!.enrollments.push({
					id: enrollment.id,
					cohortId: enrollment.cohort_id,
					cohortName: enrollment.cohort?.name,
					moduleName: enrollment.cohort?.module?.name,
					role: enrollment.role,
					status: enrollment.status
				});
			}
		}
	}

	const courseData = Array.from(coursesMap.values());
	const totalEnrollments = enrollments?.length ?? 0;

	// Only auto-redirect if user has exactly ONE enrollment total
	// (not just one course - they might have multiple cohorts in that course)
	if (totalEnrollments === 1 && courseData.length === 1) {
		const course = courseData[0].course;
		throw redirect(303, `/courses/${course.slug}`);
	}

	// Multiple enrollments or no enrollments - show selector
	return {
		courseData,
		userRole: derivedRole,
		noEnrollments: totalEnrollments === 0
	};
};

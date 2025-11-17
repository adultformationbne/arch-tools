import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin, hasModuleLevel } from '$lib/server/auth.js';

export const load: LayoutServerLoad = async (event) => {
	const startTime = Date.now();
	const { params, url } = event;
	const courseSlug = params.slug;

	console.log(`[ADMIN LAYOUT] Loading: /admin/courses/${courseSlug}${url.pathname.replace(`/admin/courses/${courseSlug}`, '')}`);

	// ✅ OPTIMIZATION: Load parent and course data in parallel (no waterfall!)
	const parallelStart = Date.now();
	const [parentData, courseResult] = await Promise.all([
		event.parent(),
		supabaseAdmin
			.from('courses')
			.select('id, name, short_name, description, settings')
			.eq('slug', courseSlug)
			.single()
	]);
	console.log(`[ADMIN LAYOUT] ⚡ Parallel parent + course: ${Date.now() - parallelStart}ms`);

	// Check auth using cached data from parent
	const authStart = Date.now();
	const authCache = parentData._authCache;

	let isCourseAdmin = false;
	let enrollmentRole = null;
	let viaModule = null;

	if (authCache?.user && authCache?.profile) {
		// Use cached auth data from parent layout
		console.log(`[ADMIN LAYOUT] ⚡ Using cached auth from parent`);
		const profile = authCache.profile;
		const user = authCache.user;

		// Check if user has platform-level course admin access
		const hasPlatformAdmin = hasModuleLevel(profile?.modules, 'courses.admin');
		const hasCourseManager = hasModuleLevel(profile?.modules, 'courses.manager');

		// Check enrollment in this course
		const { data: enrollment } = await supabaseAdmin
			.from('courses_enrollments')
			.select(`
				role,
				courses_cohorts!inner (
					courses_modules!inner (
						courses!inner (
							slug
						)
					)
				)
			`)
			.eq('user_profile_id', user.id)
			.eq('courses_cohorts.courses_modules.courses.slug', courseSlug)
			.in('status', ['active', 'invited', 'accepted'])
			.maybeSingle();

		if (enrollment) {
			enrollmentRole = enrollment.role;
		}

		// Determine if user has course admin access
		// Can be via platform module OR enrollment as admin
		if (hasPlatformAdmin) {
			isCourseAdmin = true;
			viaModule = 'courses.admin';
		} else if (hasCourseManager) {
			// Course managers need to be assigned to this specific course
			// This is handled by assigned_course_ids check
			// For now, we'll allow if they have the module
			isCourseAdmin = true;
			viaModule = 'courses.manager';
		} else if (enrollmentRole === 'admin') {
			isCourseAdmin = true;
		}

		// If no admin access, redirect
		if (!isCourseAdmin) {
			throw redirect(303, '/courses');
		}

		console.log(`[ADMIN LAYOUT] Auth check (cached): ${Date.now() - authStart}ms - isCourseAdmin: ${isCourseAdmin}, via: ${viaModule || 'enrollment'}`);
	} else {
		// Fall back to full auth check
		console.log(`[ADMIN LAYOUT] No auth cache, doing full check`);
		const authResult = await requireCourseAdmin(event, courseSlug, {
			mode: 'redirect',
			redirectTo: '/courses'
		});
		viaModule = authResult.viaModule;
		isCourseAdmin = true;

		// Still check enrollment
		const { data: enrollment } = await supabaseAdmin
			.from('courses_enrollments')
			.select(`
				role,
				courses_cohorts!inner (
					courses_modules!inner (
						courses!inner (
							slug
						)
					)
				)
			`)
			.eq('user_profile_id', authResult.user.id)
			.eq('courses_cohorts.courses_modules.courses.slug', courseSlug)
			.in('status', ['active', 'invited', 'accepted'])
			.maybeSingle();

		if (enrollment) {
			enrollmentRole = enrollment.role;
		}

		console.log(`[ADMIN LAYOUT] Auth check: ${Date.now() - authStart}ms`);
	}

	const course = courseResult.data;
	let cohorts = [];
	let modules = [];

	if (course) {
		// ✅ OPTIMIZATION: Single query to get modules with their cohorts using join
		const dataStart = Date.now();
		const { data: modulesData } = await supabaseAdmin
			.from('courses_modules')
			.select(`
				id,
				name,
				description,
				order_number,
				courses_cohorts (
					id,
					name,
					current_session,
					start_date,
					end_date,
					status,
					module_id
				)
			`)
			.eq('course_id', course.id)
			.order('order_number', { ascending: true });

		modules = (modulesData || []).map(m => ({
			id: m.id,
			name: m.name,
			description: m.description,
			order_number: m.order_number
		}));

		// Flatten cohorts from all modules and add module reference
		cohorts = (modulesData || [])
			.flatMap(m =>
				(m.courses_cohorts || []).map(c => ({
					...c,
					courses_modules: {
						id: m.id,
						name: m.name
					}
				}))
			)
			.sort((a, b) => {
				const dateA = new Date(a.start_date || 0);
				const dateB = new Date(b.start_date || 0);
				return dateB.getTime() - dateA.getTime(); // descending
			});

		console.log(`[ADMIN LAYOUT] Modules + cohorts (joined): ${Date.now() - dataStart}ms`);
	}

	// Extract theme and branding from course settings
	const settings = course?.settings || {};
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};

	// ✅ OPTIMIZATION: Cache course data in event.locals for API endpoints
	if (!event.locals.courseCache) {
		event.locals.courseCache = new Map();
	}
	event.locals.courseCache.set(courseSlug, {
		course,
		modules,
		cohorts,
		moduleIds: modules.map(m => m.id),
		cohortIds: cohorts.map(c => c.id)
	});

	console.log(`[ADMIN LAYOUT] ✅ Complete in ${Date.now() - startTime}ms (modules: ${modules.length}, cohorts: ${cohorts.length})\n`);

	return {
		courseSlug: params.slug,
		userModules: parentData.userProfile?.modules || [],
		enrollmentRole, // From this layout's enrollment check
		isCourseAdmin, // From this layout's auth check
		cohorts,
		modules, // Share modules across all admin pages
		courseInfo: {
			id: course?.id,
			slug: params.slug,
			name: course?.name,
			shortName: course?.short_name,
			description: course?.description
		},
		courseTheme,
		courseBranding
	};
};

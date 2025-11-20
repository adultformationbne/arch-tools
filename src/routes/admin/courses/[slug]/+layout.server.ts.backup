import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { requireCourseAdmin } from '$lib/server/auth.js';

export const load: LayoutServerLoad = async (event) => {
	const { params } = event;
	const courseSlug = params.slug;

	// Check auth
	const { user, enrollment } = await requireCourseAdmin(event, courseSlug, {
		mode: 'redirect',
		redirectTo: '/courses'
	});

	// Load course
	const { data: course } = await supabaseAdmin
		.from('courses')
		.select('id, name, short_name, description, settings')
		.eq('slug', courseSlug)
		.single();

	if (!course) {
		throw redirect(303, '/courses');
	}

	// Load modules with cohorts
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

	const modules = (modulesData || []).map(m => ({
		id: m.id,
		name: m.name,
		description: m.description,
		order_number: m.order_number
	}));

	// Flatten cohorts from all modules
	const cohorts = (modulesData || [])
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
			return dateB.getTime() - dateA.getTime();
		});

	// Extract theme and branding
	const settings = course?.settings || {};
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};

	return {
		courseSlug: params.slug,
		enrollmentRole: enrollment?.role,
		isCourseAdmin: true,
		cohorts,
		modules,
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

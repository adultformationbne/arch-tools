import { error } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { CourseQueries } from '$lib/server/course-data.js';
import { requireCourseAccess } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getCourseSettings } from '$lib/types/course-settings.js';

export const load: LayoutServerLoad = async (event) => {
	const { params } = event;
	const { slug } = params;

	// Load course by slug using repository
	const { data: course, error: courseError } = await CourseQueries.getCourse(slug);

	if (courseError || !course) {
		throw error(404, `Course "${slug}" not found`);
	}

	// Use unified auth function to check course access
	// This handles both enrollment and module-level access
	const { user, enrollment } = await requireCourseAccess(event, slug, {
		mode: 'redirect',
		redirectTo: '/courses'
	});

	const enrollmentRole = enrollment?.role ?? null;
	const cohortId = enrollment?.cohort_id ?? null;

	// Get full user profile for display
	const parentData = await event.parent();
	const { userProfile } = parentData;

	// Extract theme and branding from course settings
	const settings = course.settings || {};
	const courseTheme = settings.theme || {};
	const courseBranding = settings.branding || {};
	const courseSettings = getCourseSettings(settings);
	const chatEnabled = courseSettings.features?.chatEnabled !== false;

	// Check for unread chat messages (coordinators and admins only)
	let hasUnreadChat = false;
	if (cohortId && (enrollmentRole === 'coordinator' || enrollmentRole === 'admin')) {
		const { data: readStatus } = await supabaseAdmin
			.from('courses_chat_read_status')
			.select('last_read_at')
			.eq('cohort_id', cohortId)
			.eq('user_id', user.id)
			.maybeSingle();

		const lastRead = readStatus?.last_read_at || '1970-01-01';

		const { data: newerMessages } = await supabaseAdmin
			.from('courses_chat_messages')
			.select('id')
			.eq('cohort_id', cohortId)
			.gt('created_at', lastRead)
			.limit(1);

		hasUnreadChat = (newerMessages?.length ?? 0) > 0;
	}

	// Get hub name for coordinator chat sidebar
	let hubName = null;
	if (enrollmentRole === 'coordinator' && enrollment?.hub_id) {
		const { data: hub } = await supabaseAdmin
			.from('courses_hubs').select('name').eq('id', enrollment.hub_id).maybeSingle();
		hubName = hub?.name || null;
	}

	return {
		userRole: enrollmentRole || 'student', // Use actual role: 'student' or 'coordinator'
		userName: userProfile?.full_name || userProfile?.display_name || 'User',
		userProfile,
		courseSlug: slug,
		enrollmentRole,
		cohortId,
		userId: user.id,
		hasUnreadChat,
		hubName,
		chatEnabled,
		courseInfo: {
			id: course.id,
			slug: course.slug,
			name: course.name,
			shortName: course.short_name,
			description: course.description
		},
		courseTheme,
		courseBranding
	};
};

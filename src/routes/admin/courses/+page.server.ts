import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { hasModule, hasModuleLevel, requireAnyModule, requireModuleLevel } from '$lib/server/auth';

const STATUS_OPTIONS = ['draft', 'active', 'archived'] as const;

export const load: PageServerLoad = async (event) => {
	const {
		profile: userProfile
	} = await requireAnyModule(event, ['courses.admin', 'courses.manager'], {
		mode: 'redirect',
		redirectTo: '/login'
	});

	if (!userProfile) {
		throw redirect(303, '/login');
	}

	const userModules: string[] = userProfile.modules ?? [];
	const userId = userProfile.id;

	const canManageAll = hasModuleLevel(userModules, 'courses.admin');
	const canManageAssigned = hasModuleLevel(userModules, 'courses.manager');

	if (!canManageAll && !canManageAssigned) {
		throw redirect(303, '/courses');
	}

	if (canManageAll) {
		const { data: courses, error: coursesError } = await supabaseAdmin
			.from('courses')
			.select(
				`
					id,
					name,
					short_name,
					description,
					duration_weeks,
					is_active,
					status,
					metadata,
					settings,
					slug,
					created_at,
					updated_at,
					courses_modules(count)
				`
			)
			.order('created_at', { ascending: false });

		if (coursesError) {
			console.error('Error loading courses for admin view:', coursesError);
		}

		const coursesWithCount =
			courses?.map((course) => ({
				...course,
				moduleCount: course.courses_modules?.[0]?.count || 0
			})) ?? [];

		// Fetch all users with courses.manager module for assignment UI
		const { data: managers } = await supabaseAdmin
			.from('user_profiles')
			.select('id, full_name, email, assigned_course_ids')
			.contains('modules', ['courses.manager'])
			.order('full_name', { ascending: true });

		return {
			courses: coursesWithCount,
			managers: managers || [],
			userRole: 'admin',
			userProfile,
			canManageAll: true,
			noEnrollments: false
		};
	}

	// Manager-level access: list courses they're assigned to via assigned_course_ids
	const assignedCourseIds = userProfile.assigned_course_ids || [];

	if (!Array.isArray(assignedCourseIds) || assignedCourseIds.length === 0) {
		return {
			courses: [],
			userRole: 'manager',
			canManageAll: false,
			noEnrollments: true
		};
	}

	const { data: managedCourses, error: managedError } = await supabaseAdmin
		.from('courses')
		.select(`
			id,
			name,
			short_name,
			slug,
			description,
			duration_weeks,
			is_active,
			status,
			metadata,
			settings,
			created_at,
			updated_at,
			courses_modules(count)
		`)
		.in('id', assignedCourseIds)
		.order('created_at', { ascending: false });

	if (managedError) {
		console.error('Error fetching assigned courses for manager view:', managedError);
	}

	const managedCoursesWithCount =
		managedCourses?.map((course) => ({
			...course,
			moduleCount: course.courses_modules?.[0]?.count || 0
		})) ?? [];

	// Auto-redirect to single course UNLESS user explicitly came back here
	const skipRedirect = event.url.searchParams.get('from') === 'course';

	if (managedCoursesWithCount.length === 1 && !skipRedirect) {
		const course = managedCoursesWithCount[0];
		if (course?.slug) {
			throw redirect(303, `/admin/courses/${course.slug}`);
		}
	}

	return {
		courses: managedCoursesWithCount,
		managers: [],
		userRole: 'manager',
		userProfile,
		canManageAll: false,
		noEnrollments: managedCoursesWithCount.length === 0
	};
};

function sanitizeSlug(rawSlug: unknown) {
	if (typeof rawSlug !== 'string') return '';
	return rawSlug
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function parseInteger(value: FormDataEntryValue | null) {
	if (!value) return null;
	const parsed = Number.parseInt(value.toString(), 10);
	return Number.isNaN(parsed) ? null : parsed;
}

function parseBoolean(value: FormDataEntryValue | null) {
	if (!value) return false;
	const normalised = value.toString().toLowerCase();
	return normalised === 'true' || normalised === 'on' || normalised === '1';
}

function parseJsonField(value: FormDataEntryValue | null) {
	if (!value) return {};
	const trimmed = value.toString().trim();
	if (!trimmed) return {};
	try {
		return JSON.parse(trimmed);
	} catch (error) {
		throw new Error('Invalid JSON');
	}
}

export const actions: Actions = {
	create: async (event) => {
		// Allow both admins and managers to create courses
		let userProfile;
		let creatorRole;
		try {
			const result = await requireAnyModule(event, ['courses.admin', 'courses.manager']);
			userProfile = result.profile;
			creatorRole = hasModuleLevel(userProfile.modules, 'courses.admin') ? 'admin' : 'manager';
		} catch (err) {
			return fail(403, {
				type: 'error',
				message: 'Requires courses.admin or courses.manager module to create courses.'
			});
		}

		const { request } = event;
		const formData = await request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const shortName = formData.get('short_name')?.toString().trim() ?? '';
		const description = formData.get('description')?.toString().trim() ?? '';
		const rawSlug = formData.get('slug');
		const slugValue = sanitizeSlug(rawSlug ?? name);
		const durationWeeks = parseInteger(formData.get('duration_weeks'));
		const isActive = parseBoolean(formData.get('is_active'));
		const status = (formData.get('status')?.toString().trim() ?? 'draft').toLowerCase();
		let metadata = {};
		let settings = {};

		if (!name) {
			return fail(400, {
				type: 'error',
				message: 'Course name is required.',
				errors: { name: 'Required' },
				values: Object.fromEntries(formData),
				context: { action: 'create' }
			});
		}

		if (!slugValue) {
			return fail(400, {
				type: 'error',
				message: 'Slug is required.',
				errors: { slug: 'Required' },
				values: Object.fromEntries(formData),
				context: { action: 'create' }
			});
		}

		if (!STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
			return fail(400, {
				type: 'error',
				message: 'Invalid status.',
				errors: { status: 'Invalid option' },
				values: Object.fromEntries(formData),
				context: { action: 'create' }
			});
		}

		try {
			metadata = parseJsonField(formData.get('metadata'));
		} catch (error) {
			return fail(400, {
				type: 'error',
				message: 'Metadata must be valid JSON.',
				errors: { metadata: 'Invalid JSON' },
				values: Object.fromEntries(formData),
				context: { action: 'create' }
			});
		}

		try {
			settings = parseJsonField(formData.get('settings'));
		} catch (error) {
			return fail(400, {
				type: 'error',
				message: 'Settings must be valid JSON.',
				errors: { settings: 'Invalid JSON' },
				values: Object.fromEntries(formData),
				context: { action: 'create' }
			});
		}

		// Add creator information to metadata
		const enrichedMetadata = {
			...metadata,
			created_by_role: creatorRole,
			created_by_user_id: userProfile.id,
			created_at: new Date().toISOString()
		};

		const insertPayload = {
			name,
			short_name: shortName || null,
			description: description || null,
			slug: slugValue,
			duration_weeks: durationWeeks,
			is_active: isActive,
			status,
			metadata: enrichedMetadata,
			settings
		};

		const { data: newCourse, error } = await supabaseAdmin
			.from('courses')
			.insert(insertPayload)
			.select('id')
			.single();

		if (error) {
			console.error('Error creating course:', error);
			const constraintMessage =
				error.code === '23505' && error.message.includes('courses_slug_key')
					? 'Slug must be unique. Another course already uses this slug.'
					: 'Failed to create course. Please try again.';
			return fail(500, {
				type: 'error',
				message: constraintMessage,
				values: Object.fromEntries(formData),
				context: { action: 'create' }
			});
		}

		// Auto-assign managers to courses they create
		if (creatorRole === 'manager' && newCourse) {
			const currentAssignments = userProfile.assigned_course_ids || [];
			const updatedAssignments = [...currentAssignments, newCourse.id];

			await supabaseAdmin
				.from('user_profiles')
				.update({ assigned_course_ids: updatedAssignments })
				.eq('id', userProfile.id);
		}

		return {
			type: 'success',
			message: 'Course created successfully.',
			context: { action: 'create' }
		};
	},
	update: async (event) => {
		try {
			await requireModuleLevel(event, 'courses.admin');
		} catch (err) {
			return fail(403, {
				type: 'error',
				message: 'Only platform admins can update courses.'
			});
		}

		const { request } = event;

		const formData = await request.formData();
		const courseId = formData.get('course_id')?.toString();
		if (!courseId) {
			return fail(400, {
				type: 'error',
				message: 'Missing course identifier.',
				context: { action: 'update' }
			});
		}

		const name = formData.get('name')?.toString().trim() ?? '';
		const shortName = formData.get('short_name')?.toString().trim() ?? '';
		const description = formData.get('description')?.toString().trim() ?? '';
		const rawSlug = formData.get('slug');
		const slugValue = sanitizeSlug(rawSlug ?? name);
		const durationWeeks = parseInteger(formData.get('duration_weeks'));
		const isActive = parseBoolean(formData.get('is_active'));
		const status = (formData.get('status')?.toString().trim() ?? 'draft').toLowerCase();
		let metadata = {};
		let settings = {};

		if (!name) {
			return fail(400, {
				type: 'error',
				message: 'Course name is required.',
				errors: { name: 'Required' },
				values: Object.fromEntries(formData),
				context: { action: 'update', courseId }
			});
		}

		if (!slugValue) {
			return fail(400, {
				type: 'error',
				message: 'Slug is required.',
				errors: { slug: 'Required' },
				values: Object.fromEntries(formData),
				context: { action: 'update', courseId }
			});
		}

		if (!STATUS_OPTIONS.includes(status as (typeof STATUS_OPTIONS)[number])) {
			return fail(400, {
				type: 'error',
				message: 'Invalid status.',
				errors: { status: 'Invalid option' },
				values: Object.fromEntries(formData),
				context: { action: 'update', courseId }
			});
		}

		try {
			metadata = parseJsonField(formData.get('metadata'));
		} catch (error) {
			return fail(400, {
				type: 'error',
				message: 'Metadata must be valid JSON.',
				errors: { metadata: 'Invalid JSON' },
				values: Object.fromEntries(formData),
				context: { action: 'update', courseId }
			});
		}

		try {
			settings = parseJsonField(formData.get('settings'));
		} catch (error) {
			return fail(400, {
				type: 'error',
				message: 'Settings must be valid JSON.',
				errors: { settings: 'Invalid JSON' },
				values: Object.fromEntries(formData),
				context: { action: 'update', courseId }
			});
		}

		const updatePayload = {
			name,
			short_name: shortName || null,
			description: description || null,
			slug: slugValue,
			duration_weeks: durationWeeks,
			is_active: isActive,
			status,
			metadata,
			settings,
			updated_at: new Date().toISOString()
		};

		const { error } = await supabaseAdmin.from('courses').update(updatePayload).eq('id', courseId);

		if (error) {
			console.error('Error updating course:', error);
			const constraintMessage =
				error.code === '23505' && error.message.includes('courses_slug_key')
					? 'Slug must be unique. Another course already uses this slug.'
					: 'Failed to update course. Please try again.';
			return fail(500, {
				type: 'error',
				message: constraintMessage,
				values: Object.fromEntries(formData),
				context: { action: 'update', courseId }
			});
		}

		return {
			type: 'success',
			message: 'Course updated successfully.',
			context: { action: 'update', courseId }
		};
	},
	delete: async (event) => {
		// Allow both admins and managers to delete (with restrictions)
		let userProfile;
		let userRole;
		try {
			const result = await requireAnyModule(event, ['courses.admin', 'courses.manager']);
			userProfile = result.profile;
			userRole = hasModuleLevel(userProfile.modules, 'courses.admin') ? 'admin' : 'manager';
		} catch (err) {
			return fail(403, {
				type: 'error',
				message: 'Requires courses.admin or courses.manager module to delete courses.'
			});
		}

		const { request } = event;
		const formData = await request.formData();
		const courseId = formData.get('course_id')?.toString();

		if (!courseId) {
			return fail(400, {
				type: 'error',
				message: 'Missing course identifier.',
				context: { action: 'delete' }
			});
		}

		// Fetch the course to check creator
		const { data: course, error: fetchError } = await supabaseAdmin
			.from('courses')
			.select('id, metadata')
			.eq('id', courseId)
			.single();

		if (fetchError || !course) {
			return fail(404, {
				type: 'error',
				message: 'Course not found.',
				context: { action: 'delete', courseId }
			});
		}

		// Check permissions based on who created the course
		const createdByRole = course.metadata?.created_by_role;

		if (userRole === 'manager') {
			// Managers can only delete courses they created (manager courses)
			if (createdByRole !== 'manager') {
				return fail(403, {
					type: 'error',
					message: 'Managers can only delete courses created by managers. This is an admin course.',
					context: { action: 'delete', courseId }
				});
			}

			// Verify the manager created this specific course
			const createdByUserId = course.metadata?.created_by_user_id;
			if (createdByUserId !== userProfile.id) {
				return fail(403, {
					type: 'error',
					message: 'Managers can only delete courses they personally created.',
					context: { action: 'delete', courseId }
				});
			}
		}
		// Admins can delete any course (no additional checks needed)

		const { error } = await supabaseAdmin.from('courses').delete().eq('id', courseId);

		if (error) {
			console.error('Error deleting course:', error);
			const message =
				error.code === '23503'
					? 'Cannot delete course because related records exist (modules, cohorts, enrollments, etc.).'
					: 'Failed to delete course. Please try again.';
			return fail(500, {
				type: 'error',
				message,
				context: { action: 'delete', courseId }
			});
		}

		return {
			type: 'success',
			message: 'Course deleted successfully.',
			context: { action: 'delete', courseId }
		};
	},
	updateManagers: async (event) => {
		try {
			await requireModuleLevel(event, 'courses.admin');
		} catch (err) {
			return fail(403, {
				type: 'error',
				message: 'Only platform admins can assign managers.'
			});
		}

		const { request } = event;
		const formData = await request.formData();
		const courseId = formData.get('course_id')?.toString();
		const managerIds = formData.getAll('manager_ids');

		if (!courseId) {
			return fail(400, {
				type: 'error',
				message: 'Missing course identifier.'
			});
		}

		// Get all users with courses.manager module
		const { data: allManagers } = await supabaseAdmin
			.from('user_profiles')
			.select('id, assigned_course_ids')
			.contains('modules', ['courses.manager']);

		if (!allManagers) {
			return fail(500, {
				type: 'error',
				message: 'Failed to fetch managers.'
			});
		}

		// Update each manager's assigned_course_ids
		for (const manager of allManagers) {
			const currentAssignments = manager.assigned_course_ids || [];
			const shouldBeAssigned = managerIds.includes(manager.id);
			const isCurrentlyAssigned = currentAssignments.includes(courseId);

			let newAssignments = [...currentAssignments];

			if (shouldBeAssigned && !isCurrentlyAssigned) {
				// Add this course to manager's assignments
				newAssignments.push(courseId);
			} else if (!shouldBeAssigned && isCurrentlyAssigned) {
				// Remove this course from manager's assignments
				newAssignments = newAssignments.filter(id => id !== courseId);
			} else {
				// No change needed for this manager
				continue;
			}

			// Update the manager's profile
			const { error } = await supabaseAdmin
				.from('user_profiles')
				.update({ assigned_course_ids: newAssignments })
				.eq('id', manager.id);

			if (error) {
				console.error('Error updating manager assignments:', error);
				return fail(500, {
					type: 'error',
					message: `Failed to update assignments for ${manager.id}`
				});
			}
		}

		return {
			type: 'success',
			message: 'Manager assignments updated successfully.'
		};
	}
};

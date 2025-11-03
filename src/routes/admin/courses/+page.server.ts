import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { hasModule, hasModuleLevel, requireAnyModule } from '$lib/server/auth';

const STATUS_OPTIONS = ['draft', 'active', 'archived'] as const;

export const load: PageServerLoad = async (event) => {
	const {
		profile: userProfile
	} = await requireAnyModule(event, ['courses.admin', 'courses.manager', 'users'], {
		mode: 'redirect',
		redirectTo: '/auth'
	});

	if (!userProfile) {
		throw redirect(303, '/auth');
	}

	const userModules: string[] = userProfile.modules ?? [];
	const userId = userProfile.id;

	const canManageAll = hasModuleLevel(userModules, 'courses.admin') || hasModule(userModules, 'users');
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

		return {
			courses: coursesWithCount,
			userRole: 'admin',
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

	if (managedCoursesWithCount.length === 1) {
		const course = managedCoursesWithCount[0];
		if (course?.slug) {
			throw redirect(303, `/admin/courses/${course.slug}`);
		}
	}

	return {
		courses: managedCoursesWithCount,
		userRole: 'manager',
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
		try {
			await requireAnyModule(event, ['courses.admin', 'users']);
		} catch (err) {
			return fail(403, {
				type: 'error',
				message: 'Only platform admins can manage courses.'
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

		const insertPayload = {
			name,
			short_name: shortName || null,
			description: description || null,
			slug: slugValue,
			duration_weeks: durationWeeks,
			is_active: isActive,
			status,
			metadata,
			settings
		};

		const { error } = await supabaseAdmin.from('courses').insert(insertPayload);

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

		return {
			type: 'success',
			message: 'Course created successfully.',
			context: { action: 'create' }
		};
	},
	update: async (event) => {
		try {
			await requireAnyModule(event, ['courses.admin', 'users']);
		} catch (err) {
			return fail(403, {
				type: 'error',
				message: 'Only platform admins can manage courses.'
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
		try {
			await requireAnyModule(event, ['courses.admin', 'users']);
		} catch (err) {
			return fail(403, {
				type: 'error',
				message: 'Only platform admins can manage courses.'
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
	}
};

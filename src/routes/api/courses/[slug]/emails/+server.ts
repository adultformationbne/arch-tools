import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';

// GET /api/courses/[slug]/emails - List all templates for a course
export const GET: RequestHandler = async (event) => {
	try {
		const { slug } = event.params;

		// Auth check - require course admin
		const { user } = await requireCourseAdmin(event, slug);

		// Get course
		const { data: course, error: courseError } = await supabaseAdmin
			.from('courses')
			.select('id, name, slug')
			.eq('slug', slug)
			.single();

		if (courseError || !course) {
			return json({ error: 'Course not found' }, { status: 404 });
		}

		// Get all templates for this course
		const { data: templates, error: templatesError } = await supabaseAdmin
			.from('courses_email_templates')
			.select('*')
			.eq('course_id', course.id)
			.eq('is_active', true)
			.order('category', { ascending: true })
			.order('name', { ascending: true });

		if (templatesError) {
			console.error('Error fetching templates:', templatesError);
			return json({ error: 'Failed to fetch templates' }, { status: 500 });
		}

		// Separate system and custom templates
		const systemTemplates = templates.filter((t) => t.category === 'system');
		const customTemplates = templates.filter((t) => t.category === 'custom');

		return json({
			success: true,
			course: {
				id: course.id,
				name: course.name,
				slug: course.slug
			},
			templates: {
				system: systemTemplates,
				custom: customTemplates,
				all: templates
			}
		});
	} catch (error) {
		console.error('GET /api/courses/[slug]/emails error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

// POST /api/courses/[slug]/emails - Create a new custom template
export const POST: RequestHandler = async (event) => {
	try {
		const { slug } = event.params;

		// Auth check - require course admin
		const { user } = await requireCourseAdmin(event, slug);

		// Get course
		const { data: course, error: courseError } = await supabaseAdmin
			.from('courses')
			.select('id')
			.eq('slug', slug)
			.single();

		if (courseError || !course) {
			return json({ error: 'Course not found' }, { status: 404 });
		}

		// Parse request body
		const body = await event.request.json();
		const { template_key, name, description, subject_template, body_template, available_variables } =
			body;

		// Validation
		if (!template_key || !name || !subject_template || !body_template) {
			return json(
				{
					error: 'Missing required fields: template_key, name, subject_template, body_template'
				},
				{ status: 400 }
			);
		}

		// Create template (always custom, always deletable)
		const { data: template, error: createError } = await supabaseAdmin
			.from('courses_email_templates')
			.insert({
				course_id: course.id,
				template_key,
				name,
				description: description || null,
				category: 'custom',
				subject_template,
				body_template,
				available_variables: available_variables || [],
				trigger_event: null, // Custom templates don't have automated triggers
				is_active: true,
				is_deletable: true,
				created_by: user.id
			})
			.select()
			.single();

		if (createError) {
			console.error('Error creating template:', createError);

			// Check for unique constraint violation
			if (createError.code === '23505') {
				return json(
					{ error: 'A template with this key already exists for this course' },
					{ status: 409 }
				);
			}

			return json({ error: 'Failed to create template' }, { status: 500 });
		}

		return json({
			success: true,
			template
		});
	} catch (error) {
		console.error('POST /api/courses/[slug]/emails error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

// PUT /api/courses/[slug]/emails - Update a template
export const PUT: RequestHandler = async (event) => {
	try {
		const { slug } = event.params;

		// Auth check - require course admin
		await requireCourseAdmin(event, slug);

		// Get course
		const { data: course, error: courseError } = await supabaseAdmin
			.from('courses')
			.select('id')
			.eq('slug', slug)
			.single();

		if (courseError || !course) {
			return json({ error: 'Course not found' }, { status: 404 });
		}

		// Parse request body
		const body = await event.request.json();
		const { template_id, name, description, subject_template, body_template, available_variables } =
			body;

		if (!template_id) {
			return json({ error: 'Missing required field: template_id' }, { status: 400 });
		}

		// Get existing template to verify it belongs to this course
		const { data: existingTemplate, error: fetchError } = await supabaseAdmin
			.from('courses_email_templates')
			.select('id, course_id, category')
			.eq('id', template_id)
			.single();

		if (fetchError || !existingTemplate) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		if (existingTemplate.course_id !== course.id) {
			return json({ error: 'Template does not belong to this course' }, { status: 403 });
		}

		// Build update object (only update provided fields)
		const updates: any = {
			updated_at: new Date().toISOString()
		};

		if (name !== undefined) updates.name = name;
		if (description !== undefined) updates.description = description;
		if (subject_template !== undefined) updates.subject_template = subject_template;
		if (body_template !== undefined) updates.body_template = body_template;
		if (available_variables !== undefined) updates.available_variables = available_variables;

		// Update template
		const { data: template, error: updateError } = await supabaseAdmin
			.from('courses_email_templates')
			.update(updates)
			.eq('id', template_id)
			.select()
			.single();

		if (updateError) {
			console.error('Error updating template:', updateError);
			return json({ error: 'Failed to update template' }, { status: 500 });
		}

		return json({
			success: true,
			template
		});
	} catch (error) {
		console.error('PUT /api/courses/[slug]/emails error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

// DELETE /api/courses/[slug]/emails - Delete a custom template
export const DELETE: RequestHandler = async (event) => {
	try {
		const { slug } = event.params;

		// Auth check - require course admin
		await requireCourseAdmin(event, slug);

		// Get course
		const { data: course, error: courseError } = await supabaseAdmin
			.from('courses')
			.select('id')
			.eq('slug', slug)
			.single();

		if (courseError || !course) {
			return json({ error: 'Course not found' }, { status: 404 });
		}

		// Get template_id from query params or body
		const url = new URL(event.request.url);
		const template_id = url.searchParams.get('template_id');

		if (!template_id) {
			return json({ error: 'Missing required parameter: template_id' }, { status: 400 });
		}

		// Verify template exists and is deletable
		const { data: template, error: fetchError } = await supabaseAdmin
			.from('courses_email_templates')
			.select('id, course_id, is_deletable, category')
			.eq('id', template_id)
			.single();

		if (fetchError || !template) {
			return json({ error: 'Template not found' }, { status: 404 });
		}

		if (template.course_id !== course.id) {
			return json({ error: 'Template does not belong to this course' }, { status: 403 });
		}

		if (!template.is_deletable) {
			return json(
				{
					error: 'System templates cannot be deleted. You can only edit them or set them as inactive.'
				},
				{ status: 403 }
			);
		}

		// Delete the template
		const { error: deleteError } = await supabaseAdmin
			.from('courses_email_templates')
			.delete()
			.eq('id', template_id);

		if (deleteError) {
			console.error('Error deleting template:', deleteError);
			return json({ error: 'Failed to delete template' }, { status: 500 });
		}

		return json({
			success: true,
			message: 'Template deleted successfully'
		});
	} catch (error) {
		console.error('DELETE /api/courses/[slug]/emails error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

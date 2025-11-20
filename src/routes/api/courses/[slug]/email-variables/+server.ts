import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';

// GET /api/courses/[slug]/email-variables - Get available email template variables
export const GET: RequestHandler = async (event) => {
	try {
		const { slug } = event.params;

		// Auth check - require course admin
		await requireCourseAdmin(event, slug);

		// Get course (verify it exists)
		const { data: course, error: courseError } = await supabaseAdmin
			.from('courses')
			.select('id, name, slug')
			.eq('slug', slug)
			.single();

		if (courseError || !course) {
			return json({ error: 'Course not found' }, { status: 404 });
		}

		// Call database function to get available variables
		const { data: variables, error: variablesError } = await supabaseAdmin.rpc(
			'get_course_email_variables'
		);

		if (variablesError) {
			console.error('Error fetching email variables:', variablesError);
			return json({ error: 'Failed to fetch email variables' }, { status: 500 });
		}

		// Group variables by category for easier consumption
		const grouped = variables.reduce(
			(acc: any, variable: any) => {
				const category = variable.category;
				if (!acc[category]) {
					acc[category] = [];
				}
				acc[category].push({
					name: variable.variable_name,
					description: variable.description
				});
				return acc;
			},
			{} as Record<string, Array<{ name: string; description: string }>>
		);

		return json({
			success: true,
			course: {
				id: course.id,
				name: course.name,
				slug: course.slug
			},
			variables: {
				all: variables.map((v: any) => ({
					name: v.variable_name,
					description: v.description,
					category: v.category
				})),
				byCategory: grouped
			}
		});
	} catch (error) {
		console.error('GET /api/courses/[slug]/email-variables error:', error);
		return json(
			{
				error: error instanceof Error ? error.message : 'Internal server error'
			},
			{ status: 500 }
		);
	}
};

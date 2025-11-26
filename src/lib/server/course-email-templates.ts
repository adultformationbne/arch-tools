/**
 * Course email template management functions.
 * Handles generation and restoration of system templates.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_EMAIL_TEMPLATES, getDefaultTemplate } from './default-email-templates';

/**
 * Generate all system email templates for a course.
 * Called when a course is created.
 */
export async function generateSystemTemplatesForCourse(
	supabase: SupabaseClient,
	courseId: string
): Promise<{ success: boolean; error?: string; count?: number }> {
	try {
		// Check if templates already exist for this course
		const { data: existing } = await supabase
			.from('courses_email_templates')
			.select('template_key')
			.eq('course_id', courseId)
			.eq('category', 'system');

		const existingKeys = new Set((existing || []).map((t) => t.template_key));

		// Filter to only templates that don't exist yet
		const templatesToCreate = DEFAULT_EMAIL_TEMPLATES.filter(
			(t) => !existingKeys.has(t.template_key)
		);

		if (templatesToCreate.length === 0) {
			return { success: true, count: 0 };
		}

		// Insert templates
		const { error } = await supabase.from('courses_email_templates').insert(
			templatesToCreate.map((template) => ({
				course_id: courseId,
				template_key: template.template_key,
				name: template.name,
				description: template.description,
				category: template.category,
				subject_template: template.subject_template,
				body_template: template.body_template,
				available_variables: template.available_variables,
				trigger_event: template.trigger_event,
				is_deletable: template.is_deletable,
				is_active: true
			}))
		);

		if (error) {
			console.error('Error generating system templates:', error);
			return { success: false, error: error.message };
		}

		return { success: true, count: templatesToCreate.length };
	} catch (err) {
		console.error('Error in generateSystemTemplatesForCourse:', err);
		return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
	}
}

/**
 * Restore a specific system template to its default content.
 * Only works for system templates (category = 'system').
 */
export async function restoreTemplateToDefault(
	supabase: SupabaseClient,
	courseId: string,
	templateKey: string
): Promise<{ success: boolean; error?: string }> {
	try {
		// Get the default template
		const defaultTemplate = getDefaultTemplate(templateKey);
		if (!defaultTemplate) {
			return { success: false, error: `No default template found for key: ${templateKey}` };
		}

		// Update the existing template
		const { error } = await supabase
			.from('courses_email_templates')
			.update({
				name: defaultTemplate.name,
				description: defaultTemplate.description,
				subject_template: defaultTemplate.subject_template,
				body_template: defaultTemplate.body_template,
				available_variables: defaultTemplate.available_variables,
				updated_at: new Date().toISOString()
			})
			.eq('course_id', courseId)
			.eq('template_key', templateKey)
			.eq('category', 'system');

		if (error) {
			console.error('Error restoring template to default:', error);
			return { success: false, error: error.message };
		}

		return { success: true };
	} catch (err) {
		console.error('Error in restoreTemplateToDefault:', err);
		return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
	}
}

/**
 * Restore all system templates for a course to their defaults.
 */
export async function restoreAllSystemTemplates(
	supabase: SupabaseClient,
	courseId: string
): Promise<{ success: boolean; error?: string; count?: number }> {
	try {
		let restoredCount = 0;

		for (const template of DEFAULT_EMAIL_TEMPLATES) {
			const result = await restoreTemplateToDefault(supabase, courseId, template.template_key);
			if (result.success) {
				restoredCount++;
			}
		}

		return { success: true, count: restoredCount };
	} catch (err) {
		console.error('Error in restoreAllSystemTemplates:', err);
		return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
	}
}

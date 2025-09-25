/**
 * Template Management Actions
 * Reusable functions for template CRUD operations
 */

import { generateThumbnailFromPreview, uploadThumbnail, generateAndSaveThumbnail } from './thumbnail-generator.js';

export class TemplateManager {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Load all templates from database
   */
  async loadTemplates() {
    const { data, error } = await this.supabase
      .from('dgr_templates')
      .select('*')
      .order('template_key', { ascending: true })
      .order('version', { ascending: false });

    if (error) {
      throw new Error('Error loading templates: ' + error.message);
    }

    return data || [];
  }

  /**
   * Activate a specific template version
   */
  async activateTemplate(template) {
    const { error } = await this.supabase
      .rpc('activate_template_version', { p_id: template.id });

    if (error) {
      throw new Error('Error activating template: ' + error.message);
    }

    return true;
  }

  /**
   * Save template as new version
   */
  async saveAsNewVersion(templateData) {
    const { selectedTemplate, templateName, templateDescription, editingHtml } = templateData;

    // Check if the current template is active
    const wasActive = selectedTemplate.is_active;

    // Get the next version number
    const { data: versionData, error: versionError } = await this.supabase
      .rpc('get_next_template_version', {
        p_template_key: selectedTemplate.template_key
      });

    if (versionError) {
      throw new Error('Error getting version: ' + versionError.message);
    }

    // Create new version
    const { data, error } = await this.supabase
      .from('dgr_templates')
      .insert({
        template_key: selectedTemplate.template_key,
        version: versionData,
        name: templateName,
        description: templateDescription,
        html: editingHtml,
        variables: selectedTemplate.variables,
        config: selectedTemplate.config,
        is_active: false // Always start as inactive, activate later if needed
      })
      .select()
      .single();

    if (error) {
      throw new Error('Error saving template: ' + error.message);
    }

    // If the previous version was active, activate this new version
    if (wasActive) {
      const { error: activateError } = await this.supabase
        .rpc('activate_template_version', { p_id: data.id });

      if (activateError) {
        throw new Error('Error activating new version: ' + activateError.message);
      }

      // Update the returned template to reflect its active status
      data.is_active = true;
    }

    return { template: data, version: versionData };
  }

  /**
   * Create a new template
   */
  async createTemplate(templateKey, name) {
    const { data, error } = await this.supabase
      .from('dgr_templates')
      .insert({
        template_key: templateKey.toLowerCase().replace(/\s+/g, '-'),
        version: 1,
        name: name || `New ${templateKey} Template`,
        description: 'A new DGR template',
        html: '<div style="padding: 20px;">\n  <h1>{{title}}</h1>\n  <p>Date: {{formattedDate}}</p>\n  <div>{{{reflectionText}}}</div>\n  <p>By {{authorName}}</p>\n</div>',
        is_active: false
      })
      .select()
      .single();

    if (error) {
      throw new Error('Error creating template: ' + error.message);
    }

    return data;
  }

  /**
   * Duplicate a template
   */
  async duplicateTemplate(template) {
    const { data, error } = await this.supabase
      .from('dgr_templates')
      .insert({
        template_key: template.template_key + '-copy',
        version: 1,
        name: template.name + ' (Copy)',
        description: template.description,
        html: template.html,
        variables: template.variables,
        config: template.config,
        is_active: false
      })
      .select()
      .single();

    if (error) {
      throw new Error('Error duplicating template: ' + error.message);
    }

    return data;
  }

  /**
   * Delete a template
   */
  async deleteTemplate(template) {
    const { data, error } = await this.supabase
      .from('dgr_templates')
      .delete()
      .eq('id', template.id)
      .select(); // Return deleted row to confirm success

    if (error) {
      throw new Error('Error deleting template: ' + error.message);
    }

    if (!data || data.length === 0) {
      throw new Error('Failed to delete template - template may not exist');
    }

    return true;
  }

  /**
   * Generate thumbnail from current preview
   */
  async generateThumbnailFromPreview(template) {
    try {
      const previewElement = document.querySelector('.prose');
      if (previewElement) {
        const dataUrl = await generateThumbnailFromPreview(previewElement);
        if (dataUrl) {
          const thumbnailUrl = await uploadThumbnail(this.supabase, template.id, dataUrl);
          if (thumbnailUrl) {
            // Update database with thumbnail
            await this.supabase
              .from('dgr_templates')
              .update({
                thumbnail_url: thumbnailUrl,
                thumbnail_generated_at: new Date().toISOString()
              })
              .eq('id', template.id);

            return thumbnailUrl;
          }
        }
      }
    } catch (error) {
      console.warn('Preview thumbnail generation failed:', error);
    }
    return false;
  }

  /**
   * Generate thumbnail using template renderer
   */
  async generateThumbnail(template) {
    return await generateAndSaveThumbnail(this.supabase, template);
  }
}

/**
 * Group templates by key for display
 */
export function groupTemplatesByKey(templates) {
  const grouped = templates.reduce((acc, template) => {
    if (!acc[template.template_key]) {
      acc[template.template_key] = [];
    }
    acc[template.template_key].push(template);
    return acc;
  }, {});

  // Sort each group by version desc and return the active one first
  Object.keys(grouped).forEach(key => {
    grouped[key].sort((a, b) => {
      if (a.is_active && !b.is_active) return -1;
      if (!a.is_active && b.is_active) return 1;
      return b.version - a.version;
    });
  });

  return grouped;
}
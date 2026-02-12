import { json } from '@sveltejs/kit';
import { requireCourseAdmin } from '$lib/server/auth';
import { invalidateCourseCache } from '$lib/server/course-cache';
import { supabaseAdmin } from '$lib/server/supabase';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const contentType = event.request.headers.get('content-type');

	// Handle file upload (multipart/form-data)
	if (contentType?.includes('multipart/form-data')) {
		try {
			const formData = await event.request.formData();
			const file = formData.get('file') as File;
			const action = formData.get('action') as string;

			if (action !== 'upload_logo' || !file) {
				return json({ success: false, error: 'Invalid request' }, { status: 400 });
			}

			// Validate file type
			if (!file.type.startsWith('image/')) {
				return json({ success: false, error: 'File must be an image' }, { status: 400 });
			}

			// Validate file size (2MB max)
			const maxSize = 2 * 1024 * 1024;
			if (file.size > maxSize) {
				return json({ success: false, error: 'File must be less than 2MB' }, { status: 400 });
			}

			// Generate unique filename
			const fileExt = file.name.split('.').pop();
			const fileName = `course-logos/${courseSlug}-${Date.now()}.${fileExt}`;

			// Convert file to buffer
			const arrayBuffer = await file.arrayBuffer();
			const buffer = Buffer.from(arrayBuffer);

			// Upload to Supabase Storage
			const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
				.from('public-assets')
				.upload(fileName, buffer, {
					contentType: file.type,
					upsert: true
				});

			if (uploadError) {
				console.error('Upload error:', uploadError);
				return json({ success: false, error: 'Failed to upload file' }, { status: 500 });
			}

			// Get public URL
			const { data: urlData } = supabaseAdmin.storage
				.from('public-assets')
				.getPublicUrl(fileName);

			return json({ success: true, url: urlData.publicUrl });
		} catch (error) {
			console.error('Logo upload error:', error);
			return json({ success: false, error: 'Upload failed' }, { status: 500 });
		}
	}

	// Handle settings update (application/json)
	try {
		const body = await event.request.json();
		const { action, settings } = body;

		if (action !== 'update_settings' || !settings) {
			return json({ success: false, error: 'Invalid request' }, { status: 400 });
		}

		// Update course
		const { data, error } = await supabaseAdmin
			.from('courses')
			.update({
				name: settings.name,
				short_name: settings.short_name,
				description: settings.description,
				duration_weeks: settings.duration_weeks,
				settings: settings.settings,
				email_branding_config: settings.email_branding_config || null,
				updated_at: new Date().toISOString()
			})
			.eq('slug', courseSlug)
			.select()
			.single();

		if (error) {
			console.error('Update error:', error);
			return json({ success: false, error: 'Failed to update settings' }, { status: 500 });
		}

		invalidateCourseCache(courseSlug);
		return json({ success: true, data });
	} catch (error) {
		console.error('Settings update error:', error);
		return json({ success: false, error: 'Update failed' }, { status: 500 });
	}
};

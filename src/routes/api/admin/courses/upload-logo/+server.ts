import { json, error, type RequestEvent } from '@sveltejs/kit';
import { requireAnyModule } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';

const LOGOS_BUCKET = 'course-logos';
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

export const POST = async (event: RequestEvent) => {
	// Require admin or manager access
	try {
		await requireAnyModule(event, ['courses.admin', 'courses.manager']);
	} catch (err) {
		throw error(403, 'Requires courses.admin or courses.manager module');
	}

	const formData = await event.request.formData();
	const file = formData.get('logo') as File | null;
	const courseSlug = formData.get('courseSlug') as string | null;

	if (!file) {
		throw error(400, 'No file provided');
	}

	if (!courseSlug) {
		throw error(400, 'Course slug is required');
	}

	// Validate file size
	if (file.size > MAX_LOGO_SIZE) {
		throw error(400, `Logo must be less than ${MAX_LOGO_SIZE / (1024 * 1024)}MB`);
	}

	// Validate file type
	if (!ALLOWED_TYPES.includes(file.type)) {
		throw error(400, 'Logo must be an image (JPEG, PNG, GIF, WebP, or SVG)');
	}

	try {
		// Generate unique file path
		const fileExt = file.name.split('.').pop() || 'png';
		const fileName = `${courseSlug}-${Date.now()}.${fileExt}`;
		const filePath = `${courseSlug}/${fileName}`;

		// Convert File to ArrayBuffer for upload
		const arrayBuffer = await file.arrayBuffer();
		const buffer = new Uint8Array(arrayBuffer);

		// Upload file to storage using admin client
		const { data, error: uploadError } = await supabaseAdmin.storage
			.from(LOGOS_BUCKET)
			.upload(filePath, buffer, {
				contentType: file.type,
				upsert: true
			});

		if (uploadError) {
			console.error('Logo upload error:', uploadError);
			throw error(500, 'Failed to upload logo: ' + uploadError.message);
		}

		// Get public URL
		const { data: urlData } = supabaseAdmin.storage
			.from(LOGOS_BUCKET)
			.getPublicUrl(filePath);

		return json({
			success: true,
			url: urlData.publicUrl,
			path: filePath
		});

	} catch (err) {
		console.error('Logo upload error:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to upload logo');
	}
};

export const DELETE = async (event: RequestEvent) => {
	// Require admin or manager access
	try {
		await requireAnyModule(event, ['courses.admin', 'courses.manager']);
	} catch (err) {
		throw error(403, 'Requires courses.admin or courses.manager module');
	}

	const { searchParams } = event.url;
	const filePath = searchParams.get('path');

	if (!filePath) {
		throw error(400, 'File path is required');
	}

	try {
		const { error: deleteError } = await supabaseAdmin.storage
			.from(LOGOS_BUCKET)
			.remove([filePath]);

		if (deleteError) {
			console.error('Logo delete error:', deleteError);
			throw error(500, 'Failed to delete logo');
		}

		return json({ success: true });

	} catch (err) {
		console.error('Logo delete error:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to delete logo');
	}
};

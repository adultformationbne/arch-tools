import { json, error, type RequestEvent } from '@sveltejs/kit';
import { requireAnyModule } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';
import sharp from 'sharp';

const EMAIL_IMAGES_BUCKET = 'email-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB before processing
const MAX_WIDTH = 600; // Max width for email images
const MAX_PIXELS = 25_000_000; // ~25MP - prevents memory issues with huge images
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export const POST = async (event: RequestEvent) => {
	// Require appropriate module access
	try {
		await requireAnyModule(event, ['courses.admin', 'courses.manager', 'dgr', 'users']);
	} catch (err) {
		throw error(403, 'Requires appropriate admin access');
	}

	const formData = await event.request.formData();
	const file = formData.get('image') as File | null;
	const context = formData.get('context') as string | null;
	const contextId = formData.get('context_id') as string | null;

	if (!file) {
		throw error(400, 'No file provided');
	}

	if (!context || !['course', 'dgr', 'platform'].includes(context)) {
		throw error(400, 'Valid context is required (course, dgr, platform)');
	}

	// Validate file size (before processing)
	if (file.size > MAX_FILE_SIZE) {
		throw error(400, `Image must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
	}

	// Validate file type
	if (!ALLOWED_TYPES.includes(file.type)) {
		throw error(400, 'Image must be JPEG, PNG, GIF, or WebP');
	}

	try {
		// Convert File to Buffer
		const arrayBuffer = await file.arrayBuffer();
		const inputBuffer = Buffer.from(arrayBuffer);

		// Process image with sharp - resize to max 600px width and convert to JPEG
		// JPEG has the best email client compatibility (Outlook, Gmail, Apple Mail, etc.)
		const image = sharp(inputBuffer);

		// Validate image - check it's actually a valid image file
		let metadata;
		try {
			metadata = await image.metadata();
		} catch (metadataError) {
			throw error(400, 'Invalid or corrupted image file');
		}

		// Verify we got valid dimensions (catches corrupted/malformed images)
		if (!metadata.width || !metadata.height) {
			throw error(400, 'Invalid image: could not determine dimensions');
		}

		// Check pixel count to prevent memory exhaustion with huge images
		const totalPixels = metadata.width * metadata.height;
		if (totalPixels > MAX_PIXELS) {
			throw error(400, `Image too large: ${Math.round(totalPixels / 1_000_000)}MP exceeds ${MAX_PIXELS / 1_000_000}MP limit`);
		}

		let processedBuffer: Buffer;
		let outputWidth = metadata.width;
		let outputHeight = metadata.height;

		// Always output as JPEG for maximum email client compatibility
		const mimeType = 'image/jpeg';

		// Calculate output dimensions
		if (metadata.width > MAX_WIDTH) {
			const aspectRatio = metadata.height / metadata.width;
			outputWidth = MAX_WIDTH;
			outputHeight = Math.round(MAX_WIDTH * aspectRatio);
		}

		// Process: resize (if needed), flatten (remove alpha/transparency), convert to JPEG
		// flatten() adds a white background for transparent images (PNG, GIF)
		processedBuffer = await image
			.resize(MAX_WIDTH, null, { withoutEnlargement: true })
			.flatten({ background: { r: 255, g: 255, b: 255 } })
			.jpeg({ quality: 85, mozjpeg: true })
			.toBuffer();

		// Generate unique file path - always .jpg since we convert to JPEG
		const timestamp = Date.now();
		const randomStr = Math.random().toString(36).substring(2, 8);
		const fileName = `${timestamp}-${randomStr}.jpg`;

		// Organize by context
		let filePath: string;
		if (context === 'course' && contextId) {
			filePath = `courses/${contextId}/${fileName}`;
		} else if (context === 'dgr') {
			filePath = `dgr/${fileName}`;
		} else {
			filePath = `platform/${fileName}`;
		}

		// Upload to Supabase storage
		const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
			.from(EMAIL_IMAGES_BUCKET)
			.upload(filePath, processedBuffer, {
				contentType: mimeType,
				upsert: false
			});

		if (uploadError) {
			console.error('Image upload error:', uploadError);
			throw error(500, 'Failed to upload image: ' + uploadError.message);
		}

		// Get public URL
		const { data: urlData } = supabaseAdmin.storage
			.from(EMAIL_IMAGES_BUCKET)
			.getPublicUrl(filePath);

		const publicUrl = urlData.publicUrl;

		// Get user ID from locals
		const userId = event.locals.user?.id || null;

		// Record in email_images table
		const { data: imageRecord, error: dbError } = await supabaseAdmin
			.from('email_images')
			.insert({
				context,
				context_id: contextId || null,
				storage_path: filePath,
				public_url: publicUrl,
				original_filename: file.name,
				file_size: processedBuffer.length,
				width: outputWidth,
				height: outputHeight,
				mime_type: mimeType,
				uploaded_by: userId
			})
			.select()
			.single();

		if (dbError) {
			console.error('Database error:', dbError);
			// DB failed - delete from storage to prevent orphan
			await supabaseAdmin.storage.from(EMAIL_IMAGES_BUCKET).remove([filePath]);
			throw error(500, 'Failed to record image in database');
		}

		return json({
			success: true,
			url: publicUrl,
			path: filePath,
			width: outputWidth,
			height: outputHeight,
			size: processedBuffer.length,
			id: imageRecord.id
		});
	} catch (err) {
		console.error('Image upload error:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to process and upload image');
	}
};

export const DELETE = async (event: RequestEvent) => {
	// Require appropriate module access
	try {
		await requireAnyModule(event, ['courses.admin', 'courses.manager', 'dgr', 'users']);
	} catch (err) {
		throw error(403, 'Requires appropriate admin access');
	}

	const { searchParams } = event.url;
	const imageId = searchParams.get('id');
	const storagePath = searchParams.get('path');

	if (!imageId && !storagePath) {
		throw error(400, 'Image ID or path is required');
	}

	try {
		let pathToDelete = storagePath;

		// If we have an ID, look up the path
		if (imageId) {
			const { data: imageRecord, error: fetchError } = await supabaseAdmin
				.from('email_images')
				.select('storage_path')
				.eq('id', imageId)
				.single();

			if (fetchError || !imageRecord) {
				throw error(404, 'Image not found');
			}

			pathToDelete = imageRecord.storage_path;

			// Delete from database
			await supabaseAdmin.from('email_images').delete().eq('id', imageId);
		}

		// Delete from storage
		if (pathToDelete) {
			const { error: deleteError } = await supabaseAdmin.storage
				.from(EMAIL_IMAGES_BUCKET)
				.remove([pathToDelete]);

			if (deleteError) {
				console.error('Storage delete error:', deleteError);
			}
		}

		return json({ success: true });
	} catch (err) {
		console.error('Image delete error:', err);
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		throw error(500, 'Failed to delete image');
	}
};

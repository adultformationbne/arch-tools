import { json, error, type RequestEvent } from '@sveltejs/kit';
import { requireAnyModule } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';
import sharp from 'sharp';

const BUCKET = 'quiz-images';
const MAX_INPUT_SIZE = 20 * 1024 * 1024; // 20MB raw input limit
const MAX_DIMENSION = 1000;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

export const POST = async (event: RequestEvent) => {
	await requireAnyModule(event, ['courses.admin', 'platform.admin']);

	const formData = await event.request.formData();
	const file = formData.get('file') as File | null;

	if (!file) throw error(400, 'No file provided');
	if (file.size > MAX_INPUT_SIZE) throw error(400, 'Image must be less than 20MB');
	if (!ALLOWED_TYPES.includes(file.type)) throw error(400, 'Image must be JPEG, PNG, GIF, WebP, or AVIF');

	const arrayBuffer = await file.arrayBuffer();

	// Resize to max 1000px on longest side and convert to WebP
	let processed: Buffer;
	try {
		processed = await sharp(Buffer.from(arrayBuffer))
			.resize(MAX_DIMENSION, MAX_DIMENSION, {
				fit: 'inside',      // never upscale, preserve aspect ratio
				withoutEnlargement: true
			})
			.webp({ quality: 82 })
			.toBuffer();
	} catch (e) {
		console.error('Image processing error:', e);
		throw error(400, 'Could not process image — ensure it is a valid image file');
	}

	const filePath = `question-images/${Date.now()}-${Math.random().toString(36).slice(2)}.webp`;

	// Ensure bucket exists (idempotent)
	await supabaseAdmin.storage.createBucket(BUCKET, { public: true }).catch(() => {});

	const { error: uploadError } = await supabaseAdmin.storage
		.from(BUCKET)
		.upload(filePath, processed, {
			contentType: 'image/webp',
			upsert: true
		});

	if (uploadError) {
		console.error('Quiz image upload error:', uploadError);
		throw error(500, 'Failed to upload image: ' + uploadError.message);
	}

	const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(filePath);

	return json({ url: urlData.publicUrl, path: filePath });
};

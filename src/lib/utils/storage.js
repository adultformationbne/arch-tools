import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

const MATERIALS_BUCKET = 'materials';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Upload a file to the materials bucket
 * @param {File} file - The file to upload
 * @param {string} cohortId - The cohort ID for organization
 * @param {number} weekNumber - The week number
 * @returns {Promise<{url: string, path: string, error?: string}>}
 */
export async function uploadMaterial(file, cohortId, weekNumber) {
	try {
		// Validate file size
		if (file.size > MAX_FILE_SIZE) {
			throw new Error(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
		}

		// Generate unique file path
		const fileExt = file.name.split('.').pop();
		const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
		const filePath = `cohort-${cohortId}/week-${weekNumber}/${fileName}`;

		// Upload file to storage
		const { data, error } = await supabase.storage
			.from(MATERIALS_BUCKET)
			.upload(filePath, file, {
				contentType: file.type,
				upsert: false
			});

		if (error) {
			throw error;
		}

		// Get public URL
		const { data: urlData } = supabase.storage
			.from(MATERIALS_BUCKET)
			.getPublicUrl(filePath);

		return {
			url: urlData.publicUrl,
			path: filePath,
			name: file.name,
			size: file.size,
			type: file.type
		};

	} catch (error) {
		console.error('Upload error:', error);
		return {
			url: '',
			path: '',
			error: error.message
		};
	}
}

/**
 * Delete a file from storage
 * @param {string} filePath - The file path to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function deleteMaterial(filePath) {
	try {
		const { error } = await supabase.storage
			.from(MATERIALS_BUCKET)
			.remove([filePath]);

		if (error) {
			throw error;
		}

		return { success: true };

	} catch (error) {
		console.error('Delete error:', error);
		return {
			success: false,
			error: error.message
		};
	}
}

/**
 * Create the materials bucket if it doesn't exist
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function initializeMaterialsBucket() {
	try {
		// Check if bucket exists
		const { data: buckets, error: listError } = await supabase.storage.listBuckets();

		if (listError) {
			throw listError;
		}

		const bucketExists = buckets.some(bucket => bucket.name === MATERIALS_BUCKET);

		if (!bucketExists) {
			// Create bucket as public for easy access
			const { error: createError } = await supabase.storage.createBucket(MATERIALS_BUCKET, {
				public: true,
				allowedMimeTypes: [
					'application/pdf',
					'application/msword',
					'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
					'text/plain',
					'text/markdown',
					'image/jpeg',
					'image/png',
					'image/gif'
				],
				fileSizeLimit: MAX_FILE_SIZE
			});

			if (createError) {
				throw createError;
			}
		}

		return { success: true };

	} catch (error) {
		console.error('Bucket initialization error:', error);
		return {
			success: false,
			error: error.message
		};
	}
}

/**
 * List files in a specific cohort/week folder
 * @param {string} cohortId - The cohort ID
 * @param {number} weekNumber - The week number
 * @returns {Promise<{files: Array, error?: string}>}
 */
export async function listMaterials(cohortId, weekNumber) {
	try {
		const folderPath = `cohort-${cohortId}/week-${weekNumber}`;

		const { data, error } = await supabase.storage
			.from(MATERIALS_BUCKET)
			.list(folderPath);

		if (error) {
			throw error;
		}

		return { files: data || [] };

	} catch (error) {
		console.error('List materials error:', error);
		return {
			files: [],
			error: error.message
		};
	}
}
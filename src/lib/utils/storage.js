const MATERIALS_BUCKET = 'materials';
const LOGOS_BUCKET = 'course-logos';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB for logos

export async function uploadMaterial(supabase, file, cohortId, sessionNumber) {
	try {
		// Validate file size
		if (file.size > MAX_FILE_SIZE) {
			throw new Error(`File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
		}

		// Generate unique file path
		const fileExt = file.name.split('.').pop();
		const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
		const filePath = `cohort-${cohortId}/week-${sessionNumber}/${fileName}`;

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

export async function deleteMaterial(supabase, filePath) {
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

export async function initializeMaterialsBucket(supabase) {
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

export async function listMaterials(supabase, cohortId, sessionNumber) {
	try {
		const folderPath = `cohort-${cohortId}/week-${sessionNumber}`;

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

export async function uploadCourseLogo(supabase, file, courseSlug) {
	try {
		// Validate file size
		if (file.size > MAX_LOGO_SIZE) {
			throw new Error(`Logo must be less than ${MAX_LOGO_SIZE / (1024 * 1024)}MB`);
		}

		// Validate file type
		const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
		if (!allowedTypes.includes(file.type)) {
			throw new Error('Logo must be an image (JPEG, PNG, GIF, WebP, or SVG)');
		}

		// Generate unique file path
		const fileExt = file.name.split('.').pop();
		const fileName = `${courseSlug}-${Date.now()}.${fileExt}`;
		const filePath = `${courseSlug}/${fileName}`;

		// Upload file to storage
		const { data, error } = await supabase.storage
			.from(LOGOS_BUCKET)
			.upload(filePath, file, {
				contentType: file.type,
				upsert: true
			});

		if (error) {
			throw error;
		}

		// Get public URL
		const { data: urlData } = supabase.storage
			.from(LOGOS_BUCKET)
			.getPublicUrl(filePath);

		return {
			url: urlData.publicUrl,
			path: filePath
		};

	} catch (error) {
		console.error('Logo upload error:', error);
		return {
			url: '',
			path: '',
			error: error.message
		};
	}
}

export async function deleteCourseLogo(supabase, filePath) {
	try {
		const { error } = await supabase.storage
			.from(LOGOS_BUCKET)
			.remove([filePath]);

		if (error) {
			throw error;
		}

		return { success: true };

	} catch (error) {
		console.error('Logo delete error:', error);
		return {
			success: false,
			error: error.message
		};
	}
}
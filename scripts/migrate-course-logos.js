import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { config } from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
config();

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
	console.error('Missing required environment variables');
	process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function migrateLogo() {
	try {
		console.log('Starting logo migration...');

		// Read the logo file
		const logoPath = path.join(__dirname, '..', 'static', 'accf-logo.png');
		const logoBuffer = readFileSync(logoPath);

		console.log('Uploading logo to Supabase Storage...');

		// Upload to public-assets bucket
		const fileName = 'course-logos/accf-logo.png';
		const { data: uploadData, error: uploadError } = await supabase.storage
			.from('public-assets')
			.upload(fileName, logoBuffer, {
				contentType: 'image/png',
				upsert: true
			});

		if (uploadError) {
			console.error('Upload error:', uploadError);
			throw uploadError;
		}

		console.log('Upload successful:', uploadData);

		// Get the public URL
		const { data: urlData } = supabase.storage
			.from('public-assets')
			.getPublicUrl(fileName);

		const publicUrl = urlData.publicUrl;
		console.log('Public URL:', publicUrl);

		// Update the course settings
		console.log('Updating course settings...');
		const { data: updateData, error: updateError } = await supabase
			.from('courses')
			.update({
				settings: {
					theme: {
						accentDark: '#334642',
						fontFamily: 'Inter',
						accentLight: '#c59a6b'
					},
					branding: {
						logoUrl: publicUrl,
						showLogo: true
					}
				}
			})
			.eq('slug', 'accf')
			.select();

		if (updateError) {
			console.error('Update error:', updateError);
			throw updateError;
		}

		console.log('✅ Migration complete!');
		console.log('Updated course:', updateData);

	} catch (error) {
		console.error('Migration failed:', error);
		process.exit(1);
	}
}

migrateLogo();

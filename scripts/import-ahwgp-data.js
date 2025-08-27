import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Supabase client with service role key for admin access
const supabase = createClient(
	process.env.PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	}
);

async function importData() {
	try {
		// Read the JSON data
		console.log('📖 Reading AHWGP_master.json...');
		const jsonPath = join(__dirname, '..', 'static', 'AHWGP_master.json');
		const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

		console.log(`Found ${data.blocks.length} blocks to import`);

		// First, let's check if tables exist by trying to query them
		console.log('\n🔍 Checking if tables exist...');

		// Check blocks table
		const { error: blocksError } = await supabase.from('blocks').select('id').limit(1);

		if (blocksError && blocksError.code === '42P01') {
			console.log('❌ Blocks table does not exist. Please run migrations first.');
			console.log(
				'You need to apply the migrations via Supabase dashboard or fix the CLI connection.'
			);
			return;
		}

		// Check books table
		const { error: booksError } = await supabase.from('books').select('id').limit(1);

		if (booksError && booksError.code === '42P01') {
			console.log('❌ Books table does not exist. Please run migrations first.');
			return;
		}

		console.log('✅ Tables exist, proceeding with import...');

		// Import blocks
		console.log('\n📥 Importing blocks...');
		const blockBatches = [];
		const batchSize = 100; // Supabase recommends batches of 100

		for (let i = 0; i < data.blocks.length; i += batchSize) {
			const batch = data.blocks.slice(i, i + batchSize).map((block) => ({
				block_id: block.id,
				content: block.content,
				tag: block.tag,
				metadata: block.metadata || null,
				created_at: block.createdAt || new Date().toISOString()
			}));
			blockBatches.push(batch);
		}

		// Insert blocks in batches
		for (let i = 0; i < blockBatches.length; i++) {
			console.log(`Inserting batch ${i + 1}/${blockBatches.length}...`);
			const { error } = await supabase.from('blocks').insert(blockBatches[i]);

			if (error) {
				console.error('Error inserting blocks:', error);
				throw error;
			}
		}

		console.log(`✅ Successfully imported ${data.blocks.length} blocks`);

		// Create initial book structure
		console.log('\n📚 Creating initial book structure...');

		const bookBlocks = data.blocks.map((block, index) => ({
			block_id: block.id,
			is_visible: block.isVisible !== false, // Default to true if not specified
			order_index: index
		}));

		const bookData = {
			document_title: data.documentTitle || 'AHWGP',
			blocks: bookBlocks,
			custom_tags: data.customTags || [],
			auto_add_on_paste: data.autoAddOnPaste || false,
			reverse_order: data.reverseOrder !== false, // Default to true
			version: data.version || '1.0',
			created_at: new Date().toISOString()
		};

		const { data: insertedBook, error: bookError } = await supabase
			.from('books')
			.insert(bookData)
			.select()
			.single();

		if (bookError) {
			console.error('Error creating book:', bookError);
			throw bookError;
		}

		console.log('✅ Successfully created initial book structure');
		console.log(`Book ID: ${insertedBook.id}`);

		// Log the import
		const { error: logError } = await supabase.from('editor_logs').insert({
			action_type: 'initial_import',
			entity_type: 'book',
			entity_id: insertedBook.id,
			changes: {
				blocks_imported: data.blocks.length,
				source_file: 'AHWGP_master.json'
			}
		});

		if (logError) {
			console.log('Warning: Could not create log entry:', logError.message);
		}

		console.log('\n🎉 Import completed successfully!');
		console.log(`- ${data.blocks.length} blocks imported`);
		console.log(`- 1 book structure created`);
		console.log(`- Book ID: ${insertedBook.id}`);
	} catch (error) {
		console.error('\n❌ Import failed:', error);
		process.exit(1);
	}
}

// Run the import
importData();

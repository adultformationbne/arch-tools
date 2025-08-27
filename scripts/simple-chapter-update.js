import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabase = createClient(
	process.env.PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateChapterMappingSimple() {
	console.log('🔗 Simple chapter mapping update...');

	// Get chapters from database
	const { data: chapters } = await supabase.from('chapters').select('*').order('chapter_number');

	// Get original JSON to determine block order
	const jsonPath = join(__dirname, '..', 'static', 'AHWGP_master.json');
	const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

	// Create chapter mapping based on block positions
	const blockChapterMap = new Map();
	let currentChapter = null;

	data.blocks.forEach((block, index) => {
		if (block.tag === 'chapter') {
			// Find the corresponding chapter record
			currentChapter = chapters.find((c) => c.block_id === block.id);
		}

		if (currentChapter) {
			blockChapterMap.set(block.block_id, currentChapter.id);
		}
	});

	console.log(`Created mapping for ${blockChapterMap.size} blocks`);

	// Update blocks one by one (slower but more reliable)
	let updated = 0;
	let errors = 0;

	for (const [blockId, chapterId] of blockChapterMap.entries()) {
		try {
			const { error } = await supabase
				.from('blocks')
				.update({ chapter_id: chapterId })
				.eq('block_id', blockId)
				.is('chapter_id', null); // Only update if not already set

			if (error) {
				console.error(`Error updating ${blockId}:`, error.message);
				errors++;
			} else {
				updated++;
				if (updated % 100 === 0) {
					console.log(`Updated ${updated} blocks...`);
				}
			}
		} catch (err) {
			console.error(`Exception updating ${blockId}:`, err.message);
			errors++;
		}
	}

	console.log(`\n✅ Updated ${updated} blocks`);
	console.log(`❌ Errors: ${errors}`);

	// Final check
	const { count: finalCount } = await supabase
		.from('blocks')
		.select('*', { count: 'exact', head: true })
		.not('chapter_id', 'is', null);

	console.log(`🎉 Final result: ${finalCount} / 1812 blocks have chapter assignments`);
}

updateChapterMappingSimple();

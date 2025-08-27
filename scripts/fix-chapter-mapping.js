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

async function fixChapterMapping() {
	console.log('🔧 Fixing chapter mapping logic...');

	// Get chapters from database
	const { data: chapters } = await supabase.from('chapters').select('*').order('chapter_number');

	// Get original JSON
	const jsonPath = join(__dirname, '..', 'static', 'AHWGP_master.json');
	const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

	// Map ALL blocks to their chapters (not just chapter blocks)
	const blockChapterMap = new Map();
	let currentChapter = null;

	data.blocks.forEach((block, index) => {
		// If this is a chapter block, find the corresponding chapter record
		if (block.tag === 'chapter') {
			currentChapter = chapters.find((c) => c.block_id === block.id);
		}

		// Assign ALL blocks (including chapter blocks) to the current chapter
		if (currentChapter) {
			blockChapterMap.set(block.id, currentChapter.id);
		}
	});

	console.log(`Created mapping for ${blockChapterMap.size} blocks`);

	// Update blocks in batches (but only those that don't have chapter_id yet)
	const { data: blocksToUpdate } = await supabase
		.from('blocks')
		.select('id, block_id')
		.is('chapter_id', null);

	console.log(`Found ${blocksToUpdate.length} blocks needing chapter assignment`);

	let updated = 0;
	let skipped = 0;

	for (const dbBlock of blocksToUpdate) {
		const chapterId = blockChapterMap.get(dbBlock.block_id);

		if (chapterId) {
			const { error } = await supabase
				.from('blocks')
				.update({ chapter_id: chapterId })
				.eq('id', dbBlock.id);

			if (error) {
				console.error(`Error updating ${dbBlock.block_id}:`, error.message);
			} else {
				updated++;
				if (updated % 100 === 0) {
					console.log(`Updated ${updated} blocks...`);
				}
			}
		} else {
			skipped++;
		}
	}

	console.log(`\n✅ Updated ${updated} blocks`);
	console.log(`⏭️ Skipped ${skipped} blocks (no chapter found)`);

	// Final verification
	const { count: finalCount } = await supabase
		.from('blocks')
		.select('*', { count: 'exact', head: true })
		.not('chapter_id', 'is', null);

	console.log(`🎉 Final result: ${finalCount} / 1812 blocks have chapter assignments`);

	if (finalCount === 1812) {
		console.log('🎊 All blocks successfully assigned to chapters!');
	}
}

fixChapterMapping();

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

async function completeChapterMapping() {
	console.log('🔗 Completing chapter mapping...');

	// Get chapters from database
	const { data: chapters } = await supabase.from('chapters').select('*').order('chapter_number');

	console.log(`Found ${chapters.length} chapters`);

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
			blockChapterMap.set(block.id, currentChapter.id);
		}
	});

	console.log(`Mapped ${blockChapterMap.size} blocks to chapters`);

	// Get blocks that still need chapter_id
	const { data: blocksToUpdate } = await supabase
		.from('blocks')
		.select('id, block_id')
		.is('chapter_id', null);

	console.log(`Found ${blocksToUpdate.length} blocks to update`);

	// Update in smaller batches with delay
	const batchSize = 50;
	let updated = 0;

	for (let i = 0; i < blocksToUpdate.length; i += batchSize) {
		const batch = blocksToUpdate.slice(i, i + batchSize);

		// Prepare batch updates
		const updates = batch
			.map((block) => ({
				id: block.id,
				chapter_id: blockChapterMap.get(block.block_id)
			}))
			.filter((update) => update.chapter_id); // Only update if we have a chapter_id

		if (updates.length > 0) {
			// Use upsert for batch update
			const { error } = await supabase.from('blocks').upsert(updates, {
				onConflict: 'id',
				ignoreDuplicates: false
			});

			if (error) {
				console.error(`Error in batch ${i / batchSize + 1}:`, error);
			} else {
				updated += updates.length;
				console.log(
					`Updated batch ${Math.floor(i / batchSize) + 1}: ${updated} / ${blocksToUpdate.length}`
				);
			}

			// Small delay between batches
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}

	console.log(`\n✅ Updated ${updated} blocks with chapter references`);

	// Final verification
	const { count: finalCount } = await supabase
		.from('blocks')
		.select('*', { count: 'exact', head: true })
		.not('chapter_id', 'is', null);

	console.log(`🎉 Final result: ${finalCount} / 1812 blocks have chapter assignments`);

	if (finalCount === 1812) {
		console.log('✅ Chapter mapping complete!');
	} else {
		console.log(`⚠️ Still missing ${1812 - finalCount} blocks`);
	}
}

completeChapterMapping();

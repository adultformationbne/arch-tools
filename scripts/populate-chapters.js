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

async function populateChapters() {
	console.log('📚 Setting up chapter structure...');

	// Read original JSON to maintain correct order
	const jsonPath = join(__dirname, '..', 'static', 'AHWGP_master.json');
	const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

	// Find all chapter blocks and their positions
	const chapterInfo = [];
	let currentChapterIndex = 0;

	data.blocks.forEach((block, index) => {
		if (block.tag === 'chapter') {
			chapterInfo.push({
				chapter_number: currentChapterIndex + 1,
				title: block.content,
				block_id: block.id,
				startIndex: index
			});
			currentChapterIndex++;
		}
	});

	console.log(`Found ${chapterInfo.length} chapters`);

	// 1. Insert chapters into chapters table
	console.log('\n📝 Creating chapter records...');
	const chaptersToInsert = chapterInfo.map(({ startIndex, ...chapter }) => chapter);
	const { data: insertedChapters, error: chaptersError } = await supabase
		.from('chapters')
		.insert(chaptersToInsert)
		.select();

	if (chaptersError) {
		console.error('Error inserting chapters:', chaptersError);
		return;
	}

	console.log(`✅ Created ${insertedChapters.length} chapter records`);

	// 2. Create mapping of block_id to chapter_id
	const blockToChapterMap = new Map();

	// For each block, determine which chapter it belongs to
	data.blocks.forEach((block, blockIndex) => {
		let belongsToChapter = null;

		// Find the last chapter block before this block
		for (let i = chapterInfo.length - 1; i >= 0; i--) {
			if (chapterInfo[i].startIndex <= blockIndex) {
				belongsToChapter = chapterInfo[i];
				break;
			}
		}

		if (belongsToChapter) {
			// Find the corresponding inserted chapter
			const chapterRecord = insertedChapters.find(
				(c) => c.chapter_number === belongsToChapter.chapter_number
			);
			if (chapterRecord) {
				blockToChapterMap.set(block.id, chapterRecord.id);
			}
		}
	});

	console.log(`\n🔗 Mapping ${blockToChapterMap.size} blocks to chapters...`);

	// 3. Update blocks with chapter_id in batches
	const batchSize = 100;
	let updated = 0;

	const blockIds = Array.from(blockToChapterMap.keys());

	for (let i = 0; i < blockIds.length; i += batchSize) {
		const batch = blockIds.slice(i, i + batchSize);

		for (const blockId of batch) {
			const chapterId = blockToChapterMap.get(blockId);

			const { error } = await supabase
				.from('blocks')
				.update({ chapter_id: chapterId })
				.eq('block_id', blockId);

			if (error) {
				console.error(`Error updating block ${blockId}:`, error);
			} else {
				updated++;
			}
		}

		console.log(`Updated ${Math.min(i + batchSize, blockIds.length)} / ${blockIds.length} blocks`);
	}

	console.log(`\n✅ Successfully updated ${updated} blocks with chapter references`);

	// 4. Verify the setup
	console.log('\n🔍 Verifying chapter setup...');

	for (const chapter of insertedChapters.slice(0, 3)) {
		// Check first 3 chapters
		const { count, error } = await supabase
			.from('blocks')
			.select('*', { count: 'exact', head: true })
			.eq('chapter_id', chapter.id);

		if (error) {
			console.error(`Error verifying chapter ${chapter.title}:`, error);
		} else {
			console.log(`📖 "${chapter.title}": ${count} blocks`);
		}
	}

	console.log('\n🎉 Chapter structure setup complete!');
	console.log('\nNow you can query blocks by chapter:');
	console.log('- Get all blocks in a chapter: SELECT * FROM blocks WHERE chapter_id = ?');
	console.log('- Get chapter info: SELECT * FROM chapters ORDER BY chapter_number');
	console.log(
		'- Get blocks with chapter info: SELECT b.*, c.title as chapter_title FROM blocks b JOIN chapters c ON b.chapter_id = c.id'
	);
}

populateChapters();

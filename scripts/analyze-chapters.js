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

async function analyzeChapters() {
	console.log('📖 Analyzing chapter structure...');

	// Get all chapter blocks from database
	const { data: chapterBlocks, error } = await supabase
		.from('blocks')
		.select('block_id, content, tag, created_at')
		.eq('tag', 'chapter')
		.order('created_at', { ascending: true });

	if (error) {
		console.error('Error:', error);
		return;
	}

	console.log(`\n📚 Found ${chapterBlocks.length} chapter blocks in database:`);
	chapterBlocks.forEach((block, index) => {
		console.log(`${index + 1}. "${block.content}" (${block.block_id})`);
	});

	// Also check original JSON to see the structure
	console.log('\n📄 Analyzing original JSON structure...');
	const jsonPath = join(__dirname, '..', 'static', 'AHWGP_master.json');
	const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

	const chaptersInOrder = [];
	let currentChapter = null;
	let blockCount = 0;

	data.blocks.forEach((block, index) => {
		if (block.tag === 'chapter') {
			if (currentChapter) {
				currentChapter.blockCount = blockCount;
				chaptersInOrder.push(currentChapter);
			}
			currentChapter = {
				title: block.content,
				id: block.id,
				startIndex: index,
				blockCount: 0
			};
			blockCount = 0;
		} else {
			blockCount++;
		}
	});

	// Add the last chapter
	if (currentChapter) {
		currentChapter.blockCount = blockCount;
		chaptersInOrder.push(currentChapter);
	}

	console.log('\n📊 Chapter breakdown:');
	chaptersInOrder.forEach((chapter, index) => {
		console.log(`${index + 1}. "${chapter.title}" - ${chapter.blockCount} blocks`);
	});

	console.log('\n🤔 Should we create a separate chapters table?');
	console.log('Options:');
	console.log('1. Keep current structure (chapters are just blocks with tag="chapter")');
	console.log('2. Create a separate chapters table with chapter metadata');
	console.log('3. Add chapter_id to blocks table to group them');

	return chaptersInOrder;
}

analyzeChapters();

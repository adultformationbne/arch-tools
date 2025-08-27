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

async function debugMapping() {
	console.log('🔍 Debugging chapter mapping...');

	// Get chapters from database
	const { data: chapters } = await supabase.from('chapters').select('*').order('chapter_number');

	console.log('📚 Chapters in database:');
	chapters.forEach((c) => console.log(`- ${c.chapter_number}: "${c.title}" (${c.block_id})`));

	// Get original JSON
	const jsonPath = join(__dirname, '..', 'static', 'AHWGP_master.json');
	const data = JSON.parse(readFileSync(jsonPath, 'utf-8'));

	console.log('\n📄 Chapter blocks in JSON:');
	const chapterBlocks = data.blocks.filter((b) => b.tag === 'chapter');
	chapterBlocks.forEach((b, i) => console.log(`- ${i + 1}: "${b.content}" (${b.id})`));

	console.log('\n🔗 Checking matches:');
	chapterBlocks.forEach((jsonChapter) => {
		const dbChapter = chapters.find((c) => c.block_id === jsonChapter.id);
		if (dbChapter) {
			console.log(`✅ Match: "${jsonChapter.content}" -> Chapter ${dbChapter.chapter_number}`);
		} else {
			console.log(`❌ No match for: "${jsonChapter.content}" (${jsonChapter.id})`);
		}
	});

	// Check a few non-chapter blocks
	console.log('\n📝 Sample non-chapter blocks in JSON:');
	const nonChapterBlocks = data.blocks.filter((b) => b.tag !== 'chapter').slice(0, 5);
	nonChapterBlocks.forEach((b) =>
		console.log(`- ${b.tag}: "${b.content.substring(0, 50)}..." (${b.id})`)
	);
}

debugMapping();

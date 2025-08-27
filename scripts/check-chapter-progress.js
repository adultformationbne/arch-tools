import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
	process.env.PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkProgress() {
	console.log('🔍 Checking chapter setup progress...');

	// Check chapters table
	const { count: chaptersCount } = await supabase
		.from('chapters')
		.select('*', { count: 'exact', head: true });

	console.log(`📚 Chapters created: ${chaptersCount}`);

	// Check how many blocks have chapter_id
	const { count: blocksWithChapter } = await supabase
		.from('blocks')
		.select('*', { count: 'exact', head: true })
		.not('chapter_id', 'is', null);

	const { count: totalBlocks } = await supabase
		.from('blocks')
		.select('*', { count: 'exact', head: true });

	console.log(`🔗 Blocks with chapter_id: ${blocksWithChapter} / ${totalBlocks}`);

	if (blocksWithChapter < totalBlocks) {
		console.log(`⚠️ Need to update ${totalBlocks - blocksWithChapter} more blocks`);
		return false;
	} else {
		console.log('✅ All blocks have been assigned to chapters!');
		return true;
	}
}

checkProgress();

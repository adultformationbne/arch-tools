import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
	process.env.PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkMetadata() {
	console.log('🔍 Checking metadata inconsistencies...');

	// Get blocks with metadata
	const { data: blocksWithMetadata, error } = await supabase
		.from('blocks')
		.select('block_id, tag, metadata')
		.not('metadata', 'is', null)
		.limit(10);

	if (error) {
		console.error('Error:', error);
		return;
	}

	console.log('Sample blocks with metadata:');
	blocksWithMetadata.forEach((block) => {
		console.log(`- ${block.tag}: ${JSON.stringify(block.metadata)}`);
	});

	// Count blocks with the problematic metadata
	const { count: problematicCount, error: countError } = await supabase
		.from('blocks')
		.select('*', { count: 'exact', head: true })
		.eq('metadata->chapter', 'Ministry and Mission')
		.eq('metadata->section', 'read')
		.eq('metadata->pageType', 'reflection');

	if (countError) {
		console.error('Count error:', countError);
		return;
	}

	console.log(`\n📊 Found ${problematicCount} blocks with problematic metadata`);

	// Show what the original JSON looks like for comparison
	console.log('\n📖 Checking original JSON for comparison...');
	// We should see what the metadata should actually be
}

checkMetadata();

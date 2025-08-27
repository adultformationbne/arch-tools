import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the JSON file
const jsonPath = path.join(__dirname, '../static/AHWGP_master.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Find all blocks with reflection metadata
const reflectionBlocks = data.blocks.filter(
	(block) =>
		block.metadata && Array.isArray(block.metadata) && block.metadata.includes('reflection')
);

// Group reflection blocks by their surrounding context
const reflectionPages = [];
let currentPage = null;
let lastNonReflectionIndex = -1;

for (let i = 0; i < data.blocks.length; i++) {
	const block = data.blocks[i];

	if (block.metadata?.includes('reflection')) {
		// Check if this is a new reflection page
		if (!currentPage || i - lastNonReflectionIndex > 1) {
			// Look for the chapter before this reflection
			let chapterBlock = null;
			for (let j = i - 1; j >= 0; j--) {
				if (data.blocks[j].tag === 'chapter') {
					chapterBlock = data.blocks[j];
					break;
				}
			}

			currentPage = {
				chapter: chapterBlock?.content || 'Unknown Chapter',
				chapterId: chapterBlock?.id,
				blocks: [],
				structure: {
					read: [],
					share: [],
					pray: [],
					research: []
				}
			};
			reflectionPages.push(currentPage);
		}

		// Categorize the block
		const content = block.content.toLowerCase();
		if (content === 'read' || content.includes('read through')) {
			currentPage.structure.read.push(block);
		} else if (content === 'share' || content.includes('?')) {
			currentPage.structure.share.push(block);
		} else if (content === 'pray' || content.includes('amen')) {
			currentPage.structure.pray.push(block);
		} else if (content === 'research' || content.includes('catechism')) {
			currentPage.structure.research.push(block);
		}

		currentPage.blocks.push(block);
	} else {
		lastNonReflectionIndex = i;
		currentPage = null;
	}
}

// Print analysis
console.log(`Found ${reflectionBlocks.length} reflection blocks`);
console.log(`Grouped into ${reflectionPages.length} reflection pages\n`);

reflectionPages.forEach((page, index) => {
	console.log(`\n--- Reflection Page ${index + 1} ---`);
	console.log(`Chapter: ${page.chapter}`);
	console.log(`Total blocks: ${page.blocks.length}`);
	console.log(`Structure:`);
	console.log(`  - Read sections: ${page.structure.read.length}`);
	console.log(`  - Share sections: ${page.structure.share.length}`);
	console.log(`  - Pray sections: ${page.structure.pray.length}`);
	console.log(`  - Research sections: ${page.structure.research.length}`);
});

// Export the analysis
fs.writeFileSync(
	path.join(__dirname, 'reflection_analysis.json'),
	JSON.stringify(reflectionPages, null, 2)
);

console.log('\n✅ Analysis complete. Results saved to reflection_analysis.json');

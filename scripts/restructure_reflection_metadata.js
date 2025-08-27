import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the JSON file
const jsonPath = path.join(__dirname, '../static/AHWGP_master.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Create a copy of the data for modification
const updatedData = JSON.parse(JSON.stringify(data));

// Process each block
updatedData.blocks = updatedData.blocks.map((block, index) => {
	// Check if this block has reflection metadata
	if (block.metadata && Array.isArray(block.metadata) && block.metadata.includes('reflection')) {
		// Parse the content to extract sections
		const content = block.content;
		const sections = {};

		// Extract Read section
		const readMatch = content.match(/^Read\n(.+?)(?=\nShare|\nPray|\nresearch|$)/ms);
		if (readMatch) {
			sections.read = readMatch[1].trim();
		}

		// Extract Share section (questions)
		const shareMatch = content.match(/Share\n(.+?)(?=\nPray|\nresearch|$)/ms);
		if (shareMatch) {
			// Split questions by double newlines
			const questions = shareMatch[1]
				.split(/\n\n+/)
				.map((q) => q.trim())
				.filter((q) => q.length > 0);
			sections.share = questions;
		}

		// Extract Pray section
		const prayMatch = content.match(/Pray\n(.+?)(?=\nresearch|$)/ms);
		if (prayMatch) {
			sections.pray = prayMatch[1].trim();
		}

		// Extract Research section
		const researchMatch = content.match(/research\n(.+?)$/ms);
		if (researchMatch) {
			sections.research = researchMatch[1].trim();
		}

		// Find the chapter this reflection belongs to
		let chapterName = null;
		for (let i = index - 1; i >= 0; i--) {
			if (updatedData.blocks[i].tag === 'chapter') {
				chapterName = updatedData.blocks[i].content;
				break;
			}
		}

		// Update the metadata to be an object instead of an array
		return {
			...block,
			metadata: {
				type: 'reflection',
				chapter: chapterName,
				sections: sections,
				originalFormat: true // Flag to indicate this was auto-converted
			}
		};
	}

	// For non-reflection blocks, convert metadata array to object if needed
	if (block.metadata && Array.isArray(block.metadata) && block.metadata.length > 0) {
		return {
			...block,
			metadata: {
				type: block.metadata[0],
				tags: block.metadata.slice(1) // Keep any additional metadata items as tags
			}
		};
	}

	// If metadata is empty array or missing, set to null
	if (!block.metadata || (Array.isArray(block.metadata) && block.metadata.length === 0)) {
		return {
			...block,
			metadata: null
		};
	}

	return block;
});

// Count the changes
const reflectionBlocks = updatedData.blocks.filter(
	(b) => b.metadata && b.metadata.type === 'reflection'
).length;

const prayerPageBlocks = updatedData.blocks.filter(
	(b) => b.metadata && b.metadata.type === 'prayer page'
).length;

console.log(`\n📊 Restructuring Summary:`);
console.log(`- Converted ${reflectionBlocks} reflection blocks`);
console.log(`- Converted ${prayerPageBlocks} prayer page blocks`);
console.log(`- Total blocks processed: ${updatedData.blocks.length}`);

// Save the updated data
const outputPath = path.join(__dirname, '../static/AHWGP_master_restructured.json');
fs.writeFileSync(outputPath, JSON.stringify(updatedData, null, 2));

console.log(`\n✅ Restructured data saved to: ${outputPath}`);

// Print a few examples
console.log(`\n📋 Example restructured reflection block:`);
const exampleReflection = updatedData.blocks.find((b) => b.metadata?.type === 'reflection');
if (exampleReflection) {
	console.log(
		JSON.stringify(
			{
				id: exampleReflection.id,
				tag: exampleReflection.tag,
				metadata: exampleReflection.metadata,
				contentLength: exampleReflection.content.length
			},
			null,
			2
		)
	);
}

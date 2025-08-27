import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the original JSON file
const jsonPath = path.join(__dirname, '../static/AHWGP_master.json');
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

// Function to create a new block with reflection metadata
function createReflectionBlock(tag, content, chapterName, sectionType) {
	return {
		id: uuidv4(),
		tag: tag,
		content: content.trim(),
		metadata: {
			pageType: 'reflection',
			section: sectionType,
			chapter: chapterName
		},
		createdAt: new Date().toISOString(),
		isVisible: true
	};
}

// Process the blocks
const newBlocks = [];
let reflectionsSplit = 0;

for (let i = 0; i < data.blocks.length; i++) {
	const block = data.blocks[i];

	// Check if this is a reflection block with combined content
	if (
		block.metadata &&
		Array.isArray(block.metadata) &&
		block.metadata.includes('reflection') &&
		(block.content.includes('Read\n') || block.content.includes('read\n')) &&
		(block.content.includes('Share\n') || block.content.includes('share\n'))
	) {
		// Find the chapter this reflection belongs to
		let chapterName = null;
		for (let j = i - 1; j >= 0; j--) {
			if (data.blocks[j].tag === 'chapter') {
				chapterName = data.blocks[j].content;
				break;
			}
		}

		const content = block.content;

		// Extract Read section
		const readMatch = content.match(/[Rr]ead\n(.+?)(?=\n[Ss]hare|\n[Pp]ray|\n[Rr]esearch|$)/ims);
		if (readMatch) {
			newBlocks.push(createReflectionBlock('h2', 'Read', chapterName, 'read'));
			// Keep the read content as a single paragraph
			const readContent = readMatch[1].trim();
			if (readContent) {
				newBlocks.push(createReflectionBlock('paragraph', readContent, chapterName, 'read'));
			}
		}

		// Extract Share section
		const shareMatch = content.match(/[Ss]hare\n(.+?)(?=\n[Pp]ray|\n[Rr]esearch|$)/ims);
		if (shareMatch) {
			newBlocks.push(createReflectionBlock('h2', 'Share', chapterName, 'share'));
			// Split questions by double newlines
			const questions = shareMatch[1].split(/\n\n+/);
			questions.forEach((question) => {
				if (question.trim()) {
					newBlocks.push(createReflectionBlock('paragraph', question.trim(), chapterName, 'share'));
				}
			});
		}

		// Extract Pray section
		const prayMatch = content.match(/[Pp]ray\n(.+?)(?=\n[Rr]esearch|$)/ims);
		if (prayMatch) {
			newBlocks.push(createReflectionBlock('h2', 'Pray', chapterName, 'pray'));
			// Handle prayer content (may contain line breaks for formatting)
			newBlocks.push(createReflectionBlock('paragraph', prayMatch[1].trim(), chapterName, 'pray'));
		}

		// Extract Research section
		const researchMatch = content.match(/[Rr]esearch\n(.+?)$/ims);
		if (researchMatch) {
			newBlocks.push(createReflectionBlock('h2', 'Research', chapterName, 'research'));
			newBlocks.push(
				createReflectionBlock('paragraph', researchMatch[1].trim(), chapterName, 'research')
			);
		}

		reflectionsSplit++;
	} else {
		// Keep the block as is, but update metadata format if needed
		if (block.metadata && Array.isArray(block.metadata) && block.metadata.length > 0) {
			// Convert array metadata to object format
			if (block.metadata.includes('prayer page')) {
				newBlocks.push({
					...block,
					metadata: {
						pageType: 'prayer',
						tags: block.metadata.filter((m) => m !== 'prayer page')
					}
				});
			} else if (block.metadata.includes('reflection')) {
				// These are the individual reflection blocks that are already split
				// Find their chapter
				let chapterName = null;
				for (let j = i - 1; j >= 0; j--) {
					if (data.blocks[j].tag === 'chapter') {
						chapterName = data.blocks[j].content;
						break;
					}
				}

				// Determine section type based on content
				let sectionType = 'general';
				const lowerContent = block.content.toLowerCase();
				if (lowerContent === 'read' || lowerContent.includes('read through')) {
					sectionType = 'read';
				} else if (lowerContent === 'share' || block.content.includes('?')) {
					sectionType = 'share';
				} else if (lowerContent === 'pray' || block.content.includes('Amen')) {
					sectionType = 'pray';
				} else if (lowerContent === 'research' || block.content.includes('Catechism')) {
					sectionType = 'research';
				}

				newBlocks.push({
					...block,
					metadata: {
						pageType: 'reflection',
						section: sectionType,
						chapter: chapterName
					}
				});
			} else {
				newBlocks.push(block);
			}
		} else {
			// Keep blocks without metadata as is
			newBlocks.push(block);
		}
	}
}

// Create the updated data structure
const updatedData = {
	...data,
	blocks: newBlocks
};

// Save the updated data
const outputPath = path.join(__dirname, '../static/AHWGP_master_split.json');
fs.writeFileSync(outputPath, JSON.stringify(updatedData, null, 2));

console.log(`\n✅ Splitting complete!`);
console.log(`📊 Statistics:`);
console.log(`- Combined reflection blocks split: ${reflectionsSplit}`);
console.log(`- Total blocks before: ${data.blocks.length}`);
console.log(`- Total blocks after: ${newBlocks.length}`);
console.log(`- New blocks created: ${newBlocks.length - data.blocks.length}`);
console.log(`\n💾 Output saved to: ${outputPath}`);

// Show example of split blocks
console.log(`\n📋 Example of split reflection blocks:`);
const reflectionBlocks = newBlocks.filter((b) => b.metadata?.pageType === 'reflection');
const exampleChapter = reflectionBlocks[0]?.metadata?.chapter;
if (exampleChapter) {
	const exampleBlocks = reflectionBlocks
		.filter((b) => b.metadata.chapter === exampleChapter)
		.slice(0, 6);

	console.log(`\nChapter: "${exampleChapter}"`);
	exampleBlocks.forEach((block) => {
		console.log(
			`- [${block.tag}] ${block.metadata.section}: "${block.content.substring(0, 50)}..."`
		);
	});
}

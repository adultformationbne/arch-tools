// Content cleaning and consolidation utilities

export function cleanChapterContent(chapter) {
	console.log(`🧹 Cleaning chapter: ${chapter.title}`);

	const cleanedBlocks = [];
	const processedContent = new Set(); // Track content we've already processed

	// Group blocks by content type
	const blocksByType = {
		headers: [],
		paragraphs: [],
		callouts: [],
		special: []
	};

	// Categorize blocks
	chapter.blocks.forEach((block) => {
		switch (block.type) {
			case 'header':
				blocksByType.headers.push(block);
				break;
			case 'callout_text':
			case 'callout_header':
				blocksByType.callouts.push(block);
				break;
			case 'special_text':
				blocksByType.special.push(block);
				break;
			case 'paragraph':
			default:
				blocksByType.paragraphs.push(block);
				break;
		}
	});

	// Process each type
	cleanedBlocks.push(...deduplicateBlocks(blocksByType.headers));
	cleanedBlocks.push(...consolidateParagraphs(blocksByType.paragraphs));
	cleanedBlocks.push(...organizeCallouts(blocksByType.callouts));
	cleanedBlocks.push(...deduplicateBlocks(blocksByType.special));

	console.log(`✅ Cleaned ${chapter.blocks.length} → ${cleanedBlocks.length} blocks`);

	return {
		...chapter,
		blocks: cleanedBlocks,
		totalBlocks: cleanedBlocks.length,
		originalBlockCount: chapter.blocks.length
	};
}

function deduplicateBlocks(blocks) {
	const seen = new Set();
	const unique = [];

	blocks.forEach((block) => {
		const contentKey = block.content.trim().toLowerCase();
		if (!seen.has(contentKey) && contentKey.length > 0) {
			seen.add(contentKey);
			unique.push(block);
		}
	});

	return unique;
}

function consolidateParagraphs(paragraphs) {
	if (paragraphs.length === 0) return [];

	const consolidated = [];
	let currentGroup = [];

	paragraphs.forEach((block, index) => {
		const content = block.content.trim();

		// Skip very short fragments (likely broken pieces)
		if (content.length < 20) {
			return;
		}

		// Check if this content is similar to something we already have
		const isDuplicate = consolidated.some(
			(existing) => similarity(existing.content, content) > 0.8
		);

		if (!isDuplicate) {
			// Check if this continues the previous paragraph
			if (currentGroup.length > 0) {
				const lastContent = currentGroup[currentGroup.length - 1].content;

				// If the current content starts where the last ended, merge them
				if (shouldMergeContent(lastContent, content)) {
					currentGroup[currentGroup.length - 1] = {
						...currentGroup[currentGroup.length - 1],
						content: lastContent + ' ' + content,
						mergedFrom: [...(currentGroup[currentGroup.length - 1].mergedFrom || []), block.id]
					};
				} else {
					// Start a new paragraph
					consolidated.push(...currentGroup);
					currentGroup = [block];
				}
			} else {
				currentGroup = [block];
			}
		}
	});

	// Add remaining group
	consolidated.push(...currentGroup);

	return consolidated;
}

function organizeCallouts(callouts) {
	// Group callouts by their purpose (Reflect, Pray, Listen, etc.)
	const calloutGroups = {};

	callouts.forEach((block) => {
		const content = block.content.trim();

		// Identify callout type based on content
		let groupKey = 'general';
		if (content.toLowerCase().includes('reflect') || content === 'Reflect') {
			groupKey = 'reflect';
		} else if (content.toLowerCase().includes('pray') || content === 'Pray') {
			groupKey = 'pray';
		} else if (content.toLowerCase().includes('listen') || content === 'Listen') {
			groupKey = 'listen';
		} else if (content.toLowerCase().includes('worship') || content === 'Worship') {
			groupKey = 'worship';
		}

		if (!calloutGroups[groupKey]) {
			calloutGroups[groupKey] = [];
		}

		calloutGroups[groupKey].push(block);
	});

	// Consolidate each group
	const organized = [];
	Object.entries(calloutGroups).forEach(([groupKey, blocks]) => {
		if (groupKey === 'general') {
			// For general callouts, just deduplicate
			organized.push(...deduplicateBlocks(blocks));
		} else {
			// For specific groups, create a single consolidated callout
			const contents = blocks
				.map((b) => b.content.trim())
				.filter((c) => c.length > 0 && c !== groupKey)
				.filter((content, index, arr) => arr.indexOf(content) === index); // unique

			if (contents.length > 0) {
				organized.push({
					id: `consolidated_${groupKey}_${Date.now()}`,
					type: 'callout_text',
					content: `${groupKey.charAt(0).toUpperCase() + groupKey.slice(1)}\n\n${contents.join('\n\n')}`,
					originalClass: 'consolidated-callout',
					metadata: {
						consolidated: true,
						originalIds: blocks.map((b) => b.id),
						groupType: groupKey
					}
				});
			}
		}
	});

	return organized;
}

function shouldMergeContent(content1, content2) {
	// Check if content2 continues where content1 left off
	const end1 = content1.trim().toLowerCase();
	const start2 = content2.trim().toLowerCase();

	// If first content ends mid-sentence and second continues it
	if (!end1.match(/[.!?]$/) && start2.match(/^[a-z]/)) {
		return true;
	}

	// If they're both short fragments, likely part of same paragraph
	if (content1.length < 200 && content2.length < 200) {
		return true;
	}

	return false;
}

function similarity(str1, str2) {
	const longer = str1.length > str2.length ? str1 : str2;
	const shorter = str1.length > str2.length ? str2 : str1;

	if (longer.length === 0) return 1.0;

	const distance = levenshteinDistance(longer, shorter);
	return (longer.length - distance) / longer.length;
}

function levenshteinDistance(str1, str2) {
	const matrix = [];

	for (let i = 0; i <= str2.length; i++) {
		matrix[i] = [i];
	}

	for (let j = 0; j <= str1.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= str2.length; i++) {
		for (let j = 1; j <= str1.length; j++) {
			if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1,
					matrix[i][j - 1] + 1,
					matrix[i - 1][j] + 1
				);
			}
		}
	}

	return matrix[str2.length][str1.length];
}

export function cleanBookData(bookData) {
	if (!bookData?.chapters) return bookData;

	console.log('🧹 Starting book data cleaning...');

	const cleanedChapters = bookData.chapters.map((chapter) => cleanChapterContent(chapter));

	const newTotalBlocks = cleanedChapters.reduce((sum, ch) => sum + ch.totalBlocks, 0);
	const originalTotal = bookData.totalBlocks;

	console.log(`✅ Book cleaning complete: ${originalTotal} → ${newTotalBlocks} blocks`);

	return {
		...bookData,
		chapters: cleanedChapters,
		totalBlocks: newTotalBlocks,
		statistics: {
			...bookData.statistics,
			originalTotalBlocks: originalTotal,
			cleanedTotalBlocks: newTotalBlocks,
			reductionPercentage: Math.round(((originalTotal - newTotalBlocks) / originalTotal) * 100)
		}
	};
}

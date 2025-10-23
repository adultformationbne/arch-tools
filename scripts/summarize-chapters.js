#!/usr/bin/env node

/**
 * Summarize Chapters with Ollama
 *
 * Processes chapter-content.json through Ollama to generate concise summaries.
 * - Batches requests to avoid rate limits
 * - Saves progress incrementally
 * - Resumes from last checkpoint if interrupted
 *
 * Usage: node scripts/summarize-chapters.js [--model llama3.2] [--batch-size 5]
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CONFIG = {
  model: process.argv.find(arg => arg.startsWith('--model='))?.split('=')[1] || 'llama3.2',
  batchSize: parseInt(process.argv.find(arg => arg.startsWith('--batch-size='))?.split('=')[1] || '5'),
  delayMs: 500,
  maxRetries: 3,
  ollamaUrl: 'http://localhost:11434/api/generate'
};

console.log('🤖 Ollama Chapter Summarizer');
console.log(`Model: ${CONFIG.model}`);
console.log(`Batch size: ${CONFIG.batchSize}`);
console.log(`Delay: ${CONFIG.delayMs}ms\n`);

// Load chapter content
const contentPath = path.join(__dirname, '..', 'chapter-content.json');
if (!fs.existsSync(contentPath)) {
  console.error('❌ Error: chapter-content.json not found');
  console.error('Run: node scripts/extract-chapters-to-json.js first');
  process.exit(1);
}

const chapterData = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

// Load or create progress file
const progressPath = path.join(__dirname, '..', 'summary-progress.json');
let progress = { completed: [], summaries: {} };
if (fs.existsSync(progressPath)) {
  progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  console.log(`📂 Resuming from checkpoint (${progress.completed.length} items completed)\n`);
}

/**
 * Call Ollama API for summarization
 */
async function summarizeWithOllama(text, context = '') {
  const prompt = `Provide a ONE SENTENCE summary. Must be exactly one sentence. Be direct and concise. No preamble, no bullet points, no meta-commentary.

${context ? `Context: ${context}\n\n` : ''}Text:
${text}

One sentence summary:`;

  const response = await fetch(CONFIG.ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.2,
        top_p: 0.8,
        num_predict: 60
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response.trim();
}

/**
 * Sleep utility
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Process a single item with retry logic
 */
async function processItem(id, text, context, retries = 0) {
  try {
    const summary = await summarizeWithOllama(text, context);
    return { id, summary, success: true };
  } catch (error) {
    if (retries < CONFIG.maxRetries) {
      console.log(`  ⚠️  Retry ${retries + 1}/${CONFIG.maxRetries} for ${id}`);
      await sleep(1000 * (retries + 1)); // Exponential backoff
      return processItem(id, text, context, retries + 1);
    }
    console.error(`  ❌ Failed after ${CONFIG.maxRetries} retries: ${id}`);
    return { id, summary: '[ERROR: Failed to generate summary]', success: false };
  }
}

/**
 * Process items in batches
 */
async function processBatch(items) {
  const promises = items.map(item =>
    processItem(item.id, item.text, item.context)
  );
  return await Promise.all(promises);
}

/**
 * Save progress incrementally
 */
function saveProgress() {
  fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2), 'utf8');
}

/**
 * Update markdown file live
 */
function updateMarkdownLive() {
  const outputPath = path.join(__dirname, '..', 'CHAPTER_SUMMARIES.md');

  let markdown = `# Chapter Summaries - A Home with God's People\n\n`;
  markdown += `Generated: ${new Date().toLocaleString()}\n`;
  markdown += `Model: ${CONFIG.model}\n`;
  markdown += `Status: 🔄 IN PROGRESS (${progress.completed.length} items completed)\n\n`;
  markdown += `---\n\n`;

  for (const chapter of chapterData.chapters) {
    // Skip chapter 1 (Introduction)
    if (chapter.number === 1) {
      continue;
    }

    const chapterKey = `ch${chapter.number}`;

    markdown += `## Chapter ${chapter.number}: ${chapter.title}\n\n`;

    // Chapter intro summary
    const introId = `${chapterKey}_intro`;
    if (progress.summaries[introId]) {
      markdown += `**Introduction:** ${progress.summaries[introId]}\n\n`;
    } else if (chapter.intro_paragraphs.length > 0) {
      markdown += `**Introduction:** ⏳ Processing...\n\n`;
    }

    // Section summaries
    for (let i = 0; i < chapter.sections.length; i++) {
      const section = chapter.sections[i];
      const sectionId = `${chapterKey}_s${i}`;

      if (progress.summaries[sectionId]) {
        const indent = section.level === 'h3' ? '  ' : '';
        markdown += `${indent}- **${section.heading}** — ${progress.summaries[sectionId]}\n`;
      } else if (section.content.length > 0) {
        const indent = section.level === 'h3' ? '  ' : '';
        markdown += `${indent}- **${section.heading}** — ⏳ Processing...\n`;
      }
    }

    markdown += `\n`;
  }

  fs.writeFileSync(outputPath, markdown, 'utf8');
}

/**
 * Main processing loop
 */
async function summarizeAllChapters() {
  // Build work queue
  const workQueue = [];

  for (const chapter of chapterData.chapters) {
    // Skip chapter 1 (Introduction)
    if (chapter.number === 1) {
      continue;
    }

    const chapterKey = `ch${chapter.number}`;

    // Chapter intro
    if (chapter.intro_paragraphs.length > 0) {
      const introId = `${chapterKey}_intro`;
      if (!progress.completed.includes(introId)) {
        workQueue.push({
          id: introId,
          text: chapter.intro_paragraphs.join('\n\n'),
          context: `Chapter ${chapter.number}: ${chapter.title} - Introduction`,
          chapterNumber: chapter.number,
          type: 'intro'
        });
      }
    }

    // Sections
    for (let i = 0; i < chapter.sections.length; i++) {
      const section = chapter.sections[i];
      const sectionId = `${chapterKey}_s${i}`;

      if (!progress.completed.includes(sectionId) && section.content.length > 0) {
        workQueue.push({
          id: sectionId,
          text: section.content.join('\n\n'),
          context: `Chapter ${chapter.number}: ${chapter.title} - Section: ${section.heading}`,
          chapterNumber: chapter.number,
          type: 'section',
          heading: section.heading
        });
      }
    }
  }

  console.log(`📋 Work queue: ${workQueue.length} items to process\n`);

  if (workQueue.length === 0) {
    console.log('✅ All items already processed!\n');
    return;
  }

  // Process in batches
  let processed = 0;
  for (let i = 0; i < workQueue.length; i += CONFIG.batchSize) {
    const batch = workQueue.slice(i, i + CONFIG.batchSize);
    const batchNum = Math.floor(i / CONFIG.batchSize) + 1;
    const totalBatches = Math.ceil(workQueue.length / CONFIG.batchSize);

    console.log(`\n🔄 Batch ${batchNum}/${totalBatches} (${batch.length} items)`);

    const results = await processBatch(batch);

    // Save results
    for (const result of results) {
      progress.summaries[result.id] = result.summary;
      progress.completed.push(result.id);
      processed++;

      const item = batch.find(b => b.id === result.id);
      console.log(`  ✓ [${processed}/${workQueue.length}] Ch${item.chapterNumber} ${item.type}`);
    }

    // Save progress after each batch
    saveProgress();

    // Update markdown file live so you can watch it build
    updateMarkdownLive();

    // Delay between batches (except last one)
    if (i + CONFIG.batchSize < workQueue.length) {
      await sleep(CONFIG.delayMs);
    }
  }

  console.log('\n✅ All summaries generated!\n');
}

/**
 * Generate final markdown output
 */
function generateMarkdown() {
  console.log('📝 Finalizing markdown output...\n');

  let markdown = `# Chapter Summaries - A Home with God's People\n\n`;
  markdown += `Generated: ${new Date().toLocaleString()}\n`;
  markdown += `Model: ${CONFIG.model}\n`;
  markdown += `Status: ✅ COMPLETE\n\n`;
  markdown += `---\n\n`;

  for (const chapter of chapterData.chapters) {
    // Skip chapter 1 (Introduction)
    if (chapter.number === 1) {
      continue;
    }

    const chapterKey = `ch${chapter.number}`;

    markdown += `## Chapter ${chapter.number}: ${chapter.title}\n\n`;

    // Chapter intro summary
    const introId = `${chapterKey}_intro`;
    if (progress.summaries[introId]) {
      markdown += `**Introduction:** ${progress.summaries[introId]}\n\n`;
    }

    // Section summaries
    for (let i = 0; i < chapter.sections.length; i++) {
      const section = chapter.sections[i];
      const sectionId = `${chapterKey}_s${i}`;

      if (progress.summaries[sectionId]) {
        const indent = section.level === 'h3' ? '  ' : '';
        markdown += `${indent}- **${section.heading}** — ${progress.summaries[sectionId]}\n`;
      }
    }

    markdown += `\n`;
  }

  const outputPath = path.join(__dirname, '..', 'CHAPTER_SUMMARIES.md');
  fs.writeFileSync(outputPath, markdown, 'utf8');

  console.log(`✅ Markdown generated!`);
  console.log(`📄 Output: ${outputPath}`);
}

/**
 * Run the script
 */
async function main() {
  try {
    await summarizeAllChapters();
    generateMarkdown();

    // Clean up progress file
    if (fs.existsSync(progressPath)) {
      fs.unlinkSync(progressPath);
      console.log('\n🧹 Cleaned up progress file');
    }

    console.log('\n🎉 Done!\n');
  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error('\n💾 Progress saved to summary-progress.json');
    console.error('Run the script again to resume from checkpoint.\n');
    process.exit(1);
  }
}

main();

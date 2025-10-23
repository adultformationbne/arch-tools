#!/usr/bin/env node

/**
 * Test Summarizer - Single Chapter
 * Tests summarization on Chapter 2 only
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG = {
  model: 'llama3.2:1b',
  testChapter: 2,
  ollamaUrl: 'http://localhost:11434/api/generate'
};

console.log(`🧪 Testing summarization on Chapter ${CONFIG.testChapter}\n`);

// Load chapter content
const contentPath = path.join(__dirname, '..', 'chapter-content.json');
const chapterData = JSON.parse(fs.readFileSync(contentPath, 'utf8'));

const chapter = chapterData.chapters.find(ch => ch.number === CONFIG.testChapter);
if (!chapter) {
  console.error(`Chapter ${CONFIG.testChapter} not found`);
  process.exit(1);
}

async function summarizeWithOllama(text, context = '') {
  const prompt = `Summarize the following text in 1-2 concise sentences. Be minimal and direct. Do not use phrases like "this section discusses" or "the text explains". Just state the key points.

${context ? `Context: ${context}\n\n` : ''}Text to summarize:
${text}

Summary (1-2 sentences):`;

  console.log(`  🔄 Calling Ollama...`);

  const response = await fetch(CONFIG.ollamaUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.response.trim();
}

async function testChapter() {
  console.log(`Chapter ${chapter.number}: ${chapter.title}\n`);
  console.log(`Intro paragraphs: ${chapter.intro_paragraphs.length}`);
  console.log(`Sections: ${chapter.sections.length}\n`);

  const results = [];

  // Test intro
  if (chapter.intro_paragraphs.length > 0) {
    console.log('--- CHAPTER INTRO ---');
    console.log(`Text length: ${chapter.intro_paragraphs.join(' ').length} chars`);

    try {
      const summary = await summarizeWithOllama(
        chapter.intro_paragraphs.join('\n\n'),
        `Chapter ${chapter.number}: ${chapter.title} - Introduction`
      );
      console.log(`  ✓ Summary: ${summary}\n`);
      results.push({ type: 'intro', summary });
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }

  // Test first 2 sections
  const sectionsToTest = chapter.sections.slice(0, 2);

  for (let i = 0; i < sectionsToTest.length; i++) {
    const section = sectionsToTest[i];

    console.log(`--- SECTION ${i + 1}: ${section.heading} ---`);
    console.log(`Level: ${section.level}`);
    console.log(`Content paragraphs: ${section.content.length}`);
    console.log(`Text length: ${section.content.join(' ').length} chars`);

    if (section.content.length === 0) {
      console.log(`  ⊘ Skipping (no content)\n`);
      continue;
    }

    try {
      const summary = await summarizeWithOllama(
        section.content.join('\n\n'),
        `Chapter ${chapter.number}: ${chapter.title} - Section: ${section.heading}`
      );
      console.log(`  ✓ Summary: ${summary}\n`);
      results.push({
        type: 'section',
        heading: section.heading,
        level: section.level,
        summary
      });
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}\n`);
    }
  }

  // Generate sample output
  console.log('\n=== SAMPLE OUTPUT ===\n');
  console.log(`## Chapter ${chapter.number}: ${chapter.title}\n`);

  const introResult = results.find(r => r.type === 'intro');
  if (introResult) {
    console.log(`**Introduction:** ${introResult.summary}\n`);
  }

  results.filter(r => r.type === 'section').forEach(r => {
    const indent = r.level === 'h3' ? '  ' : '';
    console.log(`${indent}- **${r.heading}** — ${r.summary}`);
  });

  console.log('\n✅ Test complete!\n');
}

testChapter().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});

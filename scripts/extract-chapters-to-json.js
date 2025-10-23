#!/usr/bin/env node

/**
 * Extract Chapter Content to JSON
 *
 * Extracts structured chapter data for LLM summarization:
 * - Chapter intro paragraphs (first paragraphs, not on reflection/prayer pages)
 * - Each section heading with all content until next heading
 * - Excludes prayer and reflection pages
 *
 * Output: chapter-content.json
 * Usage: node scripts/extract-chapters-to-json.js
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function extractChapterContent() {
  console.log('📚 Extracting chapter content to JSON...\n');

  // Fetch all chapters
  const { data: chapters, error: chaptersError } = await supabase
    .from('chapters')
    .select('*')
    .order('chapter_number', { ascending: true });

  if (chaptersError) {
    console.error('Error fetching chapters:', chaptersError);
    process.exit(1);
  }

  const result = {
    generated_at: new Date().toISOString(),
    total_chapters: chapters.length,
    chapters: []
  };

  for (const chapter of chapters) {
    console.log(`Processing Chapter ${chapter.chapter_number}: ${chapter.title}`);

    // Fetch all blocks for this chapter, ordered by creation time
    const { data: blocks, error: blocksError } = await supabase
      .from('blocks')
      .select('tag, content, metadata, created_at')
      .eq('chapter_id', chapter.id)
      .order('created_at', { ascending: true });

    if (blocksError) {
      console.error(`  Error fetching blocks for chapter ${chapter.chapter_number}:`, blocksError);
      continue;
    }

    // Filter out prayer and reflection page blocks
    const contentBlocks = blocks.filter(block => {
      const pageType = block.metadata?.pageType;
      return pageType !== 'prayer' && pageType !== 'reflection';
    });

    // Extract intro paragraphs (first paragraph blocks before any heading)
    const introParagraphs = [];
    for (const block of contentBlocks) {
      if (block.tag === 'paragraph') {
        introParagraphs.push(block.content);
      } else if (['h1', 'h2', 'h3'].includes(block.tag)) {
        break; // Stop at first heading
      }
    }

    // Extract sections (headings with their content)
    const sections = [];
    let currentSection = null;

    for (const block of contentBlocks) {
      if (['h1', 'h2', 'h3'].includes(block.tag)) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }
        // Start new section
        currentSection = {
          heading: block.content,
          level: block.tag,
          content: []
        };
      } else if (currentSection && block.tag === 'paragraph') {
        // Add content to current section
        currentSection.content.push(block.content);
      }
    }

    // Don't forget the last section
    if (currentSection) {
      sections.push(currentSection);
    }

    result.chapters.push({
      number: chapter.chapter_number,
      title: chapter.title,
      intro_paragraphs: introParagraphs,
      sections: sections
    });

    console.log(`  ✓ Found ${introParagraphs.length} intro paragraphs, ${sections.length} sections\n`);
  }

  // Write to JSON file
  const outputPath = path.join(__dirname, '..', 'chapter-content.json');
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`\n✅ Extraction complete!`);
  console.log(`📄 Output: ${outputPath}`);
  console.log(`\nSummary:`);
  console.log(`- Total chapters: ${result.chapters.length}`);

  const totalSections = result.chapters.reduce((sum, ch) => sum + ch.sections.length, 0);
  console.log(`- Total sections: ${totalSections}`);

  const totalIntros = result.chapters.reduce((sum, ch) => sum + ch.intro_paragraphs.length, 0);
  console.log(`- Total intro paragraphs: ${totalIntros}`);
}

// Run the script
extractChapterContent().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

#!/usr/bin/env node

/**
 * Extract Book Structure Script
 *
 * Generates a markdown file showing the complete book structure:
 * - Chapter titles
 * - All headings (h1, h2, h3) within each chapter
 * - Excludes prayer and reflection pages
 *
 * Usage: node scripts/extract-book-structure.js
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing Supabase credentials');
  console.error('Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY in .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function extractBookStructure() {
  console.log('📚 Extracting book structure...\n');

  // Fetch all chapters with their headings
  const { data, error } = await supabase
    .from('chapters')
    .select(`
      chapter_number,
      title,
      blocks(
        tag,
        content,
        metadata,
        created_at
      )
    `)
    .order('chapter_number', { ascending: true });

  if (error) {
    console.error('Error fetching data:', error);
    process.exit(1);
  }

  console.log('Debug - data received:', data);

  if (!data || data.length === 0) {
    console.error('No chapters found');
    process.exit(1);
  }

  // Build markdown structure
  let markdown = `# Book Structure - A Home with God's People\n\n`;
  markdown += `Generated: ${new Date().toLocaleDateString()}\n\n`;
  markdown += `Total Chapters: ${data.length}\n\n`;
  markdown += `---\n\n`;

  for (const chapter of data) {
    markdown += `## Chapter ${chapter.chapter_number}: ${chapter.title}\n\n`;

    // Filter and sort headings
    const headings = (chapter.blocks || [])
      .filter(block => {
        // Only include h1, h2, h3
        if (!['h1', 'h2', 'h3'].includes(block.tag)) return false;

        // Exclude prayer and reflection pages
        const pageType = block.metadata?.pageType;
        if (pageType === 'prayer' || pageType === 'reflection') return false;

        return true;
      })
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (headings.length === 0) {
      markdown += `*No content headings found*\n\n`;
      continue;
    }

    // Add headings with proper indentation
    for (const heading of headings) {
      const indent = heading.tag === 'h1' ? '' :
                     heading.tag === 'h2' ? '  ' :
                     '    ';
      const marker = heading.tag === 'h1' ? '###' :
                     heading.tag === 'h2' ? '-' :
                     '  ·';

      // Clean content (remove newlines)
      const content = heading.content.replace(/\n/g, ' ').trim();
      markdown += `${indent}${marker} ${content}\n`;
    }

    markdown += `\n`;
  }

  // Write to file
  const outputPath = path.join(__dirname, '..', 'BOOK_STRUCTURE.md');
  fs.writeFileSync(outputPath, markdown, 'utf8');

  console.log(`✅ Book structure extracted successfully!`);
  console.log(`📄 Output file: ${outputPath}`);
  console.log(`\nSummary:`);
  console.log(`- Total chapters: ${data.length}`);

  const totalHeadings = data.reduce((sum, ch) => {
    const count = (ch.blocks || []).filter(b =>
      ['h1', 'h2', 'h3'].includes(b.tag) &&
      b.metadata?.pageType !== 'prayer' &&
      b.metadata?.pageType !== 'reflection'
    ).length;
    return sum + count;
  }, 0);

  console.log(`- Total headings: ${totalHeadings}`);
}

// Run the script
extractBookStructure().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

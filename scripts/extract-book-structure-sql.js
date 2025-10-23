#!/usr/bin/env node

/**
 * Extract Book Structure Script (Direct SQL Version)
 *
 * Generates a markdown file showing the complete book structure:
 * - Chapter titles
 * - All headings (h1, h2, h3) within each chapter
 * - Excludes prayer and reflection pages
 *
 * Usage: node scripts/extract-book-structure-sql.js
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
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function extractBookStructure() {
  console.log('📚 Extracting book structure...\n');

  // Use raw SQL to fetch chapters and headings
  const { data, error } = await supabase.rpc('get_book_structure');

  // If RPC doesn't exist, use direct SQL query
  if (error || !data) {
    console.log('Using direct SQL query...');

    const { data: sqlData, error: sqlError } = await supabase
      .from('chapters')
      .select('*')
      .order('chapter_number', { ascending: true });

    if (sqlError) {
      console.error('Error fetching chapters:', sqlError);
      process.exit(1);
    }

    const chapters = [];
    for (const chapter of sqlData) {
      const { data: blocks, error: blocksError } = await supabase
        .from('blocks')
        .select('tag, content, metadata, created_at')
        .eq('chapter_id', chapter.id)
        .in('tag', ['h1', 'h2', 'h3'])
        .order('created_at', { ascending: true });

      if (!blocksError && blocks) {
        chapters.push({
          ...chapter,
          blocks: blocks.filter(block => {
            const pageType = block.metadata?.pageType;
            return pageType !== 'prayer' && pageType !== 'reflection';
          })
        });
      }
    }

    buildMarkdownFile(chapters);
    return;
  }

  buildMarkdownFile(data);
}

function buildMarkdownFile(chapters) {
  console.log(`Processing ${chapters.length} chapters...\n`);

  let markdown = `# Book Structure - A Home with God's People\n\n`;
  markdown += `Generated: ${new Date().toLocaleDateString()}\n\n`;
  markdown += `Total Chapters: ${chapters.length}\n\n`;
  markdown += `---\n\n`;

  for (const chapter of chapters) {
    markdown += `## Chapter ${chapter.chapter_number}: ${chapter.title}\n\n`;

    const headings = chapter.blocks || [];

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
  console.log(`- Total chapters: ${chapters.length}`);

  const totalHeadings = chapters.reduce((sum, ch) => sum + (ch.blocks?.length || 0), 0);
  console.log(`- Total headings: ${totalHeadings}`);
}

// Run the script
extractBookStructure().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

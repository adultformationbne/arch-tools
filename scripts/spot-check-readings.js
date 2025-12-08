#!/usr/bin/env node
/**
 * Spot-check readings by scraping archdiocesanministries.org.au
 *
 * Usage:
 *   node scripts/spot-check-readings.js 2025-12-08
 *   node scripts/spot-check-readings.js 2025-04-17  # Holy Thursday
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june',
                'july', 'august', 'september', 'october', 'november', 'december'];

function dateToUrl(dateStr) {
  const date = new Date(dateStr);
  const day = DAYS[date.getDay()];
  const dayNum = date.getDate();
  const month = MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `https://archdiocesanministries.org.au/${day}-${dayNum}-${month}-${year}/`;
}

async function fetchReadings(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }
    const html = await response.text();

    // Extract readings using regex patterns
    const readings = {};

    // Look for reading references like "Genesis 3:9-15" or "Luke 1:26-38"
    const firstReadingMatch = html.match(/First Reading[^<]*<[^>]*>([^<]+)/i) ||
                              html.match(/(Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Tobit|Judith|Esther|1 Maccabees|2 Maccabees|Job|Psalms?|Proverbs|Ecclesiastes|Song of Songs|Wisdom|Sirach|Isaiah|Jeremiah|Lamentations|Baruch|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Acts)\s+\d+[:\d\-,\s]+/i);

    const gospelMatch = html.match(/(Matthew|Mark|Luke|John)\s+\d+[:\d\-,\s]+/gi);

    // Get liturgical day from page title or h1
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i) ||
                       html.match(/<h1[^>]*>([^<]+)<\/h1>/i);

    // Look for the main liturgical celebration name
    const celebrationMatch = html.match(/(?:Solemnity|Feast|Memorial|Optional Memorial)[:\s]+([^<\n]+)/i) ||
                             html.match(/<h2[^>]*class="[^"]*entry-title[^"]*"[^>]*>([^<]+)/i);

    readings.title = titleMatch ? titleMatch[1].trim() : null;
    readings.celebration = celebrationMatch ? celebrationMatch[1].trim() : null;
    readings.firstReading = firstReadingMatch ? firstReadingMatch[0].trim() : null;
    readings.gospel = gospelMatch ? gospelMatch[gospelMatch.length - 1].trim() : null;

    return readings;
  } catch (err) {
    return { error: err.message };
  }
}

async function getDbReadings(dateStr) {
  const { data, error } = await supabase
    .from('ordo_lectionary_mapping')
    .select(`
      calendar_date,
      match_type,
      match_method,
      lectionary_id,
      ordo_calendar!inner(liturgical_name),
      lectionary!inner(liturgical_day, first_reading, gospel_reading)
    `)
    .eq('calendar_date', dateStr)
    .single();

  if (error) {
    // Try without the inner join on lectionary
    const { data: basic } = await supabase
      .from('ordo_lectionary_mapping')
      .select('*, ordo_calendar(*)')
      .eq('calendar_date', dateStr)
      .single();
    return basic;
  }
  return data;
}

function normalizeReading(ref) {
  if (!ref) return '';
  return ref.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[,;]/g, '')
    .replace(/(\d+):(\d+)-(\d+)/g, '$1:$2-$3');
}

async function spotCheck(dateStr) {
  console.log(`\n=== SPOT CHECK: ${dateStr} ===\n`);

  const url = dateToUrl(dateStr);
  console.log(`URL: ${url}\n`);

  // Fetch from website
  console.log('Fetching from website...');
  const webReadings = await fetchReadings(url);

  if (webReadings.error) {
    console.log(`  Error: ${webReadings.error}`);
  } else {
    console.log(`  Title: ${webReadings.title || 'N/A'}`);
    console.log(`  Celebration: ${webReadings.celebration || 'N/A'}`);
    console.log(`  First Reading: ${webReadings.firstReading || 'N/A'}`);
    console.log(`  Gospel: ${webReadings.gospel || 'N/A'}`);
  }

  // Get from database
  console.log('\nDatabase entry:');
  const dbData = await getDbReadings(dateStr);

  if (!dbData) {
    console.log('  Not found in database');
  } else {
    console.log(`  Ordo Name: ${dbData.ordo_calendar?.liturgical_name || 'N/A'}`);
    console.log(`  Match Type: ${dbData.match_type}`);
    console.log(`  Match Method: ${dbData.match_method}`);
    if (dbData.lectionary) {
      console.log(`  Lectionary: ${dbData.lectionary.liturgical_day}`);
      console.log(`  First Reading: ${dbData.lectionary.first_reading || 'N/A'}`);
      console.log(`  Gospel: ${dbData.lectionary.gospel_reading || 'N/A'}`);
    }
  }

  // Compare gospels
  if (webReadings.gospel && dbData?.lectionary?.gospel_reading) {
    const webGospel = normalizeReading(webReadings.gospel);
    const dbGospel = normalizeReading(dbData.lectionary.gospel_reading);

    console.log('\n--- COMPARISON ---');
    if (webGospel.includes(dbGospel.split(':')[0]) || dbGospel.includes(webGospel.split(':')[0])) {
      console.log('  Gospel: MATCH (same book/chapter)');
    } else {
      console.log(`  Gospel: MISMATCH`);
      console.log(`    Web: ${webReadings.gospel}`);
      console.log(`    DB:  ${dbData.lectionary.gospel_reading}`);
    }
  }
}

// Main
const dateArg = process.argv[2];
if (!dateArg) {
  console.log('Usage: node scripts/spot-check-readings.js YYYY-MM-DD');
  console.log('Example: node scripts/spot-check-readings.js 2025-12-08');
  process.exit(1);
}

spotCheck(dateArg).then(() => process.exit(0));

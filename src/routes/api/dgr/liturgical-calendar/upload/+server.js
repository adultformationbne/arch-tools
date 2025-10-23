import { json } from '@sveltejs/kit';
import { parse } from 'csv-parse/sync';

/**
 * POST /api/dgr/liturgical-calendar/upload
 * Process uploaded CSV and match to Lectionary
 */
export async function POST({ request }) {
	try {
		const formData = await request.formData();
		const file = formData.get('file');
		const year = parseInt(formData.get('year'));

		if (!file) {
			return json({ success: false, error: 'No file provided' }, { status: 400 });
		}

		// Read CSV
		const text = await file.text();
		const records = parse(text, {
			columns: true,
			skip_empty_lines: true,
			bom: true
		});

		// Process and match entries
		const results = await processAndMatch(records, year);

		return json({
			success: true,
			results
		});
	} catch (error) {
		console.error('Upload processing error:', error);
		return json({ success: false, error: error.message }, { status: 500 });
	}
}

async function processAndMatch(records, year) {
	const { createClient } = await import('@supabase/supabase-js');
	const { PUBLIC_SUPABASE_URL } = await import('$env/static/public');
	const { SUPABASE_SERVICE_ROLE_KEY } = await import('$env/static/private');

	const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
		auth: { autoRefreshToken: false, persistSession: false }
	});

	// Load lectionary for matching
	const { data: lectionary } = await supabase.from('lectionary').select('*');

	const entries = [];
	let exact = 0;
	let partial = 0;
	let unmatched = 0;

	// Calculate year cycle
	const cycles = ['C', 'A', 'B'];
	const yearCycle = cycles[(year - 2025) % 3];

	for (const row of records) {
		// Only require: calendar_date, liturgical_name
		// Everything else comes from the matched lectionary entry
		const entry = {
			calendar_date: row.calendar_date || row.Date || row.date,
			liturgical_name: row.liturgical_name || row['Liturgical Day'] || row.name || row['Liturgical Name'],
			liturgical_year: year,
			year_cycle: yearCycle
		};

		// Match to lectionary
		const match = findLectionaryMatch(entry, lectionary, yearCycle);

		if (match) {
			entry.lectionary_id = match.admin_order;
			entry.match_type = match.match_type;
			entry.match_method = match.match_method;

			// Get all readings and metadata from matched lectionary entry
			entry.liturgical_rank = match.liturgical_rank;
			entry.liturgical_season = match.liturgical_season;
			entry.liturgical_week = match.liturgical_week;
			entry.first_reading = match.first_reading;
			entry.psalm = match.psalm;
			entry.second_reading = match.second_reading;
			entry.gospel_reading = match.gospel_reading;

			if (match.match_type === 'exact') {
				exact++;
			} else {
				partial++;
			}
		} else {
			entry.lectionary_id = null;
			entry.match_type = 'none';
			entry.match_method = null;
			entry.liturgical_rank = null;
			entry.liturgical_season = null;
			entry.liturgical_week = null;
			entry.first_reading = null;
			entry.psalm = null;
			entry.second_reading = null;
			entry.gospel_reading = null;
			unmatched++;
		}

		entries.push(entry);
	}

	return {
		total: entries.length,
		exact,
		partial,
		unmatched,
		entries
	};
}

function findLectionaryMatch(ordoEntry, lectionary, yearCycle) {
	const ordo_norm = normalize(ordoEntry.liturgical_name);

	// Try exact match first
	for (const lect of lectionary) {
		const lect_norm = normalize(lect.liturgical_day);

		// Exact match
		if (ordo_norm === lect_norm) {
			return {
				admin_order: lect.admin_order,
				match_type: 'exact',
				match_method: 'name',
				liturgical_rank: lect.liturgical_rank,
				liturgical_season: lect.liturgical_season,
				liturgical_week: lect.liturgical_week,
				first_reading: lect.first_reading,
				psalm: lect.psalm,
				second_reading: lect.second_reading,
				gospel_reading: lect.gospel_reading
			};
		}
	}

	// Try partial match
	const ordoWords = new Set(ordo_norm.split(/\s+/));
	let bestMatch = null;
	let bestScore = 0;

	for (const lect of lectionary) {
		const lect_norm = normalize(lect.liturgical_day);
		const lectWords = new Set(lect_norm.split(/\s+/));

		const overlap = [...ordoWords].filter(w => lectWords.has(w)).length;

		if (overlap > bestScore && overlap >= 3) {
			bestScore = overlap;
			bestMatch = {
				admin_order: lect.admin_order,
				match_type: 'partial',
				match_method: 'substring',
				liturgical_rank: lect.liturgical_rank,
				liturgical_season: lect.liturgical_season,
				liturgical_week: lect.liturgical_week,
				first_reading: lect.first_reading,
				psalm: lect.psalm,
				second_reading: lect.second_reading,
				gospel_reading: lect.gospel_reading
			};
		}
	}

	return bestMatch;
}

function normalize(text) {
	if (!text) return '';

	text = text.toUpperCase().trim();

	// Remove date prefixes
	text = text.replace(/^\d{1,2}\s+[A-Z]+\s*[–—-]\s*/, '');

	// Remove year suffixes
	text = text.replace(/,?\s*YEAR\s+[ABC]\s*$/, '');

	// Ordinal conversions
	const ordinals = {
		'FIRST': '1', 'SECOND': '2', 'THIRD': '3', 'FOURTH': '4', 'FIFTH': '5',
		'SIXTH': '6', 'SEVENTH': '7', 'EIGHTH': '8', 'NINTH': '9', 'TENTH': '10',
		'TWENTY-FIRST': '21', 'TWENTY-SECOND': '22', 'TWENTY-THIRD': '23',
		'TWENTY-FOURTH': '24', 'TWENTY-FIFTH': '25', 'TWENTY-SIXTH': '26',
		'TWENTY-SEVENTH': '27', 'TWENTY-EIGHTH': '28', 'TWENTY-NINTH': '29',
		'THIRTIETH': '30', 'THIRTY-FIRST': '31', 'THIRTY-SECOND': '32',
		'THIRTY-THIRD': '33', 'THIRTY-FOURTH': '34'
	};

	for (const [ord, num] of Object.entries(ordinals).sort((a, b) => b[0].length - a[0].length)) {
		text = text.replace(new RegExp(ord, 'g'), num);
	}

	// Saint abbreviations
	text = text.replace(/\bSS\b\.?\s+/g, 'SAINTS ');
	text = text.replace(/\bST\b\.?\s+/g, 'SAINT ');

	// Liturgical variations
	const variations = {
		'THE MOST HOLY TRINITY': 'TRINITY SUNDAY',
		'THE MOST HOLY BODY AND BLOOD OF CHRIST': 'THE BODY AND BLOOD OF CHRIST',
		'THE MOST SACRED HEART OF JESUS': 'SACRED HEART OF JESUS',
		'THE ASCENSION OF THE LORD': 'ASCENSION',
		'PASSION SUNDAY (PALM SUNDAY)': 'PALM SUNDAY'
	};

	for (const [old, new_] of Object.entries(variations)) {
		text = text.replace(old, new_);
	}

	// Clean up whitespace
	text = text.replace(/\s+/g, ' ').trim();

	return text;
}

import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

/**
 * GET /api/v1/readings
 * Public API endpoint for daily Mass readings
 *
 * Query Parameters:
 *   - date (optional): YYYY-MM-DD format, defaults to today
 *
 * Example:
 *   /api/v1/readings?date=2025-12-25
 *   /api/v1/readings (returns today's readings)
 */
export async function GET({ url }) {
	try {
		// Get date from query parameter or use today
		const dateParam = url.searchParams.get('date');
		const targetDate = dateParam || new Date().toISOString().split('T')[0];

		// Validate date format
		if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
			return json({
				success: false,
				error: 'Invalid date format. Use YYYY-MM-DD (e.g., 2025-12-25)'
			}, {
				status: 400,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, OPTIONS',
					'Cache-Control': 'public, max-age=3600'
				}
			});
		}

		// Fetch readings from database
		const { data, error } = await supabaseAdmin.rpc('get_readings_for_date', {
			target_date: targetDate
		});

		if (error) throw error;

		if (!data || data.length === 0) {
			return json({
				success: false,
				error: 'No readings found for this date',
				date: targetDate
			}, {
				status: 404,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, OPTIONS',
					'Cache-Control': 'public, max-age=3600'
				}
			});
		}

		const reading = data[0];

		// Format successful response
		return json({
			success: true,
			date: targetDate,
			liturgical_day: reading.liturgical_day || reading.liturgical_name,
			liturgical_rank: reading.liturgical_rank,
			liturgical_season: reading.liturgical_season,
			liturgical_week: reading.liturgical_week,
			year_cycle: reading.year_cycle,
			readings: {
				first_reading: reading.first_reading,
				psalm: reading.psalm,
				second_reading: reading.second_reading,
				gospel: reading.gospel_reading
			},
			region: 'Australia' // For now, defaults to Australian calendar
		}, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, OPTIONS',
				'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
				'X-API-Version': '1.0',
				'X-Region': 'AUS'
			}
		});

	} catch (error) {
		console.error('API Error:', error);
		return json({
			success: false,
			error: 'Internal server error'
		}, {
			status: 500,
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, OPTIONS'
			}
		});
	}
}

/**
 * OPTIONS /api/v1/readings
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}

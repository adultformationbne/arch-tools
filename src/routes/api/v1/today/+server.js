import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: { autoRefreshToken: false, persistSession: false }
});

/**
 * GET /api/v1/today
 * Public API endpoint for today's Mass readings
 * Simple endpoint with no parameters needed
 *
 * Example:
 *   /api/v1/today
 */
export async function GET() {
	try {
		// Always use today's date
		const today = new Date().toISOString().split('T')[0];

		// Fetch readings from database
		const { data, error } = await supabase.rpc('get_readings_for_date', {
			target_date: today
		});

		if (error) throw error;

		if (!data || data.length === 0) {
			return json({
				success: false,
				error: 'No readings found for today',
				date: today
			}, {
				status: 404,
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'GET, OPTIONS',
					'Cache-Control': 'public, max-age=1800' // Cache for 30 minutes
				}
			});
		}

		const reading = data[0];

		// Format successful response
		return json({
			success: true,
			date: today,
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
			region: 'Australia'
		}, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, OPTIONS',
				'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
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
 * OPTIONS /api/v1/today
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

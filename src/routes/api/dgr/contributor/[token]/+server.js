import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

/**
 * GET /api/dgr/contributor/[token]
 * Returns contributor info and their assigned dates for the next 12 months
 */
export async function GET({ params }) {
	const { token } = params;

	try {
		// Validate token and get contributor
		const { data: contributor, error: contributorError } = await supabase
			.from('dgr_contributors')
			.select('id, name, email, schedule_pattern, visit_count')
			.eq('access_token', token)
			.eq('active', true)
			.single();

		if (contributorError || !contributor) {
			return json({ error: 'Invalid or expired access token' }, { status: 401 });
		}

		// Track the visit - update last_visited_at and increment visit_count
		const newVisitCount = (contributor.visit_count || 0) + 1;
		await supabase
			.from('dgr_contributors')
			.update({
				last_visited_at: new Date().toISOString(),
				visit_count: newVisitCount
			})
			.eq('id', contributor.id);

		// Get assigned dates using the database function
		const { data: dates, error: datesError } = await supabase.rpc(
			'get_contributor_assigned_dates',
			{
				contributor_uuid: contributor.id,
				months_ahead: 12
			}
		);

		if (datesError) {
			console.error('Error fetching dates:', datesError);
			throw datesError;
		}

		// Format the response
		return json({
			contributor: {
				name: contributor.name,
				email: contributor.email,
				pattern: contributor.schedule_pattern,
				visit_count: newVisitCount
			},
			dates: dates || []
		});
	} catch (error) {
		console.error('Contributor API error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

/**
 * POST /api/dgr/contributor/[token]
 * Creates or updates a reflection for a specific date
 * Body: { date, title, content, action: 'save' | 'submit' | 'reset' }
 */
export async function POST({ params, request }) {
	const { token } = params;

	try {
		// Validate token and get contributor
		const { data: contributor, error: contributorError } = await supabase
			.from('dgr_contributors')
			.select('id, email')
			.eq('access_token', token)
			.eq('active', true)
			.single();

		if (contributorError || !contributor) {
			return json({ error: 'Invalid or expired access token' }, { status: 401 });
		}

		const { date, title, gospel_quote, content, action = 'save' } = await request.json();

		// Handle reset action - clears the reflection content
		if (action === 'reset') {
			if (!date) {
				return json({ error: 'Date is required for reset' }, { status: 400 });
			}

			const { data: existing } = await supabase
				.from('dgr_schedule')
				.select('id')
				.eq('date', date)
				.eq('contributor_id', contributor.id)
				.maybeSingle();

			if (existing) {
				const { data: updated, error: updateError } = await supabase
					.from('dgr_schedule')
					.update({
						reflection_title: null,
						gospel_quote: null,
						reflection_content: null,
						status: 'pending',
						submitted_at: null,
						updated_at: new Date().toISOString()
					})
					.eq('id', existing.id)
					.select()
					.single();

				if (updateError) throw updateError;
				return json({ success: true, schedule: updated, action: 'reset' });
			}

			return json({ success: true, schedule: null, action: 'reset' });
		}

		if (!date || !title || !gospel_quote || !content) {
			return json({ error: 'Date, title, gospel quote, and content are required' }, { status: 400 });
		}

		// Check if schedule entry exists for this date and contributor
		const { data: existing, error: checkError } = await supabase
			.from('dgr_schedule')
			.select('id, reflection_title, gospel_quote, reflection_content, status')
			.eq('date', date)
			.eq('contributor_id', contributor.id)
			.maybeSingle();

		if (checkError) throw checkError;

		let scheduleEntry;
		const updateData = {
			reflection_title: title,
			gospel_quote: gospel_quote,
			reflection_content: content,
			updated_at: new Date().toISOString()
		};

		// If submitting, update status and timestamp
		if (action === 'submit') {
			updateData.status = 'submitted';
			updateData.submitted_at = new Date().toISOString();
		}

		if (existing) {
			// Update existing entry
			const { data: updated, error: updateError } = await supabase
				.from('dgr_schedule')
				.update(updateData)
				.eq('id', existing.id)
				.select()
				.single();

			if (updateError) throw updateError;
			scheduleEntry = updated;
		} else {
			// Create new entry
			const { data: created, error: createError } = await supabase
				.from('dgr_schedule')
				.insert({
					date,
					contributor_id: contributor.id,
					contributor_email: contributor.email,
					reflection_title: title,
					gospel_quote: gospel_quote,
					reflection_content: content,
					status: action === 'submit' ? 'submitted' : 'pending',
					submitted_at: action === 'submit' ? new Date().toISOString() : null
				})
				.select()
				.single();

			if (createError) throw createError;
			scheduleEntry = created;
		}

		return json({
			success: true,
			schedule: scheduleEntry,
			action
		});
	} catch (error) {
		console.error('Save reflection error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

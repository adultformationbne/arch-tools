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

// Function to fetch Gospel data from Universalis API
async function fetchGospelForDate(date) {
	try {
		const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
		const region = 'australia.brisbane';
		const url = `https://universalis.com/${region}/${dateStr}/jsonpmass.js`;

		// Since this is server-side, we need to handle JSONP differently
		// We'll make a fetch request to get the JSONP and parse it
		const response = await fetch(url);
		const jsonpText = await response.text();

		// Extract JSON from JSONP format: callbackName({...data...})
		const jsonMatch = jsonpText.match(/\w+\((.+)\)/);
		if (!jsonMatch) {
			throw new Error('Failed to parse Universalis response');
		}

		const data = JSON.parse(jsonMatch[1]);

		return {
			reference: data.Mass_G?.source || '',
			text: data.Mass_G?.text || '',
			liturgicalDate: data.date || '',
			heading: data.Mass_G?.heading || ''
		};
	} catch (error) {
		console.error('Error fetching Gospel data:', error);
		// Return empty data if fetch fails
		return {
			reference: '',
			text: '',
			liturgicalDate: '',
			heading: ''
		};
	}
}

export async function GET({ url, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const days = parseInt(url.searchParams.get('days') || '30');
	const status = url.searchParams.get('status');

	try {
		let query = supabase
			.from('dgr_schedule')
			.select(
				`
        *,
        contributor:dgr_contributors(name, email)
      `
			)
			.gte('date', new Date().toISOString().split('T')[0])
			.lte('date', new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
			.order('date', { ascending: true });

		if (status) {
			query = query.eq('status', status);
		}

		const { data, error } = await query;

		if (error) throw error;

		return json({ schedule: data });
	} catch (error) {
		console.error('Schedule fetch error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

export async function POST({ request, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { action, ...data } = await request.json();

		switch (action) {
			case 'generate_schedule':
				return await generateSchedule(data);
			case 'update_assignment':
				return await updateAssignment(data);
			case 'approve_reflection':
				return await approveReflection(data);
			case 'update_status':
				return await updateStatus(data);
			default:
				return json({ error: 'Invalid action' }, { status: 400 });
		}
	} catch (error) {
		console.error('Schedule API error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

async function generateSchedule({ startDate, days = 14 }) {
	try {
		const scheduleEntries = [];
		const start = new Date(startDate);

		for (let i = 0; i < days; i++) {
			const date = new Date(start);
			date.setDate(date.getDate() + i);
			const dateStr = date.toISOString().split('T')[0];

			// Check if entry already exists
			const { data: existing } = await supabase
				.from('dgr_schedule')
				.select('id')
				.eq('date', dateStr)
				.single();

			if (existing) continue; // Skip if already exists

			// Get contributor assignment
			const { data: contributorId } = await supabase.rpc('assign_contributor_to_date', {
				target_date: dateStr
			});

			if (contributorId) {
				const { data: contributor } = await supabase
					.from('dgr_contributors')
					.select('email')
					.eq('id', contributorId)
					.single();

				// Generate submission token
				const { data: token } = await supabase.rpc('generate_submission_token');

				// Fetch Gospel data for this date
				const gospelData = await fetchGospelForDate(date);

				scheduleEntries.push({
					date: dateStr,
					contributor_id: contributorId,
					contributor_email: contributor?.email,
					submission_token: token,
					status: 'pending',
					gospel_reference: gospelData.reference,
					gospel_text: gospelData.text,
					liturgical_date: gospelData.liturgicalDate
				});
			}
		}

		if (scheduleEntries.length > 0) {
			const { data, error } = await supabase.from('dgr_schedule').insert(scheduleEntries).select();

			if (error) throw error;

			return json({
				success: true,
				message: `Generated ${scheduleEntries.length} schedule entries`,
				entries: data
			});
		}

		return json({
			success: true,
			message: 'No new entries needed - schedule already exists for this period'
		});
	} catch (error) {
		throw error;
	}
}

async function updateAssignment({ scheduleId, contributorId }) {
	try {
		const { data: contributor } = await supabase
			.from('dgr_contributors')
			.select('email')
			.eq('id', contributorId)
			.single();

		const { data, error } = await supabase
			.from('dgr_schedule')
			.update({
				contributor_id: contributorId,
				contributor_email: contributor?.email
			})
			.eq('id', scheduleId)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

async function approveReflection({ scheduleId }) {
	try {
		const { data, error } = await supabase
			.from('dgr_schedule')
			.update({
				status: 'approved',
				approved_at: new Date().toISOString()
			})
			.eq('id', scheduleId)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

async function updateStatus({ scheduleId, status }) {
	try {
		// Validate status
		const validStatuses = ['pending', 'submitted', 'approved', 'published'];
		if (!validStatuses.includes(status)) {
			throw new Error('Invalid status value');
		}

		const updateData = { status };

		// Set timestamp based on status
		if (status === 'approved') {
			updateData.approved_at = new Date().toISOString();
		} else if (status === 'published') {
			updateData.published_at = new Date().toISOString();
		}

		const { data, error } = await supabase
			.from('dgr_schedule')
			.update(updateData)
			.eq('id', scheduleId)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

async function saveReflection({ id, reflection_title, reflection_content }) {
	try {
		const { data, error } = await supabase
			.from('dgr_schedule')
			.update({
				reflection_title,
				reflection_content,
				updated_at: new Date().toISOString()
			})
			.eq('id', id)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, schedule: data });
	} catch (error) {
		throw error;
	}
}

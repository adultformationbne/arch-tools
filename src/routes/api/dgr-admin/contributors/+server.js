import { json } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase.js';

export async function GET({ locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { data, error } = await supabaseAdmin
			.from('dgr_contributors')
			.select('*')
			.order('name', { ascending: true });

		if (error) throw error;

		return json({ contributors: data });
	} catch (error) {
		console.error('Contributors fetch error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

export async function POST({ request, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const body = await request.json();

		// Check if this is a bulk import
		if (body.action === 'bulk_import' && Array.isArray(body.contributors)) {
			const contributors = body.contributors;
			const results = { successful: 0, failed: 0, errors: [] };

			// Get existing emails to check for duplicates
			const { data: existingContributors } = await supabaseAdmin
				.from('dgr_contributors')
				.select('email');

			const existingEmails = new Set(
				(existingContributors || []).map((c) => c.email.toLowerCase())
			);

			for (const contributor of contributors) {
				// Skip if email already exists
				if (existingEmails.has(contributor.email.toLowerCase())) {
					results.failed++;
					results.errors.push(`${contributor.email}: Already exists`);
					continue;
				}

				// Generate access token
				const access_token = crypto.randomUUID();

				const { error } = await supabaseAdmin.from('dgr_contributors').insert({
					name: contributor.name,
					email: contributor.email.toLowerCase(),
					notes: contributor.notes || null,
					schedule_pattern: contributor.schedule_pattern || null,
					access_token,
					active: true
				});

				if (error) {
					results.failed++;
					results.errors.push(`${contributor.email}: ${error.message}`);
				} else {
					results.successful++;
					existingEmails.add(contributor.email.toLowerCase());
				}
			}

			return json({
				success: true,
				results
			});
		}

		// Single contributor creation (original behavior)
		const contributorData = body;

		// Generate access token if not provided
		if (!contributorData.access_token) {
			contributorData.access_token = crypto.randomUUID();
		}

		const { data, error } = await supabaseAdmin
			.from('dgr_contributors')
			.insert(contributorData)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, contributor: data });
	} catch (error) {
		console.error('Contributor creation error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

export async function PUT({ request, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id, ...updateData } = await request.json();

		const { data, error } = await supabaseAdmin
			.from('dgr_contributors')
			.update(updateData)
			.eq('id', id)
			.select()
			.single();

		if (error) throw error;

		return json({ success: true, contributor: data });
	} catch (error) {
		console.error('Contributor update error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

export async function DELETE({ request, locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { id } = await request.json();

		const { error } = await supabaseAdmin.from('dgr_contributors').delete().eq('id', id);

		if (error) throw error;

		return json({ success: true });
	} catch (error) {
		console.error('Contributor deletion error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

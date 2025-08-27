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

export async function GET({ locals }) {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	try {
		const { data, error } = await supabase
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
		const contributorData = await request.json();

		const { data, error } = await supabase
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

		const { data, error } = await supabase
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

		const { error } = await supabase.from('dgr_contributors').delete().eq('id', id);

		if (error) throw error;

		return json({ success: true });
	} catch (error) {
		console.error('Contributor deletion error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

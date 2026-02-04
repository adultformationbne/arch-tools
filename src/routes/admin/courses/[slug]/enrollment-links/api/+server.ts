import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';
import { generateEnrollmentCode } from '$lib/utils/enrollment-links';

export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const body = await event.request.json();
	const { action } = body;

	switch (action) {
		case 'create':
			return handleCreate(body);
		case 'toggle':
			return handleToggle(body);
		default:
			throw error(400, 'Invalid action');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const linkId = event.url.searchParams.get('linkId');
	if (!linkId) {
		throw error(400, 'Missing linkId');
	}

	// Delete the link
	const { error: deleteError } = await supabaseAdmin
		.from('courses_enrollment_links')
		.delete()
		.eq('id', linkId);

	if (deleteError) {
		console.error('Failed to delete enrollment link:', deleteError);
		throw error(500, 'Failed to delete enrollment link');
	}

	return json({ success: true });
};

async function handleCreate(body: {
	cohortId: string;
	hubId?: string | null;
	name?: string | null;
	priceCents?: number | null;
	maxUses?: number | null;
	expiresAt?: string | null;
}) {
	const { cohortId, hubId, name, priceCents, maxUses, expiresAt } = body;

	if (!cohortId) {
		throw error(400, 'Cohort ID is required');
	}

	// Verify cohort exists
	const { data: cohort, error: cohortError } = await supabaseAdmin
		.from('courses_cohorts')
		.select('id')
		.eq('id', cohortId)
		.single();

	if (cohortError || !cohort) {
		throw error(404, 'Cohort not found');
	}

	// Verify hub exists if provided
	if (hubId) {
		const { data: hub, error: hubError } = await supabaseAdmin
			.from('courses_hubs')
			.select('id')
			.eq('id', hubId)
			.single();

		if (hubError || !hub) {
			throw error(404, 'Hub not found');
		}
	}

	// Generate unique code
	let code = generateEnrollmentCode();
	let attempts = 0;
	const maxAttempts = 10;

	while (attempts < maxAttempts) {
		const { data: existing } = await supabaseAdmin
			.from('courses_enrollment_links')
			.select('id')
			.eq('code', code)
			.single();

		if (!existing) break;

		code = generateEnrollmentCode();
		attempts++;
	}

	if (attempts >= maxAttempts) {
		throw error(500, 'Failed to generate unique code');
	}

	// Create the link
	const { data: link, error: createError } = await supabaseAdmin
		.from('courses_enrollment_links')
		.insert({
			cohort_id: cohortId,
			hub_id: hubId || null,
			code,
			name: name || null,
			price_cents: priceCents || null,
			max_uses: maxUses || null,
			expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
			is_active: true
		})
		.select('id, code')
		.single();

	if (createError) {
		console.error('Failed to create enrollment link:', createError);
		throw error(500, 'Failed to create enrollment link');
	}

	return json({ success: true, link });
}

async function handleToggle(body: { linkId: string; isActive: boolean }) {
	const { linkId, isActive } = body;

	if (!linkId) {
		throw error(400, 'Link ID is required');
	}

	const { error: updateError } = await supabaseAdmin
		.from('courses_enrollment_links')
		.update({
			is_active: isActive,
			updated_at: new Date().toISOString()
		})
		.eq('id', linkId);

	if (updateError) {
		console.error('Failed to update enrollment link:', updateError);
		throw error(500, 'Failed to update enrollment link');
	}

	return json({ success: true });
}

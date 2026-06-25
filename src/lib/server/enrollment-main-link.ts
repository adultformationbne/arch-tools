import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
import { generateEnrollmentCode } from '$lib/utils/enrollment-links';

/** Marker that identifies the canonical "main link" for a cohort. */
export const MAIN_LINK_NAME = 'Main link';

/**
 * Generate a unique enrollment code, checking it's not already taken.
 */
export async function generateUniqueCode(): Promise<string> {
	let code = generateEnrollmentCode();
	let attempts = 0;
	const maxAttempts = 10;

	while (attempts < maxAttempts) {
		const { data: existing } = await supabaseAdmin
			.from('courses_enrollment_links')
			.select('id')
			.eq('code', code)
			.single();

		if (!existing) return code;

		code = generateEnrollmentCode();
		attempts++;
	}

	throw error(500, 'Failed to generate unique code');
}

/**
 * Guarantee that a cohort has exactly one canonical "main link":
 * no hub override, no price override, bypass disabled, name = 'Main link'.
 * Idempotent — returns the existing main link if one is already present.
 * Uses a deterministic marker (name + null hub + null price + bypass=false)
 * to identify the main link and avoid creating duplicates.
 */
export async function ensureMainLink(cohortId: string) {
	const { data: existing } = await supabaseAdmin
		.from('courses_enrollment_links')
		.select('id, code')
		.eq('cohort_id', cohortId)
		.eq('name', MAIN_LINK_NAME)
		.is('hub_id', null)
		.is('price_cents', null)
		.eq('bypass_enrollment_window', false)
		.order('created_at', { ascending: true })
		.limit(1)
		.maybeSingle();

	if (existing) {
		return existing;
	}

	const code = await generateUniqueCode();

	const { data: link, error: createError } = await supabaseAdmin
		.from('courses_enrollment_links')
		.insert({
			cohort_id: cohortId,
			hub_id: null,
			code,
			name: MAIN_LINK_NAME,
			price_cents: null,
			max_uses: null,
			bypass_enrollment_window: false,
			is_active: true
		})
		.select('id, code')
		.single();

	if (createError) {
		console.error('Failed to create main enrollment link:', createError);
		throw error(500, 'Failed to create main enrollment link');
	}

	return link;
}

/**
 * Generate a unique enrollment link code
 * Uses a mix of characters that are URL-safe and easy to read/type
 */
export function generateEnrollmentCode(length: number = 8): string {
	// Exclude confusing characters: 0/O, 1/l/I
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
	const randomValues = new Uint8Array(length);
	crypto.getRandomValues(randomValues);

	let code = '';
	for (let i = 0; i < length; i++) {
		code += chars[randomValues[i] % chars.length];
	}
	return code;
}

/**
 * Validate an enrollment link code format
 */
export function isValidEnrollmentCode(code: string): boolean {
	// Must be 6-12 alphanumeric characters
	return /^[A-Za-z0-9]{6,12}$/.test(code);
}

/**
 * Check if an enrollment link is currently valid
 */
export function isEnrollmentLinkValid(link: {
	is_active: boolean | null;
	max_uses: number | null;
	uses_count: number | null;
}): { valid: boolean; reason?: string } {
	if (!link.is_active) {
		return { valid: false, reason: 'This enrollment link is no longer active.' };
	}

	if (link.max_uses !== null && (link.uses_count ?? 0) >= link.max_uses) {
		return { valid: false, reason: 'This enrollment link has reached its maximum uses.' };
	}

	return { valid: true };
}

/**
 * Check the enrollment window for a link + its cohort.
 *
 * A link's own `enrollment_closes_at` (when set) overrides the cohort's —
 * this lets one link stay open longer (or close sooner) than the rest.
 * `bypass_enrollment_window` ignores any cutoff entirely (late access).
 */
export function checkEnrollmentWindow(params: {
	link: {
		bypass_enrollment_window: boolean;
		enrollment_closes_at?: string | null;
	};
	cohort: {
		enrollment_opens_at: string | null;
		enrollment_closes_at: string | null;
	};
}): { valid: boolean; reason?: string } {
	const { link, cohort } = params;

	if (link.bypass_enrollment_window) {
		return { valid: true };
	}

	if (cohort.enrollment_opens_at && new Date(cohort.enrollment_opens_at) > new Date()) {
		return { valid: false, reason: 'Enrollment has not opened yet' };
	}

	const effectiveClosesAt = link.enrollment_closes_at ?? cohort.enrollment_closes_at;
	if (effectiveClosesAt && new Date(effectiveClosesAt) < new Date()) {
		return { valid: false, reason: 'Enrollment for this cohort has closed' };
	}

	return { valid: true };
}

/**
 * Resolve the effective enrollment price.
 *
 * Model: the cohort carries the default price; an enrollment link MAY override
 * it. A price of 0 (or null/unset) means free — including a link that overrides
 * a paid cohort down to 0 (e.g. a scholarship link).
 */
export function getEffectivePrice(params: {
	enrollmentLink?: { price_cents: number | null } | null;
	cohort: { price_cents: number | null; currency: string | null };
}): { amount: number; currency: string; isFree: boolean } {
	const { enrollmentLink, cohort } = params;

	const linkPrice = enrollmentLink?.price_cents;
	const amount =
		linkPrice !== null && linkPrice !== undefined ? linkPrice : (cohort.price_cents ?? 0);

	const currency = (cohort.currency || 'AUD').toUpperCase();

	if (!amount || amount <= 0) {
		return { amount: 0, currency, isFree: true };
	}

	return { amount, currency, isFree: false };
}

/**
 * Format price for display
 */
export function formatPrice(amountCents: number, currency: string = 'AUD'): string {
	const amount = amountCents / 100;
	return new Intl.NumberFormat('en-AU', {
		style: 'currency',
		currency: currency.toUpperCase()
	}).format(amount);
}

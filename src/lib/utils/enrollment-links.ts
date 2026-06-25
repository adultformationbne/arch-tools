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
	is_active: boolean;
	max_uses: number | null;
	uses_count: number;
}): { valid: boolean; reason?: string } {
	if (!link.is_active) {
		return { valid: false, reason: 'This enrollment link is no longer active.' };
	}

	if (link.max_uses !== null && link.uses_count >= link.max_uses) {
		return { valid: false, reason: 'This enrollment link has reached its maximum uses.' };
	}

	return { valid: true };
}

/**
 * Resolve the effective enrollment price.
 *
 * Model: the cohort carries the default price; an enrollment link MAY override
 * it. A price of 0 (or null/unset) means free — including a link that overrides
 * a paid cohort down to 0 (e.g. a scholarship link).
 *
 * NOTE: the legacy `cohort.is_free` flag, per-hub price and per-course default
 * price are intentionally no longer consulted. The `hub`/`course`/`is_free`
 * fields remain accepted (and ignored) only so existing call-sites keep
 * compiling; they will be removed from callers and then dropped.
 */
export function getEffectivePrice(params: {
	enrollmentLink?: { price_cents: number | null } | null;
	cohort: {
		price_cents: number | null;
		currency: string | null;
		is_free?: boolean | null;
	};
	/** @deprecated ignored — kept for back-compat with existing callers */
	hub?: { price_cents: number | null; currency: string | null } | null;
	/** @deprecated ignored — kept for back-compat with existing callers */
	course?: { default_price_cents: number | null; default_currency: string | null } | null;
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

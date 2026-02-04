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
	expires_at: string | null;
	max_uses: number | null;
	uses_count: number;
}): { valid: boolean; reason?: string } {
	if (!link.is_active) {
		return { valid: false, reason: 'This enrollment link is no longer active.' };
	}

	if (link.expires_at && new Date(link.expires_at) < new Date()) {
		return { valid: false, reason: 'This enrollment link has expired.' };
	}

	if (link.max_uses !== null && link.uses_count >= link.max_uses) {
		return { valid: false, reason: 'This enrollment link has reached its maximum uses.' };
	}

	return { valid: true };
}

/**
 * Calculate effective price based on hierarchy:
 * Link override → Hub → Cohort → Course default
 */
export function getEffectivePrice(params: {
	enrollmentLink?: { price_cents: number | null };
	hub?: { price_cents: number | null; currency: string | null };
	cohort: {
		price_cents: number | null;
		currency: string | null;
		is_free: boolean;
	};
	course: {
		default_price_cents: number | null;
		default_currency: string | null;
	};
}): { amount: number; currency: string; isFree: boolean } {
	const { enrollmentLink, hub, cohort, course } = params;

	// Check if explicitly marked as free
	if (cohort.is_free) {
		return { amount: 0, currency: 'AUD', isFree: true };
	}

	// Priority: Link override → Hub → Cohort → Course
	let amount: number | null = null;
	let currency: string | null = null;

	if (enrollmentLink?.price_cents !== null && enrollmentLink?.price_cents !== undefined) {
		amount = enrollmentLink.price_cents;
	} else if (hub?.price_cents !== null && hub?.price_cents !== undefined) {
		amount = hub.price_cents;
		currency = hub.currency;
	} else if (cohort.price_cents !== null) {
		amount = cohort.price_cents;
		currency = cohort.currency;
	} else if (course.default_price_cents !== null) {
		amount = course.default_price_cents;
		currency = course.default_currency;
	}

	// Default currency
	currency = currency || cohort.currency || course.default_currency || 'AUD';

	// If no price set, it's free
	if (amount === null || amount === 0) {
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

import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { dev } from '$app/environment';

/**
 * Key switching: we keep BOTH test and live Stripe keys in the environment and
 * flip between them with a single server-side STRIPE_MODE flag, so going live (or
 * dropping back to test to debug) never means swapping key VALUES around and
 * losing track of them.
 *
 * For each key we prefer the mode-suffixed var (e.g. STRIPE_SECRET_KEY_LIVE),
 * then fall back to the legacy unsuffixed var so existing setups keep working.
 * Live is opt-in and never implicit — STRIPE_MODE must be exactly "live".
 */
export type StripeMode = 'test' | 'live';

export function getStripeMode(): StripeMode {
	return env.STRIPE_MODE === 'live' ? 'live' : 'test';
}

function resolveStripeKey(
	base: string,
	source: Record<string, string | undefined>
): string | undefined {
	const suffix = getStripeMode() === 'live' ? '_LIVE' : '_TEST';
	return source[base + suffix] || source[base];
}

export function getStripeSecretKey(): string | undefined {
	return resolveStripeKey('STRIPE_SECRET_KEY', env);
}

export function getStripeWebhookSecret(): string | undefined {
	return resolveStripeKey('STRIPE_WEBHOOK_SECRET', env);
}

export function getStripePublishableKey(): string | undefined {
	// Publishable keys are PUBLIC_-prefixed, so they live in $env/dynamic/public.
	return resolveStripeKey('PUBLIC_STRIPE_PUBLISHABLE_KEY', publicEnv);
}

// Check if we're in mock mode (for development/testing)
// Hard-guarded: mock mode is ONLY allowed in dev builds
export function isStripeMockMode(): boolean {
	if (env.STRIPE_MOCK_MODE === 'true') {
		if (!dev) {
			console.error('CRITICAL: STRIPE_MOCK_MODE=true in production build! Ignoring mock mode.');
			return false;
		}
		return true;
	}
	return false;
}

// Server-side Stripe client (lazy initialization)
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
	if (isStripeMockMode()) {
		throw new Error('Stripe is in mock mode - real Stripe calls should not be made');
	}
	if (!_stripe) {
		const secretKey = getStripeSecretKey();
		if (!secretKey) {
			throw new Error('Stripe secret key is not set (STRIPE_SECRET_KEY[_TEST|_LIVE])');
		}
		_stripe = new Stripe(secretKey, {
			apiVersion: '2026-06-24.dahlia'
		});
	}
	return _stripe;
}

/**
 * Create a Stripe customer with metadata
 */
export async function createStripeCustomer(params: {
	email: string;
	name?: string;
	metadata?: Record<string, string>;
}) {
	if (isStripeMockMode()) {
		// Return mock customer
		return {
			id: `mock_cus_${Date.now()}`,
			email: params.email,
			name: params.name,
			metadata: params.metadata
		} as unknown as Stripe.Customer;
	}
	return getStripe().customers.create({
		email: params.email,
		name: params.name,
		metadata: params.metadata
	});
}

/**
 * Create a Stripe Checkout Session for course enrollment
 * In mock mode, returns a mock session with a URL to the mock checkout page
 */
export async function createCheckoutSession(params: {
	priceInCents: number;
	currency: string;
	customerEmail: string;
	customerId?: string;
	successUrl: string;
	cancelUrl: string;
	metadata: {
		cohort_id: string;
		enrollment_link_id: string;
		user_email: string;
		user_name: string;
		hub_id?: string;
	};
	allowPromotionCodes?: boolean;
	couponId?: string;
}) {
	if (isStripeMockMode()) {
		// Create a mock session ID
		const mockSessionId = `mock_cs_${Date.now()}_${Math.random().toString(36).substring(7)}`;

		// Encode data for the mock checkout page
		const mockData = Buffer.from(JSON.stringify({
			sessionId: mockSessionId,
			amount: params.priceInCents,
			currency: params.currency,
			email: params.customerEmail,
			metadata: params.metadata,
			successUrl: params.successUrl,
			cancelUrl: params.cancelUrl
		})).toString('base64url');

		// Return mock session pointing to mock checkout page
		return {
			id: mockSessionId,
			url: `/enroll/mock-checkout?data=${mockData}`,
			payment_status: 'unpaid',
			customer_email: params.customerEmail,
			metadata: params.metadata
		} as unknown as Stripe.Checkout.Session;
	}

	const sessionParams: Stripe.Checkout.SessionCreateParams = {
		mode: 'payment',
		// Omit payment_method_types so Stripe serves dynamic payment methods
		// (configured from the Dashboard) instead of hardcoding card-only.
		line_items: [
			{
				price_data: {
					currency: params.currency.toLowerCase(),
					product_data: {
						name: 'Course Enrollment'
					},
					unit_amount: params.priceInCents
				},
				quantity: 1
			}
		],
		customer: params.customerId,
		customer_email: params.customerId ? undefined : params.customerEmail,
		customer_creation: params.customerId ? undefined : 'always',
		success_url: params.successUrl,
		cancel_url: params.cancelUrl,
		metadata: params.metadata,
		payment_intent_data: {
			metadata: params.metadata
		},
		expires_at: Math.floor(Date.now() / 1000) + 30 * 60 // expires 30 minutes from now
	};

	// Apply discount if provided, otherwise allow promo codes
	if (params.couponId) {
		sessionParams.discounts = [{ coupon: params.couponId }];
	} else if (params.allowPromotionCodes !== false) {
		sessionParams.allow_promotion_codes = true;
	}

	return getStripe().checkout.sessions.create(sessionParams);
}

/**
 * Create a Stripe Embedded Checkout Session (ui_mode: 'embedded_page')
 * Returns a client_secret used to mount Stripe's checkout inside our own page.
 * In mock mode there is no real client_secret, so we return a mockUrl that the
 * client falls back to (the existing mock-checkout page).
 */
export async function createEmbeddedCheckoutSession(params: {
	priceInCents: number;
	currency: string;
	customerEmail: string;
	customerId?: string;
	returnUrl: string;
	quantity?: number;
	productName?: string;
	metadata: {
		cohort_id: string;
		enrollment_link_id: string;
		user_email: string;
		user_name: string;
		hub_id?: string;
		batch?: string;
	};
	allowPromotionCodes?: boolean;
	couponId?: string;
}): Promise<{ id: string; client_secret: string | null; mockUrl?: string }> {
	const quantity = params.quantity && params.quantity > 0 ? params.quantity : 1;
	const productName = params.productName || 'Course Enrollment';

	if (isStripeMockMode()) {
		const mockSessionId = `mock_cs_${Date.now()}_${Math.random().toString(36).substring(7)}`;
		const mockData = Buffer.from(
			JSON.stringify({
				sessionId: mockSessionId,
				amount: params.priceInCents * quantity,
				currency: params.currency,
				email: params.customerEmail,
				metadata: params.metadata,
				successUrl: params.returnUrl,
				cancelUrl: params.returnUrl
			})
		).toString('base64url');
		return {
			id: mockSessionId,
			client_secret: null,
			mockUrl: `/enroll/mock-checkout?data=${mockData}`
		};
	}

	const sessionParams: Stripe.Checkout.SessionCreateParams = {
		ui_mode: 'embedded_page',
		mode: 'payment',
		line_items: [
			{
				price_data: {
					currency: params.currency.toLowerCase(),
					product_data: {
						name: productName
					},
					unit_amount: params.priceInCents
				},
				quantity
			}
		],
		customer: params.customerId,
		customer_email: params.customerId ? undefined : params.customerEmail,
		return_url: params.returnUrl,
		metadata: params.metadata,
		payment_intent_data: {
			metadata: params.metadata
		},
		expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
		invoice_creation: {
			enabled: true,
			invoice_data: {
				description: 'Course enrollment',
				metadata: params.metadata
			}
		}
	};

	if (params.couponId) {
		sessionParams.discounts = [{ coupon: params.couponId }];
	} else if (params.allowPromotionCodes !== false) {
		sessionParams.allow_promotion_codes = true;
	}

	const session = await getStripe().checkout.sessions.create(sessionParams);
	return { id: session.id, client_secret: session.client_secret };
}

/**
 * Retrieve a Checkout Session by ID
 */
export async function getCheckoutSession(sessionId: string) {
	if (isStripeMockMode()) {
		// For mock sessions, return a mock paid session
		return {
			id: sessionId,
			payment_status: 'paid',
			customer_email: null, // Will be filled from pendingData
			metadata: {},
			amount_total: 0
		} as unknown as Stripe.Checkout.Session;
	}
	return getStripe().checkout.sessions.retrieve(sessionId, {
		expand: ['customer', 'payment_intent', 'total_details.breakdown', 'invoice']
	});
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortalSession(customerId: string, returnUrl: string) {
	if (isStripeMockMode()) {
		return {
			url: returnUrl
		} as unknown as Stripe.BillingPortal.Session;
	}
	return getStripe().billingPortal.sessions.create({
		customer: customerId,
		return_url: returnUrl
	});
}

/**
 * Create a coupon in Stripe
 */
export async function createStripeCoupon(params: {
	discountType: 'percentage' | 'fixed';
	discountValue: number;
	currency?: string;
	name: string;
}) {
	if (isStripeMockMode()) {
		return {
			id: `mock_coupon_${Date.now()}`,
			percent_off: params.discountType === 'percentage' ? params.discountValue : null,
			amount_off: params.discountType === 'fixed' ? params.discountValue : null,
			currency: params.currency,
			name: params.name
		} as unknown as Stripe.Coupon;
	}
	return getStripe().coupons.create({
		percent_off: params.discountType === 'percentage' ? params.discountValue : undefined,
		amount_off: params.discountType === 'fixed' ? params.discountValue : undefined,
		currency: params.discountType === 'fixed' ? params.currency?.toLowerCase() : undefined,
		duration: 'once',
		name: params.name
	});
}

/**
 * Create a promotion code (customer-facing) for a coupon
 */
export async function createStripePromotionCode(params: {
	couponId: string;
	code: string;
	maxRedemptions?: number;
	expiresAt?: Date;
}) {
	if (isStripeMockMode()) {
		return {
			id: `mock_promo_${Date.now()}`,
			code: params.code.toUpperCase(),
			coupon: { id: params.couponId },
			max_redemptions: params.maxRedemptions
		} as unknown as Stripe.PromotionCode;
	}
	return getStripe().promotionCodes.create({
		// Dahlia moved the coupon under a `promotion` discriminated object.
		promotion: { type: 'coupon', coupon: params.couponId },
		code: params.code.toUpperCase(),
		max_redemptions: params.maxRedemptions,
		expires_at: params.expiresAt ? Math.floor(params.expiresAt.getTime() / 1000) : undefined
	});
}

/**
 * Deactivate a promotion code
 */
export async function deactivatePromotionCode(promotionCodeId: string) {
	if (isStripeMockMode()) {
		return {
			id: promotionCodeId,
			active: false
		} as unknown as Stripe.PromotionCode;
	}
	return getStripe().promotionCodes.update(promotionCodeId, {
		active: false
	});
}

/**
 * Verify Stripe webhook signature
 */
export function constructWebhookEvent(
	payload: string,
	signature: string,
	webhookSecret: string
): Stripe.Event {
	if (isStripeMockMode()) {
		// In mock mode, parse the payload directly (no signature verification)
		return JSON.parse(payload) as Stripe.Event;
	}
	return getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
}

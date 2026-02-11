import Stripe from 'stripe';
import { env } from '$env/dynamic/private';
import { dev } from '$app/environment';

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
		if (!env.STRIPE_SECRET_KEY) {
			throw new Error('STRIPE_SECRET_KEY environment variable is not set');
		}
		_stripe = new Stripe(env.STRIPE_SECRET_KEY, {
			apiVersion: '2024-12-18.acacia'
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
		payment_method_types: ['card'],
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
		expires_after: 1800 // 30 minutes
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
		expand: ['customer', 'payment_intent', 'total_details.breakdown']
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
		coupon: params.couponId,
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

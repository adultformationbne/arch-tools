import Stripe from 'stripe';
import { env } from '$env/dynamic/private';

// Server-side Stripe client (lazy initialization)
let _stripe: Stripe | null = null;

function getStripe(): Stripe {
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
	return getStripe().customers.create({
		email: params.email,
		name: params.name,
		metadata: params.metadata
	});
}

/**
 * Create a Stripe Checkout Session for course enrollment
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
	return getStripe().checkout.sessions.retrieve(sessionId, {
		expand: ['customer', 'payment_intent', 'total_details.breakdown']
	});
}

/**
 * Create a Stripe Customer Portal session
 */
export async function createPortalSession(customerId: string, returnUrl: string) {
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
	return getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
}

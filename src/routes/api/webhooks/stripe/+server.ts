import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { constructWebhookEvent, getCheckoutSession } from '$lib/server/stripe';
import { supabaseAdmin } from '$lib/server/supabase';
import type Stripe from 'stripe';

export const POST: RequestHandler = async ({ request }) => {
	const signature = request.headers.get('stripe-signature');
	const body = await request.text();

	if (!signature) {
		return json({ error: 'Missing stripe-signature header' }, { status: 400 });
	}

	// Verify webhook signature
	let event: Stripe.Event;
	try {
		if (!env.STRIPE_WEBHOOK_SECRET) {
			throw new Error('STRIPE_WEBHOOK_SECRET environment variable is not set');
		}
		event = constructWebhookEvent(body, signature, env.STRIPE_WEBHOOK_SECRET);
	} catch (error) {
		console.error('Stripe webhook signature verification failed:', error);
		return json({ error: 'Invalid signature' }, { status: 401 });
	}

	// Check for duplicate event (idempotency)
	const { data: existingEvent } = await supabaseAdmin
		.from('stripe_events')
		.select('id')
		.eq('stripe_event_id', event.id)
		.single();

	if (existingEvent) {
		console.log(`Duplicate Stripe event: ${event.id}`);
		return json({ received: true, duplicate: true });
	}

	// Record the event before processing
	await supabaseAdmin.from('stripe_events').insert({
		stripe_event_id: event.id,
		event_type: event.type,
		payload: event.data.object as Record<string, unknown>
	});

	// Process event based on type
	try {
		switch (event.type) {
			case 'checkout.session.completed':
				await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
				break;

			case 'checkout.session.expired':
				await handleCheckoutExpired(event.data.object as Stripe.Checkout.Session);
				break;

			default:
				console.log(`Unhandled Stripe event type: ${event.type}`);
		}
	} catch (error) {
		console.error(`Error processing Stripe event ${event.type}:`, error);
		// Still return 200 to prevent retries - we've logged the error
	}

	return json({ received: true });
};

/**
 * Handle successful checkout - create enrollment if not already done
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
	const metadata = session.metadata;
	if (!metadata?.cohort_id || !metadata?.user_email) {
		console.error('Missing metadata in checkout session:', session.id);
		return;
	}

	// Get the full session with expanded data
	const fullSession = await getCheckoutSession(session.id);
	const customerId =
		typeof fullSession.customer === 'string' ? fullSession.customer : fullSession.customer?.id;

	// Check if payment record already exists and is completed
	const { data: existingPayment } = await supabaseAdmin
		.from('courses_payments')
		.select('id, status, enrollment_id')
		.eq('stripe_checkout_session_id', session.id)
		.single();

	if (existingPayment?.status === 'completed') {
		console.log(`Payment already completed for session: ${session.id}`);
		return;
	}

	// Get discount info if applied
	let discountCode: string | null = null;
	let discountAmountCents: number | null = null;

	if (fullSession.total_details?.breakdown?.discounts) {
		const discount = fullSession.total_details.breakdown.discounts[0];
		if (discount) {
			discountAmountCents = discount.amount;
			// Try to get the promo code name
			if (session.discounts && session.discounts.length > 0) {
				const discountId = session.discounts[0];
				if (typeof discountId === 'string') {
					// It's a promotion code ID - would need to fetch it
					discountCode = discountId;
				}
			}
		}
	}

	if (existingPayment) {
		// Update existing payment record
		await supabaseAdmin
			.from('courses_payments')
			.update({
				status: 'completed',
				stripe_customer_id: customerId,
				stripe_payment_intent_id:
					typeof fullSession.payment_intent === 'string'
						? fullSession.payment_intent
						: fullSession.payment_intent?.id,
				discount_code: discountCode,
				discount_amount_cents: discountAmountCents,
				paid_at: new Date().toISOString(),
				updated_at: new Date().toISOString()
			})
			.eq('id', existingPayment.id);

		// Update enrollment if it exists
		if (existingPayment.enrollment_id) {
			await supabaseAdmin
				.from('courses_enrollments')
				.update({
					payment_status: 'paid',
					stripe_customer_id: customerId
				})
				.eq('id', existingPayment.enrollment_id);
		}
	} else {
		// Create payment record (this is a backup - normally created on checkout start)
		const { data: payment } = await supabaseAdmin
			.from('courses_payments')
			.insert({
				cohort_id: metadata.cohort_id,
				enrollment_link_id: metadata.enrollment_link_id || null,
				amount_cents: fullSession.amount_total || 0,
				currency: fullSession.currency?.toUpperCase() || 'AUD',
				status: 'completed',
				stripe_checkout_session_id: session.id,
				stripe_payment_intent_id:
					typeof fullSession.payment_intent === 'string'
						? fullSession.payment_intent
						: fullSession.payment_intent?.id,
				stripe_customer_id: customerId,
				email: metadata.user_email,
				full_name: metadata.user_name || null,
				discount_code: discountCode,
				discount_amount_cents: discountAmountCents,
				paid_at: new Date().toISOString()
			})
			.select('id')
			.single();

		console.log(`Created payment record from webhook: ${payment?.id}`);
	}

	// Increment enrollment link uses count
	if (metadata.enrollment_link_id) {
		await supabaseAdmin.rpc('increment_enrollment_link_uses', {
			link_id: metadata.enrollment_link_id
		});
	}

	console.log(`Checkout completed for session: ${session.id}`);
}

/**
 * Handle expired checkout - mark payment as abandoned
 */
async function handleCheckoutExpired(session: Stripe.Checkout.Session) {
	const { data: payment } = await supabaseAdmin
		.from('courses_payments')
		.select('id, status')
		.eq('stripe_checkout_session_id', session.id)
		.single();

	if (payment && payment.status === 'pending') {
		await supabaseAdmin
			.from('courses_payments')
			.update({
				status: 'abandoned',
				updated_at: new Date().toISOString()
			})
			.eq('id', payment.id);

		// TODO: Send reminder email to complete enrollment
		console.log(`Checkout expired for session: ${session.id}`);
	}
}

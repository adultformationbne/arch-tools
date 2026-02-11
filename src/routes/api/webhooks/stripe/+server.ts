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

	// Check for duplicate event (idempotency) - record BEFORE processing
	const { data: existingEvent } = await supabaseAdmin
		.from('stripe_events')
		.select('id')
		.eq('stripe_event_id', event.id)
		.single();

	if (existingEvent) {
		console.log(`Duplicate Stripe event: ${event.id}`);
		return json({ received: true, duplicate: true });
	}

	// Record the event before processing to prevent duplicate handling on retries
	const { error: insertError } = await supabaseAdmin.from('stripe_events').insert({
		stripe_event_id: event.id,
		event_type: event.type,
		payload: event.data.object as Record<string, unknown>
	});

	if (insertError) {
		// If we can't record the event, another process may have grabbed it
		console.log(`Event already being processed: ${event.id}`);
		return json({ received: true, duplicate: true });
	}

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
		// Still return 200 to prevent retries - we've recorded the event
	}

	return json({ received: true });
};

/**
 * Handle successful checkout - atomically complete payment and create enrollment.
 * Uses the complete_checkout_and_enroll DB function for transactional safety.
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
	const paymentIntentId =
		typeof fullSession.payment_intent === 'string'
			? fullSession.payment_intent
			: fullSession.payment_intent?.id;

	// Extract discount info
	let discountCode: string | null = null;
	let discountAmountCents: number | null = null;

	if (fullSession.total_details?.breakdown?.discounts) {
		const discount = fullSession.total_details.breakdown.discounts[0];
		if (discount) {
			discountAmountCents = discount.amount;
			if (session.discounts && session.discounts.length > 0) {
				const discountId = session.discounts[0];
				if (typeof discountId === 'string') {
					discountCode = discountId;
				}
			}
		}
	}

	// Use atomic DB function to complete payment + create enrollment
	const { data: result, error: rpcError } = await supabaseAdmin.rpc(
		'complete_checkout_and_enroll',
		{
			p_stripe_session_id: session.id,
			p_stripe_payment_intent_id: paymentIntentId || null,
			p_stripe_customer_id: customerId || null,
			p_discount_code: discountCode,
			p_discount_amount_cents: discountAmountCents
		}
	);

	if (rpcError) {
		console.error('complete_checkout_and_enroll failed:', rpcError);
		return;
	}

	if (result?.error === 'payment_not_found') {
		// Payment record not yet created by enrollment API - create it as backup
		console.warn(`Payment record not found for session ${session.id}, creating from webhook`);
		await supabaseAdmin.from('courses_payments').insert({
			cohort_id: metadata.cohort_id,
			enrollment_link_id: metadata.enrollment_link_id || null,
			amount_cents: fullSession.amount_total || 0,
			currency: fullSession.currency?.toUpperCase() || 'AUD',
			status: 'completed',
			stripe_checkout_session_id: session.id,
			stripe_payment_intent_id: paymentIntentId,
			stripe_customer_id: customerId,
			email: metadata.user_email,
			full_name: metadata.user_name || null,
			discount_code: discountCode,
			discount_amount_cents: discountAmountCents,
			paid_at: new Date().toISOString()
		});
		return;
	}

	if (result?.already_completed) {
		console.log(`Payment already completed for session: ${session.id}`);
		return;
	}

	console.log(
		`Checkout completed for session: ${session.id}`,
		result?.created_enrollment ? '(enrollment created)' : '(enrollment existed or deferred)'
	);
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

		console.log(`Checkout expired for session: ${session.id}`);
	}
}

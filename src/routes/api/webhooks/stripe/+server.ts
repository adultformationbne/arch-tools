import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { constructWebhookEvent, getCharge, getCheckoutSession, getStripeWebhookSecret } from '$lib/server/stripe';
import { supabaseAdmin } from '$lib/server/supabase';
import { CourseMutations } from '$lib/server/course-data';
import { PUBLIC_SITE_URL } from '$env/static/public';
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
		const webhookSecret = getStripeWebhookSecret();
		if (!webhookSecret) {
			throw new Error('Stripe webhook secret is not set (STRIPE_WEBHOOK_SECRET[_TEST|_LIVE])');
		}
		event = constructWebhookEvent(body, signature, webhookSecret);
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
		payload: event.data.object as unknown as Record<string, unknown>
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

			case 'payment_intent.payment_failed':
				await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
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

	// Persist the Stripe hosted invoice URL for the participant's billing list.
	// Captured here (server-to-server) so the link lands even if the payer never
	// revisits the success page or the invoice finalised after that page loaded.
	const invoice = fullSession.invoice as { hosted_invoice_url?: string | null } | string | null;
	const invoiceUrl = invoice && typeof invoice !== 'string' ? invoice.hosted_invoice_url : null;
	if (invoiceUrl) {
		await supabaseAdmin
			.from('courses_payments')
			.update({ stripe_invoice_url: invoiceUrl })
			.eq('stripe_checkout_session_id', session.id);
	}

	// Multi-person (batch) checkout: one payment -> N enrollments
	if (metadata.batch === 'true') {
		await handleBatchCheckoutCompleted(
			session.id,
			paymentIntentId,
			customerId,
			discountCode,
			discountAmountCents
		);
		return;
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

	// Send our own branded receipt via Resend (Stripe's account-wide receipt
	// emails stay off so they don't double-send alongside the Shopify store).
	await CourseMutations.sendPaymentReceipt({
		stripeSessionId: session.id,
		invoiceUrl,
		siteUrl: PUBLIC_SITE_URL
	}).catch((err) => console.error('Failed to send payment receipt:', err));
}

/**
 * Handle a completed multi-person checkout: complete the single payment and
 * create one enrollment per participant, then email claim links to everyone
 * except the billing contact (who sets their password on the success page).
 */
async function handleBatchCheckoutCompleted(
	sessionId: string,
	paymentIntentId: string | undefined,
	customerId: string | undefined,
	discountCode: string | null,
	discountAmountCents: number | null
) {
	const { data: result, error: rpcError } = await supabaseAdmin.rpc(
		'complete_checkout_and_enroll_batch',
		{
			p_stripe_session_id: sessionId,
			p_stripe_payment_intent_id: paymentIntentId || null,
			p_stripe_customer_id: customerId || null,
			p_discount_code: discountCode,
			p_discount_amount_cents: discountAmountCents
		}
	);

	if (rpcError) {
		console.error('complete_checkout_and_enroll_batch failed:', rpcError);
		return;
	}

	if (result?.already_completed) {
		console.log(`Batch payment already completed for session: ${sessionId}`);
		return;
	}

	if (result?.error) {
		console.error(`Batch enrollment error for session ${sessionId}:`, result.error);
		return;
	}

	const enrollments: Array<{
		enrollment_id: string;
		email: string;
		full_name: string;
		claim_token: string;
		is_billing_contact: boolean;
	}> = result?.enrollments || [];

	// Ensure every participant (payer + invitees) has a pending auth account so the
	// smart-login flow recognises them. The payer is auto-signed-in on the success
	// page; invitees follow the emailed smart-login link.
	await Promise.allSettled(
		enrollments.map((e) =>
			CourseMutations.ensureParticipantAccount({
				email: e.email,
				fullName: e.full_name
			})
		)
	);

	// Email the course-branded "you've been enrolled" link to EVERY enrolled
	// participant — including the billing contact, who gets it alongside the
	// receipt/invoice below. (A non-attending organiser isn't enrolled, so they
	// stay receipt-only.)
	await Promise.allSettled(
		enrollments.map((e) =>
			CourseMutations.sendBatchEnrollmentInvitation({
				enrollmentId: e.enrollment_id,
				siteUrl: PUBLIC_SITE_URL
			})
		)
	);

	// Notify hub coordinators of each new hub enrolment (no-op for non-hub rows).
	await Promise.allSettled(
		enrollments.map((e) =>
			CourseMutations.notifyHubCoordinatorsOfEnrollment({
				enrollmentId: e.enrollment_id,
				siteUrl: PUBLIC_SITE_URL
			})
		)
	);

	// Notify the course/platform support inbox of every new enrolment.
	await Promise.allSettled(
		enrollments.map((e) =>
			CourseMutations.notifyAdminOfEnrollment({
				enrollmentId: e.enrollment_id,
				siteUrl: PUBLIC_SITE_URL
			})
		)
	);

	// Branded receipt to the billing contact (the payer) via Resend.
	await CourseMutations.sendPaymentReceipt({
		stripeSessionId: sessionId,
		siteUrl: PUBLIC_SITE_URL
	}).catch((err) => console.error('Failed to send payment receipt:', err));

	console.log(
		`Batch checkout completed for session ${sessionId}: ${enrollments.length} enrolled (all emailed)`
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

/**
 * Handle a failed / blocked payment attempt (declined card, Radar fraud block).
 *
 * These never reach checkout.session.completed, so without this they leave no
 * trace in our system (only the Stripe Dashboard). We log every attempt that
 * carries our enrolment metadata to courses_payment_failures — ignoring Shopify
 * and card-testing noise on the shared Stripe account, which has no cohort_id —
 * and email the course support inbox once per PaymentIntent so staff can follow
 * up. We deliberately do NOT touch the courses_payments row: its checkout session
 * can still succeed on retry within the 30-minute window, so its
 * pending -> completed/abandoned lifecycle is left to run on its own.
 */
async function handlePaymentFailed(pi: Stripe.PaymentIntent) {
	const metadata = pi.metadata || {};

	// Noise filter: only our enrolment checkouts set cohort_id in PI metadata.
	if (!metadata.cohort_id) {
		return;
	}

	const lastErr: any = pi.last_payment_error;
	const chargeId =
		(lastErr && typeof lastErr.charge === 'string' ? lastErr.charge : null) ||
		(typeof pi.latest_charge === 'string' ? pi.latest_charge : null);

	// The richest decline/fraud detail (outcome.*) lives on the charge, not the PI.
	const charge = chargeId ? await getCharge(chargeId).catch(() => null) : null;
	const outcome = charge?.outcome ?? null;
	const card = charge?.payment_method_details?.card ?? null;

	const failureCode = charge?.failure_code || lastErr?.code || null;
	const declineCode = lastErr?.decline_code || null;
	const riskLevel = outcome?.risk_level || null;
	const outcomeType = outcome?.type || null;
	const sellerMessage =
		outcome?.seller_message || charge?.failure_message || lastErr?.message || null;

	// Bucket the failure so the notification can give the right advice.
	const cardErrorCodes = [
		'incorrect_number',
		'invalid_number',
		'incorrect_cvc',
		'invalid_cvc',
		'incorrect_zip',
		'invalid_expiry_month',
		'invalid_expiry_year',
		'expired_card'
	];
	let reasonCategory = 'other';
	if (outcomeType === 'blocked' || riskLevel === 'highest') {
		reasonCategory = 'fraud_blocked';
	} else if (outcomeType === 'issuer_declined') {
		reasonCategory = 'bank_declined';
	} else if (failureCode && cardErrorCodes.includes(failureCode)) {
		reasonCategory = 'card_error';
	}

	// Resolve course_id for the log row (metadata carries cohort_id + names only).
	const { data: cohortRow } = await supabaseAdmin
		.from('courses_cohorts')
		.select('module:module_id ( course_id )')
		.eq('id', metadata.cohort_id)
		.single();
	const courseId = (cohortRow?.module as any)?.course_id ?? null;

	const email =
		metadata.user_email || charge?.billing_details?.email || pi.receipt_email || null;
	const fullName = metadata.user_name || charge?.billing_details?.name || null;
	const currency = (pi.currency || 'aud').toUpperCase();

	const { data: inserted, error: insertError } = await supabaseAdmin
		.from('courses_payment_failures')
		.insert({
			cohort_id: metadata.cohort_id,
			course_id: courseId,
			enrollment_link_id: metadata.enrollment_link_id || null,
			hub_id: metadata.hub_id || null,
			email,
			full_name: fullName,
			amount_cents: pi.amount ?? null,
			currency,
			stripe_payment_intent_id: pi.id,
			stripe_charge_id: chargeId,
			failure_code: failureCode,
			decline_code: declineCode,
			network_status: outcome?.network_status || null,
			risk_level: riskLevel,
			outcome_type: outcomeType,
			seller_message: sellerMessage,
			reason_category: reasonCategory,
			card_brand: card?.brand || null,
			card_last4: card?.last4 || null,
			card_country: card?.country || null,
			course_name: metadata.course_name || null,
			module_name: metadata.module_name || null,
			cohort_name: metadata.cohort_name || null,
			raw: { last_payment_error: lastErr ?? null, outcome }
		})
		.select('id')
		.single();

	if (insertError) {
		console.error('Failed to log payment failure:', insertError);
		return;
	}

	console.log(
		`Payment failed for PI ${pi.id} (${reasonCategory}) — ${email || 'unknown'} — logged`
	);

	// Throttle the support alert: one email per PaymentIntent. A checkout reuses the
	// same PI across retries, so several rapid declines = one alert, not several.
	const { count: alreadyNotified } = await supabaseAdmin
		.from('courses_payment_failures')
		.select('id', { count: 'exact', head: true })
		.eq('stripe_payment_intent_id', pi.id)
		.eq('notified', true);

	if (alreadyNotified && alreadyNotified > 0) {
		return;
	}

	const notifyResult: any = await CourseMutations.notifyAdminOfPaymentFailure({
		cohortId: metadata.cohort_id,
		email,
		fullName,
		amountCents: pi.amount ?? null,
		currency,
		reasonCategory,
		failureCode,
		declineCode,
		sellerMessage,
		riskLevel,
		paymentIntentId: pi.id,
		siteUrl: PUBLIC_SITE_URL
	}).catch((err) => {
		console.error('Failed to send payment-failure notification:', err);
		return null;
	});

	if (notifyResult?.sent) {
		await supabaseAdmin
			.from('courses_payment_failures')
			.update({ notified: true })
			.eq('id', inserted.id);
	}
}

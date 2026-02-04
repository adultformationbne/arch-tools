import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { createCheckoutSession, createStripeCustomer } from '$lib/server/stripe';
import { isEnrollmentLinkValid, getEffectivePrice } from '$lib/utils/enrollment-links';
import { PUBLIC_SITE_URL } from '$env/static/public';

export const POST: RequestHandler = async ({ params, request, locals }) => {
	const { code } = params;

	// Parse request body
	const body = await request.json();
	const { firstName, surname, email, phone, parishId, parishOther, referralSource, referralOther } =
		body;

	// Validate required fields
	if (!firstName || !surname || !email || !phone) {
		throw error(400, 'Missing required fields');
	}

	if (!parishId && !parishOther) {
		throw error(400, 'Parish is required');
	}

	const fullName = `${firstName.trim()} ${surname.trim()}`;
	const normalizedEmail = email.trim().toLowerCase();

	// Fetch enrollment link with related data
	const { data: link, error: linkError } = await supabaseAdmin
		.from('courses_enrollment_links')
		.select(
			`
			id,
			code,
			is_active,
			expires_at,
			max_uses,
			uses_count,
			price_cents,
			hub_id,
			cohort_id,
			hub:courses_hubs(
				id,
				name,
				price_cents,
				currency
			),
			cohort:courses_cohorts(
				id,
				name,
				price_cents,
				currency,
				is_free,
				enrollment_type,
				max_enrollments,
				module:courses_modules(
					id,
					name,
					course:courses(
						id,
						name,
						slug,
						default_price_cents,
						default_currency
					)
				)
			)
		`
		)
		.eq('code', code)
		.single();

	if (linkError || !link) {
		throw error(404, 'Enrollment link not found');
	}

	// Validate link
	const linkValidation = isEnrollmentLinkValid(link);
	if (!linkValidation.valid) {
		throw error(400, linkValidation.reason || 'Invalid enrollment link');
	}

	const cohort = link.cohort;
	const course = cohort?.module?.course;

	if (!cohort || !course) {
		throw error(404, 'Course information not found');
	}

	// Check if email already enrolled in this cohort
	const { data: existingEnrollment } = await supabaseAdmin
		.from('courses_enrollments')
		.select('id, status')
		.eq('email', normalizedEmail)
		.eq('cohort_id', cohort.id)
		.neq('status', 'withdrawn')
		.single();

	if (existingEnrollment) {
		throw error(400, 'This email is already enrolled in this cohort');
	}

	// Check max enrollments
	if (cohort.max_enrollments) {
		const { count } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id', { count: 'exact', head: true })
			.eq('cohort_id', cohort.id)
			.neq('status', 'withdrawn');

		if (count && count >= cohort.max_enrollments) {
			throw error(400, 'This cohort is full');
		}
	}

	// Calculate effective price
	const pricing = getEffectivePrice({
		enrollmentLink: { price_cents: link.price_cents },
		hub: link.hub,
		cohort: {
			price_cents: cohort.price_cents,
			currency: cohort.currency,
			is_free: cohort.is_free || false
		},
		course: {
			default_price_cents: course.default_price_cents,
			default_currency: course.default_currency
		}
	});

	// Check if user already exists
	const { data: existingUser } = await supabaseAdmin
		.from('user_profiles')
		.select('id, stripe_customer_id')
		.eq('email', normalizedEmail)
		.single();

	// Handle free enrollment
	if (pricing.isFree) {
		return handleFreeEnrollment({
			cohort,
			course,
			link,
			fullName,
			email: normalizedEmail,
			phone,
			parishId,
			parishOther,
			referralSource,
			referralOther,
			existingUser
		});
	}

	// Handle paid enrollment - create Stripe checkout session
	return handlePaidEnrollment({
		cohort,
		course,
		link,
		pricing,
		fullName,
		email: normalizedEmail,
		phone,
		parishId,
		parishOther,
		referralSource,
		referralOther,
		existingUser
	});
};

async function handleFreeEnrollment(params: {
	cohort: any;
	course: any;
	link: any;
	fullName: string;
	email: string;
	phone: string;
	parishId: string | null;
	parishOther: string | null;
	referralSource: string | null;
	referralOther: string | null;
	existingUser: { id: string; stripe_customer_id: string | null } | null;
}) {
	const {
		cohort,
		course,
		link,
		fullName,
		email,
		phone,
		parishId,
		parishOther,
		referralSource,
		referralOther,
		existingUser
	} = params;

	const isApprovalRequired = cohort.enrollment_type === 'approval_required';
	const enrollmentStatus = isApprovalRequired ? 'pending' : 'invited';

	// Create enrollment record
	const { data: enrollment, error: enrollmentError } = await supabaseAdmin
		.from('courses_enrollments')
		.insert({
			cohort_id: cohort.id,
			user_profile_id: existingUser?.id || null,
			hub_id: link.hub_id || null,
			enrollment_link_id: link.id,
			full_name: fullName,
			email,
			role: 'student',
			status: enrollmentStatus,
			payment_status: 'not_required'
		})
		.select('id')
		.single();

	if (enrollmentError) {
		console.error('Failed to create enrollment:', enrollmentError);
		throw error(500, 'Failed to create enrollment');
	}

	// Update user profile with additional info if they exist
	if (existingUser) {
		await supabaseAdmin
			.from('user_profiles')
			.update({
				phone,
				parish_id: parishId,
				parish_other: parishOther,
				referral_source: referralSource === 'other' ? referralOther : referralSource
			})
			.eq('id', existingUser.id);
	}

	// Increment link uses
	await supabaseAdmin.rpc('increment_enrollment_link_uses', { link_id: link.id });

	if (isApprovalRequired) {
		// Return success but indicate pending approval
		return json({
			success: true,
			pendingApproval: true,
			message: 'Your enrollment request has been submitted and is awaiting approval.'
		});
	}

	// For instant enrollment, redirect to success page for password setup
	return json({
		success: true,
		successUrl: `/enroll/${link.code}/success?enrollment_id=${enrollment.id}`
	});
}

async function handlePaidEnrollment(params: {
	cohort: any;
	course: any;
	link: any;
	pricing: { amount: number; currency: string };
	fullName: string;
	email: string;
	phone: string;
	parishId: string | null;
	parishOther: string | null;
	referralSource: string | null;
	referralOther: string | null;
	existingUser: { id: string; stripe_customer_id: string | null } | null;
}) {
	const {
		cohort,
		course,
		link,
		pricing,
		fullName,
		email,
		phone,
		parishId,
		parishOther,
		referralSource,
		referralOther,
		existingUser
	} = params;

	// Create or get Stripe customer
	let stripeCustomerId = existingUser?.stripe_customer_id;

	if (!stripeCustomerId) {
		const customer = await createStripeCustomer({
			email,
			name: fullName,
			metadata: {
				user_id: existingUser?.id || '',
				source: 'enrollment'
			}
		});
		stripeCustomerId = customer.id;

		// Update user profile with Stripe customer ID if they exist
		if (existingUser) {
			await supabaseAdmin
				.from('user_profiles')
				.update({ stripe_customer_id: stripeCustomerId })
				.eq('id', existingUser.id);
		}
	}

	// Create payment record
	const { data: payment, error: paymentError } = await supabaseAdmin
		.from('courses_payments')
		.insert({
			cohort_id: cohort.id,
			user_profile_id: existingUser?.id || null,
			enrollment_link_id: link.id,
			amount_cents: pricing.amount,
			currency: pricing.currency,
			status: 'pending',
			stripe_customer_id: stripeCustomerId,
			email,
			full_name: fullName
		})
		.select('id')
		.single();

	if (paymentError) {
		console.error('Failed to create payment record:', paymentError);
		throw error(500, 'Failed to initialize payment');
	}

	// Store enrollment data in a temporary record for after payment
	// We'll create the actual enrollment after payment succeeds
	const pendingData = {
		fullName,
		email,
		phone,
		parishId,
		parishOther,
		referralSource: referralSource === 'other' ? referralOther : referralSource,
		hubId: link.hub_id,
		paymentId: payment.id
	};

	// Store pending data (we'll use the payment record's metadata or a separate approach)
	// For now, encode in the success URL
	const pendingDataEncoded = Buffer.from(JSON.stringify(pendingData)).toString('base64url');

	// Create Stripe Checkout session
	const session = await createCheckoutSession({
		priceInCents: pricing.amount,
		currency: pricing.currency,
		customerEmail: email,
		customerId: stripeCustomerId,
		successUrl: `${PUBLIC_SITE_URL}/enroll/${link.code}/success?session_id={CHECKOUT_SESSION_ID}&data=${pendingDataEncoded}`,
		cancelUrl: `${PUBLIC_SITE_URL}/enroll/${link.code}?cancelled=true`,
		metadata: {
			cohort_id: cohort.id,
			enrollment_link_id: link.id,
			user_email: email,
			user_name: fullName,
			hub_id: link.hub_id || ''
		},
		allowPromotionCodes: true
	});

	// Update payment record with session ID
	await supabaseAdmin
		.from('courses_payments')
		.update({ stripe_checkout_session_id: session.id })
		.eq('id', payment.id);

	return json({
		success: true,
		checkoutUrl: session.url
	});
}

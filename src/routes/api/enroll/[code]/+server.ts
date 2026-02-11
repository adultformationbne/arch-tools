import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { createCheckoutSession, createStripeCustomer } from '$lib/server/stripe';
import { isEnrollmentLinkValid, getEffectivePrice } from '$lib/utils/enrollment-links';
import { checkRateLimit } from '$lib/server/rate-limit';
import { PUBLIC_SITE_URL } from '$env/static/public';

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	const { code } = params;

	// Rate limiting: 10 enrollments per IP per 15 minutes
	const clientIp = getClientAddress();
	if (!checkRateLimit(`enroll:ip:${clientIp}`, 10, 15 * 60_000)) {
		throw error(429, 'Too many enrollment attempts. Please try again later.');
	}

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

	const normalizedEmail = email.trim().toLowerCase();

	// Validate email format
	if (!isValidEmail(normalizedEmail)) {
		throw error(400, 'Invalid email address');
	}

	// Rate limiting: 3 enrollments per email per hour
	if (!checkRateLimit(`enroll:email:${normalizedEmail}`, 3, 60 * 60_000)) {
		throw error(429, 'Too many enrollment attempts for this email. Please try again later.');
	}

	// Validate field lengths
	if (firstName.trim().length > 100 || surname.trim().length > 100) {
		throw error(400, 'Name is too long');
	}
	if (phone.trim().length > 30) {
		throw error(400, 'Phone number is too long');
	}

	const fullName = `${firstName.trim()} ${surname.trim()}`;

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
				enrollment_opens_at,
				enrollment_closes_at,
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

	// Check enrollment window (also checked in page load, but must enforce server-side)
	if (cohort.enrollment_opens_at && new Date(cohort.enrollment_opens_at) > new Date()) {
		throw error(400, 'Enrollment has not opened yet');
	}
	if (cohort.enrollment_closes_at && new Date(cohort.enrollment_closes_at) < new Date()) {
		throw error(400, 'Enrollment for this cohort has closed');
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

	// Use atomic safe_create_enrollment to prevent race conditions on capacity
	const { data: result, error: rpcError } = await supabaseAdmin.rpc('safe_create_enrollment', {
		p_cohort_id: cohort.id,
		p_user_profile_id: existingUser?.id || null,
		p_hub_id: link.hub_id || null,
		p_enrollment_link_id: link.id,
		p_full_name: fullName,
		p_email: email,
		p_role: 'student',
		p_status: enrollmentStatus,
		p_payment_status: 'not_required',
		p_payment_id: null
	});

	if (rpcError) {
		console.error('safe_create_enrollment failed:', rpcError);
		throw error(500, 'Failed to create enrollment');
	}

	if (result?.error === 'already_enrolled') {
		throw error(400, 'This email is already enrolled in this cohort');
	}

	if (result?.error === 'cohort_full') {
		throw error(400, 'This cohort is full');
	}

	const enrollmentId = result?.enrollment_id;

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

	if (isApprovalRequired) {
		return json({
			success: true,
			pendingApproval: true,
			message: 'Your enrollment request has been submitted and is awaiting approval.'
		});
	}

	// For instant enrollment, redirect to success page for password setup
	return json({
		success: true,
		successUrl: `/enroll/${link.code}/success?enrollment_id=${enrollmentId}`
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

	// Pre-check: email not already enrolled (non-atomic but fast fail)
	const { data: existingEnrollment } = await supabaseAdmin
		.from('courses_enrollments')
		.select('id')
		.eq('email', email)
		.eq('cohort_id', cohort.id)
		.neq('status', 'withdrawn')
		.single();

	if (existingEnrollment) {
		throw error(400, 'This email is already enrolled in this cohort');
	}

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

	// Store pending enrollment data in payment record (NOT in URL)
	const pendingData = {
		fullName,
		email,
		phone,
		parishId,
		parishOther,
		referralSource: referralSource === 'other' ? referralOther : referralSource,
		hubId: link.hub_id
	};

	// Create payment record with pending data
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
			full_name: fullName,
			pending_data: pendingData
		})
		.select('id')
		.single();

	if (paymentError) {
		console.error('Failed to create payment record:', paymentError);
		throw error(500, 'Failed to initialize payment');
	}

	// Create Stripe Checkout session - success URL only includes session_id (no sensitive data)
	const session = await createCheckoutSession({
		priceInCents: pricing.amount,
		currency: pricing.currency,
		customerEmail: email,
		customerId: stripeCustomerId,
		successUrl: `${PUBLIC_SITE_URL}/enroll/${link.code}/success?session_id={CHECKOUT_SESSION_ID}`,
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

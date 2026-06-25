import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { supabaseAdmin } from '$lib/server/supabase';
import { createEmbeddedCheckoutSession, createStripeCustomer } from '$lib/server/stripe';
import { isEnrollmentLinkValid, getEffectivePrice } from '$lib/utils/enrollment-links';
import { getCourseSettings } from '$lib/types/course-settings';
import { checkRateLimit } from '$lib/server/rate-limit';
import { CourseMutations } from '$lib/server/course-data';
import { PUBLIC_SITE_URL } from '$env/static/public';

function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

type RawParticipant = {
	firstName?: string;
	surname?: string;
	email?: string;
	phone?: string;
	parishId?: string | null;
	parishOther?: string | null;
	referralSource?: string | null;
	referralOther?: string | null;
	mailingAddress?: string | null;
};

type Participant = {
	fullName: string;
	email: string;
	phone: string;
	parishId: string | null;
	parishOther: string | null;
	referralSource: string | null;
	mailingAddress: string | null;
};

type BillingContact = {
	participantIndex: number | null;
	name: string;
	email: string;
};

/**
 * Normalise + validate a single participant entry.
 * Throws a 400 with a clear message on the first problem.
 */
function normalizeParticipant(raw: RawParticipant, label: string): Participant {
	const firstName = (raw.firstName || '').trim();
	const surname = (raw.surname || '').trim();
	const email = (raw.email || '').trim().toLowerCase();
	const phone = (raw.phone || '').trim();

	if (!firstName || !surname || !email || !phone) {
		throw error(400, `Missing required fields for ${label}`);
	}
	if (firstName.length > 100 || surname.length > 100) {
		throw error(400, `Name is too long for ${label}`);
	}
	if (phone.length > 30) {
		throw error(400, `Phone number is too long for ${label}`);
	}
	if (!isValidEmail(email)) {
		throw error(400, `Invalid email address for ${label}`);
	}

	return {
		fullName: `${firstName} ${surname}`,
		email,
		phone,
		parishId: raw.parishId || null,
		parishOther: (raw.parishOther || '').trim() || null,
		referralSource: raw.referralSource === 'other' ? (raw.referralOther || '').trim() || null : raw.referralSource || null,
		mailingAddress: (raw.mailingAddress || '').trim() || null
	};
}

export const POST: RequestHandler = async ({ params, request, getClientAddress }) => {
	const { code } = params;

	// Rate limiting: 10 enrollment submissions per IP per 15 minutes
	const clientIp = getClientAddress();
	if (!checkRateLimit(`enroll:ip:${clientIp}`, 10, 15 * 60_000)) {
		throw error(429, 'Too many enrollment attempts. Please try again later.');
	}

	const body = await request.json();

	// Accept the new batch shape; fall back to treating a single-person body as a group of one.
	const rawParticipants: RawParticipant[] = Array.isArray(body.participants)
		? body.participants
		: [body];

	if (rawParticipants.length === 0) {
		throw error(400, 'At least one participant is required');
	}
	if (rawParticipants.length > 50) {
		throw error(400, 'Too many participants in a single submission');
	}

	// Validate + normalise every participant
	const participants: Participant[] = rawParticipants.map((p, i) =>
		normalizeParticipant(p, `participant ${i + 1}`)
	);

	// Dedupe emails within the batch
	const seen = new Set<string>();
	for (const p of participants) {
		if (seen.has(p.email)) {
			throw error(400, `Duplicate email in this group: ${p.email}`);
		}
		seen.add(p.email);
	}

	// Resolve the billing contact (defaults to the first participant paying for themselves)
	const rawBilling = body.billingContact;
	let billingContact: BillingContact;
	if (rawBilling && rawBilling.participantIndex !== null && rawBilling.participantIndex !== undefined) {
		const idx = Number(rawBilling.participantIndex);
		if (!Number.isInteger(idx) || idx < 0 || idx >= participants.length) {
			throw error(400, 'Invalid billing contact selection');
		}
		billingContact = { participantIndex: idx, name: participants[idx].fullName, email: participants[idx].email };
	} else if (rawBilling) {
		// Separate, non-attending organiser
		const name = (rawBilling.name || '').trim();
		const email = (rawBilling.email || '').trim().toLowerCase();
		if (!name || !isValidEmail(email)) {
			throw error(400, 'A valid name and email are required for the billing contact');
		}
		billingContact = { participantIndex: null, name, email };
	} else {
		// No billing contact supplied — first participant pays
		billingContact = { participantIndex: 0, name: participants[0].fullName, email: participants[0].email };
	}

	// Rate limiting: 5 submissions per payer email per hour
	if (!checkRateLimit(`enroll:email:${billingContact.email}`, 5, 60 * 60_000)) {
		throw error(429, 'Too many enrollment attempts for this email. Please try again later.');
	}

	// Fetch enrollment link with related data
	const { data: link, error: linkError } = await supabaseAdmin
		.from('courses_enrollment_links')
		.select(
			`
			id,
			code,
			is_active,
			bypass_enrollment_window,
			max_uses,
			uses_count,
			price_cents,
			hub_id,
			cohort_id,
			hub:courses_hubs(
				id,
				name
			),
			cohort:courses_cohorts(
				id,
				name,
				price_cents,
				currency,
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
						settings
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

	// Enforce the link's remaining uses against the headcount
	if (link.max_uses !== null && link.uses_count + participants.length > link.max_uses) {
		throw error(400, 'This enrollment link does not have enough remaining uses for this group');
	}

	// Enforce the cohort enrollment window unless this link bypasses it (late access)
	if (!link.bypass_enrollment_window) {
		if (cohort.enrollment_opens_at && new Date(cohort.enrollment_opens_at) > new Date()) {
			throw error(400, 'Enrollment has not opened yet');
		}
		if (cohort.enrollment_closes_at && new Date(cohort.enrollment_closes_at) < new Date()) {
			throw error(400, 'Enrollment for this cohort has closed');
		}
	}

	// Check cohort capacity up front for the whole group (atomic check still happens later)
	if (cohort.max_enrollments) {
		const { count: cohortCount } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id', { count: 'exact', head: true })
			.eq('cohort_id', cohort.id)
			.neq('status', 'withdrawn');
		if (cohortCount !== null && cohortCount + participants.length > cohort.max_enrollments) {
			throw error(400, 'This cohort does not have enough remaining places for your group');
		}
	}

	// Check course-wide max capacity for the whole group
	const courseSettings = getCourseSettings(course.settings);
	if (courseSettings.features?.maxCapacity) {
		const { data: courseModules } = await supabaseAdmin
			.from('courses_modules')
			.select('id')
			.eq('course_id', course.id);
		const moduleIds = courseModules?.map((m) => m.id) ?? [];
		const { data: courseCohorts } = await supabaseAdmin
			.from('courses_cohorts')
			.select('id')
			.in('module_id', moduleIds);
		const cohortIds = courseCohorts?.map((c) => c.id) ?? [];
		const { count: courseCount } = await supabaseAdmin
			.from('courses_enrollments')
			.select('id', { count: 'exact', head: true })
			.in('cohort_id', cohortIds)
			.neq('status', 'withdrawn');
		if (courseCount !== null && courseCount + participants.length > courseSettings.features.maxCapacity) {
			throw error(400, 'This course does not have enough remaining places for your group');
		}
	}

	// Resolve effective hub: a hub-locked link wins; otherwise the group's selection,
	// which must be a hub that's been offered for this cohort (cohorts_hubs).
	let effectiveHubId: string | null = link.hub_id || null;
	if (!link.hub_id && body.hubId) {
		const { data: offered } = await supabaseAdmin
			.from('cohorts_hubs')
			.select('hub_id')
			.eq('cohort_id', cohort.id)
			.eq('hub_id', body.hubId)
			.maybeSingle();
		if (!offered) {
			throw error(400, 'Invalid hub selection');
		}
		effectiveHubId = body.hubId;
	}

	// Effective unit price: cohort default, optionally overridden by the link. 0 = free.
	const pricing = getEffectivePrice({
		enrollmentLink: { price_cents: link.price_cents },
		cohort: { price_cents: cohort.price_cents, currency: cohort.currency }
	});

	// Reject any participant who is already enrolled in this cohort
	const { data: existingEnrollments } = await supabaseAdmin
		.from('courses_enrollments')
		.select('email')
		.eq('cohort_id', cohort.id)
		.neq('status', 'withdrawn')
		.in('email', participants.map((p) => p.email));
	if (existingEnrollments && existingEnrollments.length > 0) {
		const clash = existingEnrollments[0].email;
		throw error(400, `${clash} is already enrolled in this cohort`);
	}

	if (pricing.isFree) {
		return handleFreeBatch({
			cohort,
			course,
			link,
			hubId: effectiveHubId,
			participants,
			billingContact,
			courseSettings
		});
	}

	return handlePaidBatch({
		cohort,
		course,
		link,
		hubId: effectiveHubId,
		pricing,
		participants,
		billingContact
	});
};

async function handleFreeBatch(params: {
	cohort: any;
	course: any;
	link: any;
	hubId: string | null;
	participants: Participant[];
	billingContact: BillingContact;
	courseSettings?: ReturnType<typeof getCourseSettings>;
}) {
	const { cohort, course, link, hubId, participants, billingContact, courseSettings } = params;

	// Cohort-level overrides course-level; null/empty cohort type defers to course setting
	const isApprovalRequired =
		cohort.enrollment_type === 'approval_required' ||
		(cohort.enrollment_type !== 'auto_approve' && (courseSettings?.features?.requireApproval ?? false));
	const enrollmentStatus = isApprovalRequired ? 'pending' : 'invited';

	// Create an enrollment per participant, remembering each claim token
	const created: { participant: Participant; index: number; enrollmentId: string; claimToken: string }[] = [];
	for (let i = 0; i < participants.length; i++) {
		const p = participants[i];
		const claimToken = crypto.randomUUID().replace(/-/g, '');
		const { data: result, error: rpcError } = await supabaseAdmin.rpc('safe_create_enrollment', {
			p_cohort_id: cohort.id,
			p_user_profile_id: null,
			p_hub_id: hubId,
			p_enrollment_link_id: link.id,
			p_full_name: p.fullName,
			p_email: p.email,
			p_role: 'student',
			p_status: enrollmentStatus,
			p_payment_status: 'not_required',
			p_payment_id: null,
			p_claim_token: claimToken,
			p_phone: p.phone,
			p_parish_id: p.parishId,
			p_parish_other: p.parishOther,
			p_referral_source: p.referralSource,
			p_mailing_address: p.mailingAddress
		});

		if (rpcError) {
			console.error('safe_create_enrollment failed:', rpcError);
			throw error(500, 'Failed to create enrollment');
		}
		if (result?.error === 'already_enrolled') {
			throw error(400, `${p.email} is already enrolled in this cohort`);
		}
		if (result?.error === 'cohort_full') {
			throw error(400, 'This cohort filled up before your group could be enrolled');
		}
		created.push({ participant: p, index: i, enrollmentId: result.enrollment_id, claimToken });
	}

	// Approval-required groups wait for an admin; no claim links go out yet.
	if (isApprovalRequired) {
		return json({
			success: true,
			pendingApproval: true,
			message: 'Your enrollment requests have been submitted and are awaiting approval.'
		});
	}

	const billingIsParticipant = billingContact.participantIndex !== null;

	// Ensure every participant has a (pending) auth account so the smart-login flow
	// recognises them. The billing participant is auto-signed-in later on the success
	// page; invitees follow the emailed smart-login link.
	await Promise.allSettled(
		created.map((c) =>
			CourseMutations.ensureParticipantAccount({
				email: c.participant.email,
				fullName: c.participant.fullName
			})
		)
	);

	// Email a smart-login link to everyone except the participant who is the billing
	// contact (that person is signed in directly via the success redirect).
	const invitees = created.filter((c) => c.index !== billingContact.participantIndex);
	await Promise.allSettled(
		invitees.map((c) =>
			CourseMutations.sendBatchEnrollmentInvitation({
				enrollmentId: c.enrollmentId,
				siteUrl: PUBLIC_SITE_URL
			})
		)
	);

	if (billingIsParticipant) {
		const payer = created[billingContact.participantIndex as number];
		return json({
			success: true,
			successUrl: `/enroll/${link.code}/success?enrollment_id=${payer.enrollmentId}`
		});
	}

	// Non-attending organiser on a free course — nothing to pay, just confirm.
	return json({
		success: true,
		invitationsSent: true,
		participantCount: participants.length
	});
}

async function handlePaidBatch(params: {
	cohort: any;
	course: any;
	link: any;
	hubId: string | null;
	pricing: { amount: number; currency: string };
	participants: Participant[];
	billingContact: BillingContact;
}) {
	const { cohort, course, link, hubId, pricing, participants, billingContact } = params;

	const count = participants.length;
	const totalAmount = pricing.amount * count;

	// Look up an existing profile for the payer (for Stripe customer reuse)
	const { data: existingUser } = await supabaseAdmin
		.from('user_profiles')
		.select('id, stripe_customer_id')
		.eq('email', billingContact.email)
		.single();

	// Create or reuse the Stripe customer for the billing contact
	let stripeCustomerId = existingUser?.stripe_customer_id;
	if (!stripeCustomerId) {
		const customer = await createStripeCustomer({
			email: billingContact.email,
			name: billingContact.name,
			metadata: { user_id: existingUser?.id || '', source: 'enrollment' }
		});
		stripeCustomerId = customer.id;
		if (existingUser) {
			await supabaseAdmin
				.from('user_profiles')
				.update({ stripe_customer_id: stripeCustomerId })
				.eq('id', existingUser.id);
		}
	}

	// Store the whole batch in the payment's pending_data (NOT in the URL)
	const pendingData = {
		participants,
		hubId,
		billingContact
	};

	const { data: payment, error: paymentError } = await supabaseAdmin
		.from('courses_payments')
		.insert({
			cohort_id: cohort.id,
			user_profile_id: existingUser?.id || null,
			enrollment_link_id: link.id,
			amount_cents: totalAmount,
			currency: pricing.currency,
			status: 'pending',
			stripe_customer_id: stripeCustomerId,
			email: billingContact.email,
			full_name: billingContact.name,
			pending_data: pendingData
		})
		.select('id')
		.single();

	if (paymentError) {
		console.error('Failed to create payment record:', paymentError);
		throw error(500, 'Failed to initialize payment');
	}

	// One embedded checkout for the whole group: a single line item with quantity = N
	// at the unit price, so the Stripe receipt itemises the group.
	const session = await createEmbeddedCheckoutSession({
		priceInCents: pricing.amount,
		currency: pricing.currency,
		quantity: count,
		productName: count > 1 ? `Course Enrollment (${count} participants)` : 'Course Enrollment',
		customerEmail: billingContact.email,
		customerId: stripeCustomerId,
		returnUrl: `${PUBLIC_SITE_URL}/enroll/${link.code}/success?session_id={CHECKOUT_SESSION_ID}`,
		metadata: {
			cohort_id: cohort.id,
			enrollment_link_id: link.id,
			user_email: billingContact.email,
			user_name: billingContact.name,
			hub_id: hubId || '',
			batch: 'true'
		},
		allowPromotionCodes: true
	});

	await supabaseAdmin
		.from('courses_payments')
		.update({ stripe_checkout_session_id: session.id })
		.eq('id', payment.id);

	if (session.client_secret) {
		return json({ success: true, clientSecret: session.client_secret });
	}
	return json({ success: true, checkoutUrl: session.mockUrl });
}

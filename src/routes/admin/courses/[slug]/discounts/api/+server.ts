import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireCourseAdmin } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';
import {
	createStripeCoupon,
	createStripePromotionCode,
	deactivatePromotionCode
} from '$lib/server/stripe';

export const POST: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	const { user } = await requireCourseAdmin(event, courseSlug);

	const body = await event.request.json();
	const { action } = body;

	// Get course ID
	const { data: course } = await supabaseAdmin
		.from('courses')
		.select('id, name')
		.eq('slug', courseSlug)
		.single();

	if (!course) {
		throw error(404, 'Course not found');
	}

	switch (action) {
		case 'create':
			return handleCreate(body, course, user.id);
		case 'toggle':
			return handleToggle(body);
		default:
			throw error(400, 'Invalid action');
	}
};

export const DELETE: RequestHandler = async (event) => {
	const courseSlug = event.params.slug;
	await requireCourseAdmin(event, courseSlug);

	const codeId = event.url.searchParams.get('codeId');
	if (!codeId) {
		throw error(400, 'Missing codeId');
	}

	// Get the code to deactivate in Stripe
	const { data: discountCode } = await supabaseAdmin
		.from('courses_discount_codes')
		.select('stripe_promotion_code_id')
		.eq('id', codeId)
		.single();

	// Deactivate in Stripe if it exists
	if (discountCode?.stripe_promotion_code_id) {
		try {
			await deactivatePromotionCode(discountCode.stripe_promotion_code_id);
		} catch (err) {
			console.error('Failed to deactivate Stripe promotion code:', err);
			// Continue with deletion even if Stripe fails
		}
	}

	// Delete the code
	const { error: deleteError } = await supabaseAdmin
		.from('courses_discount_codes')
		.delete()
		.eq('id', codeId);

	if (deleteError) {
		console.error('Failed to delete discount code:', deleteError);
		throw error(500, 'Failed to delete discount code');
	}

	return json({ success: true });
};

async function handleCreate(
	body: {
		code: string;
		discountType: 'percentage' | 'fixed';
		discountValue: number;
		cohortId?: string | null;
		maxUses?: number | null;
		expiresAt?: string | null;
	},
	course: { id: string; name: string },
	userId: string
) {
	const { code, discountType, discountValue, cohortId, maxUses, expiresAt } = body;

	if (!code || !discountType || !discountValue) {
		throw error(400, 'Missing required fields');
	}

	// Check if code already exists for this course
	const { data: existing } = await supabaseAdmin
		.from('courses_discount_codes')
		.select('id')
		.eq('course_id', course.id)
		.eq('code', code.toUpperCase())
		.single();

	if (existing) {
		throw error(400, 'A discount code with this name already exists for this course');
	}

	// Create coupon in Stripe
	let stripeCouponId: string | null = null;
	let stripePromotionCodeId: string | null = null;

	try {
		const coupon = await createStripeCoupon({
			discountType,
			discountValue,
			currency: 'aud',
			name: `${course.name} - ${code}`
		});
		stripeCouponId = coupon.id;

		// Create promotion code
		const promoCode = await createStripePromotionCode({
			couponId: coupon.id,
			code: code.toUpperCase(),
			maxRedemptions: maxUses || undefined,
			expiresAt: expiresAt ? new Date(expiresAt) : undefined
		});
		stripePromotionCodeId = promoCode.id;
	} catch (err) {
		console.error('Failed to create Stripe coupon/promo code:', err);
		// Continue without Stripe - codes will still work for tracking
	}

	// Create in database
	const { data: discountCode, error: createError } = await supabaseAdmin
		.from('courses_discount_codes')
		.insert({
			course_id: course.id,
			cohort_id: cohortId || null,
			code: code.toUpperCase(),
			discount_type: discountType,
			discount_value: discountValue,
			stripe_coupon_id: stripeCouponId,
			stripe_promotion_code_id: stripePromotionCodeId,
			max_uses: maxUses || null,
			expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
			is_active: true,
			created_by: userId
		})
		.select('id, code')
		.single();

	if (createError) {
		console.error('Failed to create discount code:', createError);
		throw error(500, 'Failed to create discount code');
	}

	return json({ success: true, discountCode });
}

async function handleToggle(body: { codeId: string; isActive: boolean }) {
	const { codeId, isActive } = body;

	if (!codeId) {
		throw error(400, 'Code ID is required');
	}

	// Get the code for Stripe update
	const { data: discountCode } = await supabaseAdmin
		.from('courses_discount_codes')
		.select('stripe_promotion_code_id')
		.eq('id', codeId)
		.single();

	// Update in Stripe if exists
	if (discountCode?.stripe_promotion_code_id && !isActive) {
		try {
			await deactivatePromotionCode(discountCode.stripe_promotion_code_id);
		} catch (err) {
			console.error('Failed to update Stripe promotion code:', err);
		}
	}

	// Update in database
	const { error: updateError } = await supabaseAdmin
		.from('courses_discount_codes')
		.update({
			is_active: isActive,
			updated_at: new Date().toISOString()
		})
		.eq('id', codeId);

	if (updateError) {
		console.error('Failed to update discount code:', updateError);
		throw error(500, 'Failed to update discount code');
	}

	return json({ success: true });
}

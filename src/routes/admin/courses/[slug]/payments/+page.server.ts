import type { PageServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';

/**
 * Course-wide billing view: every Stripe payment attempt across the course's
 * cohorts. Auth is enforced by the admin layout (requireCourseAdmin). Only
 * available when the course accepts payments.
 */
export const load: PageServerLoad = async (event) => {
	const layoutData = await event.parent();
	const courseInfo = layoutData?.courseInfo;
	const courseFeatures = layoutData?.courseFeatures || {};

	if (!courseInfo) {
		throw error(404, 'Course not found');
	}

	if (courseFeatures.acceptPayments === false) {
		throw redirect(302, `/admin/courses/${event.params.slug}`);
	}

	const { data: rows } = await supabaseAdmin
		.from('courses_payments')
		.select(`
			id, created_at, paid_at, email, full_name, amount_cents, currency, status,
			discount_code, discount_amount_cents, stripe_invoice_url, stripe_payment_intent_id,
			cohort:courses_cohorts!inner (
				name,
				module:courses_modules!inner (
					name,
					course:courses!inner ( slug )
				)
			)
		`)
		.eq('cohort.module.course.slug', event.params.slug)
		.order('created_at', { ascending: false })
		.limit(500);

	const payments = rows || [];

	// Summary — total collected counts only completed payments.
	const completed = payments.filter((p: any) => p.status === 'completed');
	const summary = {
		currency: (payments[0] as any)?.currency || 'AUD',
		totalCents: completed.reduce((sum: number, p: any) => sum + (p.amount_cents || 0), 0),
		completed: completed.length,
		pending: payments.filter((p: any) => p.status === 'pending').length,
		abandoned: payments.filter((p: any) => p.status === 'abandoned').length,
		failed: payments.filter((p: any) => p.status === 'failed').length,
		total: payments.length
	};

	return { payments, summary };
};

import type { PageServerLoad } from './$types';
import { requireAuth, getUserProfile } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase';

export const load: PageServerLoad = async (event) => {
	// Use unified auth function
	const { user } = await requireAuth(event, {
		mode: 'redirect',
		redirectTo: '/login'
	});

	// Use centralized profile fetching
	const profile = await getUserProfile(event.locals.supabase, user.id);

	if (!profile) {
		console.error('Error loading profile: User profile not found for user', user.id);
	}

	// Billing history — the participant's payments (matched by email, since the
	// payment may be created before the user profile exists during self-signup)
	let payments: any[] = [];
	const billingEmail = (profile?.email || user.email || '').toLowerCase();
	if (billingEmail) {
		const { data } = await supabaseAdmin
			.from('courses_payments')
			.select(
				`id, amount_cents, currency, status, created_at, paid_at, stripe_invoice_url,
				cohort:courses_cohorts(name, module:courses_modules(name, course:courses(name)))`
			)
			.eq('email', billingEmail)
			.order('created_at', { ascending: false });
		payments = data || [];
	}

	return {
		profile,
		payments
	};
};

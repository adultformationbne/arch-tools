import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

export async function POST({ request }) {
	try {
		const { token, reflectionContent, reflectionTitle } = await request.json();

		if (!token || !reflectionContent) {
			return json({ error: 'Token and reflection content are required' }, { status: 400 });
		}

		// Find schedule entry by token
		const { data: schedule, error: findError } = await supabase
			.from('dgr_schedule')
			.select('*')
			.eq('submission_token', token)
			.single();

		if (findError || !schedule) {
			return json({ error: 'Invalid or expired submission link' }, { status: 404 });
		}

		// Update with reflection
		const { data, error } = await supabase
			.from('dgr_schedule')
			.update({
				reflection_content: reflectionContent,
				reflection_title: reflectionTitle || null,
				status: 'submitted',
				submitted_at: new Date().toISOString()
			})
			.eq('submission_token', token)
			.select()
			.single();

		if (error) throw error;

		// Create notification email for admin
		await supabase.from('dgr_email_queue').insert({
			schedule_id: schedule.id,
			recipient_email: 'admin@archbrisbane.net.au', // Replace with actual admin email
			email_type: 'notification',
			subject: `New DGR Reflection Submitted - ${new Date(schedule.date).toLocaleDateString()}`,
			body: `A new reflection has been submitted for ${new Date(schedule.date).toLocaleDateString()}.\n\nContributor: ${schedule.contributor_email}\nTitle: ${reflectionTitle || 'Untitled'}\n\nPlease review and approve in the admin dashboard.`,
			status: 'pending'
		});

		return json({
			success: true,
			message: 'Reflection submitted successfully. Thank you!',
			schedule: data
		});
	} catch (error) {
		console.error('Reflection submission error:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

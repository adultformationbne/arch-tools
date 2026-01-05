import { requireModule } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';

export async function load(event) {
	await requireModule(event, 'dgr');

	// Get the digest task config
	const { data: task } = await supabaseAdmin
		.from('scheduled_tasks')
		.select('*')
		.eq('task_type', 'dgr_digest')
		.single();

	// Get all DGR admins (potential recipients)
	const { data: dgrAdmins } = await supabaseAdmin
		.from('user_profiles')
		.select('id, email, full_name')
		.contains('modules', ['dgr'])
		.order('full_name');

	return {
		task,
		dgrAdmins: dgrAdmins || [],
		currentRecipients: task?.config?.recipients || []
	};
}

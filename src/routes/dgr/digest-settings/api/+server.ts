import { json } from '@sveltejs/kit';
import { requireModule } from '$lib/server/auth';
import { supabaseAdmin } from '$lib/server/supabase.js';

export async function POST(event) {
	await requireModule(event, 'dgr');

	try {
		const { taskId, enabled, runOnWeekdays, runOnWeekends, recipients } = await event.request.json();

		if (!taskId) {
			return json({ error: 'Task ID required' }, { status: 400 });
		}

		// Get current config to preserve other settings
		const { data: currentTask } = await supabaseAdmin
			.from('scheduled_tasks')
			.select('config')
			.eq('id', taskId)
			.single();

		const updatedConfig = {
			...(currentTask?.config || {}),
			recipients
		};

		// Update the task
		const { error } = await supabaseAdmin
			.from('scheduled_tasks')
			.update({
				enabled,
				run_on_weekdays: runOnWeekdays,
				run_on_weekends: runOnWeekends,
				config: updatedConfig,
				updated_at: new Date().toISOString()
			})
			.eq('id', taskId);

		if (error) {
			throw new Error(error.message);
		}

		return json({ success: true });

	} catch (error) {
		console.error('Failed to update digest settings:', error);
		return json({ error: error.message }, { status: 500 });
	}
}

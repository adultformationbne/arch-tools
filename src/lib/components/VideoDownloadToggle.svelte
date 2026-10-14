<script>
	/**
	 * "Let leaders download this video" for a Mux video (hub-leader courses).
	 *
	 * Saves as soon as it is ticked. Ticking it also asks Mux to make the MP4, which can
	 * take a few minutes; the leader's page shows a Download video button straight away
	 * and says so if the file is not ready yet. Never offered on the public watch page.
	 */
	import { apiPut } from '$lib/utils/api-handler.js';
	import { toastSuccess, toastWarning } from '$lib/utils/toast-helpers.js';

	let { material, onSaved = () => {} } = $props();

	let enabled = $state(!!material.leaderDownloadEnabled);
	let saving = $state(false);

	/** @param {Event & { currentTarget: HTMLInputElement }} event */
	async function toggle(event) {
		const input = event.currentTarget;
		const next = input.checked;
		saving = true;
		try {
			const result = await apiPut(
				'/api/courses/module-materials',
				{ id: material.id, leader_download_enabled: next },
				{
					loadingMessage: next ? 'Asking Mux to prepare the download...' : 'Saving...',
					successMessage: next ? 'Leaders can download this video' : 'Leaders can no longer download this video'
				}
			);
			enabled = next;
			onSaved(next);
			if (next && result?.download === 'preparing') {
				toastWarning('The download file is being prepared and may take a few minutes to be ready.');
			}
		} catch {
			// apiPut has already shown the error toast; put the box back
			input.checked = enabled;
		} finally {
			saving = false;
		}
	}
</script>

<div class="mt-3 max-w-2xl rounded-lg border border-gray-200 bg-gray-50 p-3">
	<label class="flex items-start gap-2 cursor-pointer">
		<input
			type="checkbox"
			checked={enabled}
			disabled={saving}
			onchange={toggle}
			class="mt-0.5 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
		/>
		<span>
			<span class="block text-sm font-semibold text-gray-800">Let leaders download this video</span>
			<span class="block text-xs text-gray-500">
				Signed-in leaders get a Download video button on their page (a 1080p file). Mux keeps a stored copy
				of the file, which adds to its storage charge. It is not offered on the public watch link.
			</span>
		</span>
	</label>
</div>

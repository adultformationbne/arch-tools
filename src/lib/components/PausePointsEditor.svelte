<script>
	/**
	 * Admin editor for a video's pause points (hub-leader courses only).
	 *
	 * The preview player runs the real pause behaviour against the unsaved list, so an
	 * admin can scrub to a moment, add a point there, and watch it play through.
	 */
	import MuxVideoPlayer from './MuxVideoPlayer.svelte';
	import { Plus, Trash2, Save } from '$lib/icons';
	import { apiPut } from '$lib/utils/api-handler.js';
	import { toastError } from '$lib/utils/toast-helpers.js';
	import {
		formatTimestamp,
		parseTimestamp,
		normalizePausePoints,
		MAX_PAUSE_POINTS,
		MAX_PROMPT_LENGTH
	} from '$lib/utils/pause-points';

	let { material, onSaved = () => {} } = $props();

	let player = $state(/** @type {any} */ (null));
	let saving = $state(false);

	/** @type {{ id: string, time: number, prompt: string }[]} */
	let points = $state(normalizePausePoints(material.pausePoints));
	let savedJson = $state(JSON.stringify(normalizePausePoints(material.pausePoints)));

	const dirty = $derived(JSON.stringify(points) !== savedJson);
	const atLimit = $derived(points.length >= MAX_PAUSE_POINTS);

	const sortPoints = () => {
		points = [...points].sort((a, b) => a.time - b.time);
	};

	const clampTime = (t) => {
		const max = Number.isFinite(player?.duration) ? player.duration : Infinity;
		return Math.round(Math.min(Math.max(0, t), max) * 10) / 10;
	};

	const addAtCurrentTime = () => {
		if (atLimit) return;
		const time = clampTime(player?.currentTime ?? 0);
		points = [...points, { id: crypto.randomUUID(), time, prompt: '' }];
		sortPoints();
	};

	const seekTo = (time) => {
		if (player) player.currentTime = time;
	};

	const setTime = (point, time) => {
		point.time = clampTime(time);
		sortPoints();
		seekTo(point.time);
	};

	const onTimeInput = (point, event) => {
		const parsed = parseTimestamp(event.currentTarget.value);
		if (parsed === null) {
			toastError('Enter a time like 1:15');
			event.currentTarget.value = formatTimestamp(point.time);
			return;
		}
		setTime(point, parsed);
	};

	const remove = (id) => {
		points = points.filter((p) => p.id !== id);
	};

	const save = async () => {
		saving = true;
		try {
			const clean = normalizePausePoints(points, player?.duration);
			await apiPut(
				'/api/courses/module-materials',
				{ id: material.id, pause_points: clean },
				{ successMessage: 'Pause points saved' }
			);
			points = clean;
			savedJson = JSON.stringify(clean);
			onSaved(clean);
		} catch {
			// apiPut has already shown the error toast
		} finally {
			saving = false;
		}
	};
</script>

<div class="space-y-4">
	<div class="max-w-2xl">
		<MuxVideoPlayer
			bind:player
			playbackId={material.mux_playback_id}
			title={material.title}
			status={material.mux_status}
			pausePoints={points}
		/>
	</div>

	<div class="max-w-2xl">
		<div class="flex items-center justify-between gap-3 mb-2">
			<div>
				<h4 class="text-sm font-semibold text-gray-700">Pause points</h4>
				<p class="text-xs text-gray-500">
					The video stops here and shows your prompt. Leaders can always skip past. With AirPlay or Cast the prompt shows only on the leader's device; screen mirroring shows it to the whole room.
				</p>
			</div>
			<button
				type="button"
				onclick={addAtCurrentTime}
				disabled={atLimit}
				class="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
			>
				<Plus size="14" />
				Add at current time
			</button>
		</div>

		{#if points.length === 0}
			<p class="text-sm text-gray-500 py-3">
				No pause points. Scrub the video to a moment, then add one.
			</p>
		{:else}
			<ul class="space-y-3">
				{#each points as point (point.id)}
					<li class="flex gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
						<button
							type="button"
							onclick={() => seekTo(point.time)}
							class="shrink-0 w-24 aspect-video rounded bg-black overflow-hidden"
							aria-label="Go to {formatTimestamp(point.time)}"
						>
							<img
								src="https://image.mux.com/{material.mux_playback_id}/thumbnail.jpg?time={point.time}&width=192"
								alt=""
								loading="lazy"
								class="w-full h-full object-cover"
							/>
						</button>

						<div class="flex-1 min-w-0 space-y-2">
							<div class="flex items-center gap-1.5">
								<input
									type="text"
									value={formatTimestamp(point.time)}
									onchange={(e) => onTimeInput(point, e)}
									aria-label="Time"
									class="w-20 px-2 py-1 text-sm font-mono border border-gray-300 rounded focus:ring-2 focus:ring-amber-500 focus:border-transparent"
								/>
								<button type="button" onclick={() => setTime(point, point.time - 1)} class="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white">−1s</button>
								<button type="button" onclick={() => setTime(point, point.time + 1)} class="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white">+1s</button>
								<button type="button" onclick={() => setTime(point, player?.currentTime ?? point.time)} class="px-2 py-1 text-xs border border-gray-300 rounded hover:bg-white">Use current time</button>
								<button
									type="button"
									onclick={() => remove(point.id)}
									class="ml-auto p-1.5 text-red-600 hover:bg-red-50 rounded"
									aria-label="Remove pause point"
								>
									<Trash2 size="16" />
								</button>
							</div>
							<textarea
								bind:value={point.prompt}
								rows="2"
								maxlength={MAX_PROMPT_LENGTH}
								placeholder="What should the group reflect on? (Leave blank for a simple pause.)"
								aria-label="Prompt"
								class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
							></textarea>
						</div>
					</li>
				{/each}
			</ul>
		{/if}

		{#if dirty}
			<div class="flex items-center gap-3 mt-3">
				<button
					type="button"
					onclick={save}
					disabled={saving}
					class="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-60"
				>
					<Save size="16" />
					{saving ? 'Saving…' : 'Save pause points'}
				</button>
				<span class="text-xs text-gray-500">Unsaved changes. Press play to preview them.</span>
			</div>
		{/if}
	</div>
</div>

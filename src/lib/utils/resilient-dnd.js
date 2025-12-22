/**
 * Resilient drag-and-drop wrapper
 *
 * Dynamically loads svelte-dnd-action and provides a no-op fallback if it fails.
 * This prevents the entire page from crashing if the DnD library breaks.
 *
 * Usage:
 *   import { getDndzone } from '$lib/utils/resilient-dnd.js';
 *   let dndzone = $state(null);
 *   onMount(async () => { dndzone = await getDndzone(); });
 *
 *   // In template, only apply if loaded:
 *   {#if dndzone}
 *     <div use:dndzone={{items}} ...>
 *   {:else}
 *     <div> <!-- static, no drag -->
 *   {/if}
 */

let cachedDndzone = null;
let loadAttempted = false;
let loadFailed = false;

/**
 * Get the dndzone action, loading it dynamically if needed.
 * Returns null if loading fails (graceful degradation).
 */
export async function getDndzone() {
	if (cachedDndzone) return cachedDndzone;
	if (loadFailed) return null;

	if (!loadAttempted) {
		loadAttempted = true;
		try {
			const module = await import('svelte-dnd-action');
			cachedDndzone = module.dndzone;
		} catch (err) {
			console.warn('svelte-dnd-action failed to load, drag-and-drop disabled:', err.message);
			loadFailed = true;
			return null;
		}
	}

	return cachedDndzone;
}

/**
 * Check if DnD loading failed (useful for showing UI hints)
 */
export function dndLoadFailed() {
	return loadFailed;
}

/**
 * No-op action for when DnD is unavailable
 */
export function noopDndzone(node, options) {
	return {
		update: () => {},
		destroy: () => {}
	};
}

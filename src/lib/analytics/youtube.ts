/**
 * Watch analytics for YouTube embeds. YouTube's IFrame API reports state changes but no
 * time updates or seeks, so this wraps it in something shaped like a media element
 * (currentTime / duration / paused + play, pause, ended, seeking, timeupdate events)
 * and hands that to the same trackVideo() the Mux player uses.
 *
 * Usage: <iframe use:trackYouTube={{ videoId, materialId }} src=".../embed/ID?enablejsapi=1">
 * The iframe must be created fresh per video (wrap it in {#key videoId}).
 */
import { trackVideo } from './tracker';

const API_URL = 'https://www.youtube.com/iframe_api';
/** How often the position is read while playing, like a media element's timeupdate */
const POLL_MS = 250;

// YouTube player states
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;

let apiReady: Promise<any> | null = null;

function loadApi(): Promise<any> {
	const w = window as any;
	if (w.YT?.Player) return Promise.resolve(w.YT);
	if (apiReady) return apiReady;
	apiReady = new Promise((resolve, reject) => {
		const previous = w.onYouTubeIframeAPIReady;
		w.onYouTubeIframeAPIReady = () => {
			previous?.();
			resolve(w.YT);
		};
		const script = document.createElement('script');
		script.src = API_URL;
		script.async = true;
		script.onerror = () => {
			apiReady = null;
			reject(new Error('YouTube API failed to load'));
		};
		document.head.append(script);
	});
	return apiReady;
}

/** A YouTube player presented as a minimal media element. */
class YouTubeMedia extends EventTarget {
	paused = true;
	private player: any = null;
	private poll: ReturnType<typeof setInterval> | null = null;
	private lastPos = 0;
	private lastAt = 0;

	attach(player: any) {
		this.player = player;
	}

	// The player's methods throw once its iframe has gone, which happens before cleanup
	get currentTime(): number {
		try {
			return this.player?.getCurrentTime?.() ?? 0;
		} catch {
			return this.lastPos;
		}
	}

	get duration(): number {
		try {
			return this.player?.getDuration?.() || NaN;
		} catch {
			return NaN;
		}
	}

	onState(state: number) {
		if (state === PLAYING && this.paused) {
			this.paused = false;
			this.dispatchEvent(new Event('play'));
			this.startPoll();
		} else if (state === PAUSED && !this.paused) {
			this.stopPoll();
			this.paused = true;
			this.dispatchEvent(new Event('pause'));
		} else if (state === ENDED) {
			this.stopPoll();
			const was = this.paused;
			this.paused = true;
			if (!was) this.dispatchEvent(new Event('pause'));
			this.dispatchEvent(new Event('ended'));
		}
		// Buffering and cued leave the playing state as it was
	}

	private startPoll() {
		this.stopPoll();
		this.lastPos = this.currentTime;
		this.lastAt = Date.now();
		this.poll = setInterval(() => {
			const pos = this.currentTime;
			const now = Date.now();
			// A jump the wall clock can't explain is the viewer scrubbing
			const expected = (now - this.lastAt) / 1000;
			if (Math.abs(pos - this.lastPos - expected) > 1.5) this.dispatchEvent(new Event('seeking'));
			this.lastPos = pos;
			this.lastAt = now;
			this.dispatchEvent(new Event('timeupdate'));
		}, POLL_MS);
	}

	private stopPoll() {
		if (this.poll) clearInterval(this.poll);
		this.poll = null;
	}

	destroy() {
		this.stopPoll();
	}
}

/** Svelte action: track watching of a YouTube embed. */
export function trackYouTube(iframe: HTMLIFrameElement, opts: { videoId: string; materialId?: string | null }) {
	let stop = () => {};
	let cancelled = false;
	const media = new YouTubeMedia();

	loadApi()
		.then((YT) => {
			if (cancelled) return;
			const player = new YT.Player(iframe, {
				events: {
					onReady: () => {
						if (cancelled) return;
						media.attach(player);
						stop = trackVideo(media as unknown as HTMLMediaElement, {
							playbackId: `youtube:${opts.videoId}`,
							materialId: opts.materialId ?? null
						});
					},
					onStateChange: (e: { data: number }) => media.onState(e.data)
				}
			});
		})
		.catch(() => {
			// Blocked by an extension or offline: the video still plays, just untracked
		});

	return {
		destroy() {
			cancelled = true;
			stop();
			media.destroy();
		}
	};
}

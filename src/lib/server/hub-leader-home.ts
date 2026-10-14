/**
 * Data for the home page of a hub-leader course (courses.settings.mode = 'hub_leader').
 *
 * A hub leader picks any session to view its materials, and sends the whole
 * Companion Guide (all sessions) to their own group.
 * Nothing here depends on the enrolment's role or current_session — every enrolled
 * leader sees every session — and nothing is written back, so there is no progress.
 */
import { CourseQueries, groupMaterialsBySession, type ResolvedEnrollment } from '$lib/server/course-data.js';
import { groupSessionsBySection } from '$lib/public-guides/sections';
import { platformSiteUrl } from '$lib/config/course-domains';
import { normalizePausePoints, type PausePoint } from '$lib/utils/pause-points';

export interface HubLeaderMaterial {
	id: string;
	type: 'mux_video' | 'link' | 'document';
	title: string;
	description: string | null;
	/** Link and document materials */
	url: string | null;
	/** mux_video materials */
	muxPlaybackId: string | null;
	muxStatus: string | null;
	/** mux_video materials: moments where the player stops and waits for play */
	pausePoints: PausePoint[];
	/** mux_video materials: the page a leader can send so one person can rewatch it; null when switched off */
	watchUrl: string | null;
	/** mux_video materials: leader-only endpoint that returns the MP4's address; null unless an admin allowed downloads */
	downloadUrl: string | null;
}

export interface HubLeaderSession {
	sessionNumber: number;
	title: string;
	description: string | null;
	sectionName: string | null;
	materials: HubLeaderMaterial[];
}

/** Material types the hub-leader home can show. Anything else is left out. */
const SUPPORTED_TYPES = new Set(['mux_video', 'link', 'document']);

export async function loadHubLeaderHome(
	enrollment: ResolvedEnrollment,
	course: { slug: string; name: string },
	publicPagesEnabled: boolean
) {
	const module = enrollment.cohort.module;

	const { data: sessions, error: sessionsError } = await CourseQueries.getSessions(module.id);
	if (sessionsError || !sessions) throw new Error('Failed to load sessions');

	const { data: materials, error: materialsError } = await CourseQueries.getMaterials(
		sessions.map((s) => s.id)
	);
	if (materialsError) throw new Error('Failed to load materials');
	const materialsBySession = groupMaterialsBySession(materials ?? []);

	const siteUrl = platformSiteUrl();

	const items: HubLeaderSession[] = sessions.map((s) => ({
		sessionNumber: s.session_number,
		title: s.title,
		description: s.description ?? null,
		sectionName: s.section_name ?? null,
		materials: (materialsBySession[s.session_number] ?? [])
			.filter((m) => SUPPORTED_TYPES.has(m.type))
			.map((m) => ({
				id: m.id,
				type: m.type,
				title: m.title,
				description: m.description ?? null,
				url: m.type === 'mux_video' ? null : (m.content ?? null),
				muxPlaybackId: m.mux_playback_id ?? null,
				muxStatus: m.mux_status ?? null,
				pausePoints: m.type === 'mux_video' ? normalizePausePoints(m.pause_points) : [],
				watchUrl:
					m.type === 'mux_video' && m.public_watch_enabled && m.mux_playback_id
						? `${siteUrl}/p/watch/${m.id}`
						: null,
				downloadUrl:
					m.type === 'mux_video' && m.leader_download_enabled && m.mux_asset_id
						? `/api/courses/${course.slug}/video-download/${m.id}`
						: null
			}))
	}));

	return {
		hubLeader: true as const,
		courseSlug: course.slug,
		moduleName: module.name as string,
		// Leaders always send the whole Companion Guide, never a single session
		guideUrl: publicPagesEnabled ? `${siteUrl}/p/${course.slug}/${module.order_number}` : null,
		groups: groupSessionsBySection(items)
	};
}

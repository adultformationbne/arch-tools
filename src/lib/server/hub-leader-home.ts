/**
 * Data for the home page of a hub-leader course (courses.settings.mode = 'hub_leader').
 *
 * A hub leader picks any session and shares its public guide with their own group.
 * Nothing here depends on the enrolment's role or current_session — every enrolled
 * leader sees every session — and nothing is written back, so there is no progress.
 */
import { CourseQueries, groupMaterialsBySession, type ResolvedEnrollment } from '$lib/server/course-data.js';
import { getGuidePdfLinks } from '$lib/server/guide-pdf-links.js';
import { groupSessionsBySection } from '$lib/public-guides/sections';
import { platformSiteUrl } from '$lib/config/course-domains';

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
}

export interface HubLeaderSession {
	sessionNumber: number;
	title: string;
	description: string | null;
	sectionName: string | null;
	materials: HubLeaderMaterial[];
	/** Public guide page to send to the group; null when the course has no public pages */
	guideUrl: string | null;
	pdfUrl: string | null;
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

	const pdfLinks = publicPagesEnabled
		? await getGuidePdfLinks(
				{ slug: course.slug, name: course.name },
				{ orderNumber: module.order_number, name: module.name }
			)
		: { guide: null, sessions: {} as Record<number, string> };

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
				muxStatus: m.mux_status ?? null
			})),
		guideUrl:
			publicPagesEnabled && s.public_page_content
				? `${siteUrl}/p/${course.slug}/${module.order_number}/${s.session_number}`
				: null,
		pdfUrl: pdfLinks.sessions[s.session_number] ?? null
	}));

	return {
		hubLeader: true as const,
		courseSlug: course.slug,
		moduleName: module.name as string,
		guideUrl: publicPagesEnabled ? `${siteUrl}/p/${course.slug}/${module.order_number}` : null,
		guidePdfUrl: pdfLinks.guide,
		groups: groupSessionsBySection(items)
	};
}

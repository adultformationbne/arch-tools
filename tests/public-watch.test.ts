import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { testHelpers } from './helpers.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { CourseMutations, CourseQueries } from '$lib/server/course-data.js';
import { loadHubLeaderHome } from '$lib/server/hub-leader-home.js';
import { load } from '../src/routes/p/watch/[id]/+page.server';

/**
 * Public watch links. A leader sends one person the link to a single session video so
 * they can rewatch it. The page must exist only for a video an admin switched on, show
 * that video and a link to the Companion Guide, and give no way to reach anything else.
 */

const PLAYBACK = 'test-playback-id';

type LoadEvent = Parameters<typeof load>[0];
const run = (id: string) => {
	const setHeaders = vi.fn();
	return { setHeaders, result: load({ params: { id }, setHeaders } as unknown as LoadEvent) };
};
const expect404 = async (id: string) => {
	await expect(run(id).result).rejects.toMatchObject({ status: 404 });
};

describe('Public watch page', () => {
	let course: any;
	let module: any;
	let session: any;
	let video: any;

	beforeAll(async () => {
		course = await testHelpers.createCourse({ name: 'Watch Test Course' });
		module = await testHelpers.createModule(course.id, { name: 'Watch Test Module' });
		[session] = await testHelpers.createSessions(module.id, 1);
		video = await testHelpers.createMaterial(session.id, { type: 'mux_video', title: 'Session video' });
		await supabaseAdmin
			.from('courses_materials')
			.update({ mux_playback_id: PLAYBACK, mux_status: 'ready' })
			.eq('id', video.id);
	});

	afterAll(async () => {
		await testHelpers.cleanup();
	});

	it('is off for every video until an admin switches it on', async () => {
		const { data } = await supabaseAdmin.from('courses_materials').select('public_watch_enabled').eq('id', video.id).single();
		expect(data?.public_watch_enabled).toBe(false);
		await expect404(video.id);
	});

	it('opens for a video that has been switched on, with only that video and the guide link', async () => {
		await CourseMutations.updateMaterial(video.id, { publicWatchEnabled: true });
		const { result, setHeaders } = run(video.id);
		const data = await result;

		expect(data.video).toEqual({ title: 'Session video', playbackId: PLAYBACK, status: 'ready' });
		expect(data.session).toMatchObject({ number: 1, title: 'Session 1' });
		expect(data.course).toEqual({ slug: course.slug, name: 'Watch Test Course' });
		// Nothing that would let a viewer reach another video or session
		expect(Object.keys(data).sort()).toEqual(['course', 'guideUrl', 'session', 'video']);
		// Unlisted
		expect(setHeaders).toHaveBeenCalledWith(expect.objectContaining({ 'X-Robots-Tag': 'noindex, nofollow' }));
	});

	it('links to the whole Companion Guide only when the course has public pages', async () => {
		expect((await run(video.id).result).guideUrl).toBeNull();

		await supabaseAdmin
			.from('courses')
			.update({ settings: { features: { publicPagesEnabled: true } } })
			.eq('id', course.id);

		expect((await run(video.id).result).guideUrl).toBe(`/p/${course.slug}/${module.order_number}`);
	});

	it('turning it off closes the link again', async () => {
		await CourseMutations.updateMaterial(video.id, { publicWatchEnabled: false });
		await expect404(video.id);
		await CourseMutations.updateMaterial(video.id, { publicWatchEnabled: true });
		await expect((run(video.id).result)).resolves.toBeTruthy();
	});

	it('does not touch the setting when a material is edited without it', async () => {
		await CourseMutations.updateMaterial(video.id, { title: 'Renamed' });
		const { data } = await supabaseAdmin.from('courses_materials').select('public_watch_enabled, title').eq('id', video.id).single();
		expect(data).toEqual({ public_watch_enabled: true, title: 'Renamed' });
	});

	it('is not available for a material that is not a Mux video, even if flagged', async () => {
		const link = await testHelpers.createMaterial(session.id, { type: 'link', title: 'A link', content: 'https://example.com' });
		await supabaseAdmin.from('courses_materials').update({ public_watch_enabled: true }).eq('id', link.id);
		await expect404(link.id);
	});

	it('says only "not found" for anything that is not a switched-on video', async () => {
		await expect404('not-a-uuid');
		await expect404('00000000-0000-4000-8000-000000000000');
		await expect404("' or 1=1 --");
	});

	it('shows a leader the link to copy only for videos switched on', async () => {
		const user = await testHelpers.createUser();
		const cohort = await testHelpers.createCohort(module.id, { current_session: 0 });
		await testHelpers.createEnrollment(user.id, cohort.id, { role: 'student', status: 'active' });

		const { data: enrollment } = await CourseQueries.getEnrollment(user.id, course.slug);
		expect(enrollment).toBeTruthy();

		const home = await loadHubLeaderHome(enrollment!, { slug: course.slug, name: course.name }, true);
		const videoItem = home.groups.flatMap((g) => g.items).flatMap((s) => s.materials).find((m) => m.id === video.id);
		expect(videoItem?.watchUrl).toMatch(new RegExp(`/p/watch/${video.id}$`));

		await CourseMutations.updateMaterial(video.id, { publicWatchEnabled: false });
		const off = await loadHubLeaderHome(enrollment!, { slug: course.slug, name: course.name }, true);
		const offItem = off.groups.flatMap((g) => g.items).flatMap((s) => s.materials).find((m) => m.id === video.id);
		expect(offItem?.watchUrl).toBeNull();
	});
});

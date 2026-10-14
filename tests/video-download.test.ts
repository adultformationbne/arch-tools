import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';

// Only the call out to Mux is replaced; everything else in the module is the real code.
vi.mock('$lib/server/mux-download', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/mux-download')>();
	return { ...actual, ensureDownloadRendition: vi.fn() };
});

import { testHelpers } from './helpers.js';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { CourseMutations, CourseQueries } from '$lib/server/course-data.js';
import { loadHubLeaderHome } from '$lib/server/hub-leader-home.js';
import * as download from '$lib/server/mux-download';
import { GET } from '../src/routes/api/courses/[slug]/video-download/[materialId]/+server';

/**
 * Leaders can download a video once an admin allows it. Mux has to make the MP4 first,
 * so the pieces are: the rules for picking and requesting a file, an endpoint that
 * only signed-in leaders of the right course can use, and the button's address.
 */

describe('Choosing and requesting the download file', () => {
	const { chooseResolution, readyDownloadFile } = download;
	const actual = vi.importActual<typeof import('$lib/server/mux-download')>('$lib/server/mux-download');

	it('asks for 1080p only when the source can make one', () => {
		expect(chooseResolution({ max_stored_resolution: 'UHD' })).toBe('1080p');
		expect(chooseResolution({ max_stored_resolution: 'FHD' })).toBe('1080p');
		expect(chooseResolution({ max_stored_resolution: 'HD' })).toBe('highest');
		expect(chooseResolution({ max_stored_resolution: 'SD' })).toBe('highest');
		expect(chooseResolution({})).toBe('highest');
	});

	it('picks a finished MP4, preferring 1080p so a 4K file is not served by accident', () => {
		const files = (list: Array<[string, string]>) => ({
			static_renditions: { files: list.map(([name, status]) => ({ name, status })) }
		});
		expect(readyDownloadFile(files([['2160p.mp4', 'ready'], ['1080p.mp4', 'ready']]))).toBe('1080p.mp4');
		expect(readyDownloadFile(files([['highest.mp4', 'ready']]))).toBe('highest.mp4');
		// not finished, not an MP4, or nothing at all
		expect(readyDownloadFile(files([['1080p.mp4', 'preparing']]))).toBeNull();
		expect(readyDownloadFile(files([['audio.m4a', 'ready']]))).toBeNull();
		expect(readyDownloadFile({})).toBeNull();
	});

	describe('ensureDownloadRendition', () => {
		const make = (asset: any) => {
			const api = { retrieve: vi.fn().mockResolvedValue(asset), createStaticRendition: vi.fn().mockResolvedValue({}) };
			return api;
		};
		let ensure: typeof download.ensureDownloadRendition;
		beforeAll(async () => {
			ensure = (await actual).ensureDownloadRendition;
		});

		it('refuses a video that is not ready', async () => {
			const api = make({ status: 'preparing' });
			await expect(ensure('a', api)).rejects.toThrow(/not ready/i);
			expect(api.createStaticRendition).not.toHaveBeenCalled();
		});

		it('asks Mux for the file when there is none, and says it is being prepared', async () => {
			const api = make({ status: 'ready', max_stored_resolution: 'UHD' });
			await expect(ensure('a', api)).resolves.toEqual({ state: 'preparing' });
			expect(api.createStaticRendition).toHaveBeenCalledWith('a', { resolution: '1080p' });
		});

		it('does not ask twice while Mux is still making it', async () => {
			const api = make({ status: 'ready', static_renditions: { files: [{ name: '1080p.mp4', status: 'preparing' }] } });
			await expect(ensure('a', api)).resolves.toEqual({ state: 'preparing' });
			expect(api.createStaticRendition).not.toHaveBeenCalled();
		});

		it('returns the file name Mux reports once it is ready', async () => {
			const api = make({ status: 'ready', static_renditions: { files: [{ name: '1080p.mp4', status: 'ready' }] } });
			await expect(ensure('a', api)).resolves.toEqual({ state: 'ready', fileName: '1080p.mp4' });
			expect(api.createStaticRendition).not.toHaveBeenCalled();
		});

		it('says so when Mux could not make a file, rather than asking again', async () => {
			const api = make({ status: 'ready', static_renditions: { files: [{ name: '1080p.mp4', status: 'errored' }] } });
			await expect(ensure('a', api)).rejects.toThrow(/could not make/i);
			expect(api.createStaticRendition).not.toHaveBeenCalled();
		});
	});

	it('names the saved file after the session, safely and without an extension', () => {
		expect(download.downloadSaveName({ courseName: 'A Living Union', sessionNumber: 1, title: 'Jesus Reveals Your Value' })).toBe(
			'A Living Union - Session 1 - Jesus Reveals Your Value'
		);
		expect(download.downloadSaveName({ courseName: 'A/B', sessionNumber: 0, title: 'What: is "this"?' })).toBe('A B - Start - What is this');
		expect(download.muxDownloadUrl('PB', '1080p.mp4', 'A Living Union - Session 1')).toBe(
			'https://stream.mux.com/PB/1080p.mp4?download=A%20Living%20Union%20-%20Session%201'
		);
	});
});

describe('Leader download endpoint', () => {
	let courseA: any, courseB: any, moduleA: any, sessionA: any, video: any, leader: any;
	const ensure = download.ensureDownloadRendition as unknown as ReturnType<typeof vi.fn>;

	const eventFor = (slug: string, materialId: string, user: any | null) =>
		({
			params: { slug, materialId },
			locals: { safeGetSession: async () => (user ? { session: { user }, user } : { session: null, user: null }) },
			cookies: { get: () => undefined, delete: () => {}, set: () => {} },
			url: new URL(`http://localhost/api/courses/${slug}/video-download/${materialId}`),
			request: new Request('http://localhost')
		}) as any;

	beforeAll(async () => {
		courseA = await testHelpers.createCourse({ name: 'Download Test Course' });
		courseB = await testHelpers.createCourse({ name: 'Other Course' });
		moduleA = await testHelpers.createModule(courseA.id);
		const moduleB = await testHelpers.createModule(courseB.id);
		[sessionA] = await testHelpers.createSessions(moduleA.id, 1);
		video = await testHelpers.createMaterial(sessionA.id, { type: 'mux_video', title: 'Session video' });
		await supabaseAdmin
			.from('courses_materials')
			.update({ mux_asset_id: 'asset-1', mux_playback_id: 'PLAYBACK1', mux_status: 'ready' })
			.eq('id', video.id);

		leader = await testHelpers.createUser();
		const cohortA = await testHelpers.createCohort(moduleA.id, { current_session: 0 });
		const cohortB = await testHelpers.createCohort(moduleB.id, { current_session: 0 });
		await testHelpers.createEnrollment(leader.id, cohortA.id, { role: 'student', status: 'active' });
		void cohortB;
	});

	// (a block body: returning the mock would make vitest call it as a cleanup step)
	beforeEach(() => {
		ensure.mockReset();
	});

	afterAll(async () => {
		await testHelpers.cleanup();
	});

	it('is closed until an admin allows downloads for the video', async () => {
		await expect(GET(eventFor(courseA.slug, video.id, leader))).rejects.toMatchObject({ status: 404 });
		expect(ensure).not.toHaveBeenCalled();
	});

	it('gives a leader of the course the file address once Mux has made it', async () => {
		await CourseMutations.updateMaterial(video.id, { leaderDownloadEnabled: true });
		ensure.mockResolvedValue({ state: 'ready', fileName: '1080p.mp4' });

		const response = await GET(eventFor(courseA.slug, video.id, leader));
		const body = await response.json();
		expect(body.state).toBe('ready');
		expect(body.url).toBe(
			'https://stream.mux.com/PLAYBACK1/1080p.mp4?download=' + encodeURIComponent('Download Test Course - Session 1 - Session 1')
		);
		expect(response.headers.get('cache-control')).toContain('no-store');
	});

	it('says the file is still being prepared rather than failing', async () => {
		ensure.mockResolvedValue({ state: 'preparing' });
		const body = await (await GET(eventFor(courseA.slug, video.id, leader))).json();
		expect(body).toEqual({ state: 'preparing' });
	});

	it('turns away someone who is not signed in', async () => {
		await expect(GET(eventFor(courseA.slug, video.id, null))).rejects.toMatchObject({ status: 401 });
		expect(ensure).not.toHaveBeenCalled();
	});

	it('turns away a signed-in person who is not part of the course', async () => {
		const stranger = await testHelpers.createUser();
		await expect(GET(eventFor(courseA.slug, video.id, stranger))).rejects.toBeTruthy();
		expect(ensure).not.toHaveBeenCalled();
	});

	it("will not serve a video through a different course's address", async () => {
		const memberOfB = await testHelpers.createUser();
		const { data: moduleB } = await supabaseAdmin.from('courses_modules').select('id').eq('course_id', courseB.id).single();
		const cohort = await testHelpers.createCohort(moduleB!.id, { current_session: 0 });
		await testHelpers.createEnrollment(memberOfB.id, cohort.id, { role: 'student', status: 'active' });

		await expect(GET(eventFor(courseB.slug, video.id, memberOfB))).rejects.toMatchObject({ status: 404 });
		expect(ensure).not.toHaveBeenCalled();
	});

	it("reports Mux trouble as 'not available', without leaking the cause", async () => {
		// Fails only when called, as the real call would
		ensure.mockImplementation(async () => {
			throw new Error('Mux said something internal');
		});
		await expect(GET(eventFor(courseA.slug, video.id, leader))).rejects.toMatchObject({ status: 502 });
	});

	it("gives the leader's page the endpoint to call only for videos allowed", async () => {
		const { data: enrollment } = await CourseQueries.getEnrollment(leader.id, courseA.slug);
		const find = async () => {
			const home = await loadHubLeaderHome(enrollment!, { slug: courseA.slug, name: courseA.name }, true);
			return home.groups.flatMap((g) => g.items).flatMap((s) => s.materials).find((m) => m.id === video.id);
		};
		expect((await find())?.downloadUrl).toBe(`/api/courses/${courseA.slug}/video-download/${video.id}`);

		await CourseMutations.updateMaterial(video.id, { leaderDownloadEnabled: false });
		expect((await find())?.downloadUrl).toBeNull();
	});
});

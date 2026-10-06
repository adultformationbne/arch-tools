import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { env } from '$env/dynamic/private';
import { supabaseAdmin } from '$lib/server/supabase.js';
import { getCourseSettings } from '$lib/types/course-settings.js';
import { loadPublicGuide, type PublicGuide } from '$lib/server/public-guide.js';
import { GUIDE_PDF_BUCKET, folderFor, listStoredGuidePdfs } from '$lib/server/guide-pdf-links.js';

// PDFs of the public guide pages. A daily cron renders the print page with headless
// Chromium and stores the result in Supabase Storage; the public pages just link to
// the stored file. Each filename carries a hash of what went into it, so the cron
// only re-renders what changed and the browser never serves a stale cached copy.

/** Bump when the print layout changes, so every PDF is rebuilt on the next run. */
const TEMPLATE_VERSION = 1;

// Must match the installed @sparticuz/chromium-min version (and puppeteer-core's Chrome).
// The binary is fetched when the cron runs rather than shipped inside the function.
const CHROMIUM_PACK_URL =
	'https://github.com/Sparticuz/chromium/releases/download/v153.0.0/chromium-v153.0.0-pack.x64.tar';

const LOCAL_CHROME_PATHS = [
	'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	'/usr/bin/google-chrome',
	'/usr/bin/chromium'
];

interface PdfTarget {
	/** 'guide' for the whole module, 'session-3' for one session */
	key: string;
	sessionNumber: number | null;
	fileName: string;
}

const hashOf = (value: unknown) =>
	createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 12);

function targetsFor(guide: PublicGuide): PdfTarget[] {
	const base = { v: TEMPLATE_VERSION, course: guide.course.name, module: guide.module.name };
	const targets: PdfTarget[] = [];

	if (guide.module.blocks.length > 0 || guide.sessions.length > 0) {
		const hash = hashOf({ ...base, description: guide.module.description, blocks: guide.module.blocks, sessions: guide.sessions });
		targets.push({ key: 'guide', sessionNumber: null, fileName: `guide-${hash}.pdf` });
	}
	for (const session of guide.sessions) {
		const key = `session-${session.sessionNumber}`;
		targets.push({ key, sessionNumber: session.sessionNumber, fileName: `${key}-${hashOf({ ...base, session })}.pdf` });
	}
	return targets;
}

async function launchBrowser() {
	const { default: puppeteer } = await import('puppeteer-core');

	if (env.VERCEL) {
		const { default: chromium } = await import('@sparticuz/chromium-min');
		return puppeteer.launch({
			args: chromium.args,
			executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
			headless: true
		});
	}

	// Local development: use an installed Chrome
	const executablePath = env.CHROME_EXECUTABLE_PATH || LOCAL_CHROME_PATHS.find(p => existsSync(p));
	if (!executablePath) throw new Error('No local Chrome found — set CHROME_EXECUTABLE_PATH');
	return puppeteer.launch({ executablePath, headless: true });
}

const escapeHtml = (text: string) =>
	text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface GuidePdfRunResult {
	built: string[];
	removed: string[];
	unchanged: number;
	errors: string[];
}

/**
 * Bring the stored PDFs in line with the current public page content for every
 * course that has public pages switched on. `origin` is this deployment's own URL,
 * which Chromium loads the print pages from.
 */
export async function rebuildGuidePdfs(origin: string): Promise<GuidePdfRunResult> {
	const result: GuidePdfRunResult = { built: [], removed: [], unchanged: 0, errors: [] };

	const { data: courses, error } = await supabaseAdmin.from('courses').select('id, slug, settings');
	if (error) throw new Error(`Could not load courses: ${error.message}`);

	const publicCourses = (courses ?? []).filter(c => getCourseSettings(c.settings).features?.publicPagesEnabled);
	if (publicCourses.length === 0) return result;

	const { data: modules, error: modulesError } = await supabaseAdmin
		.from('courses_modules')
		.select('course_id, order_number')
		.in('course_id', publicCourses.map(c => c.id));
	if (modulesError) throw new Error(`Could not load modules: ${modulesError.message}`);

	// Work out what is missing before paying for a browser launch
	const jobs: { folder: string; printUrl: string; footerLabel: string; target: PdfTarget }[] = [];
	const stale: string[] = [];

	for (const mod of modules ?? []) {
		const course = publicCourses.find(c => c.id === mod.course_id)!;
		try {
			const guide = await loadPublicGuide(course.slug, mod.order_number);
			if (!guide) continue;

			const folder = folderFor(course.slug, mod.order_number);
			const targets = targetsFor(guide);
			const wanted = new Set(targets.map(t => t.fileName));
			const stored = await listStoredGuidePdfs(folder);
			const have = new Set(stored.map(f => f.name));

			for (const file of stored) if (!wanted.has(file.name)) stale.push(`${folder}/${file.name}`);
			for (const target of targets) {
				if (have.has(target.fileName)) {
					result.unchanged++;
					continue;
				}
				const query = target.sessionNumber === null ? '' : `?session=${target.sessionNumber}`;
				jobs.push({
					folder,
					printUrl: `${origin}/p/${course.slug}/${mod.order_number}/print${query}`,
					footerLabel: guide.module.name,
					target
				});
			}
		} catch (err) {
			result.errors.push(`${course.slug}/${mod.order_number}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	if (jobs.length > 0) {
		const browser = await launchBrowser();
		try {
			for (const job of jobs) {
				const path = `${job.folder}/${job.target.fileName}`;
				const page = await browser.newPage();
				try {
					const response = await page.goto(job.printUrl, { waitUntil: 'networkidle0', timeout: 45_000 });
					if (!response?.ok()) throw new Error(`print page returned ${response?.status() ?? 'no response'}`);
					await page.evaluate(() => document.fonts.ready.then(() => undefined));

					const pdf = await page.pdf({
						format: 'A4',
						printBackground: true,
						displayHeaderFooter: true,
						headerTemplate: '<span></span>',
						footerTemplate: `<div style="width:100%; padding:0 18mm; font-family:Helvetica,Arial,sans-serif; font-size:8px; color:#a8a29e; display:flex; justify-content:space-between;"><span>${escapeHtml(job.footerLabel)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
						margin: { top: '18mm', bottom: '20mm', left: '18mm', right: '18mm' }
					});

					const { error: uploadError } = await supabaseAdmin.storage.from(GUIDE_PDF_BUCKET).upload(path, Buffer.from(pdf), {
						contentType: 'application/pdf',
						cacheControl: '31536000', // filename includes a content hash
						upsert: true
					});
					if (uploadError) throw new Error(uploadError.message);
					result.built.push(path);
				} catch (err) {
					result.errors.push(`${path}: ${err instanceof Error ? err.message : String(err)}`);
				} finally {
					await page.close();
				}
			}
		} finally {
			await browser.close();
		}
	}

	// Drop superseded files only once their replacement exists, so a failed render
	// leaves yesterday's PDF downloadable
	const failedFolders = new Set(result.errors.map(e => e.slice(0, e.lastIndexOf('/'))));
	const removable = stale.filter(p => !failedFolders.has(p.slice(0, p.lastIndexOf('/'))));
	if (removable.length > 0) {
		const { error: removeError } = await supabaseAdmin.storage.from(GUIDE_PDF_BUCKET).remove(removable);
		if (removeError) result.errors.push(`cleanup: ${removeError.message}`);
		else result.removed.push(...removable);
	}

	return result;
}

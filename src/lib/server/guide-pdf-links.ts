import { supabaseAdmin } from '$lib/server/supabase.js';

// Reading side of the guide PDFs: finds what the daily build has stored and hands
// the public pages their download links. Kept apart from guide-pdf.ts so the pages
// never pull the headless browser into their own server bundle.

export const GUIDE_PDF_BUCKET = 'public-assets';

export interface GuidePdfLinks {
	guide: string | null;
	sessions: Record<number, string>;
}

export const folderFor = (courseSlug: string, moduleOrder: number) => `course-guides/${courseSlug}/${moduleOrder}`;

const slugify = (text: string) =>
	text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** 'session-3-abc123.pdf' → 'session-3' */
const keyOfFile = (fileName: string) => fileName.replace(/-[0-9a-f]{12}\.pdf$/, '');

export async function listStoredGuidePdfs(folder: string) {
	const { data, error } = await supabaseAdmin.storage.from(GUIDE_PDF_BUCKET).list(folder, { limit: 200 });
	if (error) throw new Error(`Could not list ${folder}: ${error.message}`);
	return (data ?? []).filter(f => f.name.endsWith('.pdf'));
}

/** Download links for whatever PDFs have been built so far (empty until the first cron run). */
export async function getGuidePdfLinks(
	course: { slug: string; name: string },
	module: { orderNumber: number; name: string }
): Promise<GuidePdfLinks> {
	const links: GuidePdfLinks = { guide: null, sessions: {} };
	const folder = folderFor(course.slug, module.orderNumber);

	let files;
	try {
		files = await listStoredGuidePdfs(folder);
	} catch (err) {
		console.error('Guide PDF lookup failed:', err);
		return links;
	}

	// Newest first, in case an old file is still waiting to be cleaned up
	files.sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));

	const urlFor = (fileName: string, downloadName: string) => {
		const { data } = supabaseAdmin.storage.from(GUIDE_PDF_BUCKET).getPublicUrl(`${folder}/${fileName}`, { download: `${downloadName}.pdf` });
		return data.publicUrl;
	};

	const base = slugify(module.name) || course.slug;
	for (const file of files) {
		const key = keyOfFile(file.name);
		if (key === 'guide') {
			links.guide ??= urlFor(file.name, `${base}-companion-guide`);
		} else {
			const n = Number(key.replace('session-', ''));
			if (!Number.isNaN(n)) links.sessions[n] ??= urlFor(file.name, `${base}-${n === 0 ? 'pre-start' : `session-${n}`}`);
		}
	}
	return links;
}

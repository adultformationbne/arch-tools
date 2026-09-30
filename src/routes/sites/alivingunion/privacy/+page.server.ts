import { redirect } from '@sveltejs/kit';
import { SITE } from '../site';
import type { PageServerLoad } from './$types';

// The site uses the Archdiocesan Ministries privacy policy; keep /privacy working for old links
export const load: PageServerLoad = () => {
	throw redirect(308, SITE.privacyUrl);
};

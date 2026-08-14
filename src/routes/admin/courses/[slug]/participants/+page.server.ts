import { redirect } from '@sveltejs/kit';

export const load = async ({ params, url }) => {
	throw redirect(301, `/admin/courses/${params.slug}/directory${url.search}`);
};

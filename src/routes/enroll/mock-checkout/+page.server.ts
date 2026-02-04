import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isStripeMockMode } from '$lib/server/stripe';

export const load: PageServerLoad = async ({ url }) => {
	// Only allow mock checkout in mock mode
	if (!isStripeMockMode()) {
		throw error(404, 'Not found');
	}

	const dataParam = url.searchParams.get('data');
	if (!dataParam) {
		throw error(400, 'Missing checkout data');
	}

	try {
		const data = JSON.parse(Buffer.from(dataParam, 'base64url').toString());

		return {
			sessionId: data.sessionId,
			amount: data.amount,
			currency: data.currency,
			email: data.email,
			metadata: data.metadata,
			successUrl: data.successUrl,
			cancelUrl: data.cancelUrl
		};
	} catch {
		throw error(400, 'Invalid checkout data');
	}
};

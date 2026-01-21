import { publishDGRToWordPress } from '$lib/server/dgr-publisher.js';

export async function POST({ request }) {
	try {
		const data = await request.json();

		const result = await publishDGRToWordPress({
			date: data.date,
			liturgicalDate: data.liturgicalDate,
			readings: data.readings,
			readingsArray: data.readingsArray,
			title: data.title,
			gospelQuote: data.gospelQuote,
			reflectionText: data.reflectionText,
			authorName: data.authorName,
			templateKey: data.templateKey,
			gospelFullText: data.gospelFullText,
			gospelReference: data.gospelReference
		});

		if (!result.success) {
			return new Response(
				JSON.stringify({
					success: false,
					error: result.error
				}),
				{
					status: 500,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		return new Response(JSON.stringify(result), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	} catch (error) {
		console.error('DGR Publish Error:', error);

		return new Response(
			JSON.stringify({
				success: false,
				error: error.message
			}),
			{
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

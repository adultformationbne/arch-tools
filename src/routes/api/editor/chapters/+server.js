import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Initialize Supabase client
const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

// GET /api/editor/chapters - Get all chapters with block counts
export async function GET() {
	try {
		// Get all chapters
		const { data: chapters, error: chaptersError } = await supabase
			.from('editor_chapters')
			.select(
				`
                id,
                chapter_number,
                title,
                block_id,
                created_at
            `
			)
			.order('chapter_number', { ascending: true });

		if (chaptersError) {
			throw chaptersError;
		}

		// Get block counts for each chapter
		const chaptersWithCounts = await Promise.all(
			chapters.map(async (chapter) => {
				const { count, error: countError } = await supabase
					.from('editor_blocks')
					.select('*', { count: 'exact', head: true })
					.eq('chapter_id', chapter.id);

				if (countError) {
					console.error(`Error counting blocks for chapter ${chapter.id}:`, countError);
				}

				return {
					id: chapter.id,
					number: chapter.chapter_number,
					title: chapter.title,
					blockId: chapter.block_id,
					blockCount: count || 0,
					createdAt: chapter.created_at
				};
			})
		);

		return json({
			success: true,
			chapters: chaptersWithCounts
		});
	} catch (error) {
		console.error('Error loading chapters:', error);
		return json(
			{
				success: false,
				error: error.message || 'Failed to load chapters'
			},
			{ status: 500 }
		);
	}
}

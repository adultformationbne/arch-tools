import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';
import { processBlockContent, validateHtmlContent } from '$lib/server/content-utils.js';

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

// POST /api/editor/blocks - Create or update a block (creates new version)
export async function POST({ request, locals }) {
	try {
		const data = await request.json();

		// Get user session safely
		const { user } = await locals.safeGetSession();

		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		const { block_id, content, tag, metadata, chapter_id } = data;

		if (!block_id || !content || !tag) {
			return json(
				{
					success: false,
					error: 'Missing required fields: block_id, content, tag'
				},
				{ status: 400 }
			);
		}

		// Validate and process HTML content
		const validation = validateHtmlContent(content);
		if (!validation.isValid) {
			return json(
				{
					success: false,
					error: `Invalid content: ${validation.errors.join(', ')}`
				},
				{ status: 400 }
			);
		}

		// Process content for storage
		const processedContent = processBlockContent(content);

		// Create new block version with processed content
		const { data: newBlock, error: insertError } = await supabase
			.from('editor_blocks')
			.insert({
				block_id,
				content: processedContent.html_content,
				tag,
				metadata: metadata || null,
				chapter_id: chapter_id || null,
				created_by: user.id
			})
			.select()
			.single();

		if (insertError) {
			throw insertError;
		}

		// Log the block creation/update
		const { data: existingBlocks } = await supabase
			.from('editor_blocks')
			.select('id')
			.eq('block_id', block_id)
			.neq('id', newBlock.id);

		const isUpdate = existingBlocks && existingBlocks.length > 0;

		await supabase.from('editor_logs').insert({
			action_type: isUpdate ? 'block_updated' : 'block_created',
			entity_type: 'block',
			entity_id: newBlock.id,
			block_id: block_id,
			changes: {
				content_length: processedContent.html_content.length,
				plain_text_length: processedContent.plain_content.length,
				word_count: processedContent.metrics.word_count,
				has_formatting: processedContent.metrics.has_formatting,
				format_types: processedContent.metrics.format_types,
				tag,
				metadata: metadata || [],
				chapter_id,
				is_new_version: isUpdate
			},
			user_id: user.id
		});

		return json({
			success: true,
			id: newBlock.id,
			block_id: newBlock.block_id,
			content: newBlock.content,
			tag: newBlock.tag,
			metadata: newBlock.metadata,
			createdAt: newBlock.created_at
		});
	} catch (error) {
		console.error('Error saving block:', error);
		return json(
			{
				success: false,
				error: error.message || 'Failed to save block'
			},
			{ status: 500 }
		);
	}
}

// GET /api/editor/blocks?block_id=xxx - Get all versions of a block
export async function GET({ url }) {
	try {
		const blockId = url.searchParams.get('block_id');
		const latest = url.searchParams.get('latest') === 'true';

		if (!blockId) {
			return json(
				{
					success: false,
					error: 'block_id parameter required'
				},
				{ status: 400 }
			);
		}

		let query = supabase
			.from('editor_blocks')
			.select(
				`
                id,
                block_id,
                content,
                tag,
                metadata,
                created_at,
                created_by,
                editor_chapters(id, title, chapter_number)
            `
			)
			.eq('block_id', blockId)
			.order('created_at', { ascending: false });

		if (latest) {
			query = query.limit(1);
		}

		const { data: blocks, error } = await query;

		if (error) {
			throw error;
		}

		if (latest && blocks.length > 0) {
			const block = blocks[0];
			return json({
				id: block.block_id,
				content: block.content,
				tag: block.tag,
				metadata: block.metadata || [],
				createdAt: block.created_at,
				chapter: block.editor_chapters
					? {
							id: block.editor_chapters.id,
							title: block.editor_chapters.title,
							number: block.editor_chapters.chapter_number
						}
					: null
			});
		}

		return json({
			success: true,
			blocks: blocks.map((block) => ({
				id: block.id,
				block_id: block.block_id,
				content: block.content,
				tag: block.tag,
				metadata: block.metadata || [],
				created_at: block.created_at,
				created_by: block.created_by,
				chapter: block.editor_chapters
					? {
							id: block.editor_chapters.id,
							title: block.editor_chapters.title,
							number: block.editor_chapters.chapter_number
						}
					: null
			}))
		});
	} catch (error) {
		console.error('Error loading block versions:', error);
		return json(
			{
				success: false,
				error: error.message || 'Failed to load block versions'
			},
			{ status: 500 }
		);
	}
}

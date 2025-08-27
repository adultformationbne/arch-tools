import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client with service role key
export const supabaseAdmin = createClient(
	process.env.PUBLIC_SUPABASE_URL,
	process.env.SUPABASE_SERVICE_ROLE_KEY,
	{
		auth: {
			autoRefreshToken: false,
			persistSession: false
		}
	}
);

// Get the latest version of a block
export async function getLatestBlock(blockId) {
	const { data, error } = await supabaseAdmin
		.from('blocks')
		.select(
			`
            id,
            block_id,
            content,
            tag,
            metadata,
            created_at,
            chapters(id, title, chapter_number)
        `
		)
		.eq('block_id', blockId)
		.order('created_at', { ascending: false })
		.limit(1)
		.single();

	if (error) throw error;
	return data;
}

// Get the current book structure
export async function getCurrentBook() {
	const { data, error } = await supabaseAdmin
		.from('books')
		.select(
			`
            id,
            document_title,
            blocks,
            custom_tags,
            auto_add_on_paste,
            reverse_order,
            version,
            created_at
        `
		)
		.order('created_at', { ascending: false })
		.limit(1)
		.single();

	if (error) throw error;
	return data;
}

// Create a new block version
export async function createBlockVersion(blockData, userId) {
	const { data, error } = await supabaseAdmin
		.from('blocks')
		.insert({
			block_id: blockData.block_id,
			content: blockData.content,
			tag: blockData.tag,
			metadata: blockData.metadata || null,
			chapter_id: blockData.chapter_id || null,
			created_by: userId
		})
		.select()
		.single();

	if (error) throw error;
	return data;
}

// Create a new book version
export async function createBookVersion(bookData, userId) {
	const currentBook = await getCurrentBook().catch(() => null);

	const { data, error } = await supabaseAdmin
		.from('books')
		.insert({
			document_title: bookData.document_title,
			blocks: bookData.blocks,
			custom_tags: bookData.custom_tags || [],
			auto_add_on_paste: bookData.auto_add_on_paste || false,
			reverse_order: bookData.reverse_order !== false,
			version: bookData.version || '1.0',
			created_by: userId,
			parent_version_id: currentBook?.id || null
		})
		.select()
		.single();

	if (error) throw error;
	return data;
}

// Log editor action
export async function logEditorAction(action) {
	const { error } = await supabaseAdmin.from('editor_logs').insert(action);

	if (error) {
		console.error('Error logging action:', error);
	}
}

// Get blocks by chapter
export async function getBlocksByChapter(chapterId, withLatestVersions = true) {
	let query = supabaseAdmin
		.from('blocks')
		.select(
			`
            id,
            block_id,
            content,
            tag,
            metadata,
            created_at,
            chapters(id, title, chapter_number)
        `
		)
		.eq('chapter_id', chapterId);

	if (withLatestVersions) {
		// This is complex - we need to get only the latest version of each block
		// For now, let's get all and filter client-side or use a more complex query
		query = query.order('created_at', { ascending: false });
	}

	const { data, error } = await query;
	if (error) throw error;

	if (withLatestVersions) {
		// Filter to only latest versions
		const latestBlocks = new Map();
		data.forEach((block) => {
			const existing = latestBlocks.get(block.block_id);
			if (!existing || new Date(block.created_at) > new Date(existing.created_at)) {
				latestBlocks.set(block.block_id, block);
			}
		});
		return Array.from(latestBlocks.values());
	}

	return data;
}

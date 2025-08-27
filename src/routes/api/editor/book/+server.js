import { json } from '@sveltejs/kit';
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL } from '$env/static/public';
import { SUPABASE_SERVICE_ROLE_KEY } from '$env/static/private';

// Initialize Supabase client with service role key for server-side operations
const supabase = createClient(PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

// Helper function to create a default empty book
async function createDefaultBook(userId) {
	const { data: newBook, error: createError } = await supabase
		.from('books')
		.insert({
			document_title: 'AHWGP',
			blocks: [],
			custom_tags: [],
			auto_add_on_paste: false,
			reverse_order: true,
			version: '1.0',
			created_by: userId
		})
		.select()
		.single();

	if (createError) {
		throw createError;
	}

	return json({
		id: newBook.id,
		documentTitle: newBook.document_title,
		blocks: [],
		customTags: newBook.custom_tags,
		autoAddOnPaste: newBook.auto_add_on_paste,
		reverseOrder: newBook.reverse_order,
		version: newBook.version,
		lastSaved: newBook.created_at
	});
}

// GET /api/editor/book - Load current book with latest block content using optimized DB function
export async function GET({ url, locals }) {
	try {
		const bookId = url.searchParams.get('id');
		const mode = url.searchParams.get('mode') || 'complete'; // 'complete' or 'chapters'

		if (mode === 'chapters') {
			// Get book organized by chapters
			const { data: chapterData, error: chapterError } = await supabase.rpc(
				'get_book_by_chapters',
				{ book_id_param: bookId || null }
			);

			if (chapterError) {
				throw chapterError;
			}

			if (!chapterData || chapterData.length === 0) {
				// No book exists, create a default empty book
				const { user } = await locals.safeGetSession();
				return await createDefaultBook(user?.id);
			}

			return json({
				id: chapterData[0].book_id,
				documentTitle: chapterData[0].document_title,
				chapters: chapterData.map((chapter) => ({
					id: chapter.chapter_id,
					title: chapter.chapter_title,
					number: chapter.chapter_number,
					blocks: chapter.blocks || []
				})),
				lastSaved: new Date().toISOString()
			});
		} else {
			// Get complete book with all blocks in single request
			const { data: bookData, error: bookError } = await supabase.rpc('get_complete_book', {
				book_id_param: bookId || null
			});

			if (bookError) {
				throw bookError;
			}

			if (!bookData || bookData.length === 0) {
				// No book exists, create a default empty book
				const { user } = await locals.safeGetSession();
				return await createDefaultBook(user?.id);
			}

			const book = bookData[0];

			return json({
				id: book.book_id,
				documentTitle: book.document_title,
				blocks: book.blocks || [],
				version: book.version || '1.0',
				lastSaved: book.created_at
			});
		}
	} catch (error) {
		console.error('Error loading book:', error);
		return json(
			{
				success: false,
				error: error.message || 'Failed to load book'
			},
			{ status: 500 }
		);
	}
}

// POST /api/editor/book - Create new book version (for structure changes)
export async function POST({ request, locals }) {
	try {
		const data = await request.json();

		// Get user session safely
		const { user } = await locals.safeGetSession();

		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		// Get current book to link as parent version
		const { data: currentBook } = await supabase
			.from('books')
			.select('id')
			.order('created_at', { ascending: false })
			.limit(1)
			.single();

		const newBookData = {
			document_title: data.documentTitle || 'AHWGP',
			blocks: data.blocks || [],
			custom_tags: data.customTags || [],
			auto_add_on_paste: data.autoAddOnPaste || false,
			reverse_order: data.reverseOrder !== false,
			version: data.version || '1.0',
			created_by: user.id,
			parent_version_id: currentBook?.id || null
		};

		const { data: newBook, error: insertError } = await supabase
			.from('books')
			.insert(newBookData)
			.select()
			.single();

		if (insertError) {
			throw insertError;
		}

		// Log the book structure change
		await supabase.from('editor_logs').insert({
			action_type: 'book_structure_changed',
			entity_type: 'book',
			entity_id: newBook.id,
			changes: {
				blocks_count: newBookData.blocks.length,
				document_title: newBookData.document_title,
				previous_version: currentBook?.id
			},
			user_id: user.id
		});

		return json({
			success: true,
			id: newBook.id,
			documentTitle: newBook.document_title,
			lastSaved: newBook.created_at
		});
	} catch (error) {
		console.error('Error saving book:', error);
		return json(
			{
				success: false,
				error: error.message || 'Failed to save book'
			},
			{ status: 500 }
		);
	}
}

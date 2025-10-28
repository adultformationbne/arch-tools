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

// POST /api/editor/bulk - Handle bulk operations (visibility, delete, etc.)
export async function POST({ request, locals }) {
	try {
		const { action, blockIds, data: actionData } = await request.json();

		// Get user session safely
		const { user } = await locals.safeGetSession();

		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		if (!action || !Array.isArray(blockIds) || blockIds.length === 0) {
			return json(
				{
					success: false,
					error: 'Missing required fields: action, blockIds'
				},
				{ status: 400 }
			);
		}

		// Get current book structure
		const { data: bookData, error: bookError } = await supabase.from('editor_books').select('*').single();

		if (bookError) {
			console.error('Error loading book:', bookError);
			return json({ success: false, error: 'Failed to load book' }, { status: 500 });
		}

		let newBlocks = [...(bookData.blocks || [])];

		switch (action) {
			case 'set_visibility':
				// Set specific visibility for blocks
				const visible = actionData?.visible !== undefined ? actionData.visible : true;
				newBlocks = newBlocks.map((block) => {
					if (blockIds.includes(block.id)) {
						return {
							...block,
							isVisible: visible
						};
					}
					return block;
				});
				break;

			case 'toggle_visibility':
				// Toggle visibility for selected blocks
				newBlocks = newBlocks.map((block) => {
					if (blockIds.includes(block.id)) {
						return {
							...block,
							isVisible: !block.isVisible
						};
					}
					return block;
				});
				break;

			case 'delete':
				// Remove blocks from structure
				newBlocks = newBlocks.filter((block) => !blockIds.includes(block.id));
				break;

			case 'move':
				// Move blocks up or down
				const direction = actionData?.direction; // 'up' or 'down'
				console.log('Move operation - direction:', direction, 'blockId:', blockIds[0]);
				if (direction && blockIds.length === 1) {
					const blockId = blockIds[0];
					const index = newBlocks.findIndex((b) => b.id === blockId);
					console.log('Found block at index:', index, 'total blocks:', newBlocks.length);

					if (index !== -1) {
						const newIndex = direction === 'up' ? index - 1 : index + 1;
						console.log('Moving from index', index, 'to index', newIndex);
						if (newIndex >= 0 && newIndex < newBlocks.length) {
							console.log('Before swap - block at index', index, ':', newBlocks[index].id);
							console.log('Before swap - block at index', newIndex, ':', newBlocks[newIndex].id);
							[newBlocks[index], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[index]];
							console.log('After swap - block at index', index, ':', newBlocks[index].id);
							console.log('After swap - block at index', newIndex, ':', newBlocks[newIndex].id);
						} else {
							console.log('Move blocked - newIndex out of bounds:', newIndex);
						}
					} else {
						console.log('Block not found in array');
					}
				} else {
					console.log(
						'Move operation invalid - direction:',
						direction,
						'blockIds length:',
						blockIds.length
					);
				}
				break;

			default:
				return json(
					{
						success: false,
						error: `Unknown action: ${action}`
					},
					{ status: 400 }
				);
		}

		// Save updated book structure
		console.log('Saving updated blocks to database - count:', newBlocks.length);
		console.log(
			'First 3 block IDs after changes:',
			newBlocks.slice(0, 3).map((b) => b.id)
		);

		const { data: updatedBook, error: updateError } = await supabase
			.from('editor_books')
			.update({ blocks: newBlocks })
			.eq('id', bookData.id)
			.select()
			.single();

		if (updateError) {
			console.error('Error updating book:', updateError);
			return json({ success: false, error: 'Failed to update book structure' }, { status: 500 });
		}

		console.log('Database update successful - book ID:', updatedBook.id);

		return json({
			success: true,
			message: `Bulk ${action} completed successfully`,
			affected_blocks: blockIds.length,
			book_id: updatedBook.id
		});
	} catch (error) {
		console.error('Error performing bulk operation:', error);
		return json(
			{
				success: false,
				error: error.message || 'Failed to perform bulk operation'
			},
			{ status: 500 }
		);
	}
}

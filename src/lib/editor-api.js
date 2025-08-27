// Client-side API functions for the editor
import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

// Initialize Supabase client for client-side operations
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

// Load the current book with all blocks
export async function loadBook(bookId = null, mode = 'complete') {
	const params = new URLSearchParams();
	if (bookId) {
		params.set('id', bookId);
	}
	params.set('mode', mode); // 'complete' or 'chapters'

	const response = await fetch(`/api/editor/book?${params}`);
	
	if (!response.ok) {
		throw new Error(`Failed to load book: ${response.statusText}`);
	}

	return await response.json();
}

// Save book structure (ordering, visibility, etc.)
export async function saveBook(bookData) {
	const response = await fetch('/api/editor/book', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(bookData)
	});

	if (!response.ok) {
		throw new Error(`Failed to save book: ${response.statusText}`);
	}

	return await response.json();
}

// Create or update a block (creates new version)
export async function saveBlock(blockData) {
	const response = await fetch('/api/editor/blocks', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(blockData)
	});

	if (!response.ok) {
		throw new Error(`Failed to save block: ${response.statusText}`);
	}

	return await response.json();
}

// Get all versions of a block
export async function getBlockVersions(blockId) {
	const params = new URLSearchParams({ block_id: blockId });

	const response = await fetch(`/api/editor/blocks?${params}`);
	if (!response.ok) {
		throw new Error(`Failed to load block versions: ${response.statusText}`);
	}

	return await response.json();
}

// Get latest version of a specific block
export async function getLatestBlock(blockId) {
	const params = new URLSearchParams({
		block_id: blockId,
		latest: 'true'
	});

	const response = await fetch(`/api/editor/blocks?${params}`);
	if (!response.ok) {
		throw new Error(`Failed to load block: ${response.statusText}`);
	}

	return await response.json();
}

// Perform bulk operations
export async function bulkOperation(action, blockIds, data = {}) {
	const response = await fetch('/api/editor/bulk', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			action,
			blockIds,
			data
		})
	});

	if (!response.ok) {
		throw new Error(`Failed to perform bulk operation: ${response.statusText}`);
	}

	return await response.json();
}

// Load all chapters
export async function loadChapters() {
	const response = await fetch('/api/editor/chapters');
	if (!response.ok) {
		throw new Error(`Failed to load chapters: ${response.statusText}`);
	}

	return await response.json();
}

// Real-time subscriptions for collaboration (optional)
export function subscribeToBookChanges(bookId, onUpdate) {
	return supabase
		.channel(`book:${bookId}`)
		.on(
			'postgres_changes',
			{
				event: 'INSERT',
				schema: 'public',
				table: 'books'
			},
			(payload) => {
				console.log('Book updated:', payload);
				onUpdate(payload.new);
			}
		)
		.on(
			'postgres_changes',
			{
				event: 'INSERT',
				schema: 'public',
				table: 'blocks'
			},
			(payload) => {
				console.log('Block updated:', payload);
				onUpdate(payload.new);
			}
		)
		.subscribe();
}

export function subscribeToBlockChanges(blockId, onUpdate) {
	return supabase
		.channel(`block:${blockId}`)
		.on(
			'postgres_changes',
			{
				event: 'INSERT',
				schema: 'public',
				table: 'blocks',
				filter: `block_id=eq.${blockId}`
			},
			(payload) => {
				console.log('Block version created:', payload);
				onUpdate(payload.new);
			}
		)
		.subscribe();
}

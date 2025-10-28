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

// GET /api/editor/blocks/versions?block_id=xxx - Get all versions of a specific block
export async function GET({ url, locals }) {
	try {
		const blockId = url.searchParams.get('block_id');

		if (!blockId) {
			return json(
				{
					success: false,
					error: 'block_id parameter is required'
				},
				{ status: 400 }
			);
		}

		// Get user session for authentication
		const { user } = await locals.safeGetSession();

		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		// Get all versions of the block ordered by creation date (newest first)
		const { data: versions, error: versionsError } = await supabase
			.from('editor_blocks')
			.select(
				`
                id,
                block_id,
                content,
                tag,
                metadata,
                created_at,
                created_by
            `
			)
			.eq('block_id', blockId)
			.order('created_at', { ascending: false });

		if (versionsError) {
			throw versionsError;
		}

		// Format the response
		const formattedVersions = versions.map((version) => ({
			id: version.id,
			block_id: version.block_id,
			content: version.content,
			tag: version.tag,
			metadata: version.metadata,
			created_at: version.created_at,
			created_by: version.created_by
		}));

		return json({
			success: true,
			versions: formattedVersions,
			total: formattedVersions.length,
			block_id: blockId
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

// POST /api/editor/blocks/versions - Restore a specific version (creates new version with old content)
export async function POST({ request, locals }) {
	try {
		const { versionId, blockId } = await request.json();

		if (!versionId || !blockId) {
			return json(
				{
					success: false,
					error: 'versionId and blockId are required'
				},
				{ status: 400 }
			);
		}

		// Get user session for authentication
		const { user } = await locals.safeGetSession();

		if (!user) {
			return json({ success: false, error: 'Authentication required' }, { status: 401 });
		}

		// Get the specific version to restore
		const { data: versionToRestore, error: versionError } = await supabase
			.from('editor_blocks')
			.select('content, tag, metadata')
			.eq('id', versionId)
			.eq('block_id', blockId)
			.single();

		if (versionError) {
			throw versionError;
		}

		if (!versionToRestore) {
			return json(
				{
					success: false,
					error: 'Version not found'
				},
				{ status: 404 }
			);
		}

		// Create a new version with the restored content
		const { data: restoredBlock, error: insertError } = await supabase
			.from('editor_blocks')
			.insert({
				block_id: blockId,
				content: versionToRestore.content,
				tag: versionToRestore.tag,
				metadata: versionToRestore.metadata,
				created_by: user.id
			})
			.select()
			.single();

		if (insertError) {
			throw insertError;
		}

		return json({
			success: true,
			message: 'Version restored successfully',
			restored_version: {
				id: restoredBlock.id,
				block_id: restoredBlock.block_id,
				content: restoredBlock.content,
				tag: restoredBlock.tag,
				metadata: restoredBlock.metadata,
				created_at: restoredBlock.created_at
			}
		});
	} catch (error) {
		console.error('Error restoring version:', error);
		return json(
			{
				success: false,
				error: error.message || 'Failed to restore version'
			},
			{ status: 500 }
		);
	}
}

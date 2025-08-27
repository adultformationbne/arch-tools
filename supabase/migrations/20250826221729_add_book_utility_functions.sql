-- Book utility functions and views
-- PostgreSQL functions to build complete book data server-side

CREATE OR REPLACE FUNCTION get_complete_book(book_id_param UUID DEFAULT NULL)
RETURNS TABLE (
    book_id UUID,
    document_title TEXT,
    version TEXT,
    created_at TIMESTAMPTZ,
    blocks JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_book AS (
        -- Get the most recent book (or specific book if ID provided)
        SELECT 
            b.id,
            b.document_title,
            b.blocks as block_structure,
            b.version,
            b.created_at
        FROM books b
        WHERE (book_id_param IS NULL OR b.id = book_id_param)
        ORDER BY b.created_at DESC
        LIMIT 1
    ),
    latest_blocks AS (
        -- Get the latest version of each block
        SELECT DISTINCT ON (bl.block_id)
            bl.block_id,
            bl.content,
            bl.tag,
            bl.metadata,
            bl.created_at as block_created_at
        FROM blocks bl
        WHERE bl.block_id = ANY(
            SELECT DISTINCT unnest(
                ARRAY(
                    SELECT jsonb_array_elements_text(
                        CASE 
                            WHEN jsonb_typeof(lb.block_structure) = 'array' 
                            THEN jsonb_path_query_array(lb.block_structure, '$[*].block_id')
                            ELSE '[]'::jsonb
                        END
                    )
                )
            )
            FROM latest_book lb
        )
        ORDER BY bl.block_id, bl.created_at DESC
    )
    SELECT 
        lb.id as book_id,
        lb.document_title,
        lb.version,
        lb.created_at,
        -- Build complete blocks array with content in correct order
        COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'id', block_info->>'block_id',
                    'content', COALESCE(latest_bl.content, ''),
                    'tag', COALESCE(latest_bl.tag, 'paragraph'),
                    'metadata', COALESCE(latest_bl.metadata, '[]'::jsonb),
                    'isVisible', COALESCE((block_info->>'is_visible')::boolean, true),
                    'createdAt', latest_bl.block_created_at
                ) ORDER BY block_order.ordinality
            ),
            '[]'::jsonb
        ) as blocks
    FROM latest_book lb
    CROSS JOIN LATERAL jsonb_array_elements(lb.block_structure) WITH ORDINALITY AS block_order(block_info, ordinality)
    LEFT JOIN latest_blocks latest_bl ON latest_bl.block_id = block_info->>'block_id'
    GROUP BY lb.id, lb.document_title, lb.version, lb.created_at;
END;
$$ LANGUAGE plpgsql;

-- Create an optimized view for quick book access
CREATE OR REPLACE VIEW complete_books AS
SELECT 
    book_id,
    document_title,
    version,
    created_at,
    blocks,
    jsonb_array_length(blocks) as block_count
FROM get_complete_book();

-- Optional: Create a function to get book by chapters
CREATE OR REPLACE FUNCTION get_book_by_chapters(book_id_param UUID DEFAULT NULL)
RETURNS TABLE (
    book_id UUID,
    document_title TEXT,
    chapter_id UUID,
    chapter_title TEXT,
    chapter_number INTEGER,
    blocks JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH latest_book AS (
        SELECT 
            b.id,
            b.document_title,
            b.blocks as block_structure
        FROM books b
        WHERE (book_id_param IS NULL OR b.id = book_id_param)
        ORDER BY b.created_at DESC
        LIMIT 1
    ),
    book_blocks AS (
        -- Get all blocks for the book with their latest content
        SELECT 
            bl.block_id,
            bl.content,
            bl.tag,
            bl.metadata,
            bl.created_at,
            block_info->>'block_id' as book_block_id,
            COALESCE((block_info->>'is_visible')::boolean, true) as is_visible,
            block_order.ordinality as sort_order
        FROM latest_book lb
        CROSS JOIN LATERAL jsonb_array_elements(lb.block_structure) WITH ORDINALITY AS block_order(block_info, ordinality)
        LEFT JOIN LATERAL (
            SELECT bl2.block_id, bl2.content, bl2.tag, bl2.metadata, bl2.created_at
            FROM blocks bl2
            WHERE bl2.block_id = block_info->>'block_id'
            ORDER BY bl2.created_at DESC
            LIMIT 1
        ) bl ON true
    ),
    chapter_blocks AS (
        -- Group blocks by chapter
        SELECT 
            bb.*,
            COALESCE(c.id, gen_random_uuid()) as chapter_id,
            COALESCE(c.title, 'Uncategorized') as chapter_title,
            COALESCE(c.chapter_number, 999) as chapter_number
        FROM book_blocks bb
        LEFT JOIN chapters c ON bb.tag = 'chapter' AND bb.content = c.title
    )
    SELECT 
        lb.id as book_id,
        lb.document_title,
        cb.chapter_id,
        cb.chapter_title,
        cb.chapter_number,
        jsonb_agg(
            jsonb_build_object(
                'id', cb.block_id,
                'content', cb.content,
                'tag', cb.tag,
                'metadata', cb.metadata,
                'isVisible', cb.is_visible,
                'createdAt', cb.created_at
            ) ORDER BY cb.sort_order
        ) as blocks
    FROM latest_book lb
    CROSS JOIN chapter_blocks cb
    GROUP BY lb.id, lb.document_title, cb.chapter_id, cb.chapter_title, cb.chapter_number
    ORDER BY cb.chapter_number;
END;
$$ LANGUAGE plpgsql;
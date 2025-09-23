-- Create sections table to organize content hierarchically
CREATE TABLE IF NOT EXISTS sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    chapter_block_id TEXT, -- Reference to the chapter block
    section_name TEXT NOT NULL, -- e.g., 'Reflect', 'Pray', 'Listen', 'Introduction'
    section_type TEXT NOT NULL, -- 'standard' (Reflect/Pray/etc), 'introduction', 'content'
    section_order INTEGER NOT NULL, -- Order within the chapter
    start_block_id TEXT, -- First block in this section
    end_block_id TEXT, -- Last block in this section (nullable if extends to next section)
    block_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_sections_book_id ON sections(book_id);
CREATE INDEX idx_sections_chapter_block_id ON sections(chapter_block_id);
CREATE INDEX idx_sections_section_type ON sections(section_type);

-- Create a function to automatically detect and create sections based on h2 headings
CREATE OR REPLACE FUNCTION detect_chapter_sections(p_book_id UUID DEFAULT NULL)
RETURNS TABLE(
    chapter_id TEXT,
    chapter_title TEXT,
    section_name TEXT,
    section_type TEXT,
    section_order INTEGER,
    start_block_id TEXT,
    block_count BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_book_id UUID;
BEGIN
    -- Get the latest book if not specified
    IF p_book_id IS NULL THEN
        SELECT id INTO v_book_id
        FROM books
        ORDER BY created_at DESC
        LIMIT 1;
    ELSE
        v_book_id := p_book_id;
    END IF;

    RETURN QUERY
    WITH book_blocks AS (
        -- Get all blocks in order from the book
        SELECT
            unnest(blocks)::jsonb->>'block_id' as block_id,
            ROW_NUMBER() OVER () as position
        FROM books
        WHERE id = v_book_id
    ),
    block_details AS (
        -- Get the latest version of each block with details
        SELECT DISTINCT ON (b.block_id)
            b.block_id,
            b.tag,
            b.content,
            bb.position
        FROM blocks b
        INNER JOIN book_blocks bb ON b.block_id = bb.block_id
        ORDER BY b.block_id, b.created_at DESC
    ),
    chapters_and_sections AS (
        -- Identify chapters and section markers
        SELECT
            block_id,
            content,
            tag,
            position,
            CASE
                WHEN tag = 'chapter' THEN block_id
                ELSE LAG(CASE WHEN tag = 'chapter' THEN block_id END) OVER (ORDER BY position)
            END as current_chapter_id
        FROM block_details
        WHERE tag IN ('chapter', 'h2')
    ),
    section_groups AS (
        -- Group blocks into sections
        SELECT
            cs.current_chapter_id as chapter_id,
            MAX(CASE WHEN cs.tag = 'chapter' THEN cs.content END) OVER (PARTITION BY cs.current_chapter_id) as chapter_title,
            cs.block_id as section_block_id,
            cs.content as section_name,
            CASE
                WHEN cs.content IN ('Reflect', 'Pray', 'Listen', 'Worship', 'Research', 'Share', 'Read') THEN 'standard'
                WHEN cs.tag = 'chapter' THEN 'introduction'
                ELSE 'content'
            END as section_type,
            ROW_NUMBER() OVER (PARTITION BY cs.current_chapter_id ORDER BY cs.position) - 1 as section_order,
            cs.position as start_position,
            LEAD(cs.position, 1, 99999) OVER (PARTITION BY cs.current_chapter_id ORDER BY cs.position) as end_position
        FROM chapters_and_sections cs
        WHERE cs.current_chapter_id IS NOT NULL
    )
    SELECT
        sg.chapter_id::TEXT,
        sg.chapter_title::TEXT,
        CASE
            WHEN sg.section_order = 0 THEN 'Introduction'
            ELSE sg.section_name
        END::TEXT as section_name,
        sg.section_type::TEXT,
        sg.section_order::INTEGER,
        sg.section_block_id::TEXT as start_block_id,
        COUNT(bd.block_id)::BIGINT as block_count
    FROM section_groups sg
    LEFT JOIN block_details bd ON bd.position >= sg.start_position AND bd.position < sg.end_position
    GROUP BY sg.chapter_id, sg.chapter_title, sg.section_name, sg.section_type, sg.section_order, sg.section_block_id
    ORDER BY
        (SELECT MIN(bd2.position) FROM block_details bd2 WHERE bd2.block_id = sg.chapter_id),
        sg.section_order;
END;
$$;

-- Create a view for easy access to the hierarchical structure
CREATE OR REPLACE VIEW chapter_section_hierarchy AS
WITH latest_book AS (
    SELECT id FROM books ORDER BY created_at DESC LIMIT 1
)
SELECT * FROM detect_chapter_sections((SELECT id FROM latest_book));

-- Add RLS policies
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sections are viewable by everyone" ON sections
    FOR SELECT USING (true);

CREATE POLICY "Sections can be created by authenticated users" ON sections
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Sections can be updated by authenticated users" ON sections
    FOR UPDATE USING (auth.role() = 'authenticated');
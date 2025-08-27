-- AHWGP Editor Baseline Schema
-- This is the complete current schema as of 2025-08-26

-- Blocks table: stores versioned content blocks
CREATE TABLE public.blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    block_id text NOT NULL,
    content text NOT NULL,
    tag text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    chapter_id uuid
);

COMMENT ON TABLE public.blocks IS 'Stores versioned content blocks. Never update - always insert new versions';
COMMENT ON COLUMN public.blocks.block_id IS 'Original block ID, used to group versions together';
COMMENT ON COLUMN public.blocks.tag IS 'Content type: paragraph, h1, h2, h3, ul, ol, chapter, callout, quote, prayer, author';
COMMENT ON COLUMN public.blocks.metadata IS 'Optional metadata like pageType, section, chapter from original data';

-- Books table: stores versioned document structure
CREATE TABLE public.books (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    document_title text DEFAULT 'AHWGP'::text NOT NULL,
    blocks jsonb NOT NULL,
    custom_tags jsonb DEFAULT '[]'::jsonb,
    auto_add_on_paste boolean DEFAULT false,
    reverse_order boolean DEFAULT true,
    version text DEFAULT '1.0'::text,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    parent_version_id uuid
);

COMMENT ON TABLE public.books IS 'Stores versioned document structure. Never update - always insert new versions';
COMMENT ON COLUMN public.books.blocks IS 'Array of objects containing block_id, is_visible, and order_index';
COMMENT ON COLUMN public.books.parent_version_id IS 'References the previous version for history tracking';

-- Chapters table: chapter metadata and organization
CREATE TABLE public.chapters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    chapter_number integer NOT NULL,
    title text NOT NULL,
    block_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- Editor logs table: audit trail for all editor actions
CREATE TABLE public.editor_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    action_type text NOT NULL,
    entity_type text NOT NULL,
    entity_id uuid,
    block_id text,
    changes jsonb,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

COMMENT ON TABLE public.editor_logs IS 'Audit trail for all editor actions';
COMMENT ON COLUMN public.editor_logs.action_type IS 'Type of action performed';
COMMENT ON COLUMN public.editor_logs.changes IS 'JSON object containing details of the change';

-- Primary key constraints
ALTER TABLE ONLY public.blocks ADD CONSTRAINT blocks_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.books ADD CONSTRAINT books_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.chapters ADD CONSTRAINT chapters_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.chapters ADD CONSTRAINT chapters_chapter_number_key UNIQUE (chapter_number);
ALTER TABLE ONLY public.editor_logs ADD CONSTRAINT editor_logs_pkey PRIMARY KEY (id);

-- Indexes for performance
CREATE INDEX idx_blocks_block_id_created_at ON public.blocks USING btree (block_id, created_at DESC);
CREATE INDEX idx_blocks_chapter_id ON public.blocks USING btree (chapter_id);
CREATE INDEX idx_blocks_tag ON public.blocks USING btree (tag);
CREATE INDEX idx_books_created_at ON public.books USING btree (created_at DESC);
CREATE INDEX idx_books_parent_version ON public.books USING btree (parent_version_id);
CREATE INDEX idx_editor_logs_block_id ON public.editor_logs USING btree (block_id);
CREATE INDEX idx_editor_logs_created_at ON public.editor_logs USING btree (created_at DESC);
CREATE INDEX idx_editor_logs_entity ON public.editor_logs USING btree (entity_type, entity_id);
CREATE INDEX idx_editor_logs_user_id ON public.editor_logs USING btree (user_id);

-- Foreign key constraints
ALTER TABLE ONLY public.blocks ADD CONSTRAINT blocks_chapter_id_fkey FOREIGN KEY (chapter_id) REFERENCES public.chapters(id);
ALTER TABLE ONLY public.blocks ADD CONSTRAINT blocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.books ADD CONSTRAINT books_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
ALTER TABLE ONLY public.books ADD CONSTRAINT books_parent_version_id_fkey FOREIGN KEY (parent_version_id) REFERENCES public.books(id);
ALTER TABLE ONLY public.editor_logs ADD CONSTRAINT editor_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);

-- Enable Row Level Security
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editor_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can create block versions" ON public.blocks FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));
CREATE POLICY "Authenticated users can create book versions" ON public.books FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));
CREATE POLICY "Authenticated users can create chapters" ON public.chapters FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can read blocks" ON public.blocks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read books" ON public.books FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read chapters" ON public.chapters FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read editor logs" ON public.editor_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Chapters are immutable - no updates" ON public.chapters FOR UPDATE TO authenticated USING (false);
CREATE POLICY "Chapters cannot be deleted" ON public.chapters FOR DELETE TO authenticated USING (false);
CREATE POLICY "System can create editor logs" ON public.editor_logs FOR INSERT TO authenticated WITH CHECK (true);
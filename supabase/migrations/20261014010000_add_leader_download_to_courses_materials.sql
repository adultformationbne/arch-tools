-- Leader downloads: when true, logged-in leaders of the course can download this
-- Mux video as an MP4 from their own page. Enabling it also asks Mux to produce the
-- file (see src/lib/server/mux-download.ts). Off by default; never exposed on the
-- public watch page.
ALTER TABLE public.courses_materials
	ADD COLUMN IF NOT EXISTS leader_download_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.courses_materials.leader_download_enabled IS
	'When true, signed-in leaders of the course can download this video as an MP4.';

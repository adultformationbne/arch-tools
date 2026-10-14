-- Public watch links: a Mux video an admin has switched on can be opened at
-- /p/watch/<material id> by anyone with the link, without signing in.
-- Off by default. The page is served with the service role, so this adds no
-- direct access to the table.
ALTER TABLE public.courses_materials
	ADD COLUMN IF NOT EXISTS public_watch_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.courses_materials.public_watch_enabled IS
	'When true, the video can be watched at /p/watch/<id> by anyone holding the link.';

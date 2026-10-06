-- Sessions in a public guide can be grouped under named sections
-- (e.g. "Discovering Yourself in Jesus"), the same way modules already can.
ALTER TABLE public.courses_sessions ADD COLUMN IF NOT EXISTS section_name text;

COMMENT ON COLUMN public.courses_sessions.section_name IS
  'Optional section heading that groups consecutive sessions on the public guide pages';

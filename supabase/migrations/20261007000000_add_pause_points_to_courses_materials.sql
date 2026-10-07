-- Pause points: moments in a video where the player stops and waits for play.
-- Shape: [{ "id": text, "time": seconds }], validated in the API
-- (see src/lib/utils/pause-points.ts). Only hub-leader courses use them.
ALTER TABLE public.courses_materials
	ADD COLUMN IF NOT EXISTS pause_points jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.courses_materials
	ADD CONSTRAINT courses_materials_pause_points_is_array
	CHECK (jsonb_typeof(pause_points) = 'array');

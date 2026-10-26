-- First-party usage analytics: page views across the whole site and how much of each
-- course video people actually watch. Written only by /api/analytics with the service
-- role; RLS is on with no policies, so nothing else can read or write these tables.
--
-- Visitors are an anonymous random id kept in the browser. No IP addresses or user
-- agent strings are stored; user_id is filled only when the viewer is signed in.

CREATE TABLE IF NOT EXISTS public.analytics_page_views (
	id uuid PRIMARY KEY,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	visitor_id uuid NOT NULL,
	session_id uuid NOT NULL,
	user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
	host text NOT NULL,
	path text NOT NULL,
	route_id text,
	course_slug text,
	referrer_host text,
	utm_source text,
	utm_medium text,
	utm_campaign text,
	device text,
	country text,
	-- Seconds the tab was visible on this page; updated when the viewer leaves it
	engaged_seconds integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.analytics_page_views IS
	'One row per page view, site-wide. Written by /api/analytics (service role only).';

CREATE INDEX IF NOT EXISTS analytics_page_views_created_at_idx
	ON public.analytics_page_views (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_page_views_course_idx
	ON public.analytics_page_views (course_slug, created_at DESC) WHERE course_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_page_views_route_idx
	ON public.analytics_page_views (route_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_page_views_visitor_idx
	ON public.analytics_page_views (visitor_id);
CREATE INDEX IF NOT EXISTS analytics_page_views_user_idx
	ON public.analytics_page_views (user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.analytics_video_views (
	-- One row per player per page load, created on first play and updated by heartbeats
	id uuid PRIMARY KEY,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	visitor_id uuid NOT NULL,
	session_id uuid NOT NULL,
	user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
	page_view_id uuid,
	material_id uuid REFERENCES public.courses_materials (id) ON DELETE SET NULL,
	course_slug text,
	playback_id text NOT NULL,
	host text NOT NULL,
	path text NOT NULL,
	route_id text,
	device text,
	country text,
	-- Length of the video itself
	duration_seconds numeric(10, 2),
	-- Distinct seconds of the video seen (rewatching a part does not add to it)
	watched_seconds numeric(10, 2) NOT NULL DEFAULT 0,
	-- Total time spent playing, rewatches included
	play_seconds numeric(10, 2) NOT NULL DEFAULT 0,
	-- Furthest point reached by playing (not by scrubbing)
	max_position_seconds numeric(10, 2) NOT NULL DEFAULT 0,
	-- Merged [start, end] spans actually played, for drop-off / rewatch analysis
	watched_ranges jsonb NOT NULL DEFAULT '[]'::jsonb,
	plays integer NOT NULL DEFAULT 0,
	seeks integer NOT NULL DEFAULT 0,
	-- Watched at least 90% of it (or reached the end, when the length is unknown)
	completed boolean NOT NULL DEFAULT false
);

COMMENT ON TABLE public.analytics_video_views IS
	'One row per video playback session. Written by /api/analytics (service role only).';

CREATE INDEX IF NOT EXISTS analytics_video_views_created_at_idx
	ON public.analytics_video_views (created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_video_views_material_idx
	ON public.analytics_video_views (material_id, created_at DESC);
CREATE INDEX IF NOT EXISTS analytics_video_views_course_idx
	ON public.analytics_video_views (course_slug, created_at DESC) WHERE course_slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_video_views_visitor_idx
	ON public.analytics_video_views (visitor_id);
CREATE INDEX IF NOT EXISTS analytics_video_views_user_idx
	ON public.analytics_video_views (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.analytics_page_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analytics_video_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.analytics_page_views FROM anon, authenticated;
REVOKE ALL ON public.analytics_video_views FROM anon, authenticated;

-- Heartbeats carry the running totals, so applying one is idempotent. Beacons can land
-- out of order, so totals only ever grow, and only the visitor who created a row can
-- update it.
CREATE OR REPLACE FUNCTION public.analytics_record_video_view(p jsonb)
RETURNS void
LANGUAGE sql
SET search_path = ''
AS $$
	INSERT INTO public.analytics_video_views AS v (
		id, visitor_id, session_id, user_id, page_view_id, material_id, course_slug,
		playback_id, host, path, route_id, device, country, duration_seconds,
		watched_seconds, play_seconds, max_position_seconds, watched_ranges,
		plays, seeks, completed
	) VALUES (
		(p->>'id')::uuid,
		(p->>'visitor_id')::uuid,
		(p->>'session_id')::uuid,
		(p->>'user_id')::uuid,
		(p->>'page_view_id')::uuid,
		(p->>'material_id')::uuid,
		p->>'course_slug',
		p->>'playback_id',
		p->>'host',
		p->>'path',
		p->>'route_id',
		p->>'device',
		p->>'country',
		(p->>'duration_seconds')::numeric,
		coalesce((p->>'watched_seconds')::numeric, 0),
		coalesce((p->>'play_seconds')::numeric, 0),
		coalesce((p->>'max_position_seconds')::numeric, 0),
		coalesce(p->'watched_ranges', '[]'::jsonb),
		coalesce((p->>'plays')::integer, 0),
		coalesce((p->>'seeks')::integer, 0),
		coalesce((p->>'completed')::boolean, false)
	)
	ON CONFLICT (id) DO UPDATE SET
		updated_at = now(),
		user_id = coalesce(v.user_id, excluded.user_id),
		duration_seconds = coalesce(excluded.duration_seconds, v.duration_seconds),
		watched_ranges = CASE WHEN excluded.watched_seconds >= v.watched_seconds
			THEN excluded.watched_ranges ELSE v.watched_ranges END,
		watched_seconds = greatest(v.watched_seconds, excluded.watched_seconds),
		play_seconds = greatest(v.play_seconds, excluded.play_seconds),
		max_position_seconds = greatest(v.max_position_seconds, excluded.max_position_seconds),
		plays = greatest(v.plays, excluded.plays),
		seeks = greatest(v.seeks, excluded.seeks),
		completed = v.completed OR excluded.completed
	WHERE v.visitor_id = excluded.visitor_id;
$$;

REVOKE ALL ON FUNCTION public.analytics_record_video_view(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_record_video_view(jsonb) TO service_role;

-- Site-wide analytics summary for the Settings > Analytics tab: one call returns every
-- figure the page shows, for [p_from, p_to). Days are bucketed in Brisbane time.
-- Time on page is the median: a tab left open all day would swamp an average.
-- Traffic from local development (host localhost:*) is left out.
-- Service role only, like the tables it reads.
CREATE OR REPLACE FUNCTION public.analytics_overview(p_from timestamptz, p_to timestamptz)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
	WITH
	pv AS (
		SELECT * FROM public.analytics_page_views
		WHERE created_at >= p_from AND created_at < p_to AND host NOT LIKE 'localhost%'
	),
	vv AS (
		SELECT * FROM public.analytics_video_views
		WHERE created_at >= p_from AND created_at < p_to AND host NOT LIKE 'localhost%'
	),
	-- Same length of time immediately before, for the change figures
	prev_pv AS (
		SELECT * FROM public.analytics_page_views
		WHERE created_at >= p_from - (p_to - p_from) AND created_at < p_from AND host NOT LIKE 'localhost%'
	),
	prev_vv AS (
		SELECT * FROM public.analytics_video_views
		WHERE created_at >= p_from - (p_to - p_from) AND created_at < p_from AND host NOT LIKE 'localhost%'
	),
	days AS (
		SELECT d::date AS day
		FROM generate_series(
			(p_from AT TIME ZONE 'Australia/Brisbane')::date,
			((p_to - interval '1 second') AT TIME ZONE 'Australia/Brisbane')::date,
			interval '1 day'
		) AS d
	)
	SELECT jsonb_build_object(
		'trackingSince', (SELECT min(created_at) FROM public.analytics_page_views WHERE host NOT LIKE 'localhost%'),
		'totals', (
			SELECT jsonb_build_object(
				'visitors', (SELECT count(DISTINCT visitor_id) FROM pv),
				'visits', (SELECT count(DISTINCT session_id) FROM pv),
				'pageViews', (SELECT count(*) FROM pv),
				'medianEngagedSeconds', (SELECT coalesce(round(percentile_cont(0.5) WITHIN GROUP (ORDER BY engaged_seconds)), 0) FROM pv),
				'signedInVisitors', (SELECT count(DISTINCT user_id) FROM pv),
				'videoViews', (SELECT count(*) FROM vv),
				'watchSeconds', (SELECT coalesce(round(sum(watched_seconds)), 0) FROM vv)
			)
		),
		'previous', (
			SELECT jsonb_build_object(
				'visitors', (SELECT count(DISTINCT visitor_id) FROM prev_pv),
				'visits', (SELECT count(DISTINCT session_id) FROM prev_pv),
				'pageViews', (SELECT count(*) FROM prev_pv),
				'medianEngagedSeconds', (SELECT coalesce(round(percentile_cont(0.5) WITHIN GROUP (ORDER BY engaged_seconds)), 0) FROM prev_pv),
				'signedInVisitors', (SELECT count(DISTINCT user_id) FROM prev_pv),
				'videoViews', (SELECT count(*) FROM prev_vv),
				'watchSeconds', (SELECT coalesce(round(sum(watched_seconds)), 0) FROM prev_vv)
			)
		),
		'daily', (
			SELECT coalesce(jsonb_agg(jsonb_build_object(
				'day', days.day,
				'visitors', coalesce(t.visitors, 0),
				'pageViews', coalesce(t.page_views, 0),
				'videoViews', coalesce(v.video_views, 0)
			) ORDER BY days.day), '[]'::jsonb)
			FROM days
			LEFT JOIN (
				SELECT (created_at AT TIME ZONE 'Australia/Brisbane')::date AS day,
					count(DISTINCT visitor_id) AS visitors, count(*) AS page_views
				FROM pv GROUP BY 1
			) t ON t.day = days.day
			LEFT JOIN (
				SELECT (created_at AT TIME ZONE 'Australia/Brisbane')::date AS day, count(*) AS video_views
				FROM vv GROUP BY 1
			) v ON v.day = days.day
		),
		'courses', (
			SELECT coalesce(jsonb_agg(row_to_json(c) ORDER BY c."pageViews" DESC), '[]'::jsonb)
			FROM (
				SELECT
					coalesce(p.slug, w.slug) AS slug,
					co.name,
					coalesce(p.visitors, 0) AS visitors,
					coalesce(p.page_views, 0) AS "pageViews",
					coalesce(p.public_views, 0) AS "publicPageViews",
					coalesce(w.video_views, 0) AS "videoViews",
					coalesce(w.watch_seconds, 0) AS "watchSeconds"
				FROM (
					SELECT course_slug AS slug, count(DISTINCT visitor_id) AS visitors, count(*) AS page_views,
						count(*) FILTER (WHERE route_id LIKE '/p/%' OR route_id LIKE '/sites/%') AS public_views
					FROM pv WHERE course_slug IS NOT NULL GROUP BY 1
				) p
				FULL JOIN (
					SELECT course_slug AS slug, count(*) AS video_views, round(sum(watched_seconds)) AS watch_seconds
					FROM vv WHERE course_slug IS NOT NULL GROUP BY 1
				) w ON w.slug = p.slug
				LEFT JOIN public.courses co ON co.slug = coalesce(p.slug, w.slug)
			) c
		),
		'videos', (
			SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.viewers DESC, x."watchSeconds" DESC), '[]'::jsonb)
			FROM (
				SELECT
					vv.material_id AS "materialId",
					vv.playback_id AS "playbackId",
					m.title,
					max(vv.course_slug) AS "courseSlug",
					count(DISTINCT vv.visitor_id) AS viewers,
					count(*) AS views,
					round(sum(vv.watched_seconds)) AS "watchSeconds",
					round(max(vv.duration_seconds)) AS "durationSeconds",
					round(avg(CASE WHEN vv.duration_seconds > 0
						THEN least(vv.watched_seconds / vv.duration_seconds, 1) END) * 100) AS "avgPercentWatched",
					round(count(*) FILTER (WHERE vv.completed) * 100.0 / count(*)) AS "completionRate"
				FROM vv
				LEFT JOIN public.courses_materials m ON m.id = vv.material_id
				GROUP BY vv.material_id, vv.playback_id, m.title
				ORDER BY count(DISTINCT vv.visitor_id) DESC
				LIMIT 50
			) x
		),
		'pages', (
			SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x."pageViews" DESC), '[]'::jsonb)
			FROM (
				-- Pages that differ only by a UUID (a reflection question, a watch link) are one row
				SELECT host,
					regexp_replace(path, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '…', 'gi') AS path,
					count(*) AS "pageViews", count(DISTINCT visitor_id) AS visitors,
					round(percentile_cont(0.5) WITHIN GROUP (ORDER BY engaged_seconds)) AS "medianEngagedSeconds"
				FROM pv GROUP BY 1, 2 ORDER BY count(*) DESC LIMIT 25
			) x
		),
		'referrers', (
			SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.visits DESC), '[]'::jsonb)
			FROM (
				SELECT coalesce(referrer_host, 'Direct / none') AS source,
					count(DISTINCT session_id) AS visits, count(DISTINCT visitor_id) AS visitors
				FROM pv GROUP BY 1 ORDER BY 2 DESC LIMIT 15
			) x
		),
		'campaigns', (
			SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.visits DESC), '[]'::jsonb)
			FROM (
				SELECT utm_source AS source, utm_medium AS medium, utm_campaign AS campaign,
					count(DISTINCT session_id) AS visits
				FROM pv WHERE utm_source IS NOT NULL OR utm_campaign IS NOT NULL
				GROUP BY 1, 2, 3 ORDER BY 4 DESC LIMIT 15
			) x
		),
		'devices', (
			SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.visitors DESC), '[]'::jsonb)
			FROM (
				SELECT coalesce(device, 'unknown') AS device, count(DISTINCT visitor_id) AS visitors
				FROM pv GROUP BY 1
			) x
		),
		'countries', (
			SELECT coalesce(jsonb_agg(row_to_json(x) ORDER BY x.visitors DESC), '[]'::jsonb)
			FROM (
				SELECT coalesce(country, '??') AS country, count(DISTINCT visitor_id) AS visitors
				FROM pv GROUP BY 1 ORDER BY 2 DESC LIMIT 10
			) x
		)
	);
$$;

REVOKE ALL ON FUNCTION public.analytics_overview(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.analytics_overview(timestamptz, timestamptz) TO service_role;

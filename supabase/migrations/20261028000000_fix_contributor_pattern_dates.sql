-- Fix pattern-date calculation in get_contributor_assigned_dates():
--   * support multi-day patterns ({"values": [14, 31]}), not only {"value": n}
--   * skip days a month doesn't have (31st in February no longer becomes 3 March)
--   * never return dates before today (earlier days of the current month)
-- Mirrors calculatePatternDates() in src/routes/api/dgr-admin/schedule/+server.js.

CREATE OR REPLACE FUNCTION public.get_contributor_assigned_dates(contributor_uuid uuid, months_ahead integer DEFAULT 12)
 RETURNS TABLE(date date, schedule_id uuid, has_content boolean, status text, reflection_title text, gospel_quote text, reflection_content text, liturgical_date text, readings_data jsonb)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  pattern JSONB;
  pattern_type TEXT;
  pattern_values INT[];
  start_date DATE := CURRENT_DATE;
  end_date DATE := CURRENT_DATE + (months_ahead || ' months')::INTERVAL;
  blocked_seasons TEXT[];
BEGIN
  -- Get list of blocked seasons from active assignment rules
  SELECT ARRAY_AGG(LOWER(condition_season))
  INTO blocked_seasons
  FROM dgr_assignment_rules
  WHERE active = true
    AND action_type = 'skip_pattern'
    AND condition_season IS NOT NULL;

  IF blocked_seasons IS NULL THEN
    blocked_seasons := ARRAY[]::TEXT[];
  END IF;

  -- First, return all actual schedule entries for this contributor
  RETURN QUERY
  SELECT
    s.date::DATE,
    s.id,
    (s.reflection_content IS NOT NULL AND s.reflection_content != '') AS has_content,
    s.status::TEXT,
    s.reflection_title,
    s.gospel_quote,
    s.reflection_content,
    s.liturgical_date,
    s.readings_data
  FROM dgr_schedule s
  WHERE s.contributor_id = contributor_uuid
    AND s.date BETWEEN start_date AND end_date
  ORDER BY s.date;

  -- Then, calculate pattern-based dates that don't have schedule entries yet
  SELECT schedule_pattern INTO pattern
  FROM dgr_contributors
  WHERE id = contributor_uuid;

  IF pattern IS NULL THEN
    RETURN;
  END IF;

  pattern_type := pattern->>'type';

  -- 'values' (array) takes precedence over the older single 'value'
  IF jsonb_typeof(pattern->'values') = 'array' THEN
    SELECT ARRAY_AGG(v::INT) INTO pattern_values
    FROM jsonb_array_elements_text(pattern->'values') AS v;
  ELSIF pattern ? 'value' THEN
    pattern_values := ARRAY[(pattern->>'value')::INT];
  END IF;

  IF pattern_values IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH candidates AS (
    -- Day of month: walk months from the 1st, keeping only days the month has
    SELECT (m + (d - 1) * INTERVAL '1 day')::DATE AS cdate
    FROM generate_series(DATE_TRUNC('month', start_date), end_date, INTERVAL '1 month') AS m,
         UNNEST(pattern_values) AS d
    WHERE pattern_type = 'day_of_month'
      AND d BETWEEN 1 AND EXTRACT(DAY FROM (m + INTERVAL '1 month' - INTERVAL '1 day'))
    UNION
    -- Day of week (0 = Sunday)
    SELECT d::DATE
    FROM generate_series(start_date, end_date, INTERVAL '1 day') AS d
    WHERE pattern_type = 'day_of_week'
      AND EXTRACT(DOW FROM d)::INT = ANY(pattern_values)
  )
  SELECT c.cdate, NULL::UUID, FALSE, 'pending'::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::TEXT, NULL::JSONB
  FROM candidates c
  WHERE c.cdate BETWEEN start_date AND end_date
    -- Skip if date is "claimed" (has contributor OR has content);
    -- empty rows with NULL contributor don't block patterns
    AND NOT EXISTS (
      SELECT 1 FROM dgr_schedule s
      WHERE s.date = c.cdate
        AND (
          s.contributor_id IS NOT NULL
          OR (s.reflection_content IS NOT NULL AND s.reflection_content != '')
        )
    )
    -- Skip if date falls in a blocked season
    AND NOT EXISTS (
      SELECT 1 FROM ordo_calendar oc
      WHERE oc.calendar_date = c.cdate
        AND LOWER(oc.liturgical_season) = ANY(blocked_seasons)
    )
  ORDER BY c.cdate;

  RETURN;
END;
$function$;

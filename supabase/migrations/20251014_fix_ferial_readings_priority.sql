-- Fix get_readings_for_date to prioritize ferial readings over optional memorials
-- Optional memorials (rank="Feast") should use ferial readings by default
-- Only Solemnities and obligatory feasts should override ferial readings

DROP FUNCTION IF EXISTS get_readings_for_date(DATE);

CREATE OR REPLACE FUNCTION get_readings_for_date(target_date DATE)
RETURNS TABLE (
  calendar_date DATE,
  liturgical_day TEXT,
  liturgical_season TEXT,
  liturgical_week INTEGER,
  liturgical_rank TEXT,
  day_of_week TEXT,
  year_cycle TEXT,
  first_reading TEXT,
  psalm TEXT,
  second_reading TEXT,
  gospel_reading TEXT
) AS $$
DECLARE
  cal_row RECORD;
  year_row RECORD;
  current_cycle TEXT;
BEGIN
  -- Get calendar info
  SELECT * INTO cal_row
  FROM liturgical_calendar lc
  WHERE lc.calendar_date = target_date;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Date % not found in liturgical_calendar', target_date;
  END IF;

  -- Get year cycle info
  SELECT * INTO year_row
  FROM liturgical_years ly
  WHERE ly.year = EXTRACT(YEAR FROM target_date)::INTEGER;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Year % not found in liturgical_years', EXTRACT(YEAR FROM target_date);
  END IF;

  -- Determine cycle based on day of week
  IF cal_row.day_of_week = 'Sunday' THEN
    current_cycle := year_row.sunday_cycle;
  ELSE
    -- Convert Roman numerals to Arabic for weekday cycle matching
    current_cycle := CASE year_row.weekday_cycle
      WHEN 'I' THEN '1'
      WHEN 'II' THEN '2'
      ELSE year_row.weekday_cycle
    END;
  END IF;

  -- PRIORITY 1: Try ferial readings for optional memorials (rank="Feast")
  -- Optional memorials should default to ferial readings unless specifically chosen
  IF cal_row.liturgical_rank = 'Feast' AND cal_row.liturgical_season = 'Ordinary Time' THEN
    RETURN QUERY
    SELECT
      cal_row.calendar_date,
      cal_row.liturgical_name,
      cal_row.liturgical_season,
      cal_row.liturgical_week,
      cal_row.liturgical_rank,
      cal_row.day_of_week,
      current_cycle,
      lr.first_reading,
      lr.psalm,
      lr.second_reading,
      lr.gospel_reading
    FROM lectionary_readings lr
    WHERE
      lr.year_cycle = current_cycle
      AND lr.week_number = cal_row.liturgical_week::TEXT
      AND lr.day_type = cal_row.day_of_week
      AND lr.time_period = 'Ordinary'  -- Note: lectionary uses "Ordinary", not "Ordinary Time"
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- PRIORITY 2: Try exact match on liturgical_day (for Solemnities and special days)
  RETURN QUERY
  SELECT
    cal_row.calendar_date,
    cal_row.liturgical_name,
    cal_row.liturgical_season,
    cal_row.liturgical_week,
    cal_row.liturgical_rank,
    cal_row.day_of_week,
    current_cycle,
    lr.first_reading,
    lr.psalm,
    lr.second_reading,
    lr.gospel_reading
  FROM lectionary_readings lr
  WHERE lr.liturgical_day = cal_row.liturgical_name
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  -- PRIORITY 3: Try pattern matching on seasons (Advent, Lent, Easter, Christmas)
  IF cal_row.liturgical_season IN ('Advent', 'Lent', 'Easter', 'Christmas') THEN
    -- For Sundays: always match by year cycle (Advent/Lent/Easter Sundays use year cycles A/B/C)
    IF cal_row.day_of_week = 'Sunday' THEN
      RETURN QUERY
      SELECT
        cal_row.calendar_date,
        cal_row.liturgical_name,
        cal_row.liturgical_season,
        cal_row.liturgical_week,
        cal_row.liturgical_rank,
        cal_row.day_of_week,
        year_row.sunday_cycle as year_cycle,
        lr.first_reading,
        lr.psalm,
        lr.second_reading,
        lr.gospel_reading
      FROM lectionary_readings lr
      WHERE
        lr.time_period = cal_row.liturgical_season
        AND lr.day_type = cal_row.day_of_week
        AND lr.year_cycle = year_row.sunday_cycle
      LIMIT 1;

      IF FOUND THEN
        RETURN;
      END IF;
    -- For weekdays with specific week numbers (not 'N/A')
    ELSIF cal_row.liturgical_week IS NOT NULL THEN
      RETURN QUERY
      SELECT
        cal_row.calendar_date,
        cal_row.liturgical_name,
        cal_row.liturgical_season,
        cal_row.liturgical_week,
        cal_row.liturgical_rank,
        cal_row.day_of_week,
        'Season' as year_cycle,
        lr.first_reading,
        lr.psalm,
        lr.second_reading,
        lr.gospel_reading
      FROM lectionary_readings lr
      WHERE
        lr.time_period = cal_row.liturgical_season
        AND lr.week_number = cal_row.liturgical_week::TEXT
        AND lr.day_type = cal_row.day_of_week
      LIMIT 1;

      IF FOUND THEN
        RETURN;
      END IF;
    ELSE
      -- For weekdays without specific week numbers (e.g., Christmas octave, days after Epiphany)
      -- Match by time_period and day_type only
      RETURN QUERY
      SELECT
        cal_row.calendar_date,
        cal_row.liturgical_name,
        cal_row.liturgical_season,
        cal_row.liturgical_week,
        cal_row.liturgical_rank,
        cal_row.day_of_week,
        'Season' as year_cycle,
        lr.first_reading,
        lr.psalm,
        lr.second_reading,
        lr.gospel_reading
      FROM lectionary_readings lr
      WHERE
        lr.time_period = cal_row.liturgical_season
        AND lr.day_type = cal_row.day_of_week
      LIMIT 1;

      IF FOUND THEN
        RETURN;
      END IF;
    END IF;
  END IF;

  -- PRIORITY 4: Try Ordinary Time ferial readings
  IF cal_row.liturgical_season = 'Ordinary Time' THEN
    RETURN QUERY
    SELECT
      cal_row.calendar_date,
      cal_row.liturgical_name,
      cal_row.liturgical_season,
      cal_row.liturgical_week,
      cal_row.liturgical_rank,
      cal_row.day_of_week,
      current_cycle,
      lr.first_reading,
      lr.psalm,
      lr.second_reading,
      lr.gospel_reading
    FROM lectionary_readings lr
    WHERE
      lr.year_cycle = current_cycle
      AND lr.week_number = cal_row.liturgical_week::TEXT
      AND lr.day_type = cal_row.day_of_week
      AND lr.time_period = 'Ordinary'
    LIMIT 1;

    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- PRIORITY 5: Last resort - try to find ANY matching feast readings
  RETURN QUERY
  SELECT
    cal_row.calendar_date,
    cal_row.liturgical_name,
    cal_row.liturgical_season,
    cal_row.liturgical_week,
    cal_row.liturgical_rank,
    cal_row.day_of_week,
    'Feast' as year_cycle,
    lr.first_reading,
    lr.psalm,
    lr.second_reading,
    lr.gospel_reading
  FROM lectionary_readings lr
  WHERE lr.liturgical_day = cal_row.liturgical_name
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE NOTICE 'No readings found for date % (liturgical_day: %, season: %, week: %)',
      target_date, cal_row.liturgical_name, cal_row.liturgical_season, cal_row.liturgical_week;
  END IF;

  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_readings_for_date IS
'Gets liturgical readings for a date. For optional memorials (Feast rank), prioritizes ferial readings over memorial readings, following Catholic liturgical practice where ferial readings are recommended unless pastoral reasons suggest otherwise.';

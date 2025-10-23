-- Fix and enable DGR assignment rules enforcement
-- This migration:
-- 1. Fixes the check_assignment_rules function to use correct column names
-- 2. Updates assign_contributor_to_date to respect rules

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS check_assignment_rules(DATE);

-- Create corrected check_assignment_rules function
CREATE OR REPLACE FUNCTION check_assignment_rules(target_date DATE)
RETURNS TABLE(
  is_blocked BOOLEAN,
  rule_name TEXT,
  rule_message TEXT,
  specific_contributor_id UUID
) AS $$
DECLARE
  cal_record RECORD;
BEGIN
  -- Get liturgical calendar info for the date
  SELECT
    liturgical_season,
    day_of_week,
    liturgical_week,
    liturgical_name
  INTO cal_record
  FROM liturgical_calendar
  WHERE calendar_date = target_date;

  -- If no calendar record found, allow assignment
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check all active rules in priority order
  RETURN QUERY
  SELECT
    CASE
      WHEN r.action_type = 'block_assignment' THEN true
      ELSE false
    END as is_blocked,
    r.name as rule_name,
    r.action_message as rule_message,
    CASE
      WHEN r.action_type = 'assign_specific_contributor' THEN r.action_value::UUID
      ELSE NULL
    END as specific_contributor_id
  FROM dgr_assignment_rules r
  WHERE r.active = true
    -- Check season condition (map old time_period to liturgical_season)
    AND (r.condition_season IS NULL OR r.condition_season = cal_record.liturgical_season)
    -- Check day type condition (map to day_of_week)
    AND (r.condition_day_type IS NULL OR r.condition_day_type = cal_record.day_of_week)
    -- Check week number condition (map to liturgical_week)
    AND (r.condition_week_number IS NULL OR r.condition_week_number::INTEGER = cal_record.liturgical_week)
    -- Check liturgical day contains (map to liturgical_name)
    AND (r.condition_liturgical_day_contains IS NULL
         OR cal_record.liturgical_name ILIKE '%' || r.condition_liturgical_day_contains || '%')
  ORDER BY r.priority ASC
  LIMIT 1; -- Return first matching rule (highest priority)

  -- If no rules matched, allow assignment
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::UUID;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Update assign_contributor_to_date to check rules first
CREATE OR REPLACE FUNCTION assign_contributor_to_date(target_date DATE)
RETURNS UUID AS $$
DECLARE
    contributor_id UUID;
    day_of_week INTEGER;
    rule_check RECORD;
BEGIN
    -- FIRST: Check assignment rules
    SELECT * INTO rule_check
    FROM check_assignment_rules(target_date)
    LIMIT 1;

    -- If blocked by rule, return NULL (no assignment)
    IF rule_check.is_blocked THEN
        RETURN NULL;
    END IF;

    -- If rule specifies a specific contributor, return that
    IF rule_check.specific_contributor_id IS NOT NULL THEN
        RETURN rule_check.specific_contributor_id;
    END IF;

    -- Otherwise, proceed with normal assignment logic
    -- Get day of week (0=Sunday, 1=Monday, etc)
    day_of_week := EXTRACT(DOW FROM target_date);

    -- Try to find a contributor who prefers this day and hasn't been assigned recently
    SELECT c.id INTO contributor_id
    FROM dgr_contributors c
    WHERE c.active = true
    AND (c.preferred_days = '{}' OR day_of_week = ANY(c.preferred_days))
    ORDER BY (
        SELECT COUNT(*)
        FROM dgr_schedule s
        WHERE s.contributor_id = c.id
        AND s.date >= target_date - INTERVAL '14 days'
    ) ASC, RANDOM()
    LIMIT 1;

    -- If no preferred contributor found, get any active contributor
    IF contributor_id IS NULL THEN
        SELECT c.id INTO contributor_id
        FROM dgr_contributors c
        WHERE c.active = true
        ORDER BY (
            SELECT COUNT(*)
            FROM dgr_schedule s
            WHERE s.contributor_id = c.id
            AND s.date >= target_date - INTERVAL '14 days'
        ) ASC, RANDOM()
        LIMIT 1;
    END IF;

    RETURN contributor_id;
END;
$$ LANGUAGE plpgsql;

-- Add helpful comments
COMMENT ON FUNCTION check_assignment_rules(DATE) IS
'Checks if a date is blocked or has special assignment rules based on liturgical calendar. Returns first matching rule by priority.';

COMMENT ON FUNCTION assign_contributor_to_date(DATE) IS
'Assigns a contributor to a date, respecting assignment rules. Returns NULL if blocked by rules.';

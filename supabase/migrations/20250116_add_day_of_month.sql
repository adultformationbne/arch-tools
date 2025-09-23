-- Add day_of_month field to contributors for simple monthly assignments
-- This replaces the complex calendar system with a simple day-of-month pattern

-- Add day_of_month field
ALTER TABLE dgr_contributors
ADD COLUMN IF NOT EXISTS day_of_month INTEGER CHECK (day_of_month >= 1 AND day_of_month <= 31);

-- Update the assignment function to prefer day_of_month assignments
CREATE OR REPLACE FUNCTION assign_contributor_to_date(target_date DATE)
RETURNS UUID AS $$
DECLARE
    contributor_id UUID;
    day_of_month INTEGER;
BEGIN
    -- Get day of month (1-31)
    day_of_month := EXTRACT(DAY FROM target_date);

    -- First try to find a contributor assigned to this day of month
    SELECT c.id INTO contributor_id
    FROM dgr_contributors c
    WHERE c.active = true
    AND c.day_of_month = day_of_month
    ORDER BY RANDOM() -- In case multiple contributors have same day
    LIMIT 1;

    -- If no day-of-month contributor found, fall back to preference-based assignment
    IF contributor_id IS NULL THEN
        -- Get day of week (0=Sunday, 1=Monday, etc)
        day_of_month := EXTRACT(DOW FROM target_date);

        -- Try to find a contributor who prefers this day and hasn't been assigned recently
        SELECT c.id INTO contributor_id
        FROM dgr_contributors c
        WHERE c.active = true
        AND (c.preferred_days = '{}' OR day_of_month = ANY(c.preferred_days))
        ORDER BY (
            SELECT COUNT(*)
            FROM dgr_schedule s
            WHERE s.contributor_id = c.id
            AND s.date >= target_date - INTERVAL '14 days'
        ) ASC, RANDOM()
        LIMIT 1;
    END IF;

    -- If still no contributor found, get any active contributor
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

-- Comment for documentation
COMMENT ON COLUMN dgr_contributors.day_of_month IS 'Day of month (1-31) this contributor is typically assigned to write reflections';
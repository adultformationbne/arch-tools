-- Create Ordo-Lectionary mapping tables and functions
-- This enables automatic lookup of daily liturgical readings

-- Table to store the Ordo (liturgical calendar for 2025-2030)
CREATE TABLE IF NOT EXISTS ordo_calendar (
    calendar_date DATE PRIMARY KEY,
    liturgical_year INTEGER NOT NULL,
    liturgical_season TEXT,
    liturgical_week INTEGER,
    liturgical_name TEXT NOT NULL,
    liturgical_rank TEXT,
    year_cycle TEXT, -- A, B, or C for Sundays/Solemnities
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store the Lectionary (scripture readings)
CREATE TABLE IF NOT EXISTS lectionary (
    id SERIAL PRIMARY KEY,
    admin_order INTEGER UNIQUE,
    year TEXT, -- A, B, C, 1, 2, Season, Feast, Memorial, Solemnity
    week TEXT,
    day TEXT,
    time TEXT, -- Ordinary, Advent, Lent, Easter, Christmas, etc.
    liturgical_day TEXT NOT NULL,
    first_reading TEXT,
    psalm TEXT,
    second_reading TEXT,
    gospel_reading TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to store the mapping between Ordo and Lectionary
CREATE TABLE IF NOT EXISTS ordo_lectionary_mapping (
    id SERIAL PRIMARY KEY,
    calendar_date DATE NOT NULL REFERENCES ordo_calendar(calendar_date),
    lectionary_id INTEGER REFERENCES lectionary(admin_order),
    match_type TEXT NOT NULL, -- 'exact', 'partial', 'none'
    match_method TEXT, -- 'date', 'name', 'substring'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(calendar_date)
);

-- Function to get readings for a specific date
CREATE OR REPLACE FUNCTION get_readings_for_date(target_date DATE)
RETURNS TABLE (
    calendar_date DATE,
    liturgical_day TEXT,
    liturgical_rank TEXT,
    liturgical_season TEXT,
    liturgical_week INTEGER,
    year_cycle TEXT,
    first_reading TEXT,
    psalm TEXT,
    second_reading TEXT,
    gospel_reading TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        o.calendar_date,
        o.liturgical_name AS liturgical_day,
        o.liturgical_rank,
        o.liturgical_season,
        o.liturgical_week,
        o.year_cycle,
        l.first_reading,
        l.psalm,
        l.second_reading,
        l.gospel_reading
    FROM ordo_calendar o
    LEFT JOIN ordo_lectionary_mapping m ON m.calendar_date = o.calendar_date
    LEFT JOIN lectionary l ON l.admin_order = m.lectionary_id
    WHERE o.calendar_date = target_date;
END;
$$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ordo_calendar_date ON ordo_calendar(calendar_date);
CREATE INDEX IF NOT EXISTS idx_ordo_calendar_year ON ordo_calendar(liturgical_year);
CREATE INDEX IF NOT EXISTS idx_lectionary_day ON lectionary(liturgical_day);
CREATE INDEX IF NOT EXISTS idx_lectionary_admin_order ON lectionary(admin_order);
CREATE INDEX IF NOT EXISTS idx_ordo_mapping_date ON ordo_lectionary_mapping(calendar_date);

-- Grant permissions (adjust based on your RLS policies)
GRANT SELECT ON ordo_calendar TO anon, authenticated;
GRANT SELECT ON lectionary TO anon, authenticated;
GRANT SELECT ON ordo_lectionary_mapping TO anon, authenticated;

COMMENT ON TABLE ordo_calendar IS 'Liturgical calendar (Ordo) with one entry per day';
COMMENT ON TABLE lectionary IS 'Scripture readings from the Lectionary';
COMMENT ON TABLE ordo_lectionary_mapping IS 'Maps Ordo dates to Lectionary entries';
COMMENT ON FUNCTION get_readings_for_date IS 'Get liturgical readings for a specific date';

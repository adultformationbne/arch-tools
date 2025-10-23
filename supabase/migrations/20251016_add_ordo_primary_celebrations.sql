-- Create table for authoritative Ordo primary celebrations
-- This table contains ONLY the primary liturgical celebration for each day
-- (excludes optional memorials that use ferial readings)

CREATE TABLE IF NOT EXISTS ordo_primary_celebrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    calendar_date DATE NOT NULL UNIQUE,
    year INTEGER NOT NULL,
    liturgical_season TEXT,
    liturgical_week INTEGER,
    liturgical_name TEXT NOT NULL,
    liturgical_rank TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast date lookups
CREATE INDEX idx_ordo_primary_date ON ordo_primary_celebrations(calendar_date);
CREATE INDEX idx_ordo_primary_year ON ordo_primary_celebrations(year);

-- Add comment explaining the table
COMMENT ON TABLE ordo_primary_celebrations IS
'Authoritative primary liturgical celebrations from official Ordo calendars (e.g., 2025.csv, 2026.csv).
Only includes the PRIMARY celebration for each day - optional memorials are excluded.
This table takes precedence over liturgical_calendar for readings selection.';

-- Update function for updated_at
CREATE OR REPLACE FUNCTION update_ordo_primary_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ordo_primary_updated_at
    BEFORE UPDATE ON ordo_primary_celebrations
    FOR EACH ROW
    EXECUTE FUNCTION update_ordo_primary_updated_at();

-- Grant permissions (adjust as needed for your RLS policies)
ALTER TABLE ordo_primary_celebrations ENABLE ROW LEVEL SECURITY;

-- Allow public read access (since this is reference data)
CREATE POLICY "Allow public read access to ordo_primary_celebrations"
    ON ordo_primary_celebrations
    FOR SELECT
    USING (true);

-- Only allow service role to insert/update/delete
CREATE POLICY "Allow service role full access to ordo_primary_celebrations"
    ON ordo_primary_celebrations
    FOR ALL
    USING (auth.role() = 'service_role');

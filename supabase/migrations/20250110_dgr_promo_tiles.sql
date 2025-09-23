-- Create table for DGR promotional tiles
CREATE TABLE IF NOT EXISTS dgr_promo_tiles (
    id SERIAL PRIMARY KEY,
    position INTEGER NOT NULL CHECK (position IN (1, 2, 3)),
    image_url TEXT,
    title TEXT,
    link_url TEXT,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(position) -- Each position can only have one tile
);

-- Create an update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dgr_promo_tiles_updated_at BEFORE UPDATE
    ON dgr_promo_tiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default placeholder tiles
INSERT INTO dgr_promo_tiles (position, image_url, title, active) VALUES
    (1, '', 'Event 1', true),
    (2, '', 'Event 2', true),
    (3, '', 'Event 3', true)
ON CONFLICT (position) DO NOTHING;

-- Add RLS policies
ALTER TABLE dgr_promo_tiles ENABLE ROW LEVEL SECURITY;

-- Allow public to read promo tiles
CREATE POLICY "Anyone can view promo tiles" ON dgr_promo_tiles
    FOR SELECT USING (true);

-- Only authenticated users can update
CREATE POLICY "Authenticated users can update promo tiles" ON dgr_promo_tiles
    FOR ALL USING (auth.role() = 'authenticated');

-- Create a function to get active promo tiles
CREATE OR REPLACE FUNCTION get_active_promo_tiles()
RETURNS TABLE (
    position INTEGER,
    image_url TEXT,
    title TEXT,
    link_url TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.position,
        p.image_url,
        p.title,
        p.link_url
    FROM dgr_promo_tiles p
    WHERE p.active = true
    ORDER BY p.position;
END;
$$ LANGUAGE plpgsql;
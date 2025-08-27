-- Admin Settings Table
-- Stores application-wide settings in flexible JSON format

CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    setting_key TEXT UNIQUE NOT NULL, -- e.g., 'analytics_thresholds', 'editor_preferences', etc.
    setting_value JSONB NOT NULL,
    description TEXT,
    
    -- Metadata  
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (only authenticated users can access)
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Only authenticated users can read settings
CREATE POLICY "Authenticated users can view admin settings" ON admin_settings
    FOR SELECT USING (auth.role() = 'authenticated');

-- Policy: Only authenticated users can modify settings (we can make this more restrictive later)
CREATE POLICY "Authenticated users can insert admin settings" ON admin_settings  
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update admin settings" ON admin_settings
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON admin_settings(setting_key);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_admin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER admin_settings_updated_at
    BEFORE UPDATE ON admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_settings_updated_at();

-- Insert default analytics settings
INSERT INTO admin_settings (setting_key, setting_value, description) 
VALUES (
    'analytics_thresholds',
    '{
        "green_min_relatability": 6,
        "green_min_accessibility": 7, 
        "orange_min_relatability": 4,
        "orange_min_accessibility": 5,
        "red_max_theological_depth": 8,
        "red_max_emotional_resonance": 3
    }'::jsonb,
    'Threshold settings for content analytics recommendations'
) ON CONFLICT (setting_key) DO NOTHING;
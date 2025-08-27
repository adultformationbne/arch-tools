-- DGR (Daily Gospel Reflection) Management System
-- Complete system for managing contributors, schedules, and email notifications

-- Contributors table
CREATE TABLE dgr_contributors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    preferred_days INTEGER[] DEFAULT '{}', -- Array of day numbers (0=Sunday, 1=Monday, etc)
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create status enum types first
CREATE TYPE dgr_status AS ENUM (
    'pending',         -- No reflection yet, awaiting contributor submission
    'submitted',       -- Reflection submitted by contributor, needs approval
    'approved',        -- Reflection approved by admin, ready to upload/publish
    'published'        -- Reflection has been published (optional final state)
);

CREATE TYPE dgr_email_type AS ENUM (
    'assignment',      -- Initial assignment notification to contributor
    'reminder',        -- Reminder email if reflection is overdue
    'approval',        -- Notification to admin when reflection submitted
    'published'        -- Notification to contributor when reflection published
);

CREATE TYPE dgr_email_status AS ENUM (
    'pending',         -- Email queued but not sent
    'sent',           -- Email successfully sent
    'failed'          -- Email failed to send
);

-- Schedule table for daily assignments
CREATE TABLE dgr_schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE UNIQUE NOT NULL,
    gospel_reference TEXT,
    gospel_text TEXT,
    contributor_id UUID REFERENCES dgr_contributors(id),
    contributor_email TEXT, -- Denormalized for easier queries
    status dgr_status DEFAULT 'pending',
    reflection_content TEXT,
    reflection_title TEXT,
    submission_token TEXT UNIQUE, -- For secure submission links
    submitted_at TIMESTAMP WITH TIME ZONE,
    approved_at TIMESTAMP WITH TIME ZONE,
    published_at TIMESTAMP WITH TIME ZONE,
    liturgical_date TEXT, -- Added from dgr_schema_update.sql
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Email queue for managing notifications
CREATE TABLE dgr_email_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES dgr_schedule(id),
    recipient_email TEXT NOT NULL,
    email_type dgr_email_type NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    status dgr_email_status DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for better performance
CREATE INDEX idx_dgr_schedule_date ON dgr_schedule(date);
CREATE INDEX idx_dgr_schedule_status ON dgr_schedule(status);
CREATE INDEX idx_dgr_schedule_contributor ON dgr_schedule(contributor_id);
CREATE INDEX idx_dgr_schedule_token ON dgr_schedule(submission_token);
CREATE INDEX idx_dgr_contributors_email ON dgr_contributors(email);
CREATE INDEX idx_dgr_contributors_active ON dgr_contributors(active);
CREATE INDEX idx_dgr_email_queue_status ON dgr_email_queue(status);
CREATE INDEX idx_dgr_email_queue_type ON dgr_email_queue(email_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to auto-update updated_at
CREATE TRIGGER update_dgr_contributors_updated_at BEFORE UPDATE ON dgr_contributors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dgr_schedule_updated_at BEFORE UPDATE ON dgr_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE dgr_contributors ENABLE ROW LEVEL SECURITY;
ALTER TABLE dgr_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE dgr_email_queue ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can read all data
CREATE POLICY "Authenticated users can read contributors" ON dgr_contributors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read schedule" ON dgr_schedule FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read email queue" ON dgr_email_queue FOR SELECT TO authenticated USING (true);

-- Policy: Authenticated users can manage all data (admin-level access)
CREATE POLICY "Authenticated users can manage contributors" ON dgr_contributors FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage schedule" ON dgr_schedule FOR ALL TO authenticated USING (true);
CREATE POLICY "Authenticated users can manage email queue" ON dgr_email_queue FOR ALL TO authenticated USING (true);

-- Policy: Allow public updates to schedule via token (for reflection submissions)
CREATE POLICY "Public can update schedule with valid token" ON dgr_schedule 
    FOR UPDATE TO anon 
    USING (submission_token IS NOT NULL AND submission_token != '');

-- Sample contributors (you can modify/remove these)
INSERT INTO dgr_contributors (email, name, preferred_days, notes) VALUES
('contributor1@example.com', 'Sr. Mary Catherine', '{1,3,5}', 'Prefers weekdays'),
('contributor2@example.com', 'Fr. John Smith', '{0,6}', 'Available weekends'),
('contributor3@example.com', 'Deacon Michael Brown', '{2,4}', 'Tuesday/Thursday preference');

-- Function to generate secure tokens
CREATE OR REPLACE FUNCTION generate_submission_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Function to assign contributors using round-robin with preferences
CREATE OR REPLACE FUNCTION assign_contributor_to_date(target_date DATE)
RETURNS UUID AS $$
DECLARE
    contributor_id UUID;
    day_of_week INTEGER;
BEGIN
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

-- Comments for documentation
COMMENT ON TABLE dgr_contributors IS 'Contributors who write daily gospel reflections';
COMMENT ON TABLE dgr_schedule IS 'Daily schedule assignments for gospel reflections';
COMMENT ON TABLE dgr_email_queue IS 'Queue for managing email notifications';
COMMENT ON FUNCTION assign_contributor_to_date IS 'Assigns a contributor to a date using round-robin with day preferences';
COMMENT ON TYPE dgr_status IS 'Status of daily gospel reflection entries';
COMMENT ON TYPE dgr_email_type IS 'Type of DGR email notifications';  
COMMENT ON TYPE dgr_email_status IS 'Status of email delivery';
-- Create pending_invitations table for invite-only authentication system
-- This table stores shareable invitation codes (ABC-123 format) alongside OTP codes

CREATE TABLE IF NOT EXISTS public.pending_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  modules TEXT[] NOT NULL DEFAULT '{}',
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',

  created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  accepted_at TIMESTAMPTZ,

  last_sent_at TIMESTAMPTZ DEFAULT NOW(),
  send_count INT DEFAULT 1,

  CONSTRAINT valid_code CHECK (code ~ '^[A-Z0-9]{3}-[A-Z0-9]{3}$'),
  CONSTRAINT pending_invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS pending_invitations_code_idx ON pending_invitations(code);
CREATE INDEX IF NOT EXISTS pending_invitations_email_idx ON pending_invitations(email);
CREATE INDEX IF NOT EXISTS pending_invitations_status_idx ON pending_invitations(status);
CREATE INDEX IF NOT EXISTS pending_invitations_created_by_idx ON pending_invitations(created_by);

-- RLS Policies
ALTER TABLE pending_invitations ENABLE ROW LEVEL SECURITY;

-- Public can view pending invitations by code (for redemption)
CREATE POLICY "Anyone can view invitation by code"
  ON pending_invitations FOR SELECT
  USING (status = 'pending' AND expires_at > NOW());

-- Users with 'users' module can view all invitations
CREATE POLICY "Users module can view all invitations"
  ON pending_invitations FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM user_profiles WHERE 'users' = ANY(modules)
    )
  );

-- Users with 'users' module can insert invitations
CREATE POLICY "Users module can insert invitations"
  ON pending_invitations FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM user_profiles WHERE 'users' = ANY(modules)
    )
  );

-- Users with 'users' module can update invitations
CREATE POLICY "Users module can update invitations"
  ON pending_invitations FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM user_profiles WHERE 'users' = ANY(modules)
    )
  );

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  code TEXT;
BEGIN
  LOOP
    code := '';
    -- Generate 3 characters
    FOR i IN 1..3 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    code := code || '-';
    -- Generate 3 more characters
    FOR i IN 1..3 LOOP
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    -- Check if code exists
    EXIT WHEN NOT EXISTS (SELECT 1 FROM pending_invitations WHERE pending_invitations.code = code);
  END LOOP;

  RETURN code;
END;
$$ LANGUAGE plpgsql VOLATILE;

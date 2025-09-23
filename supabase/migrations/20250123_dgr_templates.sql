-- Create DGR templates table for version-controlled HTML templates
CREATE TABLE dgr_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL, -- 'default', 'hero', 'minimal', 'email', etc.
  version INT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- The complete HTML template with {{variables}}
  html TEXT NOT NULL,

  -- Available variables in this template
  variables TEXT[] DEFAULT ARRAY[
    'title',
    'date',
    'formattedDate',
    'liturgicalDate',
    'readings',
    'gospelQuote',
    'reflectionText',
    'authorName',
    'gospelFullText',
    'gospelReference'
  ],

  -- Configuration options
  config JSONB DEFAULT '{}',

  -- Version control
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users,

  -- Ensure unique version per template key
  UNIQUE(template_key, version)
);

-- Only one active version per template key
CREATE UNIQUE INDEX idx_one_active_per_key ON dgr_templates(template_key)
  WHERE is_active = true;

-- Quick lookup for active templates
CREATE INDEX idx_active_templates ON dgr_templates(is_active)
  WHERE is_active = true;

-- Function to get the next version number for a template
CREATE OR REPLACE FUNCTION get_next_template_version(p_template_key TEXT)
RETURNS INT AS $$
BEGIN
  RETURN COALESCE(
    (SELECT MAX(version) + 1 FROM dgr_templates WHERE template_key = p_template_key),
    1
  );
END;
$$ LANGUAGE plpgsql;

-- Function to activate a template version (deactivates others)
CREATE OR REPLACE FUNCTION activate_template_version(p_id UUID)
RETURNS VOID AS $$
DECLARE
  v_template_key TEXT;
BEGIN
  -- Get the template key
  SELECT template_key INTO v_template_key
  FROM dgr_templates
  WHERE id = p_id;

  -- Deactivate all versions of this template
  UPDATE dgr_templates
  SET is_active = false
  WHERE template_key = v_template_key;

  -- Activate the specified version
  UPDATE dgr_templates
  SET is_active = true
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default template (current design)
INSERT INTO dgr_templates (template_key, version, name, html, is_active)
VALUES (
  'default',
  1,
  'Default DGR Template',
  '<article style="max-width:700px; margin:0 auto; font-family: Arial, Helvetica, sans-serif; line-height:1.6; color:#333;">

  <!-- Main Title -->
  <h1 style="font-family:''PT Serif'', Georgia, serif; font-size:42px; font-weight:bold; color:#213d6b; text-align:center; margin:40px 0;">
    Daily Gospel Reflections
  </h1>

  <!-- Header Section -->
  <div style="background:#fafafa; border:1px solid #e8e8e8; border-radius:16px; padding:24px; margin-bottom:32px;">
    <div style="text-align:center; margin-bottom:24px;">
      <div style="font-family:''PT Serif'', Georgia, serif; font-size:24px; font-weight:700; color:#019da4; margin-bottom:6px;">{{formattedDate}}</div>
      <div style="font-size:14px; color:#666; font-style:italic;">{{liturgicalDate}}</div>
    </div>

    {{#if readings}}
    <div>
      <h3 style="font-size:14px; color:#666; margin:0 0 12px 0; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; text-align:center;">Today''s Scripture Readings</h3>
      <div style="text-align:center; color:#0d5f5f;">{{readings}}</div>
    </div>
    {{/if}}
  </div>

  {{#if gospelFullText}}
  <!-- Gospel Reading -->
  <div style="background:#f7f3ed; border:1px solid #d1bd99; padding:35px; margin:30px 0; border-radius:20px;">
    <h2 style="font-family:''PT Serif'', Georgia, serif; font-size:32px; color:#e28929; font-weight:700; margin:0 0 20px 0;">{{gospelReference}}</h2>
    <div style="font-size:16px; color:#3a3a3a; line-height:1.75; font-family:Georgia, serif;">
      {{{gospelFullText}}}
    </div>
  </div>
  {{/if}}

  <!-- Reflection -->
  <div style="padding:0 16px;">
    <h2 style="font-size:12px; font-weight:600; color:#1a5555; text-transform:uppercase; letter-spacing:1.5px; margin:40px 0 20px 0;">Reflection</h2>

    <h1 style="font-family:''PT Serif'', Georgia, serif; font-size:28px; color:#2c7777; margin:0 0 20px;">{{title}}</h1>

    <blockquote style="margin:20px 0; padding-left:16px; border-left:3px solid #2c7777; font-style:italic; font-size:16px; color:#2c7777;">
      {{gospelQuote}}
    </blockquote>

    <div style="font-size:16px; line-height:1.7; color:#333; margin:30px 0;">
      {{{reflectionText}}}
    </div>

    <div style="margin-top:30px; text-align:center;">
      <div style="display:inline-block; background:#e6f7f7; border:1px solid #8dd3d3; color:#0d5f5f; padding:8px 16px; border-radius:24px; font-size:14px;">
        <span style="opacity:0.8; margin-right:6px;">Reflection by</span>
        <strong>{{authorName}}</strong>
      </div>
    </div>
  </div>

</article>

<!-- Subscribe Section -->
<div style="background: linear-gradient(135deg, #0fa3a3 0%, #2c7777 100%); padding:50px 20px; margin-top:50px; text-align:center;">
  <div style="max-width:600px; margin:0 auto;">
    <h3 style="font-family:''PT Serif'', Georgia, serif; font-size:28px; font-weight:700; color:white; margin:0 0 15px;">
      Subscribe to Daily Gospel Reflections
    </h3>
    <p style="font-size:16px; color:white; margin:0 0 30px; opacity:0.95;">
      Sent directly to your email inbox, every morning.
    </p>
    <a href="https://share-ap1.hsforms.com/1tifbJAvIRhmZf5yuh3qEsQ7av94g" target="_blank"
       style="display:inline-block; background:white; color:#2c7777; padding:14px 35px; text-decoration:none; font-size:16px; font-weight:600; border-radius:5px;">
      Subscribe
    </a>
  </div>
</div>',
  true
);

-- Add RLS policies
ALTER TABLE dgr_templates ENABLE ROW LEVEL SECURITY;

-- Everyone can read active templates
CREATE POLICY "Active templates are public" ON dgr_templates
  FOR SELECT USING (is_active = true);

-- Authenticated users can read all templates
CREATE POLICY "Authenticated users can read all templates" ON dgr_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Authenticated users can create templates
CREATE POLICY "Authenticated users can create templates" ON dgr_templates
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Authenticated users can update templates
CREATE POLICY "Authenticated users can update templates" ON dgr_templates
  FOR UPDATE USING (auth.uid() IS NOT NULL);
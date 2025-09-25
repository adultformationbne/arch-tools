#!/usr/bin/env node

// Script to update the DGR template in the database with random header functionality
// This ensures all template data lives in the database, not in static files

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables
config();

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Updated template HTML with random header image functionality
const updatedTemplateHtml = `<article style="max-width:700px; margin:0 auto; font-family: Arial, Helvetica, sans-serif; line-height:1.6; color:#333;">

  <!-- Main Title -->
  <h1 style="font-family:'PT Serif', Georgia, serif; font-size:42px; font-weight:bold; color:#213d6b; text-align:center; margin:40px 0;">
    Daily Gospel Reflections
  </h1>

  <!-- Random Header Image with rounded top corners only -->
  <div style="text-align:center; margin-bottom:0;">
    <img src="{{randomHeaderImage}}"
         alt="Daily Gospel Reflections"
         style="max-width:700px; width:100%; height:auto; display:block; border-radius:16px 16px 0 0;">
  </div>

  <!-- Header Section (seamlessly connected to image with rounded bottom corners only) -->
  <div style="background:#fafafa; border:1px solid #e8e8e8; border-top:none; border-radius:0 0 16px 16px; padding:24px; margin-bottom:32px;">
    <div style="text-align:center; margin-bottom:24px;">
      <div style="font-family:'PT Serif', Georgia, serif; font-size:24px; font-weight:700; color:#019da4; margin-bottom:6px;">{{formattedDate}}</div>
      <div style="font-size:14px; color:#666; font-style:italic;">{{liturgicalDate}}</div>
    </div>

    {{#if readings}}
    <div>
      <h3 style="font-size:14px; color:#666; margin:0 0 12px 0; font-weight:600; text-transform:uppercase; letter-spacing:0.8px; text-align:center;">Today's Scripture Readings</h3>
      <div style="display:flex; flex-wrap:wrap; gap:10px; justify-content:center;">
        {{readingsPills readings}}
      </div>
    </div>
    {{/if}}
  </div>

  {{#if gospelFullText}}
  <!-- Gospel Reading -->
  <div style="background:#f7f3ed; border:1px solid #d1bd99; padding:35px; margin:30px 0; border-radius:20px;">
    <div style="font-family: Arial, sans-serif; font-size: 12px; color: #7a6f5d; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; font-weight: 600;">Gospel Reading</div>
    <h2 style="font-family:'PT Serif', Georgia, serif; font-size:32px; color:#e28929; font-weight:700; margin:0 0 8px 0; line-height:1.2;">{{gospelReference}}</h2>
    <div style="font-family: Arial, sans-serif; font-size: 13px; color: #7a6f5d; margin-bottom: 20px;">NRSV</div>
    <div style="font-size:16px; color:#3a3a3a; line-height:1.75; font-family:Georgia, serif;">
      {{{gospelFullText}}}
    </div>
  </div>

  <!-- NRSV Copyright Notice -->
  <div style="font-family: Arial, sans-serif; font-size: 11px; color: #8a8a8a; line-height: 1.5; margin: 15px 0 0 0; padding: 0 16px;">
    New Revised Standard Version Bible, copyright © 1989 National Council of the Churches of Christ in the United States of America. Used by permission. All rights reserved worldwide.
  </div>
  {{/if}}

  <!-- Icon Spacer with Lines using random icon -->
  <div style="display:flex; align-items:center; margin:60px 0; padding:0 20px;">
    <div style="flex:1; height:1px; background:#ddd;"></div>
    <img src="{{randomIcon}}" alt="" style="width:24px; height:24px; opacity:0.4; margin:0 20px;">
    <div style="flex:1; height:1px; background:#ddd;"></div>
  </div>

  <!-- Reflection -->
  <div style="padding:0 16px;">
    <h2 style="font-size:12px; font-weight:600; color:#1a5555; text-transform:uppercase; letter-spacing:1.5px; margin:40px 0 20px 0;">Reflection</h2>

    <h1 style="font-family:'PT Serif', Georgia, serif; font-size:28px; color:#2c7777; margin:0 0 20px;">{{title}}</h1>

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

{{promoTiles promoTiles}}

</article>

<!-- Subscribe Section -->
<div style="background: linear-gradient(135deg, #0fa3a3 0%, #2c7777 100%); padding:50px 20px; margin-top:50px; text-align:center;">
  <div style="max-width:600px; margin:0 auto;">
    <h3 style="font-family:'PT Serif', Georgia, serif; font-size:28px; font-weight:700; color:white; margin:0 0 15px;">
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
</div>`;

async function updateTemplate() {
  try {
    console.log('🔄 Updating DGR template with random header functionality...');

    // Update the default template
    const { data, error } = await supabase
      .from('dgr_templates')
      .update({
        html: updatedTemplateHtml,
        updated_at: new Date().toISOString()
      })
      .eq('template_key', 'default')
      .eq('is_active', true);

    if (error) {
      throw error;
    }

    console.log('✅ Successfully updated DGR template!');
    console.log('📝 Changes made:');
    console.log('   • Added {{randomHeaderImage}} helper for random header images');
    console.log('   • Added {{randomIcon}} helper for random divider icons');
    console.log('   • Header image now has rounded top corners only');
    console.log('   • Date box has rounded bottom corners only for seamless connection');
    console.log('   • All randomization logic now lives in the template renderer');

  } catch (error) {
    console.error('❌ Error updating template:', error);
    process.exit(1);
  }
}

// Run the update
updateTemplate().then(() => {
  console.log('🎉 Template update complete!');
  process.exit(0);
});
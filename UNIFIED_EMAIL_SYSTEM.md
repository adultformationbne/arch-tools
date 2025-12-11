# Unified Email Template System

This document describes the platform-wide email template system that provides consistent email management across courses, DGR, and platform contexts.

## Overview

The email system uses a single `email_templates` table with a `context` column to differentiate between template types:

| Context | Description | Example Templates |
|---------|-------------|-------------------|
| `course` | Course-specific emails | Welcome, materials ready, reflection reminders |
| `dgr` | Daily Gospel Reflections | Welcome, submission reminders |
| `platform` | Platform-wide emails | Password reset, account notifications |

## Database Schema

### Table: `email_templates`

```sql
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  context TEXT NOT NULL,           -- 'course', 'dgr', 'platform'
  context_id UUID,                 -- For course templates: course.id
  template_key TEXT NOT NULL,      -- Unique key within context
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'custom',  -- 'system' or 'custom'
  subject_template TEXT NOT NULL,
  body_template TEXT NOT NULL,
  available_variables JSONB,
  trigger_event TEXT,              -- For automated emails
  is_active BOOLEAN DEFAULT true,
  is_deletable BOOLEAN DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

## Where to Edit Templates

### Course Email Templates
**Location:** Course Admin → Emails tab (`/admin/courses/[slug]/emails`)

Templates include:
- Welcome (enrollment confirmation)
- Session materials ready
- Reflection reminders
- Custom templates

### DGR Email Templates
**Location:** DGR → People & Rules → Email Templates (`/dgr/emails`)

Templates include:
- **Welcome Email** - Sent to new contributors with their personal portal link
- **Reminder Email** - Sent to remind contributors of upcoming due dates

### Platform Email Templates
Currently managed via database. Future admin UI planned.

---

## Template Variables

### Course Variables
| Variable | Description |
|----------|-------------|
| `{{firstName}}` | Student first name |
| `{{lastName}}` | Student last name |
| `{{fullName}}` | Student full name |
| `{{email}}` | Student email address |
| `{{hubName}}` | Student hub assignment |
| `{{courseName}}` | Course name |
| `{{courseSlug}}` | Course URL identifier |
| `{{cohortName}}` | Cohort name |
| `{{startDate}}` | Cohort start date |
| `{{endDate}}` | Cohort end date |
| `{{sessionNumber}}` | Session number (context-dependent) |
| `{{sessionTitle}}` | Session title (context-dependent) |
| `{{currentSession}}` | Current cohort session |
| `{{loginLink}}` | Course login page URL |
| `{{dashboardLink}}` | Course dashboard URL |
| `{{materialsLink}}` | Course materials page URL |
| `{{reflectionLink}}` | Reflections page URL |
| `{{supportEmail}}` | Support contact email |

### DGR Variables
| Variable | Description |
|----------|-------------|
| `{{contributor_name}}` | Contributor full name |
| `{{contributor_first_name}}` | First name with title if applicable (e.g., "Fr Michael") |
| `{{contributor_title}}` | Title only (Fr, Sr, Br, Deacon) |
| `{{contributor_email}}` | Contributor email address |
| `{{write_url}}` | Personal writing portal URL |
| `{{write_url_button}}` | Styled HTML button for portal link |
| `{{due_date}}` | Full formatted date (e.g., "Monday, 15 January 2025") ⚡ |
| `{{due_date_text}}` | Relative date (e.g., "today", "tomorrow") ⚡ |
| `{{liturgical_date}}` | Liturgical day name ⚡ |
| `{{gospel_reference}}` | Gospel reading reference ⚡ |

*⚡ = Context-dependent (only populated in reminder emails with specific assignment data)*

---

## Email Service Functions

### Core Functions (`$lib/utils/email-service.js`)

#### `sendEmail(options)`
Low-level email sending with logging. Used by all other send functions.

```javascript
await sendEmail({
  to: 'recipient@example.com',
  subject: 'Hello',
  html: '<p>Message body</p>',
  emailType: 'notification',
  referenceId: 'optional-id',
  metadata: { custom: 'data' },
  resendApiKey: RESEND_API_KEY,
  supabase: supabaseAdmin
});
```

#### `sendBrandedEmail(options)`
Sends email with branded header/footer wrapper.

```javascript
await sendBrandedEmail({
  to: 'recipient@example.com',
  subject: 'Hello',
  bodyHtml: '<p>Content here</p>',
  emailType: 'notification',
  branding: {
    name: 'My Brand',
    logoUrl: 'https://...',
    accentDark: '#334642'
  },
  context: 'platform',
  contextId: null,
  templateId: 'template-uuid',
  resendApiKey: RESEND_API_KEY,
  supabase: supabaseAdmin
});
```

#### `sendCourseEmail(options)`
Course-specific wrapper with automatic branding from course settings.

```javascript
await sendCourseEmail({
  to: enrollment.email,
  subject: renderedSubject,
  bodyHtml: renderedBody,
  emailType: 'course_welcome',
  course: courseRecord,
  cohortId: 'cohort-uuid',
  enrollmentId: 'enrollment-uuid',
  templateId: 'template-uuid',
  resendApiKey: RESEND_API_KEY,
  supabase: supabaseAdmin
});
```

#### `sendDgrEmail(options)`
DGR-specific wrapper with DGR branding.

```javascript
await sendDgrEmail({
  to: contributor.email,
  subject: renderedSubject,
  bodyHtml: renderedBody,
  emailType: 'dgr_welcome',
  contributorId: 'contributor-uuid',
  templateId: 'template-uuid',
  resendApiKey: RESEND_API_KEY,
  supabase: supabaseAdmin
});
```

### Template Functions

#### `getEmailTemplate(supabase, templateKey, context)`
Get any template by key and context.

```javascript
const template = await getEmailTemplate(supabase, 'welcome', 'platform');
// Returns: { subject, body, variables }
```

#### `getCourseEmailTemplate(supabase, courseId, templateKey)`
Get course-specific template.

```javascript
const template = await getCourseEmailTemplate(supabase, courseId, 'welcome_enrolled');
```

#### `getDgrEmailTemplate(supabase, templateKey)`
Get DGR template.

```javascript
const template = await getDgrEmailTemplate(supabase, 'reminder');
```

#### `renderTemplate(template, variables)`
Replace `{{variable}}` placeholders with values.

```javascript
const rendered = renderTemplate('Hello {{firstName}}!', { firstName: 'John' });
// Returns: 'Hello John!'
```

---

## UI Components

### EmailTemplateEditor
Unified template editor component supporting any context.

```svelte
<EmailTemplateEditor
  template={selectedTemplate}
  context="course"
  contextId={courseId}
  apiBaseUrl="/api/courses/my-course/emails"
  branding={{
    name: 'My Course',
    logoUrl: '/logo.png',
    accentDark: '#334642',
    footerText: "You're enrolled in this course."
  }}
  variables={customVariables}
  onSave={handleSave}
/>
```

**Props:**
| Prop | Type | Description |
|------|------|-------------|
| `template` | Object | Template to edit (null for new) |
| `context` | String | 'course', 'dgr', or 'platform' |
| `contextId` | String | Context-specific ID (e.g., course_id) |
| `apiBaseUrl` | String | API endpoint base URL |
| `branding` | Object | { name, logoUrl, accentDark, footerText } |
| `variables` | Array | Custom variables (uses defaults if empty) |
| `onSave` | Function | Called after successful save |
| `onCancel` | Function | Called when cancelled |

### EmailPreviewFrame
Branded email preview wrapper.

```svelte
<EmailPreviewFrame
  brandName="My Course"
  logoUrl="/logo.png"
  accentDark="#334642"
  footerText="Custom footer message"
>
  <p>Email content here</p>
</EmailPreviewFrame>
```

### EmailBodyEditor
Rich text editor with toolbar and variable picker.

```svelte
<EmailBodyEditor
  value={bodyHtml}
  onchange={handleChange}
  brandName="My Course"
  logoUrl="/logo.png"
  accentDark="#334642"
  footerText="Footer text"
  availableVariables={variables}
/>
```

### TestEmailPanel
Unified test email modal with native MJML preview.

```svelte
<TestEmailPanel
  context="dgr"
  contextId={null}
  template={{ subject_template, body_template }}
  branding={{ name: 'DGR', logoUrl, accentDark: '#009199' }}
  currentUserEmail="admin@example.com"
  testApiUrl="/api/emails/test"
  onClose={() => showTestPanel = false}
/>
```

**Features:**
- **Real recipient selection**: Dropdown to preview with actual user data
- **Native MJML preview**: Server-side compilation displayed in iframe (pixel-perfect)
- **Sample data fallback**: Works without selecting a real recipient

---

## API Endpoints

### Unified Test Email
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/emails/test` | Send test email OR get MJML preview |

**Request body:**
```json
{
  "context": "course|dgr|platform",
  "context_id": "optional-id",
  "recipient_id": "uuid|null",
  "to": "test@example.com",
  "subject_template": "Subject with {{variable}}",
  "body_template": "<p>Body HTML</p>",
  "branding": { "name": "...", "logo_url": "...", "accent_dark": "#009199" },
  "preview_only": false
}
```

**With `preview_only: true`**: Returns rendered HTML without sending
```json
{ "success": true, "preview": true, "subject": "Rendered subject", "html": "<full MJML output>" }
```

### Course Emails
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/courses/[slug]/emails` | List all templates |
| POST | `/api/courses/[slug]/emails` | Create custom template |
| PUT | `/api/courses/[slug]/emails` | Update template |
| DELETE | `/api/courses/[slug]/emails?template_id=...` | Delete custom template |
| PATCH | `/api/courses/[slug]/emails` | Restore to default / generate missing |
| POST | `/api/courses/[slug]/emails/test` | Send test email |
| POST | `/api/courses/[slug]/emails/send` | Send to recipients |

### DGR Emails
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dgr/templates` | List all DGR templates |
| GET | `/api/dgr/templates?key=welcome` | Get specific template |
| PUT | `/api/dgr/templates` | Update template (accepts `template_id` or `id`) |
| POST | `/api/dgr/welcome` | Send welcome email(s) |
| POST | `/api/dgr/reminder` | Send reminder email |

*Note: DGR test emails use unified `/api/emails/test` endpoint*

### DGR Email Logs
DGR emails are logged to `platform_email_log` with `metadata->>'context' = 'dgr'`.
View logs at `/dgr/emails?view=logs`.

---

## Email Branding

All emails are wrapped with consistent branding using MJML compilation for Outlook compatibility.

### Default Branding
- **Courses:** Uses course accent colors and logo
- **DGR:** Teal theme (`#009199`)
- **Platform:** Default Archdiocesan Ministries branding

### Bulletproof Buttons
Use `createEmailButton()` for Outlook-compatible buttons:

```javascript
import { createEmailButton } from '$lib/utils/email-service.js';

const button = createEmailButton(
  'Click Here',           // Button text
  'https://example.com',  // URL
  '#009199',              // Background color
  { width: 220, height: 50, borderRadius: 6 }
);
```

This generates VML for Outlook + standard HTML/CSS for other clients.

---

## Migration Notes

The system was unified from three separate tables:
- `courses_email_templates` → `email_templates` (context='course')
- `dgr_email_templates` → `email_templates` (context='dgr')
- `platform_email_templates` → `email_templates` (context='platform')

All existing data was migrated. The old tables no longer exist.

---

## Files Reference

### Core
| File | Purpose |
|------|---------|
| `src/lib/utils/email-service.js` | Core email functions |
| `src/lib/email/compiler.js` | MJML email compilation |
| `src/lib/email/context-config.ts` | Context registry (SSOT for courses/dgr/platform) |

### Components
| File | Purpose |
|------|---------|
| `src/lib/components/EmailTemplateEditor.svelte` | Unified template editor |
| `src/lib/components/EmailBodyEditor.svelte` | Rich text editor with toolbar |
| `src/lib/components/EmailPreviewFrame.svelte` | Branded preview wrapper |
| `src/lib/components/TestEmailPanel.svelte` | Unified test email modal |
| `src/lib/components/TipTapEmailEditor.svelte` | WYSIWYG core (buttons, variables, dividers) |
| `src/lib/components/SendEmailView.svelte` | Course bulk send view |
| `src/lib/components/EmailSenderModal.svelte` | Course bulk send modal |
| `src/lib/components/EmailTreeSidebar.svelte` | Course template navigation |

### API Endpoints
| File | Purpose |
|------|---------|
| `src/routes/api/emails/test/+server.ts` | Unified test email API |
| `src/routes/api/courses/[slug]/emails/+server.ts` | Course email CRUD |
| `src/routes/api/courses/[slug]/emails/send/+server.ts` | Course bulk send |
| `src/routes/api/dgr/templates/+server.js` | DGR template API |
| `src/routes/api/dgr/welcome/+server.js` | DGR welcome email sender |
| `src/routes/api/dgr/reminder/+server.js` | DGR reminder email sender |

### Admin UI
| File | Purpose |
|------|---------|
| `src/routes/admin/courses/[slug]/emails/` | Course email admin |
| `src/routes/dgr/emails/` | DGR email admin (templates + logs) |

---

## Recent Updates (Dec 2025)

### Unified Test Email System ✅
- **TestEmailPanel component**: Unified modal for all contexts (courses, DGR, platform)
- **Native MJML preview**: Server compiles template, displays in iframe (pixel-perfect)
- **Real recipient selection**: Dropdown to preview with actual user data
- **Unified endpoint**: `/api/emails/test` with `preview_only` mode for preview without sending
- **Deleted old endpoints**: Removed context-specific test endpoints

### Context-Aware Button Colors ✅
- **TipTapEmailEditor**: Added `accentColor` prop using CSS custom property
- **Courses**: Dark green (`#334642`)
- **DGR**: Teal (`#009199`)
- Buttons now render with correct color in editor

### DGR Email Logs ✅
- Added "Email Logs" view at `/dgr/emails?view=logs`
- Queries `platform_email_log` where `metadata->>'context' = 'dgr'`
- Shows date, recipient, subject, template, status

### Bulk Send Confirmation ✅
- **SendEmailView**: Added ConfirmationModal before sending
- **EmailSenderModal**: Same confirmation pattern
- Shows recipient count, subject preview, first 3 names

### Button Parsing Fix ✅
- Fixed `parseHTML` in TipTapEmailEditor to extract `data-text` and `data-href` attributes
- Buttons now load correctly when editing saved templates

### Other Fixes
- **Sticky toolbar**: Fixed for both courses and DGR
- **Platform logo in DGR**: Uses logo from platform settings
- **Variable picker dropdown**: `{ }` button with floating dropdown
- **Deleted dead code**: Removed unused EmailComposer, EmailTemplateCard, EmailTemplateEditorModal

### Design Decisions

#### Button Variables vs Editor Buttons
Two ways to add buttons:

1. **Variable-based** (`{{write_url_button}}`):
   - Server replaces with pre-styled HTML at send time
   - Shows as variable pill in editor
   - Fixed text and styling

2. **Editor buttons** (recommended):
   - Use toolbar "Insert Button" feature
   - Set URL to `{{write_url}}` for dynamic links
   - Full preview in editor with correct colors
   - Customizable text

**Recommendation:** Use editor buttons for flexibility.

---

## TODO / Future Improvements

### Completed ✅
- [x] Test with sample data
- [x] Test with real user data (recipient dropdown)
- [x] Native MJML preview in test panel
- [x] Confirmation before bulk sending
- [x] DGR email logs

### Still TODO

#### Platform
- [ ] Admin UI for platform email templates
- [ ] Use cases TBD (password reset, announcements?)

#### Nice to Have
- [ ] Delivery tracking via Resend webhooks (foundation exists: `resend_id` stored)
- [ ] Resend failed emails
- [ ] Consolidate SendEmailView + EmailSenderModal (~1400 lines of duplication)
- [ ] Group variables by category in picker
- [ ] Search/filter for templates with many variables

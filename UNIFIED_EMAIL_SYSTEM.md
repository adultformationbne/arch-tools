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

---

## API Endpoints

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
| POST | `/api/dgr/templates/test` | Send test email |
| POST | `/api/dgr/welcome` | Send welcome email(s) |
| POST | `/api/dgr/reminder` | Send reminder email |

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

| File | Purpose |
|------|---------|
| `src/lib/utils/email-service.js` | Core email functions |
| `src/lib/components/EmailTemplateEditor.svelte` | Unified template editor (used by courses & DGR) |
| `src/lib/components/EmailPreviewFrame.svelte` | Branded preview wrapper |
| `src/lib/components/EmailBodyEditor.svelte` | Rich text editor |
| `src/lib/server/course-email-templates.ts` | Course template generation |
| `src/lib/server/default-email-templates.ts` | Default template definitions |
| `src/lib/email/compiler.js` | MJML email compilation |
| `src/routes/api/courses/[slug]/emails/+server.ts` | Course email API |
| `src/routes/api/courses/[slug]/emails/test/+server.ts` | Course test email API |
| `src/routes/api/dgr/templates/+server.js` | DGR template API |
| `src/routes/api/dgr/templates/test/+server.js` | DGR test email API |
| `src/routes/api/dgr/welcome/+server.js` | DGR welcome email sender |
| `src/routes/api/dgr/reminder/+server.js` | DGR reminder email sender |
| `src/routes/admin/courses/[slug]/emails/` | Course email admin UI |
| `src/routes/dgr/emails/` | DGR email admin UI (uses unified EmailTemplateEditor) |

---

## Recent Updates (Dec 2025)

### Completed
- **Sticky toolbar fix**: Fixed toolbar sticking behavior for both courses (`h-screen`) and DGR (changed from `min-h-screen` to `h-screen`)
- **Platform logo in DGR**: DGR email editor now uses the platform logo from settings
- **Branding props unified**: EmailBodyEditor accepts both `brandName` and `courseName` (backwards compatible)
- **Variable picker dropdown**: Added `{ }` button in toolbar with floating dropdown (uses `dropdown.js` for proper positioning)
- **Variable display consistency**: Fixed ButtonEditorPopover to show `{{variable}}` with double braces

### Design Decisions

#### Button Variables vs Editor Buttons
There are two ways to add buttons to emails:

1. **Variable-based** (`{{write_url_button}}`):
   - Server replaces with pre-styled HTML at send time
   - Cannot preview in editor (shows as variable pill)
   - Fixed text and styling

2. **Editor buttons** (recommended):
   - Use toolbar "Insert Button" feature
   - Set URL to `{{write_url}}` for dynamic links
   - Full preview in editor
   - Customizable text

**Recommendation:** Use editor buttons for flexibility. Consider deprecating `write_url_button` variable.

---

## TODO / Needs Design

### Test Email System
Currently test emails use placeholder values for variables. Need to design:

1. **Test with sample data**: Current behavior - shows `{{firstName}}` → "John" etc.

2. **Test with real user data**: Select an actual recipient to preview real variable values
   - **Courses**: Select a student from cohort to see their actual name, hub, etc.
   - **DGR**: Select a contributor to see their portal URL, assigned dates, etc.

3. **Questions to resolve**:
   - Should test emails go to a custom address or the selected user's actual email?
   - How to handle context-dependent variables (e.g., session info) in test mode?
   - Should we show a preview panel with rendered variables before sending?

### Send Email Flow
Need to design the "Send Email" workflow for each context:

#### Courses (`/admin/courses/[slug]/emails?view=send`)
- [x] Template selection
- [x] Recipient filtering (by cohort, hub)
- [ ] Preview with real user data
- [ ] Confirmation before sending
- [ ] Batch sending with progress indicator
- [ ] Email log integration

#### DGR
- [x] Welcome email to individual contributors
- [x] Reminder email to contributors with upcoming deadlines
- [ ] Bulk send to multiple contributors
- [ ] Preview with real contributor data

#### Platform
- [ ] Admin UI for platform templates
- [ ] Use cases TBD (password reset, announcements?)

### Variable Picker Improvements
- [ ] Group variables by category (recipient info, links, dates)
- [ ] Show which variables are "context-dependent" (only available in certain sends)
- [ ] Search/filter for templates with many variables

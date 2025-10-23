# Email System Documentation

## Overview

The arch-tools platform has a centralized email system that handles all email sending, logging, and template management. This system uses **Resend** as the email service provider and stores all sent emails in the database for tracking and auditing.

## Quick Start

### Send a Simple Email

```javascript
import { sendEmail, textToHtml } from '$lib/utils/email-service.js';

const result = await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome!',
  html: textToHtml('Welcome to our platform!'),
  emailType: 'adhoc',
  resendApiKey: env.RESEND_API_KEY,
  supabase: supabase
});

if (result.success) {
  console.log('Email sent!', result.emailId);
}
```

### Send Using a Template

```javascript
import { getEmailTemplate, renderTemplate, textToHtml, sendEmail } from '$lib/utils/email-service.js';

// 1. Fetch template from database
const template = await getEmailTemplate(supabase, 'session_advance');

// 2. Render with variables
const subject = renderTemplate(template.subject, {
  cohortName: 'Introduction to Scripture',
  sessionTitle: 'The Gospels'
});

const body = renderTemplate(template.body, {
  studentName: 'John',
  cohortName: 'Introduction to Scripture',
  sessionTitle: 'The Gospels',
  sessionNumber: '3',
  customNote: 'Please complete your reflection by Friday!',
  courseLink: 'https://app.../cohorts/123',
  instructorName: 'Fr. Smith'
});

// 3. Send email
await sendEmail({
  to: student.email,
  subject,
  html: textToHtml(body),
  emailType: 'session_advance',
  referenceId: cohortId,
  resendApiKey: env.RESEND_API_KEY,
  supabase: supabase
});
```

### Use EmailComposer Component (Ad-hoc Emails)

```svelte
<script>
  import EmailComposer from '$lib/components/EmailComposer.svelte';

  const recipients = [
    { email: 'john@example.com', name: 'John Doe' },
    { email: 'jane@example.com', name: 'Jane Smith' }
  ];

  async function handleSend(subject, message) {
    // Your custom send logic here
    console.log('Sending:', subject, message);
  }
</script>

<EmailComposer
  {recipients}
  prefilledSubject="DGR Reminder"
  prefilledMessage="Your reflection is due in 3 days."
  emailType="dgr_reminder"
  onSend={handleSend}
/>
```

---

## Architecture

### Database Tables

#### `email_log`
Stores all sent emails for tracking and auditing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `recipient_email` | TEXT | Email recipient |
| `email_type` | TEXT | Type of email (for filtering) |
| `subject` | TEXT | Email subject |
| `body` | TEXT | Email body (HTML) |
| `sent_at` | TIMESTAMPTZ | When email was sent |
| `status` | TEXT | 'sent' or 'failed' |
| `error_message` | TEXT | Error details if failed |
| `resend_id` | TEXT | Resend email ID |
| `reference_id` | UUID | Optional reference (cohort_id, etc) |
| `metadata` | JSONB | Custom data |

#### `email_templates`
Platform-wide email templates with variable substitution.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `template_key` | TEXT | Unique key (e.g., 'session_advance') |
| `name` | TEXT | Display name |
| `subject_template` | TEXT | Subject with {{variables}} |
| `body_template` | TEXT | Body with {{variables}} |
| `available_variables` | TEXT[] | List of available variables |
| `is_active` | BOOLEAN | Enable/disable template |

#### Cohort Email Preferences
Stored in `cohorts.email_preferences` (JSONB):

```json
{
  "session_advance_enabled": true,
  "session_advance_custom_note": "Please complete reflections by Friday!",
  "send_from_name": "ACCF Platform"
}
```

---

## Email Types

### 1. **Automated Template Emails**

These use database templates and are triggered automatically.

#### Session Advance Notification
- **Template Key:** `session_advance`
- **Trigger:** Admin clicks "Advance to Next Session"
- **Recipients:** All students in cohort
- **Variables:** `studentName`, `cohortName`, `sessionTitle`, `sessionNumber`, `customNote`, `courseLink`, `instructorName`

#### Bulk Signup Invitation
- **Template Key:** `bulk_signup`
- **Trigger:** Admin invites students to cohort
- **Recipients:** Email list provided by admin
- **Variables:** `cohortName`, `courseName`, `startDate`, `magicLink`, `instructorEmail`

### 2. **Ad-hoc Manual Emails**

These are composed on-the-fly using the `EmailComposer` component.

#### DGR Reminder
- **Use Case:** Manually remind contributor their DGR is due
- **Component:** `<EmailComposer emailType="dgr_reminder" />`
- **Prefilled Message:** "Your Daily Gospel Reflection is due in 3 days."

#### Mid-Week Cohort Message
- **Use Case:** Send custom message to cohort students
- **Component:** `<EmailComposer emailType="cohort_message" />`
- **Prefilled Message:** (blank, fully custom)

#### Missed Reflection Reminder
- **Use Case:** Remind students about overdue reflections
- **Component:** `<EmailComposer emailType="reflection_reminder" />`
- **Prefilled Message:** "We noticed you haven't submitted your reflection yet..."

---

## Email Service API

### Core Functions

#### `sendEmail(options)`
Send an email and log it to the database.

**Parameters:**
```javascript
{
  to: string,              // Recipient email
  subject: string,         // Email subject
  html: string,            // HTML body
  emailType: string,       // Type for logging
  referenceId?: string,    // Optional reference ID
  metadata?: object,       // Optional custom data
  resendApiKey: string,    // Resend API key
  supabase: object         // Supabase client
}
```

**Returns:**
```javascript
{
  success: boolean,
  emailId?: string,        // Resend email ID
  error?: string           // Error message if failed
}
```

#### `renderTemplate(template, variables)`
Replace `{{variables}}` in template string.

**Example:**
```javascript
renderTemplate('Hi {{name}}!', { name: 'John' })
// Returns: 'Hi John!'
```

#### `textToHtml(text)`
Convert plain text to HTML email with professional formatting.

**Example:**
```javascript
textToHtml('Hello\nWorld')
// Returns: Styled HTML email with line breaks preserved
```

#### `getEmailTemplate(supabase, templateKey)`
Fetch email template from database.

**Returns:**
```javascript
{
  subject: string,         // Subject template
  body: string,            // Body template
  variables: string[]      // Available variables
}
```

#### `sendBulkEmails(options)`
Send multiple emails with rate limiting.

**Parameters:**
```javascript
{
  emails: [{to, subject, html}],  // Array of emails
  emailType: string,               // Type for logging
  resendApiKey: string,
  supabase: object
}
```

**Returns:**
```javascript
{
  sent: number,            // Count of successful sends
  failed: number,          // Count of failures
  errors: []               // Details of failures
}
```

#### `getEmailLogs(supabase, filters)`
Query email logs with filtering.

**Filters:**
```javascript
{
  emailType?: string,      // Filter by type
  status?: string,         // 'sent' or 'failed'
  referenceId?: string,    // Filter by reference
  limit?: number           // Max results (default 100)
}
```

---

## EmailComposer Component

Reusable Svelte component for ad-hoc email sending.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `recipients` | Array | `[]` | Array of `{email, name?}` objects |
| `prefilledSubject` | String | `''` | Pre-filled subject line |
| `prefilledMessage` | String | `''` | Pre-filled message body |
| `emailType` | String | `'adhoc'` | Email type for logging |
| `onSend` | Function | `null` | Custom send handler |

### Features

- ✅ Character count feedback
- ✅ Recipient list display
- ✅ Email preview
- ✅ Form validation
- ✅ Send confirmation
- ✅ Loading states
- ✅ Automatic toast notifications

### Example Usage

```svelte
<script>
  import EmailComposer from '$lib/components/EmailComposer.svelte';
  import { supabase } from '$lib/supabase.js';
  import { env } from '$env/dynamic/private';
  import { sendEmail, textToHtml } from '$lib/utils/email-service.js';

  let students = $state([
    { email: 'student1@example.com', name: 'Student 1' },
    { email: 'student2@example.com', name: 'Student 2' }
  ]);

  async function handleSend(subject, message) {
    for (const student of students) {
      await sendEmail({
        to: student.email,
        subject,
        html: textToHtml(message),
        emailType: 'cohort_message',
        referenceId: cohortId,
        metadata: { studentId: student.id },
        resendApiKey: env.RESEND_API_KEY,
        supabase
      });
    }
  }
</script>

<EmailComposer
  recipients={students}
  emailType="cohort_message"
  onSend={handleSend}
/>
```

---

## Configuration

### Environment Variables

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

### Verified Domain

**Domain:** `app.archdiocesanministries.org.au`
**From Address:** `noreply@app.archdiocesanministries.org.au`

To change the from address, edit `FROM_EMAIL` in `/src/lib/utils/email-service.js`.

---

## Template Management

### Creating New Templates

```sql
INSERT INTO email_templates (
  template_key,
  name,
  description,
  subject_template,
  body_template,
  available_variables
) VALUES (
  'my_template',
  'My Custom Template',
  'Description of when this is used',
  'Subject with {{variable}}',
  'Body text with {{variable1}} and {{variable2}}',
  ARRAY['variable1', 'variable2']
);
```

### Editing Templates

Templates can be edited via database or through an admin UI (to be built).

**Via SQL:**
```sql
UPDATE email_templates
SET body_template = 'Updated template with {{variables}}'
WHERE template_key = 'session_advance';
```

### Deactivating Templates

```sql
UPDATE email_templates
SET is_active = false
WHERE template_key = 'old_template';
```

---

## Cohort Email Settings

### Configuring Email Preferences

```javascript
// Enable session advance emails with custom note
const emailPreferences = {
  session_advance_enabled: true,
  session_advance_custom_note: 'Please complete your reflection by Friday 5pm!',
  send_from_name: 'Fr. Smith - ACCF'
};

await supabase
  .from('cohorts')
  .update({ email_preferences: emailPreferences })
  .eq('id', cohortId);
```

### Reading Email Preferences

```javascript
const { data: cohort } = await supabase
  .from('cohorts')
  .select('email_preferences')
  .eq('id', cohortId)
  .single();

const customNote = cohort.email_preferences?.session_advance_custom_note || '';
```

---

## Monitoring & Logging

### View Recent Emails

```javascript
import { getEmailLogs } from '$lib/utils/email-service.js';

// Get last 50 sent emails
const logs = await getEmailLogs(supabase, {
  status: 'sent',
  limit: 50
});
```

### View Failed Emails

```javascript
const failed = await getEmailLogs(supabase, {
  status: 'failed'
});

failed.forEach(email => {
  console.log(`Failed to send to ${email.recipient_email}: ${email.error_message}`);
});
```

### View Emails for Specific Cohort

```javascript
const cohortEmails = await getEmailLogs(supabase, {
  referenceId: cohortId,
  limit: 100
});
```

---

## Best Practices

### 1. Always Log Emails
The `sendEmail()` function automatically logs all emails. Never bypass this.

### 2. Use Templates for Recurring Emails
Don't hardcode email content. Use database templates for consistency.

### 3. Test Before Bulk Sending
Use the "Send test email" feature in `EmailComposer` before sending to all recipients.

### 4. Handle Errors Gracefully
```javascript
const result = await sendEmail({...});

if (!result.success) {
  console.error('Email failed:', result.error);
  // Handle error (retry, notify admin, etc)
}
```

### 5. Use Metadata for Context
Store useful context in the `metadata` field:

```javascript
await sendEmail({
  ...,
  metadata: {
    cohortId,
    sessionNumber,
    triggeredBy: userId,
    timestamp: new Date().toISOString()
  }
});
```

### 6. Rate Limiting
When sending bulk emails, use `sendBulkEmails()` which includes rate limiting:

```javascript
await sendBulkEmails({
  emails: students.map(s => ({
    to: s.email,
    subject: 'Welcome!',
    html: textToHtml('Welcome to the course!')
  })),
  emailType: 'bulk_welcome',
  resendApiKey,
  supabase
});
```

---

## Troubleshooting

### Email Not Sending

1. **Check Resend API key** - Verify `RESEND_API_KEY` is set in `.env`
2. **Check domain** - Ensure `app.archdiocesanministries.org.au` is verified in Resend
3. **Check logs** - Query `email_log` table for error messages
4. **Check recipient** - In test mode, you can only send to verified email addresses

### Template Variables Not Replacing

```javascript
// ❌ Wrong - missing variable
renderTemplate('Hi {{name}}!', {}) // Returns: 'Hi !'

// ✅ Correct - provide all variables
renderTemplate('Hi {{name}}!', { name: 'John' }) // Returns: 'Hi John!'
```

### Rate Limiting Issues

Resend has rate limits. If sending bulk emails:
- Use `sendBulkEmails()` which includes delays
- Consider queueing large batches
- Monitor for 429 errors in logs

---

## Future Enhancements

### Planned Features

- [ ] Admin UI for template editing
- [ ] Email scheduling (send later)
- [ ] Email analytics dashboard
- [ ] A/B testing for templates
- [ ] Unsubscribe management
- [ ] Email template preview tool
- [ ] Retry failed emails
- [ ] Email delivery webhooks

---

## File Reference

| File | Purpose |
|------|---------|
| `/src/lib/utils/email-service.js` | Core email service functions |
| `/src/lib/components/EmailComposer.svelte` | Reusable email composer UI |
| `/src/routes/api/email/send-bulk/+server.js` | Bulk email API endpoint (to be created) |
| `/supabase/migrations/*_create_email_templates_system.sql` | Database schema |
| `/EMAIL_SYSTEM.md` | This documentation |

---

## Support

For questions or issues with the email system:
1. Check this documentation
2. Review code comments in `email-service.js`
3. Check `email_log` table for errors
4. Review Resend dashboard for delivery status

---

*Last updated: 2025-10-16*
*Version: 1.0.0*
*Maintainer: Liam Desic*

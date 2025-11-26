# Email System Redesign - Implementation Plan

**Created:** November 26, 2025
**Status:** Planning

---

## Overview

Redesign the email system to consolidate all email functionality into `/admin/courses/[slug]/emails` with an improved UX that supports both template-based emails and quick one-off messages.

### Key Changes
1. **Send Email** becomes the primary entry point (not Email Logs)
2. **Quick Email vs Template** - Progressive disclosure for two paths
3. **Inline template editing** - Edit templates without leaving Send Email page
4. **Smart recipient filters** - Filter by hub, coordinator, session, outstanding reflections
5. **Remove modal approach** - Dashboard button navigates to `/emails` instead of opening modal

---

## Current State

### Existing Components
| Component | Location | Purpose |
|-----------|----------|---------|
| `EmailTreeSidebar.svelte` | `$lib/components/` | Tree navigation (Logs, System Templates, Custom Templates) |
| `EmailTemplateEditor.svelte` | `$lib/components/` | Full template editor with TipTap |
| `TipTapEmailEditor.svelte` | `$lib/components/` | Rich text email editor with variable support |
| `EmailCohortModal.svelte` | `$lib/components/` | Modal for sending to cohort (to be deprecated) |
| `+page.svelte` | `routes/admin/courses/[slug]/emails/` | Current email management page |

### Current Sidebar Structure
```
EMAIL MANAGEMENT
├─ Email Logs (default)
├─ System Templates (4)
│   ├─ Login Instructions
│   ├─ Reflection Reminder
│   ├─ Session Materials Ready
│   └─ Welcome to Course
└─ Custom Templates (n)
```

### Database Schema (No Changes Needed)
- `courses_email_templates` - Template storage (system + custom)
- `platform_email_log` - Email send history
- `courses_enrollments` - Recipient data with hub_id, role, current_session
- `courses_hubs` - Hub information for filtering
- `courses_reflection_responses` - For "outstanding reflections" filter

---

## Proposed Design

### New Sidebar Structure
```
EMAIL MANAGEMENT
├─ 📤 Send Email          ← NEW: Default view, Quick/Template choice
├─ 📋 Email Logs
├─ 📁 System Templates (4)
│   ├─ Login Instructions
│   ├─ Reflection Reminder
│   ├─ Session Materials Ready
│   └─ Welcome to Course
└─ 📁 Custom Templates (n)
    └─ [custom templates]
```

### Send Email Page Flow

**Step 1: Choose Path**
```
┌─────────────────────────────────────────────────────────────┐
│  Send Email                                                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   How would you like to compose this email?                 │
│                                                             │
│   ┌─────────────────────┐  ┌─────────────────────┐         │
│   │  ✏️  Quick Email     │  │  📄 Use a Template  │         │
│   │                     │  │                     │         │
│   │  Write a one-off    │  │  Select from your   │         │
│   │  message directly   │  │  saved templates    │         │
│   └─────────────────────┘  └─────────────────────┘         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Step 2a: Quick Email Mode**
```
┌─────────────────────────────────────────────────────────────┐
│  Send Email › Quick Email                      [← Back]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Subject: [________________________________________]        │
│                                                             │
│  Message:                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [TipTap Editor with variable insertion]              │   │
│  │                                                      │   │
│  │ Hi {{firstName}},                                    │   │
│  │                                                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Recipients: [Filter selector - see below]        (12)      │
│                                                             │
│  [Preview] [Send Test]                    [Send to 12 →]   │
└─────────────────────────────────────────────────────────────┘
```

**Step 2b: Template Mode**
```
┌─────────────────────────────────────────────────────────────┐
│  Send Email › Use Template                     [← Back]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Template: [Reflection Reminder ▼]              [✏️ Edit]   │
│                                                             │
│  ┌─ Subject ────────────────────────────────────────────┐  │
│  │ Reflection Reminder for {{courseName}}               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─ Preview ────────────────────────────────────────────┐  │
│  │ Hi {{firstName}},                                    │  │
│  │                                                      │  │
│  │ Just a reminder to complete your Session 3...        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Recipients: [Filter selector]                    (12)      │
│                                                             │
│  [Send Test]                                  [Send to 12 →]│
└─────────────────────────────────────────────────────────────┘
```

**Step 2b (Edit Mode Active):**
```
┌─────────────────────────────────────────────────────────────┐
│  Send Email › Use Template                     [← Back]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Template: [Reflection Reminder ▼]           Editing...     │
│                                                             │
│  Subject: [Reflection Reminder for {{courseName}}      ]    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ [TipTap toolbar: B I U | Link | Variable ▼]         │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │ Hi {{firstName}},                                   │   │
│  │                                                      │   │
│  │ Just a reminder to complete your...                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Cancel]    [💾 Save to Template]  [📤 Send without saving]│
│                                                             │
│  Recipients: [Filter selector]                    (12)      │
└─────────────────────────────────────────────────────────────┘
```

### Recipient Filter Options

```
┌─────────────────────────────────────────────────────────────┐
│ Recipients                                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ○ All Enrolled Students                          (47)      │
│                                                             │
│  ○ By Cohort                                                │
│    └─ [Module 3 - 2025 ▼]                         (12)      │
│                                                             │
│  ○ By Hub                                                   │
│    └─ [St. Mary's Parish ▼]                       (8)       │
│                                                             │
│  ○ Hub Coordinators Only                          (6)       │
│                                                             │
│  ○ By Session Progress                                      │
│    └─ [Students on Session ▼] [3 ▼]              (15)      │
│                                                             │
│  ○ Outstanding Reflections                                  │
│    └─ [For Session ▼] [Any ▼]                    (9)       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Tasks

### Phase 1: Sidebar & Navigation (2-3 hours)

#### 1.1 Update EmailTreeSidebar.svelte
- [ ] Add "Send Email" as first item with `Mail` icon
- [ ] Change default `selectedView` from `'logs'` to `'send'`
- [ ] Add visual distinction (primary action styling)

```svelte
<!-- New Send Email button at top -->
<button
  onclick={() => handleViewChange('send')}
  class="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors {selectedView === 'send' ? '...' : '...'}"
>
  <Mail size={16} />
  <span class="text-sm font-semibold">Send Email</span>
</button>
```

#### 1.2 Update Dashboard "Email Everyone" Button
- [ ] Change from opening modal to navigating to `/emails?mode=quick`
- [ ] Location: Dashboard component where `EmailCohortModal` is triggered

---

### Phase 2: Send Email Page Component (4-6 hours)

#### 2.1 Create SendEmailView.svelte
New component for the Send Email view with:

**State Management:**
```javascript
let mode = $state('choose'); // 'choose' | 'quick' | 'template'
let selectedTemplateId = $state('');
let isEditing = $state(false);
let editedSubject = $state('');
let editedBody = $state('');

// Quick email state
let quickSubject = $state('');
let quickBody = $state('');

// Recipients state
let recipientFilter = $state('all'); // 'all' | 'cohort' | 'hub' | 'coordinators' | 'session' | 'reflections'
let filterValue = $state(null);
let filteredRecipients = $derived(/* computed from filter */);
```

**Key Functions:**
```javascript
// Template editing actions
function startEditing() { isEditing = true; editedSubject = template.subject; editedBody = template.body; }
function cancelEditing() { isEditing = false; /* reset state */ }
async function saveToTemplate() { /* API call to save */ isEditing = false; }
function sendWithoutSaving() { /* send with edited content, don't persist */ }

// Send actions
async function sendEmail() { /* POST to /api/courses/[slug]/send-email */ }
async function sendTestEmail(to: string) { /* POST to /api/courses/[slug]/emails/test */ }
```

#### 2.2 Integrate TipTap for Quick Email
- [ ] Reuse `TipTapEmailEditor.svelte` for quick email composition
- [ ] Support basic variables: `{{firstName}}`, `{{courseName}}`, `{{cohortName}}`
- [ ] Show email preview wrapped in course branding

---

### Phase 3: Recipient Filter System (3-4 hours)

#### 3.1 Create RecipientFilter.svelte
New component for smart filtering:

```svelte
<script>
  let {
    courseId,
    cohorts = [],
    hubs = [],
    onFilterChange = (recipients) => {}
  } = $props();

  let filterType = $state('all');
  let cohortId = $state('');
  let hubId = $state('');
  let sessionNumber = $state(null);
  let reflectionSession = $state(null);
</script>
```

#### 3.2 Add API Endpoint for Filtered Recipients
- [ ] Extend `/api/courses/[slug]/enrollments` or create new endpoint
- [ ] Support query params: `?filter=hub&hub_id=xxx`
- [ ] Support `?filter=outstanding_reflections&session=3`

**SQL for Outstanding Reflections:**
```sql
SELECT e.* FROM courses_enrollments e
JOIN courses_cohorts c ON e.cohort_id = c.id
WHERE c.module_id = $moduleId
  AND e.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM courses_reflection_responses r
    JOIN courses_reflection_questions q ON r.question_id = q.id
    JOIN courses_sessions s ON q.session_id = s.id
    WHERE r.enrollment_id = e.id
      AND s.session_number = $sessionNumber
  )
```

---

### Phase 4: Page Integration (2-3 hours)

#### 4.1 Update emails/+page.svelte
- [ ] Add `'send'` view handler
- [ ] Import and render `SendEmailView.svelte`
- [ ] Pass required data (templates, cohorts, hubs, course info)

```svelte
{#if selectedView === 'send'}
  <SendEmailView
    {templates}
    {cohorts}
    {hubs}
    {courseInfo}
    initialMode={$page.url.searchParams.get('mode') || 'choose'}
  />
{:else if selectedView === 'logs'}
  <!-- existing logs view -->
{:else if selectedTemplate}
  <!-- existing template editor view -->
{/if}
```

#### 4.2 Update emails/+page.server.ts
- [ ] Load cohorts for filter dropdown
- [ ] Load hubs for filter dropdown
- [ ] Load current session counts per cohort

```typescript
// Add to load function
const { data: cohorts } = await supabaseAdmin
  .from('courses_cohorts')
  .select('id, name, current_session, module_id')
  .eq('module_id', moduleId)
  .order('start_date', { ascending: false });

const { data: hubs } = await supabaseAdmin
  .from('courses_hubs')
  .select('id, name')
  .eq('course_id', courseInfo.id);
```

---

### Phase 5: Quick Email API (1-2 hours)

#### 5.1 Update send-email endpoint
- [ ] Support sending without template_id
- [ ] Accept raw `subject` and `body_html` for quick emails
- [ ] Log with `email_type: 'quick'` and no template_id

**Request body options:**
```typescript
// Template-based send
{ template_id: 'uuid', recipients: ['uuid'], cohort_id: 'uuid' }

// Quick email send
{ subject: 'string', body_html: 'string', recipients: ['uuid'], cohort_id: 'uuid' }

// Template with inline edits (send without saving)
{ template_id: 'uuid', subject_override: 'string', body_override: 'string', recipients: ['uuid'] }
```

---

### Phase 6: Deprecate Modal (1 hour)

#### 6.1 Update Dashboard
- [ ] Remove `EmailCohortModal` usage from dashboard
- [ ] Change "Email Everyone" button to navigate:
  ```javascript
  goto(`/admin/courses/${slug}/emails?mode=quick&cohort=${cohortId}`)
  ```
- [ ] Consider keeping modal for other contexts (optional)

---

## File Changes Summary

### New Files
| File | Purpose |
|------|---------|
| `$lib/components/SendEmailView.svelte` | Main send email view with mode switching |
| `$lib/components/RecipientFilter.svelte` | Smart recipient filtering UI |

### Modified Files
| File | Changes |
|------|---------|
| `EmailTreeSidebar.svelte` | Add "Send Email" as first item |
| `emails/+page.svelte` | Add `'send'` view, integrate SendEmailView |
| `emails/+page.server.ts` | Load cohorts, hubs for filters |
| `/api/courses/[slug]/send-email/+server.ts` | Support quick emails without template |
| Dashboard component | Remove modal, add navigation |

### Files to Eventually Deprecate
| File | Reason |
|------|--------|
| `EmailCohortModal.svelte` | Replaced by Send Email page |

---

## URL Structure

| URL | View |
|-----|------|
| `/emails` | Send Email (choice screen) |
| `/emails?mode=quick` | Send Email (quick mode) |
| `/emails?mode=template` | Send Email (template mode) |
| `/emails?mode=template&template=uuid` | Pre-selected template |
| `/emails?mode=quick&cohort=uuid` | Quick email with pre-selected cohort |
| `/emails?view=logs` | Email logs |
| `/emails?view=uuid` | Template editor (existing) |
| `/emails?view=new` | Create new template (existing) |

---

## Svelte 5 Patterns to Follow

Per `SVELTE5_BEST_PRACTICES.md`:

```javascript
// State
let mode = $state('choose');
let recipients = $state([]);

// Derived
const filteredRecipients = $derived(
  recipients.filter(r => applyFilter(r, filterType, filterValue))
);

// Props
let { templates = [], onSend = () => {} } = $props();

// Events
<button onclick={handleSend}>Send</button>

// Direct mutation (not immutable updates)
recipients.push(newRecipient); // ✅ Works with $state
```

---

## Testing Checklist

- [ ] Can navigate to Send Email from sidebar
- [ ] Can switch between Quick Email and Template modes
- [ ] Quick Email: Can compose and send
- [ ] Template: Can select template and see preview
- [ ] Template: Can edit inline and save to template
- [ ] Template: Can edit inline and send without saving
- [ ] Filter: All enrolled works
- [ ] Filter: By cohort works
- [ ] Filter: By hub works
- [ ] Filter: Coordinators only works
- [ ] Filter: By session progress works
- [ ] Filter: Outstanding reflections works
- [ ] Test email sends correctly
- [ ] Email logs show sent emails
- [ ] Dashboard button navigates correctly

---

## Estimated Timeline

| Phase | Hours | Description |
|-------|-------|-------------|
| Phase 1 | 2-3h | Sidebar & navigation updates |
| Phase 2 | 4-6h | SendEmailView component |
| Phase 3 | 3-4h | Recipient filter system |
| Phase 4 | 2-3h | Page integration |
| Phase 5 | 1-2h | Quick email API |
| Phase 6 | 1h | Deprecate modal |
| **Total** | **13-19h** | Full implementation |

---

## Open Questions

1. **State preservation when editing template**: Should URL params capture cohort selection to restore on browser back?

2. **Quick email variables**: Which variables to support? Full 18 or just basics (firstName, courseName, cohortName)?

3. **Recipient preview**: Show recipient list in a collapsible panel, or just count?

4. **Combined filters**: Allow AND combinations (e.g., Hub X + Outstanding reflections)?

---

## Next Steps

1. Review this plan
2. Clarify any open questions
3. Begin Phase 1 implementation

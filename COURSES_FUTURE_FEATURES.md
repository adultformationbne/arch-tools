# Courses Platform - Future Features Plan

**Created:** January 14, 2026
**Status:** Planning

---

## Overview

This document outlines planned features for self-service enrollment with Stripe payments and async/self-paced course progression.

---

## 1. Course Management Model

Instead of binary "facilitated vs async", use a **management model** that determines who's responsible for what.

### The Core Question: Who's in Charge?

```
┌─────────────────────────────────────────────────────────────────┐
│                    MANAGEMENT MODEL                              │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  ADMIN-LED      │  HUB-LED        │  SELF-DIRECTED              │
│                 │                 │                             │
│  Admin runs     │  Coordinators   │  Student manages            │
│  everything     │  run their      │  themselves                 │
│  centrally      │  groups         │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### Management Model Comparison

| Aspect | Admin-Led | Hub-Led | Self-Directed |
|--------|-----------|---------|---------------|
| **Progression** | Admin advances whole cohort | Coordinator advances their hub | Student advances themselves |
| **Reflections** | Admin marks | Coordinator marks | Auto-pass or disabled |
| **Hubs** | Optional | Required | Disabled |
| **Attendance** | Optional (if hubs on) | Optional | Disabled |
| **Timeline** | Fixed cohort dates | Fixed or flexible | Rolling / anytime |
| **Enrollment** | Admin invites | Admin or self-enroll | Self-enroll |

### Real-World Examples

**Admin-Led (current ACCF model):**
> "We run a structured 8-week course. Admin advances everyone to the next session each week. Instructors review and mark reflections. Students meet in hub groups with coordinators who track attendance."

**Hub-Led:**
> "We train hub coordinators, then they run their groups independently. Each coordinator decides when their group is ready to advance. They mark their students' reflections. Central admin just monitors."

**Self-Directed:**
> "Online course you can take anytime. Pay, get access, work at your own pace. No one marks your reflections - it's for personal growth. No attendance, no groups."

### Why This Works

**One choice, sensible defaults:**
- Pick "Hub-Led" → hubs are required, progression is per-hub, coordinator marks
- Pick "Self-Directed" → no hubs, no marking, student controls pace

**Minimal overrides:**
- Admin-Led + "disable hubs" = online cohort course with central admin
- Admin-Led + "auto-pass reflections" = structured but less admin work
- Self-Directed + "require sequential completion" = guided self-paced

### Settings Structure

```typescript
interface CourseSettings {
  // PRIMARY CHOICE - everything else flows from this
  managementModel: 'admin_led' | 'hub_led' | 'self_directed';

  // OVERRIDES (optional, model sets sensible defaults)
  overrides?: {
    // Admin-Led overrides
    hubsEnabled?: boolean;           // default: true for admin_led
    attendanceEnabled?: boolean;     // default: true if hubs enabled
    reflectionMarking?: 'admin' | 'auto_pass' | 'disabled';  // default: 'admin'

    // Self-Directed overrides
    progressionMode?: 'all_unlocked' | 'sequential' | 'time_drip';  // default: 'sequential'
    dripIntervalDays?: number;       // default: 7

    // Any model
    allowSelfEnrollment?: boolean;   // default: false for admin_led, true for self_directed
  };
}
```

### Default Behaviors by Model

**Admin-Led Defaults:**
```json
{
  "managementModel": "admin_led",
  "implied": {
    "progression": "admin_controls_cohort",
    "reflectionMarking": "admin",
    "hubsEnabled": true,
    "attendanceEnabled": true,
    "timeline": "fixed_dates",
    "selfEnrollment": false
  }
}
```

**Hub-Led Defaults:**
```json
{
  "managementModel": "hub_led",
  "implied": {
    "progression": "coordinator_controls_hub",
    "reflectionMarking": "coordinator",
    "hubsEnabled": true,
    "attendanceEnabled": true,
    "timeline": "flexible",
    "selfEnrollment": false
  }
}
```

**Self-Directed Defaults:**
```json
{
  "managementModel": "self_directed",
  "implied": {
    "progression": "student_controls_self",
    "reflectionMarking": "auto_pass",
    "hubsEnabled": false,
    "attendanceEnabled": false,
    "timeline": "rolling",
    "selfEnrollment": true
  }
}
```

### Edge Cases Handled

| Scenario | Solution |
|----------|----------|
| "Admin-led but no hubs (online)" | Admin-Led + override `hubsEnabled: false` |
| "Self-paced but I want to mark reflections" | Self-Directed + override `reflectionMarking: 'admin'` |
| "Hub groups but admin still marks reflections" | Admin-Led (not Hub-Led) with hubs enabled |
| "Coordinator runs group, but auto-pass reflections" | Hub-Led + override `reflectionMarking: 'auto_pass'` |
| "Fixed cohort dates but self-paced within that" | Admin-Led + override progression to student-controlled |

---

## 1b. Hub-Led Model Deep Dive

Hub-Led is the most complex model. Here's how it works:

### Progression: Per-Hub, Not Per-Cohort

**Current (Admin-Led):**
```
cohorts.current_session = 3  →  ALL students in cohort see session 3
```

**Hub-Led:**
```
courses_hubs.current_session = 3  →  Only THIS hub's students see session 3
Other hubs might be at session 2 or 4
```

**Database change:**
```sql
ALTER TABLE courses_hubs ADD COLUMN IF NOT EXISTS
  current_session INTEGER DEFAULT 0;
```

**Query change:**
```typescript
// Admin-Led: use cohort's session
const currentSession = enrollment.cohort.current_session;

// Hub-Led: use hub's session (or cohort's if no hub assigned)
const currentSession = enrollment.hub?.current_session ?? enrollment.cohort.current_session;
```

### Reflection Marking: Coordinator Permissions

**Current:** Only users with `courses.admin` or `courses.manager` module can mark reflections.

**Hub-Led:** Coordinators can mark reflections for students **in their hub only**.

**Implementation:**
```typescript
// In reflection marking API
async function canMarkReflection(userId, reflectionId) {
  const reflection = await getReflection(reflectionId);
  const studentEnrollment = reflection.enrollment;

  // Check if user is course admin (can mark anyone)
  if (await isCourseAdmin(userId, courseId)) return true;

  // Check if user is coordinator of this student's hub
  const coordinatorEnrollment = await getEnrollment(userId, cohortId);
  if (coordinatorEnrollment.role === 'coordinator' &&
      coordinatorEnrollment.hub_id === studentEnrollment.hub_id) {
    return true;
  }

  return false;
}
```

### Coordinator Dashboard Enhancements

For Hub-Led courses, the coordinator bar becomes a full dashboard:

```
┌─────────────────────────────────────────────────────────────┐
│  St Mary's Hub                           Session 3 of 8    │
├─────────────────────────────────────────────────────────────┤
│  [Advance to Session 4]    [View All Sessions]             │
├─────────────────────────────────────────────────────────────┤
│  Students (12)                                              │
│  ┌──────────────────┬────────────┬──────────────────────┐  │
│  │ Name             │ Attendance │ Reflection           │  │
│  ├──────────────────┼────────────┼──────────────────────┤  │
│  │ John Smith       │ ✓ Present  │ Submitted [Mark]     │  │
│  │ Jane Doe         │ ✓ Present  │ Passed ✓             │  │
│  │ Bob Wilson       │ - Absent   │ Not started          │  │
│  └──────────────────┴────────────┴──────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### What Admin Sees in Hub-Led

Admin dashboard shows hub progress overview:

```
┌─────────────────────────────────────────────────────────────┐
│  Cohort: Feb 2026 - Foundations        Hub-Led Course      │
├─────────────────────────────────────────────────────────────┤
│  Hub Progress                                               │
│  ┌──────────────────┬──────────┬────────┬────────────────┐ │
│  │ Hub              │ Session  │ Students│ Reflections   │ │
│  ├──────────────────┼──────────┼────────┼────────────────┤ │
│  │ St Mary's        │ 3        │ 12     │ 10/12 passed  │ │
│  │ Holy Spirit      │ 2        │ 8      │ 6/8 passed    │ │
│  │ Sacred Heart     │ 4        │ 15     │ 14/15 passed  │ │
│  └──────────────────┴──────────┴────────┴────────────────┘ │
│                                                             │
│  Admin can: View details, Send announcements, Export data  │
│  Admin cannot: Advance hubs (that's coordinator's job)     │
└─────────────────────────────────────────────────────────────┘
```

### Model Selection UI

Simple radio selection when creating a course:

```
Course Management Model:

○ Admin-Led (Recommended for structured programs)
  You control progression for all students. You mark reflections.
  Optional: Enable hub groups for in-person meetings.

○ Hub-Led (For distributed/franchise programs)
  Coordinators control their hub's progression. They mark reflections.
  You monitor overall progress but don't manage day-to-day.

○ Self-Directed (For online/self-paced courses)
  Students control their own progression. No marking required.
  Best for: paid online courses, reference materials.
```

---

## 1c. Hub-Specific Enrollment Links

For Hub-Led courses, coordinators need their own sign-up links that auto-assign to their hub.

### Flow

```
1. Admin creates course (Hub-Led)
2. Admin creates hub "St Mary's Parish" + assigns coordinator Jane
3. System generates: archmin.org/enroll/accf-feb-2026/st-marys
4. Jane shares link with her parish
5. Parishioners sign up → auto-assigned to St Mary's hub → Jane sees them
```

### Database

```sql
-- Extend enrollment_links to support hub-specific links
ALTER TABLE courses_enrollment_links ADD COLUMN IF NOT EXISTS
  hub_id UUID REFERENCES courses_hubs(id) ON DELETE CASCADE;

-- A cohort can have:
-- 1. General link (hub_id = NULL) → enrollee not assigned to hub, or picks hub
-- 2. Hub-specific links (hub_id set) → enrollee auto-assigned to that hub
```

### URL Structure

```
/enroll/[cohort-slug]              → General cohort enrollment
/enroll/[cohort-slug]/[hub-slug]   → Hub-specific enrollment
```

### Coordinator View

```
┌─────────────────────────────────────────────────────────────┐
│  Your Hub: St Mary's Parish                                 │
├─────────────────────────────────────────────────────────────┤
│  Invite Link                                                │
│  ┌────────────────────────────────────────────────────────┐│
│  │ archmin.org/enroll/foundations-2026/st-marys    [Copy] ││
│  └────────────────────────────────────────────────────────┘│
│  Share this link with your group. They'll be automatically │
│  added to your hub when they sign up.                      │
│                                                             │
│  [Generate QR Code]  [Share via Email]                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 1d. Certificates & Completion

### Completion Tracking

```sql
ALTER TABLE courses_enrollments ADD COLUMN IF NOT EXISTS
  completed_at TIMESTAMPTZ,
  certificate_issued_at TIMESTAMPTZ,
  certificate_id TEXT UNIQUE;  -- For verification: cert.archmin.org/ABC123
```

### Completion Criteria (Configurable per Course)

```typescript
interface CompletionCriteria {
  // What counts as "complete"?
  requireAllSessions: boolean;      // Must reach final session
  requireReflections: 'all' | 'passing' | 'none';
  requireAttendance: number | null; // Minimum % attendance, or null
}
```

**Examples:**
- Accredited course: All sessions + all reflections passed + 80% attendance
- Casual small group: All sessions completed (that's it)
- Self-directed: All sessions viewed

### Certificate Generation

Simple PDF with:
- Participant name
- Course name
- Completion date
- Certificate ID (for verification)
- Optional: Coordinator/admin signature

```
/api/certificates/[enrollment-id]/download  → Generate PDF
/verify/[certificate-id]                    → Public verification page
```

---

## 1e. Engagement Options Beyond Reflections

Not every course needs formal written reflections. Configurable per course:

### Engagement Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| **Full Reflections** | Written responses, marked by admin/coordinator | Accredited courses |
| **Simple Reflections** | Written responses, auto-passed on submit | Personal growth, no marking overhead |
| **Completion Only** | "Mark as complete" checkbox per session | Reference material, casual study |
| **Discussion Prompts** | Questions shown but not submitted (for group discussion) | Small group meetings |
| **Disabled** | No engagement tracking | Pure content delivery |

### Database

```sql
ALTER TABLE courses ADD COLUMN IF NOT EXISTS
  engagement_mode TEXT DEFAULT 'full_reflections'
  CHECK (engagement_mode IN (
    'full_reflections',
    'simple_reflections',
    'completion_only',
    'discussion_prompts',
    'disabled'
  ));
```

### UI Differences

**Full Reflections (current):**
```
Session 3 Reflection
[Rich text editor - 500 word response]
[Submit for Review]
Status: Awaiting marking
```

**Simple Reflections:**
```
Session 3 Reflection
[Rich text editor - personal response]
[Save Response]
Status: Complete ✓
```

**Completion Only:**
```
Session 3
[✓] I have completed this session
```

**Discussion Prompts:**
```
Session 3 - Discussion Questions
• What struck you most about this session's content?
• How does this apply to your daily life?
• Share an example from your own experience.

(Discuss these with your group - no written submission required)
```

---

## 1f. Hub Meeting Details

Coordinators can set meeting info visible to their hub members.

### Database

```sql
ALTER TABLE courses_hubs ADD COLUMN IF NOT EXISTS
  meeting_day TEXT,           -- 'tuesday'
  meeting_time TEXT,          -- '7:00 PM'
  meeting_location TEXT,      -- 'St Mary's Parish Hall, Room 2'
  meeting_notes TEXT;         -- 'Enter via side door, parking available'
```

### Member View

```
┌─────────────────────────────────────────────────────────────┐
│  Your Group: St Mary's Parish                               │
│  Coordinator: Jane Smith                                    │
├─────────────────────────────────────────────────────────────┤
│  📍 Meetings                                                │
│  Every Tuesday at 7:00 PM                                   │
│  St Mary's Parish Hall, Room 2                              │
│  Enter via side door, parking available                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema Changes

### New Fields on `courses` table

```sql
ALTER TABLE courses ADD COLUMN IF NOT EXISTS
  -- Primary management model (see Section 1)
  management_model TEXT DEFAULT 'admin_led'
    CHECK (management_model IN ('admin_led', 'hub_led', 'self_directed'));
```

### New Fields on `courses_cohorts` table

```sql
ALTER TABLE courses_cohorts ADD COLUMN IF NOT EXISTS
  -- Management model override (if cohort differs from course default)
  management_model_override TEXT
    CHECK (management_model_override IN ('admin_led', 'hub_led', 'self_directed')),

  -- Enrollment settings
  enrollment_type TEXT DEFAULT 'admin_only'
    CHECK (enrollment_type IN ('admin_only', 'self_enroll', 'waitlist')),
  enrollment_link_slug TEXT UNIQUE,  -- e.g., "accf-feb-2026" for /enroll/accf-feb-2026
  max_enrollments INTEGER,           -- NULL = unlimited
  enrollment_opens_at TIMESTAMPTZ,
  enrollment_closes_at TIMESTAMPTZ,

  -- Pricing (for self-enrollment)
  is_paid BOOLEAN DEFAULT false,
  price_cents INTEGER,               -- Price in cents (e.g., 15000 = $150.00)
  currency TEXT DEFAULT 'AUD',
  stripe_price_id TEXT,              -- Stripe Price object ID
  stripe_product_id TEXT,            -- Stripe Product object ID

  -- Self-directed progression settings (only applies if self_directed model)
  self_progression_mode TEXT DEFAULT 'sequential'
    CHECK (self_progression_mode IN ('all_unlocked', 'sequential', 'time_drip')),
  self_drip_days INTEGER DEFAULT 7;  -- For time_drip mode
```

### Model-Implied Settings

Rather than storing every setting, most are **computed from the management model**:

```typescript
// In code, not database
function getEffectiveSettings(course, cohort) {
  const model = cohort.management_model_override || course.management_model;

  // Defaults by model
  const defaults = {
    admin_led: {
      progressionControl: 'admin',
      reflectionMarking: 'admin',
      hubsEnabled: true,
      attendanceEnabled: true,
    },
    hub_led: {
      progressionControl: 'coordinator',
      reflectionMarking: 'coordinator',
      hubsEnabled: true,
      attendanceEnabled: true,
    },
    self_directed: {
      progressionControl: 'student',
      reflectionMarking: 'auto_pass',
      hubsEnabled: false,
      attendanceEnabled: false,
    }
  };

  // Merge with any explicit overrides from course.settings
  return { ...defaults[model], ...course.settings?.overrides };
}
```

This keeps the database simple while allowing flexibility through the existing `settings` JSONB column for edge cases.

### New Table: `courses_payments`

```sql
CREATE TABLE courses_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES courses_enrollments(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES courses_cohorts(id) ON DELETE CASCADE,

  -- Payment details
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'AUD',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),

  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_checkout_session_id TEXT,
  stripe_customer_id TEXT,

  -- Metadata
  payment_method TEXT,               -- 'card', 'bank_transfer', etc.
  receipt_url TEXT,
  failure_reason TEXT,
  refund_reason TEXT,

  -- Timestamps
  paid_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_enrollment ON courses_payments(enrollment_id);
CREATE INDEX idx_payments_cohort ON courses_payments(cohort_id);
CREATE INDEX idx_payments_stripe_intent ON courses_payments(stripe_payment_intent_id);
```

### New Table: `courses_enrollment_links`

```sql
CREATE TABLE courses_enrollment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES courses_cohorts(id) ON DELETE CASCADE,

  -- Link settings
  slug TEXT UNIQUE NOT NULL,         -- URL slug: /enroll/{slug}
  is_active BOOLEAN DEFAULT true,

  -- Access control
  requires_code BOOLEAN DEFAULT false,
  access_code TEXT,                  -- Optional access code

  -- Limits
  max_uses INTEGER,                  -- NULL = unlimited
  uses_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,

  -- Tracking
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_enrollment_links_slug ON courses_enrollment_links(slug);
CREATE INDEX idx_enrollment_links_cohort ON courses_enrollment_links(cohort_id);
```

---

## 3. Enrollment Flow

### Public Enrollment Page

**Route:** `/enroll/[slug]`

**Flow:**
```
1. User visits /enroll/accf-feb-2026
2. Page shows:
   - Course name, description, branding
   - Cohort details (start date if facilitated, "Start anytime" if async)
   - Price (if paid) or "Free"
   - Registration form (name, email, password if new user)
3. User submits form
4. If paid:
   - Redirect to Stripe Checkout
   - On success: Create enrollment, redirect to course
   - On cancel: Return to enrollment page
5. If free:
   - Create enrollment immediately
   - Redirect to course dashboard
```

**Components:**
```
/src/routes/enroll/[slug]/
├── +page.server.ts     # Load cohort, validate link
├── +page.svelte        # Registration form + payment UI
└── success/
    └── +page.server.ts # Handle Stripe redirect, create enrollment
```

### Stripe Integration

**Checkout Flow (Recommended for simplicity):**
```typescript
// Create Stripe Checkout Session
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  payment_method_types: ['card'],
  line_items: [{
    price: cohort.stripe_price_id,
    quantity: 1
  }],
  customer_email: userEmail,
  success_url: `${siteUrl}/enroll/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${siteUrl}/enroll/${slug}?cancelled=true`,
  metadata: {
    cohort_id: cohort.id,
    user_email: userEmail,
    user_name: userName
  }
});
```

**Webhook Handler:**
```
/src/routes/api/webhooks/stripe/+server.ts

Events to handle:
- checkout.session.completed → Create enrollment
- payment_intent.payment_failed → Log failure
- charge.refunded → Update enrollment status
```

---

## 4. Async Progression Modes

### Mode 1: All Unlocked

```typescript
// All sessions visible immediately
const sessions = allSessions; // No filtering
```

**Use case:** Reference material, study guides, no structure needed

### Mode 2: Sequential

```typescript
// Unlock next session when current is "complete"
// Complete = reflection submitted (if reflections enabled) OR marked viewed

interface SessionProgress {
  session_number: number;
  completed_at: TIMESTAMPTZ | null;
  reflection_submitted: boolean;
  materials_viewed: boolean;
}

const unlockedSessions = allSessions.filter(s =>
  s.session_number <= getHighestCompletedSession(progress) + 1
);
```

**Use case:** Structured learning path, ensure comprehension before advancing

### Mode 3: Time Drip

```typescript
// Unlock sessions based on enrollment date + drip interval
const daysSinceEnrollment = daysBetween(enrollment.enrolled_at, now);
const unlockedSessionCount = Math.floor(daysSinceEnrollment / cohort.async_drip_days) + 1;

const unlockedSessions = allSessions.filter(s =>
  s.session_number <= unlockedSessionCount
);
```

**Use case:** Prevent rushing, maintain engagement over time

---

## 5. Course Settings Updates

Extend existing `CourseSettings` interface:

```typescript
interface CourseSettings {
  // ... existing settings ...

  // Delivery mode
  deliveryMode?: 'facilitated' | 'async';

  // Async-specific settings
  asyncSettings?: {
    progressionMode: 'all_unlocked' | 'sequential' | 'time_drip';
    dripIntervalDays?: number;        // For time_drip
    requireReflectionForProgress?: boolean;  // For sequential
    autoPassReflections?: boolean;    // Skip marking, auto-pass on submit
  };

  // Enrollment settings
  enrollmentSettings?: {
    allowSelfEnrollment: boolean;
    requirePayment: boolean;
    requireApproval: boolean;         // Admin approval after payment
  };
}
```

---

## 6. Admin UI Changes

### Cohort Creation Modal

Add new fields:
- **Delivery Mode:** Facilitated / Async (radio)
- **Enrollment Type:** Admin Only / Open Registration / Waitlist (radio)
- **Pricing:** Free / Paid (toggle)
  - If Paid: Price input, currency selector
- **Async Settings:** (shown if async mode)
  - Progression: All Unlocked / Sequential / Time Drip
  - Drip interval (if time drip)

### Cohort Dashboard

New sections for open enrollment cohorts:
- **Enrollment Link:** Copy link button, QR code generator
- **Enrollment Stats:** Registrations, payments, conversion rate
- **Payment Log:** Recent payments, refund actions

### New Admin Page: `/admin/courses/[slug]/payments`

- Payment history for all cohorts
- Filter by cohort, status, date range
- Refund functionality
- Export to CSV

---

## 7. New Routes

```
Public:
/enroll/[slug]                    # Public enrollment page
/enroll/[slug]/success            # Post-payment success
/enroll/[slug]/cancelled          # Payment cancelled

API:
/api/webhooks/stripe              # Stripe webhook handler
/api/enroll/[slug]                # Enrollment submission
/api/payments/[id]/refund         # Refund endpoint

Admin:
/admin/courses/[slug]/payments    # Payment management
/admin/courses/[slug]/enrollment-links  # Manage enrollment links
```

---

## 8. Implementation Phases

### Phase 1: Delivery Modes & Async Progression

**Goal:** Support self-paced courses without payment

1. Add `delivery_mode` to courses table
2. Add async progression settings to course settings
3. Update materials/dashboard pages to respect async settings
4. Update course settings UI with delivery mode options
5. Disable irrelevant features (hubs, attendance) for async courses

**Estimate:** Medium complexity

### Phase 2: Self-Service Enrollment (Free)

**Goal:** Public enrollment links for free cohorts

1. Add enrollment link fields to cohorts
2. Create `/enroll/[slug]` public page
3. Add enrollment link management to admin UI
4. Handle account creation for new users
5. Auto-enroll on form submission

**Estimate:** Medium complexity

### Phase 3: Stripe Integration

**Goal:** Paid enrollment with Stripe

1. Set up Stripe account connection
2. Add pricing fields to cohorts
3. Create Stripe products/prices on cohort creation
4. Implement Checkout flow
5. Set up webhook handler
6. Create payments table and logging
7. Add payment management admin UI

**Estimate:** High complexity (Stripe integration)

### Phase 4: Advanced Features

**Goal:** Polish and additional features

1. Enrollment waitlists
2. Discount codes / promo codes
3. Payment plans / installments
4. Enrollment caps with auto-close
5. Email notifications (payment received, enrollment confirmed)
6. Analytics dashboard

**Estimate:** Medium-high complexity

---

## 9. Technical Considerations

### Stripe Setup

1. **Connect Account:** Decide if platform account or connected accounts
2. **API Keys:** Add `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` to env
3. **Products vs Prices:** Create Stripe Product per course, Price per cohort
4. **Webhooks:** Use Stripe CLI for local testing

### Security

- Validate webhook signatures
- Use Stripe's idempotency keys
- Never trust client-side price data
- Rate limit enrollment endpoints
- Validate enrollment link access

### Edge Cases

- What if payment succeeds but enrollment fails?
- What if user already has account with different email?
- What if cohort fills up during checkout?
- Refund policy and automation

---

## 10. Environment Variables

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Optional: Stripe Connect (if using connected accounts)
STRIPE_CONNECT_CLIENT_ID=ca_...
```

---

## 11. Authentication Flow for Public Enrollment

The platform is **invite-only** for general access. Public enrollment pages are the exception - paying and providing email acts as the "sign-up" process.

### Flow: New User (No Account)

```
1. User visits /enroll/accf-feb-2026
2. Enters: name, email
3. If paid: Completes Stripe Checkout
4. On success:
   a. Create user_profiles record (status: 'pending' or 'active')
   b. Create Supabase auth user (with random password or passwordless)
   c. Create courses_enrollment record
   d. Send "Welcome + Set Password" email with magic link
5. User clicks magic link → sets password → logged in → sees course
```

### Flow: Existing User (Has Account, Not Logged In)

```
1. User visits /enroll/accf-feb-2026
2. Enters: name, email (matches existing account)
3. If paid: Completes Stripe Checkout
4. On success:
   a. Match to existing user_profiles by email
   b. Create courses_enrollment record
   c. Send "You're Enrolled" email with login link
5. User logs in normally → sees new course in their dashboard
```

### Flow: Logged-In User

```
1. User visits /enroll/accf-feb-2026 (already logged in)
2. Form pre-fills their name/email (read-only)
3. If paid: Completes Stripe Checkout
4. On success:
   a. Create courses_enrollment for their existing user
   b. Redirect straight to course dashboard
```

### Database Considerations

**user_profiles changes:**
```sql
-- Add enrollment source tracking
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  signup_source TEXT DEFAULT 'invite'
  CHECK (signup_source IN ('invite', 'enrollment', 'admin'));

-- Track which enrollment created this user (if applicable)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS
  source_enrollment_id UUID REFERENCES courses_enrollments(id);
```

**courses_enrollments changes:**
```sql
-- Track if this enrollment created the user account
ALTER TABLE courses_enrollments ADD COLUMN IF NOT EXISTS
  created_user_account BOOLEAN DEFAULT false;
```

### Email Templates Needed

| Template | Trigger | Content |
|----------|---------|---------|
| `enrollment_welcome_new_user` | New user enrolls | Welcome, set password link, course access info |
| `enrollment_welcome_existing` | Existing user enrolls | Confirmation, login link, course added |
| `enrollment_payment_receipt` | Payment completed | Receipt, course details, next steps |
| `enrollment_payment_failed` | Payment failed | Retry link, support contact |

### Security Considerations

1. **Public pages are limited:** Only `/enroll/[slug]` is public, nothing else
2. **Rate limiting:** Prevent enrollment spam
3. **Email verification:** Magic link confirms email ownership
4. **No password in initial form:** User sets password via email link (prevents weak passwords)
5. **Duplicate prevention:** Check if email already enrolled in this cohort

### Implementation Notes

**Supabase Auth Integration:**
```typescript
// Option 1: Create user with auto-generated password + send reset email
const { data: authUser } = await supabase.auth.admin.createUser({
  email: userEmail,
  email_confirm: true,  // Skip email verification (payment = verification)
  user_metadata: { full_name: userName }
});
await supabase.auth.admin.generateLink({
  type: 'recovery',  // Password reset link
  email: userEmail
});

// Option 2: Passwordless / Magic link only
const { data: authUser } = await supabase.auth.admin.createUser({
  email: userEmail,
  email_confirm: true
});
// User always logs in via magic link, no password needed
```

**Recommended:** Option 1 (password reset link) - familiar flow, user chooses their password.

---

## Future Considerations (Out of Scope for Now)

These are acknowledged needs but not part of the immediate roadmap:

### Mobile App

A native mobile app would enable:
- Push notifications for session reminders
- Offline access to materials
- Better video playback experience
- Quick attendance check-in (QR code?)
- Hub group chat

**Approach:** Build web platform first, ensure API-ready architecture. Mobile app as Phase 2 project using React Native or similar, consuming same APIs.

### Offline Access

Parish halls don't always have reliable wifi. Options:
- PWA with service worker caching
- Downloadable PDF versions of materials
- Mobile app with offline sync

### Print Materials

Some demographics prefer physical materials:
- Print-friendly CSS for browser printing
- PDF export of session materials
- Coordinator "leader guide" printouts

### Multi-Language

Parishes serve diverse communities:
- Content translation infrastructure
- UI language switching
- Per-course language variants

### Group Communication

Currently assumes coordinators use external tools (WhatsApp, email).
Future options:
- In-app announcements to hub
- Simple group messaging
- Integration with existing tools (Slack, WhatsApp Business API)

### Calendar Integration

- Add hub meetings to personal calendar (ICS export)
- Sync with Google Calendar / Outlook
- Automated reminders before meetings

### Sponsor/Parent Visibility

For RCIA or youth programs:
- Limited view for sponsors/parents
- "John has completed 6 of 8 sessions"
- No access to reflection content, just progress

---

## Questions to Resolve

1. ~~**Account creation:** Require password on enrollment, or magic link login?~~ → Password set via email link after payment
2. **Refund policy:** Automatic refunds allowed? Time limit?
3. **Partial payments:** Support payment plans for expensive courses?
4. **Multi-cohort discount:** Discount for enrolling in multiple cohorts?
5. **Team enrollments:** Allow bulk purchase for organizations?
6. **Email conflicts:** What if someone tries to enroll with an email that exists but belongs to a different person?
7. **Hub creation:** Can coordinators create their own hub, or admin-only?

---

## Summary: Parish Small Group Leader Persona

**Jane runs a Tuesday night faith formation group at St Mary's Parish.**

What she needs (all covered in this plan):
- ✅ Her own sign-up link to share with parishioners
- ✅ See who's in her group
- ✅ Access materials to lead discussion
- ✅ Track attendance
- ✅ Set meeting time/location visible to members
- ✅ Simple engagement (discussion prompts, not formal reflections)
- ✅ Advance her group through sessions at her own pace
- ✅ Certificates for participants who complete

What she doesn't need:
- ❌ Complex reflection marking
- ❌ Central admin oversight of her group
- ❌ Payment processing (parish handles separately, or free)

**Management Model:** Hub-Led with `engagement_mode: 'discussion_prompts'`

---

*This is a planning document. Implementation details may change.*

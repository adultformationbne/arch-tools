# Courses Quiz System — Future Feature Spec

**Created:** April 14, 2026
**Status:** Planning / Not Started

---

## Overview

This document specifies a new **Quiz** submission type for course sessions. It is completely separate from the existing Reflection Question system — the reflection tables, marking UI, and status flows are untouched.

A session can have one of three submission configurations:

| Configuration | Description |
|---------------|-------------|
| **None** | No submission required. Session is informational. |
| **Reflection** | Existing system. Open-ended free-text, manual marking. |
| **Quiz** | New system. Either instant (auto-graded MC) or qualitative (short answer, manually marked). |

A session holds at most one quiz. Reflections and quizzes are not mixed on the same session.

---

## Quiz Modes

### Instant Quiz
- Questions are **multiple choice** with pre-selected correct answers
- Graded automatically on submission
- Participant sees score and (optionally) correct answers immediately
- No admin involvement after initial setup
- Supports retakes with configurable attempt limits

### Qualitative Quiz
- Questions are **short answer** (free text)
- Submitted to a marking queue — same workflow as reflections
- Admin or coordinator reviews each response and writes feedback
- Per-question feedback + overall feedback
- Final pass/fail issued by marker
- Participant notified when marked

---

## Database Schema

### `courses_quizzes`

One quiz per session.

```sql
CREATE TABLE courses_quizzes (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID NOT NULL REFERENCES courses_sessions(id) ON DELETE CASCADE,
  course_id             UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  mode                  TEXT NOT NULL CHECK (mode IN ('instant', 'qualitative')),
  title                 TEXT,                        -- optional display title, e.g. "Unit 3 Knowledge Check"
  instructions          TEXT,                        -- shown to participant before they start
  pass_threshold        INTEGER DEFAULT 70,          -- percentage, instant mode only (0–100)
  allow_retakes         BOOLEAN DEFAULT FALSE,       -- instant mode only
  max_attempts          INTEGER,                     -- null = unlimited, only relevant if allow_retakes = true
  show_correct_answers  BOOLEAN DEFAULT TRUE,        -- instant mode: reveal correct answer after submit
  require_pass_to_advance BOOLEAN DEFAULT FALSE,     -- gates session progression on passing this quiz
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE (session_id)
);
```

### `courses_quiz_questions`

Ordered list of questions belonging to a quiz.

```sql
CREATE TABLE courses_quiz_questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id        UUID NOT NULL REFERENCES courses_quizzes(id) ON DELETE CASCADE,
  question_text  TEXT NOT NULL,
  question_type  TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'short_answer')),
  order_index    INTEGER NOT NULL DEFAULT 0,
  points         INTEGER NOT NULL DEFAULT 1,   -- instant mode: weight of this question in score
  word_limit     INTEGER,                      -- qualitative mode: optional per-question cap
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
```

> Note: `question_type` is stored on each question, but in practice all questions in an instant quiz will be `multiple_choice` and all in a qualitative quiz will be `short_answer`. The schema doesn't enforce this to allow future flexibility.

### `courses_quiz_options`

Answer options for multiple choice questions. Only used by instant quizzes.

```sql
CREATE TABLE courses_quiz_options (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID NOT NULL REFERENCES courses_quiz_questions(id) ON DELETE CASCADE,
  option_text  TEXT NOT NULL,
  is_correct   BOOLEAN NOT NULL DEFAULT FALSE,
  order_index  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);
```

Constraints:
- Each question must have at least 2 options.
- Exactly one option per question should have `is_correct = true` (enforced at application level, not DB constraint, to allow future multi-select).

### `courses_quiz_attempts`

One row per participant attempt. A participant may have multiple attempts if retakes are enabled.

```sql
CREATE TYPE quiz_attempt_status AS ENUM (
  'in_progress',      -- started but not submitted (future: save-and-resume)
  'submitted',        -- submitted, auto-grading pending (transient for instant)
  'passed',           -- instant: auto-passed; qualitative: marker issued pass
  'failed',           -- instant: auto-failed; qualitative: marker issued fail
  'pending_review',   -- qualitative: awaiting manual marking
  'reviewing'         -- qualitative: a marker has claimed this attempt
);

CREATE TABLE courses_quiz_attempts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id               UUID NOT NULL REFERENCES courses_quizzes(id) ON DELETE CASCADE,
  enrollment_id         UUID NOT NULL REFERENCES courses_enrollments(id) ON DELETE CASCADE,
  cohort_id             UUID NOT NULL REFERENCES courses_cohorts(id),
  attempt_number        INTEGER NOT NULL DEFAULT 1,
  status                quiz_attempt_status NOT NULL DEFAULT 'in_progress',
  score                 INTEGER,                  -- percentage 0–100, instant mode only
  points_earned         INTEGER,                  -- raw points, instant mode only
  points_possible       INTEGER,                  -- total available points, instant mode only
  overall_feedback      TEXT,                     -- qualitative: marker writes summary feedback
  marked_by             UUID REFERENCES auth.users(id),
  marked_at             TIMESTAMPTZ,
  reviewing_by          UUID REFERENCES auth.users(id),
  reviewing_started_at  TIMESTAMPTZ,
  started_at            TIMESTAMPTZ DEFAULT now(),
  submitted_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),

  UNIQUE (quiz_id, enrollment_id, attempt_number)
);
```

### `courses_quiz_responses`

One row per question per attempt.

```sql
CREATE TABLE courses_quiz_responses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id         UUID NOT NULL REFERENCES courses_quiz_attempts(id) ON DELETE CASCADE,
  question_id        UUID NOT NULL REFERENCES courses_quiz_questions(id),
  selected_option_id UUID REFERENCES courses_quiz_options(id),  -- multiple choice
  response_text      TEXT,                                       -- short answer
  is_correct         BOOLEAN,         -- auto-set for MC; set by marker for qualitative
  points_awarded     INTEGER,         -- auto-set for MC; set by marker for qualitative
  feedback           TEXT,            -- qualitative: per-question feedback from marker
  marked_by          UUID REFERENCES auth.users(id),
  marked_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),

  UNIQUE (attempt_id, question_id)
);
```

---

## Status Flows

### Instant Quiz Attempt

```
in_progress
    │
    ▼  (participant submits)
submitted
    │
    ▼  (auto-grading, synchronous)
passed ──── or ──── failed
```

The `submitted` status is transient — grading happens server-side within the same request. The response to the participant includes their result.

### Qualitative Quiz Attempt

```
in_progress
    │
    ▼  (participant submits)
pending_review
    │
    ▼  (marker opens attempt)
reviewing
    │
    ▼  (marker submits decision)
passed ──── or ──── failed
```

Mirrors the reflection status flow. `reviewing` is a soft lock to prevent two markers working the same attempt.

---

## Admin Flows

### 1. Attaching a Quiz to a Session

Entry point: session edit page (or a dedicated "Submissions" tab on the session).

- If no quiz exists: **"Add Quiz"** button opens the **Quiz Type Selection Modal**.
- If a quiz exists: shows quiz summary with **Edit** and **Delete** actions.
- Deleting a quiz that has submitted attempts requires a confirmation modal warning that all attempt data will be lost.

### 2. Quiz Type Selection Modal

Simple two-option choice shown before the builder opens.

```
┌─────────────────────────────────────────────────────┐
│  Add Quiz                                           │
│                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │  ⚡ Instant          │  │  ✍ Qualitative      │  │
│  │                     │  │                     │  │
│  │  Multiple choice    │  │  Short answer       │  │
│  │  Auto-graded        │  │  Manually marked    │  │
│  │  Instant feedback   │  │  Admin writes       │  │
│  │                     │  │  feedback           │  │
│  └─────────────────────┘  └─────────────────────┘  │
│                                                     │
│                              [Cancel]               │
└─────────────────────────────────────────────────────┘
```

Selecting a type opens the **Quiz Builder**.

### 3. Quiz Builder — Instant Mode

Full-page editor (or large modal). Sections:

**Settings panel (top)**
- Quiz title (optional)
- Instructions (optional, shown to participant before starting)
- Pass threshold (number input, default 70%)
- Show correct answers after submission (toggle)
- Allow retakes (toggle) → if on, shows Max attempts field (empty = unlimited)
- Require pass to advance session (toggle)

**Questions panel**
- Ordered list of questions with drag-to-reorder
- Each question card shows:
  - Question text (inline editable)
  - Options list with correct answer indicator
  - Points value
  - Edit / Delete actions
- **"Add Question"** button at bottom

**Add / Edit Question Modal (Instant)**

```
┌──────────────────────────────────────────────────┐
│  Question                                        │
│  ┌────────────────────────────────────────────┐  │
│  │ Which council defined the hypostatic...    │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Points  [1]                                     │
│                                                  │
│  Answer Options                                  │
│  ◉ Council of Nicaea                    [Edit] [✕]│
│  ○ Council of Ephesus                   [Edit] [✕]│
│  ○ Council of Chalcedon                 [Edit] [✕]│  ← correct
│  ○ Council of Constantinople            [Edit] [✕]│
│                                                  │
│  [+ Add Option]                                  │
│                                                  │
│  Correct answer:  [Council of Chalcedon ▼]       │
│                                                  │
│                        [Cancel]  [Save Question] │
└──────────────────────────────────────────────────┘
```

- Radio group selects the correct answer
- Minimum 2 options, maximum 6
- Options are reorderable

### 4. Quiz Builder — Qualitative Mode

Same structure but simplified.

**Settings panel**
- Quiz title (optional)
- Instructions (optional)
- Require pass to advance session (toggle)

**Questions panel**
- Ordered list of short answer questions
- Each card: question text, optional word limit, Edit / Delete

**Add / Edit Question Modal (Qualitative)**

```
┌──────────────────────────────────────────────────┐
│  Question                                        │
│  ┌────────────────────────────────────────────┐  │
│  │ Describe how the concept of kenosis        │  │
│  │ relates to your understanding of...        │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Word limit (optional)  [____]                   │
│                                                  │
│                        [Cancel]  [Save Question] │
└──────────────────────────────────────────────────┘
```

### 5. Quiz Results Overview (Admin)

Accessible from the session page or a course-level "Submissions" view.

For **instant quizzes:**
- Table of all attempts: participant name, attempt number, score, pass/fail, date
- Click row to see full attempt with per-question breakdown
- Aggregate stats: average score, pass rate, per-question correct % (useful for identifying badly written questions)

For **qualitative quizzes:**
- Same marking queue pattern as reflections
- Tabs: Pending Review | Reviewing | Marked
- Count badges on each tab

---

## Marking Flow (Qualitative Quizzes)

### Marking Queue

Accessible from:
- Admin sidebar (same area as reflection marking, separate tab or section)
- Session page "Submissions" panel

List view shows:
- Participant name
- Submission date
- Attempt number
- Status badge (Pending Review / Reviewing)
- "Mark" button

### Marking Modal

Opens when admin clicks "Mark" on a qualitative attempt.

```
┌──────────────────────────────────────────────────────────┐
│  Marking: Jane Smith — Session 4 Quiz                    │
│  Attempt 1 of 1  ·  Submitted 12 Apr 2026                │
│                                                          │
│  ──────────────────────────────────────────────────────  │
│  Q1. Describe how the concept of kenosis relates to...   │
│                                                          │
│  Jane's response:                                        │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Kenosis refers to the self-emptying of Christ...   │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Feedback for this question (optional)                   │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ──────────────────────────────────────────────────────  │
│  Q2. In your own words, explain...                       │
│  [ same pattern ]                                        │
│                                                          │
│  ──────────────────────────────────────────────────────  │
│  Overall Feedback (optional)                             │
│  ┌────────────────────────────────────────────────────┐  │
│  │                                                    │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  Result:   ○ Pass    ○ Fail                              │
│                                                          │
│            [Save Draft]  [Cancel]  [Submit Marking]      │
└──────────────────────────────────────────────────────────┘
```

- "Save Draft" saves progress without submitting (status stays `reviewing`)
- "Submit Marking" sets status to `passed` or `failed`, triggers participant notification
- If another marker is already `reviewing` this attempt, show a warning before allowing takeover

---

## Participant Flows

### Taking an Instant Quiz

1. Session page shows quiz panel: title, instructions, question count, pass threshold
2. **"Start Quiz"** button (or "Retake Quiz" if failed + retakes allowed)
3. Quiz page: all questions shown, scroll to answer
   - Multiple choice: radio group per question
   - Questions numbered, progress indicator
4. **"Submit Quiz"** button → confirmation modal if not all questions answered
5. **Results view** shown immediately after submit:

```
┌──────────────────────────────────────────────────┐
│  Quiz Results                                    │
│                                                  │
│         ✓ PASSED                                 │
│         8 / 10   ·   80%                         │
│                                                  │
│  ──────────────────────────────────────────────  │
│  Q1. Which council defined...          ✓ Correct │
│      Your answer: Council of Chalcedon           │
│                                                  │
│  Q2. The theological term for...       ✗ Wrong   │
│      Your answer: Homoiousios                    │
│      Correct answer: Homoousios                  │
│                                                  │
│  [ ... ]                                         │
│                                                  │
│  ──────────────────────────────────────────────  │
│                                  [Back to Session]│
└──────────────────────────────────────────────────┘
```

- If `show_correct_answers = false`: still shows ✓/✗ per question but not the correct answer text
- If failed + retakes allowed: "Retake Quiz" button shown
- If failed + retakes not allowed: no retake option, message displayed

### Taking a Qualitative Quiz

1. Session page shows quiz panel: title, instructions, question count
2. **"Start Quiz"** (or quiz questions shown inline — no gating needed for qualitative)
3. Text areas per question, optional word count indicator if limit set
4. **"Submit Quiz"** → confirmation modal
5. Post-submit message: "Your responses have been submitted for review. You'll be notified when they've been marked."
6. Session page shows status badge: **Pending Review** → **Reviewing** → **Passed / Failed**
7. Participant receives notification (email + in-app) when marked
8. Can view feedback after marking: per-question feedback + overall feedback

### Viewing Past Attempts

On the session page, participants can expand a history of their attempts:
- Instant: score, pass/fail, date — click to see full breakdown
- Qualitative: status, date, feedback (when marked)

---

## Notifications

### Instant Quiz
No notifications required — feedback is immediate.

### Qualitative Quiz

| Event | Who | Channel |
|-------|-----|---------|
| Attempt submitted | Admin / Coordinator | In-app marking queue count update |
| Attempt marked | Participant | Email + in-app notification |

Email notification to participant uses the existing email template system. Template variables to support:
- `{{quizTitle}}`
- `{{sessionTitle}}`
- `{{result}}` — "Passed" or "Failed"
- `{{overallFeedback}}`
- `{{courseButton}}` — link back to session

---

## Session Page Integration

The session page (participant view) gains a **Submissions** section below the session content:

```
[ Session content ]

────────────────────────────────
Quiz: Unit 3 Knowledge Check
Multiple choice · 10 questions · Pass: 70%

[Start Quiz]
────────────────────────────────
```

For qualitative:
```
────────────────────────────────
Quiz: Unit 3 Reflection
Short answer · 3 questions

Status: ● Pending Review
[View Your Submission]
────────────────────────────────
```

---

## Session Progression Gating

If `require_pass_to_advance = true` on a quiz:

- For instant: participant must have a `passed` attempt before the next session unlocks
- For qualitative: participant must have a `passed` marked attempt before the next session unlocks
- Admin can override and manually advance a participant regardless

This integrates with the existing session unlock / progression logic.

---

## Admin Navigation

New items in the course admin sidebar (under a "Submissions" group or alongside existing Reflections):

- **Quiz Marking** — marking queue for qualitative quiz attempts (only shown if course has qualitative quizzes)
- **Quiz Results** — results overview for instant quizzes (only shown if course has instant quizzes)

Existing **Reflections** item unchanged.

---

## Key API Endpoints (Sketch)

```
GET    /api/courses/[slug]/quizzes/[sessionId]         # Get quiz for a session
POST   /api/courses/[slug]/quizzes                     # Create quiz
PUT    /api/courses/[slug]/quizzes/[quizId]            # Update quiz settings
DELETE /api/courses/[slug]/quizzes/[quizId]            # Delete quiz

POST   /api/courses/[slug]/quizzes/[quizId]/questions  # Add question
PUT    /api/courses/[slug]/quizzes/[quizId]/questions/[qId]  # Edit question
DELETE /api/courses/[slug]/quizzes/[quizId]/questions/[qId]  # Delete question
PATCH  /api/courses/[slug]/quizzes/[quizId]/questions/reorder  # Reorder

POST   /api/courses/[slug]/quizzes/[quizId]/attempts   # Start attempt
PUT    /api/courses/[slug]/quizzes/[quizId]/attempts/[aId]  # Submit attempt
GET    /api/courses/[slug]/quizzes/[quizId]/attempts   # List attempts (admin)
GET    /api/courses/[slug]/quizzes/[quizId]/attempts/[aId]  # Get attempt detail

PUT    /api/courses/[slug]/quizzes/[quizId]/attempts/[aId]/mark  # Submit marking (qualitative)
```

---

## Out of Scope (Future Iterations)

- Mixed quizzes (MC + short answer in one quiz)
- Multiple-select (choose all that apply) question type
- Time limits
- Question randomisation / shuffling
- Question banks / question reuse across sessions
- File/image upload responses
- Approve-then-pay style quiz gates
- Bulk marking
- Per-question point weighting in qualitative mode
- Quiz analytics beyond basic pass rate

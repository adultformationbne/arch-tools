# Reflection Status Utility Guide

## Overview
The reflection status utility provides a centralized system for tracking and displaying participant reflection statuses in the ACCF platform.

## Key Concepts

### Individual Reflection Status
Each reflection can have one of these statuses:
- `NOT_SUBMITTED` - No reflection submitted yet
- `SUBMITTED` - Submitted, waiting for marking
- `NEEDS_REVISION` - Marked as needs revision by admin
- `MARKED_PASS` - Marked as passed
- `MARKED_FAIL` - Marked as failed
- `OVERDUE` - Submitted but not marked within 14 days

### Overall User Status (Prioritized)
When a participant has multiple reflections across sessions, we show the most urgent status:

**Priority Order (highest to lowest):**
1. **MULTIPLE_OVERDUE** - 2+ reflections overdue
2. **OVERDUE** - 1 reflection overdue
3. **NEEDS_REVISION** - At least 1 needs revision
4. **WAITING_FOR_MARKING** - At least 1 waiting for marking
5. **NOT_SUBMITTED** - At least 1 not submitted
6. **ALL_CAUGHT_UP** - All sessions marked as pass

## Usage

### In CohortManager Component

```javascript
import {
  getUserReflectionStatus,
  formatUserReflectionStatus,
  getStatusBadgeClass,
  fetchReflectionsByCohort
} from '$lib/utils/reflection-status.ts';

// Fetch all reflections for a cohort
const reflectionsByUser = await fetchReflectionsByCohort(cohort.id);

// For each participant
participants.forEach(participant => {
  const userReflections = reflectionsByUser.get(participant.auth_user_id) || [];
  const status = getUserReflectionStatus(userReflections, participant.current_session);

  // status = { status: 'overdue', count: 1, details: {...} }
});
```

### Display in UI

```svelte
{#if participant.reflectionStatus}
  <span class="badge {getStatusBadgeClass(participant.reflectionStatus.status)}">
    {formatUserReflectionStatus(participant.reflectionStatus.status, participant.reflectionStatus.count)}
  </span>
{/if}
```

## Status Display Examples

| Scenario | Display |
|----------|---------|
| 3 reflections overdue | `3 overdue` |
| 1 reflection overdue | `1 overdue` |
| 2 need revision | `2 need revision` |
| 1 waiting for marking | `1 waiting for marking` |
| 2 not submitted | `2 not submitted` |
| All sessions passed | `All caught up` |

## Database Schema

The utility reads from `courses_reflection_responses` table:
- `user_id` - Participant's auth user ID
- `cohort_id` - Cohort ID
- `session_number` - Session 1-8
- `status` - submitted, marked, needs_revision
- `grade` - pass, fail, incomplete
- `marked_at` - Timestamp when marked (NULL = not yet marked)
- `created_at` - Submission timestamp

## API Endpoint

GET `/admin/cohorts/api?endpoint=reflection_responses&cohort_id={cohortId}`

Returns all reflection responses for a cohort.

## Color Coding

- **Red** - Overdue (urgent)
- **Orange** - Needs revision
- **Blue** - Waiting for marking
- **Yellow** - Not submitted
- **Green** - All caught up

## Future Enhancements

- Email notifications for overdue reflections
- Admin bulk marking workflows
- Student notification system
- Progress analytics dashboard
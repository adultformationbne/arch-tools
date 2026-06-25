-- The activity feed (getActivityType in admin courses api) and several endpoints
-- write granular activity_type values that the original constraint never allowed,
-- so those inserts were silently rejected for months (only 'reflection_submitted'
-- ever persisted). Widen the constraint to the vocabulary the code actually uses.
ALTER TABLE public.courses_activity_log
  DROP CONSTRAINT IF EXISTS cohort_activity_log_activity_type_check;

ALTER TABLE public.courses_activity_log
  ADD CONSTRAINT cohort_activity_log_activity_type_check
  CHECK (activity_type = ANY (ARRAY[
    'reflection_submitted',
    'reflection_resubmitted',
    'reflection_passed',
    'reflection_needs_revision',
    'reflections_marked',
    'attendance_marked',
    'attendance_submitted',
    'session_changed',
    'advancement_email_sent'
  ]::text[]));

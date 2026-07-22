-- Allow course admins/managers to SELECT reflection responses for their courses,
-- mirroring the app-level requireCourseAdmin() check. This is required so the
-- browser-side Realtime subscription (used to replace 30s polling on the admin
-- reflections page) actually receives postgres_changes events — Realtime enforces
-- RLS using the subscribing user's JWT, not the service-role key the page itself
-- uses to load data. Read-only; existing service-role/assigned-admin policies
-- still govern mutations.
CREATE POLICY "Course admins can view reflection responses"
ON courses_reflection_responses
FOR SELECT
TO authenticated
USING (
  has_module_access(auth.uid(), 'courses.admin')
  OR (
    has_module_access(auth.uid(), 'courses.manager')
    AND EXISTS (
      SELECT 1
      FROM courses_cohorts cc
      JOIN courses_modules cm ON cm.id = cc.module_id
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE cc.id = courses_reflection_responses.cohort_id
        AND cm.course_id::text IN (
          SELECT jsonb_array_elements_text(COALESCE(up.assigned_course_ids, '[]'::jsonb))
        )
    )
  )
);

-- Enable Realtime for the tables the admin dashboards now watch for changes
-- instead of polling. courses_chat_messages was already enabled.
ALTER PUBLICATION supabase_realtime ADD TABLE courses_reflection_responses;

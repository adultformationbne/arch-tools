-- order_number was unique across ALL courses, so only one course could have a
-- "module 1". Module order is only meaningful within a course.
ALTER TABLE public.courses_modules DROP CONSTRAINT modules_order_number_key;
ALTER TABLE public.courses_modules
  ADD CONSTRAINT courses_modules_course_id_order_number_key UNIQUE (course_id, order_number);

# Course Repository Refactoring Task List

**Status:** 2/15 files refactored (13% complete)
**Updated:** January 20, 2025

---

## ✅ Completed Files

### 1. Student Dashboard ✅
- **File:** `src/routes/courses/[slug]/+page.server.ts`
- **Status:** COMPLETED
- **Changes:**
  - Reduced from 470 to 230 lines (51% reduction)
  - Using `CourseAggregates.getStudentDashboard()`
  - Parallel query execution
- **Complexity:** ⭐⭐⭐⭐ High
- **Impact:** High performance improvement

### 2. Reflection API ✅
- **File:** `src/routes/courses/[slug]/reflections/api/+server.ts`
- **Status:** COMPLETED
- **Changes:**
  - Removed `session_number` write
  - Now relies on join for session data
- **Complexity:** ⭐⭐ Low
- **Impact:** Database integrity improvement

---

## 🔄 Student-Facing Routes (Priority 1)

### 3. Reflections Page
- **File:** `src/routes/courses/[slug]/reflections/+page.server.ts`
- **Current Size:** ~226 lines
- **Estimated After:** ~120 lines (47% reduction)
- **Complexity:** ⭐⭐⭐⭐ High
- **Current Issues:**
  - Serial queries (enrollment, cohort, module, questions, responses)
  - Redundant session_number handling
  - Complex data transformations inline
- **Migration Strategy:**
  - Use `CourseAggregates.getStudentDashboard()` (already has most data)
  - OR create new `CourseAggregates.getReflectionsPage()`
  - Use `addSessionNumbers()` for backward compatibility
  - Use `groupQuestionsBySession()` helper
- **Dependencies:**
  - Needs `CourseAggregates.getStudentDashboard()` or new aggregate
  - Uses reflection-status.js utility (keep as-is)

### 4. Materials Page
- **File:** `src/routes/courses/[slug]/materials/+page.server.ts`
- **Current Size:** ~100 lines
- **Estimated After:** ~40 lines (60% reduction)
- **Complexity:** ⭐⭐ Low
- **Current Issues:**
  - Simple serial queries
  - Could use existing dashboard aggregate
- **Migration Strategy:**
  - Use `CourseQueries.getEnrollment()` + `CourseQueries.getMaterials()`
  - OR subset of `CourseAggregates.getStudentDashboard()`
  - Use `groupMaterialsBySession()` helper
- **Dependencies:**
  - Simple core queries only

### 5. Write Reflection Page
- **File:** `src/routes/courses/[slug]/write/[questionId]/+page.server.ts`
- **Current Size:** Unknown (need to check if exists)
- **Complexity:** ⭐ Very Low
- **Current Issues:**
  - Likely fetches question and existing response
- **Migration Strategy:**
  - Use `CourseQueries.getReflectionQuestions()`
  - Use `CourseQueries.getReflectionResponses()`
- **Dependencies:**
  - Core queries only

---

## 🔧 Admin Routes (Priority 2)

### 6. Admin Dashboard
- **File:** `src/routes/admin/courses/[slug]/+page.server.ts`
- **Current Size:** ~26 lines
- **Estimated After:** ~15 lines (42% reduction)
- **Complexity:** ⭐ Very Low
- **Current Issues:**
  - Relies on layout data (modules/cohorts already loaded)
  - Just handles cohort selection redirect
- **Migration Strategy:**
  - Already optimized via layout
  - Minimal changes needed
- **Dependencies:**
  - Layout already loads data via `CourseAggregates.getAdminCourseData()`

### 7. Admin Layout (Critical!)
- **File:** `src/routes/admin/courses/[slug]/+layout.server.ts`
- **Current Size:** ~93 lines
- **Estimated After:** ~30 lines (68% reduction)
- **Complexity:** ⭐⭐⭐ Medium
- **Current Issues:**
  - Loads modules and cohorts separately
  - Manually flattens cohorts from modules
- **Migration Strategy:**
  - Use `CourseAggregates.getAdminCourseData(courseId)`
  - Already returns modules and flattened cohorts
  - Huge performance win for ALL admin pages
- **Dependencies:**
  - Aggregate already exists!
  - Benefits cascades to all child admin routes

### 8. Admin Reflections
- **File:** `src/routes/admin/courses/[slug]/reflections/+page.server.ts`
- **Current Size:** ~145 lines
- **Estimated After:** ~60 lines (59% reduction)
- **Complexity:** ⭐⭐⭐⭐ High
- **Current Issues:**
  - Complex reflection response query with joins
  - Manual status calculations
  - Cohort filtering
- **Migration Strategy:**
  - Create `CourseAggregates.getAdminReflections(courseId, cohortIds)`
  - Parallel fetch reflections by cohort
  - Use existing data transformations
- **Dependencies:**
  - Need new aggregate function
  - Layout provides cohort data

### 9. Admin Reflections API
- **File:** `src/routes/admin/courses/[slug]/reflections/api/+server.ts`
- **Current Size:** ~69 lines
- **Estimated After:** ~30 lines (57% reduction)
- **Complexity:** ⭐⭐ Low
- **Current Issues:**
  - Uses `CourseMutations.markReflection()` ✅ (already done!)
- **Migration Strategy:**
  - Already using mutations correctly
  - Just needs cleanup/documentation
- **Dependencies:**
  - Mutation already exists

### 10. Admin Sessions
- **File:** `src/routes/admin/courses/[slug]/sessions/+page.server.ts`
- **Current Size:** ~77 lines
- **Estimated After:** ~30 lines (61% reduction)
- **Complexity:** ⭐⭐⭐ Medium
- **Current Issues:**
  - Fetches sessions, materials, questions separately
  - No parallelization
- **Migration Strategy:**
  - Use `CourseAggregates.getSessionData(moduleId)` ✅ (already exists!)
  - Returns sessions, materials, questions in parallel
- **Dependencies:**
  - Aggregate already implemented!

### 11. Admin Attendance
- **File:** `src/routes/admin/courses/[slug]/attendance/+page.server.ts`
- **Current Size:** Unknown
- **Complexity:** ⭐⭐ Low to Medium
- **Migration Strategy:**
  - Check current implementation
  - Likely needs custom aggregate for attendance grid
  - Create `CourseAggregates.getAttendanceData(cohortId)`
- **Dependencies:**
  - May need new aggregate

### 12. Admin Attendance API
- **File:** `src/routes/admin/courses/[slug]/attendance/api/+server.ts`
- **Current Size:** ~156 lines
- **Estimated After:** ~60 lines (62% reduction)
- **Complexity:** ⭐⭐⭐ Medium
- **Current Issues:**
  - GET: Fetches students and attendance separately
  - POST: Uses manual upsert (should use mutation)
- **Migration Strategy:**
  - GET: Create `CourseAggregates.getAttendanceGrid(cohortId)`
  - POST: Use `CourseMutations.markAttendance()` ✅ (already exists!)
- **Dependencies:**
  - Need attendance aggregate for GET
  - Mutation already done for POST

### 13. Admin Participants
- **File:** `src/routes/admin/courses/[slug]/participants/+page.server.ts`
- **Current Size:** Unknown
- **Complexity:** ⭐⭐ Low
- **Migration Strategy:**
  - Check current implementation
  - Likely simple enrollment queries
  - Use `CourseQueries.getCohorts()` + enrollment joins
- **Dependencies:**
  - Core queries sufficient

### 14. Admin Hubs
- **File:** `src/routes/admin/courses/[slug]/hubs/+page.server.ts`
- **Current Size:** Unknown
- **Complexity:** ⭐⭐ Low
- **Migration Strategy:**
  - Check current implementation
  - Hub CRUD operations
  - Likely needs minimal changes
- **Dependencies:**
  - May need hub-specific queries

---

## 📊 API Routes (Priority 3)

### 15. Course API (General)
- **File:** `src/routes/admin/courses/[slug]/api/+server.ts`
- **Current Size:** ~850+ lines (HUGE!)
- **Estimated After:** ~300 lines (65% reduction)
- **Complexity:** ⭐⭐⭐⭐⭐ Very High
- **Current Issues:**
  - Massive switch statement handling multiple endpoints
  - Mixes reads and writes
  - Lots of duplicate query logic
- **Migration Strategy:**
  - Break into smaller API routes
  - Use repository for all operations
  - Consider splitting into separate endpoints
- **Dependencies:**
  - All aggregates and mutations
  - May need refactoring guidance

---

## 🎯 Delegation Strategy

### Phase 1: Student Routes (Highest Impact)
**Delegate to Agent 1:**
- Task 3: Reflections Page
- Task 4: Materials Page
- Task 5: Write Reflection Page

**Estimated Time:** 2-3 hours
**Impact:** High user-facing performance improvement

### Phase 2: Admin Infrastructure
**Delegate to Agent 2:**
- Task 7: Admin Layout (CRITICAL - affects all admin pages)
- Task 10: Admin Sessions (aggregate already exists)
- Task 9: Admin Reflections API (mostly done)

**Estimated Time:** 2 hours
**Impact:** Cascades to all admin routes

### Phase 3: Admin Pages
**Delegate to Agent 3:**
- Task 8: Admin Reflections
- Task 12: Admin Attendance API
- Task 13: Admin Participants

**Estimated Time:** 3-4 hours
**Impact:** Admin workflow improvements

### Phase 4: Complex Routes
**Delegate to Agent 4:**
- Task 15: Course API (needs strategy discussion first)
- Task 11: Admin Attendance (if complex)
- Task 14: Admin Hubs

**Estimated Time:** 4-5 hours
**Impact:** Code quality and maintainability

---

## 📋 New Aggregates Needed

Based on the task list, we need to add these to `course-data.ts`:

### 1. `CourseAggregates.getReflectionsPage(userId, courseSlug)`
**For:** Task 3 (Student Reflections)
**Returns:**
- enrollment
- module
- cohort
- reflection questions (with session info)
- user's responses
- cohort's public reflections

### 2. `CourseAggregates.getAdminReflections(courseId, cohortIds?)`
**For:** Task 8 (Admin Reflections)
**Returns:**
- All reflection responses for course/cohorts
- With student info, session info, marking info
- Filtered by cohort if provided

### 3. `CourseAggregates.getAttendanceGrid(cohortId)`
**For:** Tasks 11, 12 (Admin Attendance)
**Returns:**
- All enrollments for cohort
- Attendance records for all sessions
- Hub assignments
- Formatted for grid display

---

## 🧪 Testing Checklist

After each refactoring task, test:

- [ ] Page loads without errors
- [ ] Data displays correctly
- [ ] No regression in functionality
- [ ] Performance improved (check Network tab)
- [ ] No TypeScript errors
- [ ] Build succeeds

---

## 📝 Notes

**Important Considerations:**

1. **Backward Compatibility:** Use `addSessionNumbers()` transformer where UI components expect `session_number` property

2. **Error Handling:** Repository returns `{ data, error }` - always check for errors

3. **Performance:** Use aggregates for page loads, core queries for specific needs

4. **Type Safety:** Import types from repository when available

5. **Testing:** Create backups before refactoring (use `.backup` extension)

---

## 🎉 Success Metrics

**Target Metrics:**
- ✅ 50%+ code reduction across all routes
- ✅ 50%+ faster page load times
- ✅ Zero data duplication
- ✅ 100% TypeScript coverage
- ✅ Single source of truth for all course queries

**Current Progress:**
- Files refactored: 2/15 (13%)
- Estimated total LOC reduction: ~40-60%
- New aggregates needed: 3
- Build status: ✅ Passing

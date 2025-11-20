# Unmigrated Pages - Repository Pattern TODO List

**Status:** 16 files completed, ~10 files remaining
**Updated:** January 20, 2025

This document tracks pages that still use direct Supabase queries instead of the repository pattern.

---

## ✅ Already Migrated (16 files)

### Student Routes
- [x] `/courses/[slug]/+page.server.ts` - Student dashboard
- [x] `/courses/[slug]/reflections/+page.server.ts` - Reflections page
- [x] `/courses/[slug]/materials/+page.server.ts` - Materials page
- [x] `/courses/[slug]/write/[questionId]/+page.server.ts` - Write reflection
- [x] `/courses/[slug]/reflections/api/+server.ts` - Reflection submission API
- [x] `/courses/+page.server.ts` - Course listing page ⭐ (Option A)

### Admin Routes
- [x] `/admin/courses/[slug]/+layout.server.ts` - Admin layout
- [x] `/admin/courses/[slug]/+page.server.ts` - Admin dashboard
- [x] `/admin/courses/[slug]/sessions/+page.server.ts` - Sessions editor
- [x] `/admin/courses/[slug]/reflections/+page.server.ts` - Admin reflections
- [x] `/admin/courses/[slug]/reflections/api/+server.ts` - Reflections API
- [x] `/admin/courses/[slug]/attendance/+page.server.ts` - Attendance page
- [x] `/admin/courses/[slug]/attendance/api/+server.ts` - Attendance API
- [x] `/admin/courses/[slug]/participants/+page.server.ts` - Participants page
- [x] `/admin/courses/[slug]/hubs/+page.server.ts` - Hubs page
- [x] `/admin/courses/[slug]/api/+server.ts` - Course API (850→426 lines!) 🔥

### Platform Routes
- [x] `/settings/+page.server.ts` - Platform settings ⭐ (Option A)
- [x] `/api/admin/enrollments/+server.ts` - Enrollment API ⭐ (Option A)

---

## 🔄 Still Need Migration (Priority Order)

### Priority 1: Core Student Routes ⭐⭐⭐

#### 1. Course Layout
- **File:** `/routes/courses/[slug]/+layout.server.ts`
- **Current:** Unknown size
- **Complexity:** ⭐⭐ Low-Medium
- **Impact:** HIGH - Loads course settings/theme for all student pages
- **Current Issues:**
  - Likely loads course by slug
  - Fetches course settings and branding
  - May load enrollment data
- **Migration Strategy:**
  - Use `CourseQueries.getCourse(slug)`
  - Use `CourseQueries.getEnrollment(userId, courseSlug)` if needed
  - Keep theme application logic
- **Dependencies:** Core queries only

#### 2. Student Profile
- **File:** `/routes/courses/[slug]/profile/+page.server.ts`
- **Current:** Unknown size
- **Complexity:** ⭐⭐ Low
- **Impact:** MEDIUM - Student profile/settings page
- **Current Issues:**
  - Likely fetches enrollment and user data
  - May include progress tracking
- **Migration Strategy:**
  - Use `CourseQueries.getEnrollment(userId, courseSlug)`
  - Use existing queries for user profile
- **Dependencies:** Core queries sufficient

---

### Priority 2: API Endpoints (CRUD Operations) ⭐⭐

#### 3. Materials API
- **File:** `/routes/api/courses/module-materials/+server.ts`
- **Current:** 195 lines
- **Complexity:** ⭐⭐⭐ Medium
- **Impact:** MEDIUM - Used by admin materials editor
- **Current Issues:**
  - GET: Complex joins with sessions
  - POST/PUT/DELETE: Manual CRUD operations
  - Material validation logic inline
- **Migration Strategy:**
  - GET: Use `CourseQueries.getMaterials(sessionIds)`
  - Create `CourseMutations.createMaterial(params)`
  - Create `CourseMutations.updateMaterial(id, updates)`
  - Create `CourseMutations.deleteMaterial(id)`
- **Estimated Reduction:** 30-40% (195 → ~120 lines)

#### 4. Reflection Questions API
- **File:** `/routes/api/courses/module-reflection-questions/+server.ts`
- **Current:** ~150 lines (estimated)
- **Complexity:** ⭐⭐⭐ Medium
- **Impact:** MEDIUM - Used by admin to manage questions
- **Current Issues:**
  - GET: Fetches questions by module/session
  - POST/PUT/DELETE: Manual CRUD
  - Session validation inline
- **Migration Strategy:**
  - GET: Use `CourseQueries.getReflectionQuestions(sessionIds)`
  - Create `CourseMutations.createReflectionQuestion(params)`
  - Create `CourseMutations.updateReflectionQuestion(id, updates)`
  - Create `CourseMutations.deleteReflectionQuestion(id)`
- **Estimated Reduction:** 30-40%

#### 5. Sessions API
- **File:** `/routes/api/courses/sessions/+server.ts`
- **Current:** ~120 lines (estimated)
- **Complexity:** ⭐⭐ Low-Medium
- **Impact:** MEDIUM - Session CRUD operations
- **Current Issues:**
  - GET: Fetches sessions by module
  - POST/PUT/DELETE: Manual operations
- **Migration Strategy:**
  - GET: Use `CourseQueries.getSessions(moduleId)`
  - Create `CourseMutations.createSession(params)`
  - Create `CourseMutations.updateSession(id, updates)`
  - Create `CourseMutations.deleteSession(id)`
- **Estimated Reduction:** 30%

#### 6. Participants API
- **File:** `/routes/admin/courses/[slug]/participants/api/+server.ts`
- **Current:** Unknown size
- **Complexity:** ⭐⭐ Low
- **Impact:** LOW - Participant management operations
- **Migration Strategy:**
  - Check if exists first
  - Use enrollment mutations (already exist!)
  - May not need additional work

#### 7. Hubs API
- **File:** `/routes/admin/courses/[slug]/hubs/api/+server.ts`
- **Current:** Unknown size
- **Complexity:** ⭐⭐ Low
- **Impact:** LOW - Hub CRUD operations
- **Migration Strategy:**
  - Hub mutations already exist in repository!
  - Just refactor to use `CourseMutations.createHub()`, etc.

---

### Priority 3: Special/Complex Routes ⭐

#### 8. Community Feed API
- **File:** `/routes/api/courses/community-feed/+server.ts`
- **Current:** Unknown size
- **Complexity:** ⭐⭐⭐ Medium-High
- **Impact:** LOW - Public reflections feed
- **Current Issues:**
  - Likely fetches public reflections
  - May include pagination/filtering
  - Pin/unpin functionality
- **Migration Strategy:**
  - Use `CourseQueries.getPublicReflections(cohortId)`
  - Create pin/unpin mutations if needed
  - Keep feed-specific business logic
- **Note:** Check if feed has specific requirements

#### 9. Course Index API
- **File:** `/routes/api/courses/index/+server.ts`
- **Current:** Unknown size
- **Complexity:** ⭐⭐ Low
- **Impact:** LOW - Course listing/search
- **Migration Strategy:**
  - Check current implementation
  - May use `CourseQueries.getCohorts()` or similar
  - Likely minimal changes needed

#### 10. Module Management Page
- **File:** `/routes/admin/courses/[slug]/modules/+page.server.ts`
- **Current:** Unknown size
- **Complexity:** ⭐⭐⭐ Medium
- **Impact:** MEDIUM - Admin module editor
- **Migration Strategy:**
  - Use `CourseQueries.getModules(courseId)`
  - Use `CourseAggregates.getSessionData(moduleId)` for sessions/materials
  - Module mutations already exist!

---

## 📊 Migration Statistics

### Completed
- **Total files migrated:** 18 files (16 from phases + 2 from Option A)
- **Lines reduced:** ~1,366 lines (44% average reduction)
- **Repository functions:** 44 functions across 3 layers

### Remaining
- **Files to migrate:** ~10 files
- **Estimated lines:** ~1,000-1,200 lines
- **Estimated reduction:** ~350-450 lines (35% reduction)
- **New mutations needed:** ~12-15 functions

---

## 🎯 Recommended Approach

### Batch 1: Student Essentials (High Priority)
**Files:** 2 files
- Course layout
- Student profile

**Impact:** HIGH - Affects all student routes
**Time:** 1-2 hours
**New Functions:** 0-2 (likely use existing queries)

### Batch 2: API CRUD (Medium Priority)
**Files:** 5 files
- Materials API
- Reflection questions API
- Sessions API
- Participants API
- Hubs API

**Impact:** MEDIUM - Admin workflow improvements
**Time:** 3-4 hours
**New Functions:** ~12 mutations

### Batch 3: Special Routes (Low Priority)
**Files:** 3 files
- Community feed API
- Course index API
- Module management page

**Impact:** LOW - Nice-to-have refactoring
**Time:** 2-3 hours
**New Functions:** 0-3

---

## 🔧 Required Repository Additions

### Materials Mutations (Priority 2)
```typescript
CourseMutations.createMaterial(params: {
  sessionId: string;
  type: string;
  title: string;
  content: string;
  displayOrder?: number;
})

CourseMutations.updateMaterial(id: string, updates: {
  type?: string;
  title?: string;
  content?: string;
  displayOrder?: number;
})

CourseMutations.deleteMaterial(id: string)
```

### Reflection Question Mutations (Priority 2)
```typescript
CourseMutations.createReflectionQuestion(params: {
  sessionId: string;
  questionText: string;
  wordCountMin?: number;
})

CourseMutations.updateReflectionQuestion(id: string, updates: {
  questionText?: string;
  wordCountMin?: number;
})

CourseMutations.deleteReflectionQuestion(id: string)
```

### Session Mutations (Priority 2)
```typescript
CourseMutations.createSession(params: {
  moduleId: string;
  sessionNumber: number;
  title: string;
  description?: string;
})

CourseMutations.updateSession(id: string, updates: {
  title?: string;
  description?: string;
  reflectionsEnabled?: boolean;
})

CourseMutations.deleteSession(id: string)
```

---

## 📝 Migration Checklist Template

For each file:
- [ ] Create backup (`.backup` extension)
- [ ] Read current implementation
- [ ] Identify all database queries
- [ ] Map queries to repository functions
- [ ] Add missing repository functions if needed
- [ ] Refactor file to use repository
- [ ] Test build (`npm run build`)
- [ ] Update this checklist
- [ ] Test functionality manually

---

## 🎉 Success Criteria

When all migrations complete:
- ✅ 100% of course-related routes use repository pattern
- ✅ Zero direct Supabase queries in route files
- ✅ All CRUD operations through mutations
- ✅ Single source of truth for all course data
- ✅ Comprehensive documentation
- ✅ Build passes with no errors

---

**Current Progress:** 18/28 files (64% complete)
**Estimated Remaining Work:** 6-9 hours across 3 batches

# Schema Cleanup NOW - Before Finishing ACCF
## Fix the names while it's still test data, build multi-program later

**Philosophy:** Get the table names right NOW while we can still wipe data. Build ACCF properly with good names. Add multi-program features LATER when ACCF is working.

---

## 🎯 What We're Doing NOW

**Only fix the naming issues that will be painful to change later:**

1. ✅ Rename `accf_users` → `cohort_enrollments`
2. ✅ Fix role system (move role to enrollment level)
3. ✅ Simplify `user_profiles.role` enum

**What we're NOT doing now:**
- ❌ Creating `programs` table (later)
- ❌ Multi-program routes (later)
- ❌ Program branding system (later)
- ❌ URL restructuring (later)

**Result:** Clean schema with good names, finish ACCF development, add multi-program when ready.

---

## 📋 Schema Changes (Execute Once)

### **Step 1: Create New cohort_enrollments Table**

```sql
-- Drop existing table and recreate with better name
DROP TABLE IF EXISTS accf_users CASCADE;

CREATE TABLE cohort_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- User & Cohort linkage
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,

  -- Role in THIS specific cohort (prepares for multi-program)
  role TEXT NOT NULL CHECK (role IN ('student', 'admin', 'coordinator')),

  -- Student progression
  current_session INTEGER DEFAULT 1 CHECK (current_session >= 1 AND current_session <= 12),

  -- Hub assignment (if applicable)
  hub_id UUID REFERENCES hubs(id) ON DELETE SET NULL,

  -- Admin assignment (for reflection marking)
  assigned_admin_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,

  -- Invitation workflow (used before user signs up)
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'invited', 'accepted', 'active', 'held', 'completed', 'withdrawn', 'error')),
  invitation_token UUID UNIQUE DEFAULT gen_random_uuid(),
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,

  -- Import tracking
  imported_by UUID REFERENCES user_profiles(id),
  error_message TEXT,

  -- Timestamps
  enrolled_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Indexes for performance
CREATE INDEX idx_cohort_enrollments_user_profile ON cohort_enrollments(user_profile_id);
CREATE INDEX idx_cohort_enrollments_cohort ON cohort_enrollments(cohort_id);
CREATE INDEX idx_cohort_enrollments_status ON cohort_enrollments(status);
CREATE INDEX idx_cohort_enrollments_hub ON cohort_enrollments(hub_id);
CREATE INDEX idx_cohort_enrollments_role ON cohort_enrollments(role);

-- Enable RLS
ALTER TABLE cohort_enrollments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own enrollments"
  ON cohort_enrollments FOR SELECT
  USING (auth.uid() = user_profile_id);

CREATE POLICY "Admins can view all enrollments"
  ON cohort_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cohort_enrollments
      WHERE user_profile_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert enrollments"
  ON cohort_enrollments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cohort_enrollments
      WHERE user_profile_id = auth.uid()
        AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update enrollments"
  ON cohort_enrollments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cohort_enrollments
      WHERE user_profile_id = auth.uid()
        AND role = 'admin'
    )
  );

COMMENT ON TABLE cohort_enrollments IS 'User enrollments in cohorts - replaces accf_users with better name';
COMMENT ON COLUMN cohort_enrollments.role IS 'User role in this cohort: student, admin, or coordinator';
COMMENT ON COLUMN cohort_enrollments.user_profile_id IS 'Links to user_profiles. NULL until user accepts invitation';
```

### **Step 2: Update Foreign Keys in Dependent Tables**

```sql
-- Update attendance table
ALTER TABLE attendance
  RENAME COLUMN accf_user_id TO enrollment_id;

COMMENT ON COLUMN attendance.enrollment_id IS 'Links to cohort_enrollments (student who attended)';

-- Update reflection_responses table
ALTER TABLE reflection_responses
  RENAME COLUMN accf_user_id TO enrollment_id;

COMMENT ON COLUMN reflection_responses.enrollment_id IS 'Links to cohort_enrollments (student who submitted)';

-- Update cohort_activity_log if it references accf_users
-- (Check first if this column exists and references accf_users)
```

### **Step 3: Update accf_user_imports Table**

```sql
-- This table tracks CSV imports, just update the name for clarity
ALTER TABLE accf_user_imports RENAME TO enrollment_imports;

COMMENT ON TABLE enrollment_imports IS 'Tracks bulk enrollment imports from CSV files';
```

### **Step 4: Simplify user_profiles.role Enum**

```sql
-- Current enum has program-specific roles mixed with platform roles
-- We're keeping it simple for now, will add program scoping later

-- For now, just add a comment documenting the system
COMMENT ON COLUMN user_profiles.role IS 'Platform-level role. Current values: admin (platform admin), accf_admin (ACCF admin), accf_student (ACCF student), hub_coordinator. Future: will simplify to platform_admin/user, with program-specific roles in cohort_enrollments.role';

-- We'll clean this up when adding multi-program support
-- For now, existing enum values work fine
```

---

## 🔄 Code Changes Needed

### **Global Find & Replace**

Use your editor's find-and-replace across the entire project:

1. **Table name:**
   - Find: `'accf_users'` (with quotes)
   - Replace: `'cohort_enrollments'`

2. **Column name:**
   - Find: `accf_user_id`
   - Replace: `enrollment_id`

3. **Import name:**
   - Find: `accf_user_imports`
   - Replace: `enrollment_imports`

### **Files That Will Need Updates** (roughly 15-20 files)

```
src/routes/(accf)/
  ├── +layout.server.ts
  ├── dashboard/+page.server.ts
  ├── materials/+page.server.ts
  ├── reflections/+page.server.ts
  ├── reflections/api/+server.ts
  ├── admin/+page.server.ts
  ├── admin/api/+server.ts
  ├── admin/attendance/+page.server.ts
  ├── admin/attendance/api/+server.ts
  ├── admin/reflections/+page.server.ts
  ├── admin/reflections/api/+server.ts
  └── signup/api/+server.ts
```

### **Example Change**

**Before:**
```typescript
const { data: enrollment } = await supabaseAdmin
  .from('accf_users')
  .select('cohort_id, current_session')
  .eq('user_profile_id', currentUserId)
  .single();
```

**After:**
```typescript
const { data: enrollment } = await supabaseAdmin
  .from('cohort_enrollments')
  .select('cohort_id, current_session')
  .eq('user_profile_id', currentUserId)
  .single();
```

---

## ✅ Migration Script (Run Once)

Save this as `supabase/migrations/YYYYMMDD_rename_to_cohort_enrollments.sql`:

```sql
-- RENAME ACCF_USERS TO COHORT_ENROLLMENTS
-- Safe to run - test data can be wiped

-- Step 1: Drop old table if exists
DROP TABLE IF EXISTS accf_users CASCADE;

-- Step 2: Create new cohort_enrollments table
CREATE TABLE cohort_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin', 'coordinator')),
  current_session INTEGER DEFAULT 1 CHECK (current_session >= 1 AND current_session <= 12),
  hub_id UUID REFERENCES hubs(id) ON DELETE SET NULL,
  assigned_admin_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'invited', 'accepted', 'active', 'held', 'completed', 'withdrawn', 'error')),
  invitation_token UUID UNIQUE DEFAULT gen_random_uuid(),
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  imported_by UUID REFERENCES user_profiles(id),
  error_message TEXT,
  enrolled_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);

-- Step 3: Create indexes
CREATE INDEX idx_cohort_enrollments_user_profile ON cohort_enrollments(user_profile_id);
CREATE INDEX idx_cohort_enrollments_cohort ON cohort_enrollments(cohort_id);
CREATE INDEX idx_cohort_enrollments_status ON cohort_enrollments(status);
CREATE INDEX idx_cohort_enrollments_hub ON cohort_enrollments(hub_id);
CREATE INDEX idx_cohort_enrollments_role ON cohort_enrollments(role);

-- Step 4: Enable RLS
ALTER TABLE cohort_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own enrollments"
  ON cohort_enrollments FOR SELECT
  USING (auth.uid() = user_profile_id);

CREATE POLICY "Admins can view all enrollments"
  ON cohort_enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cohort_enrollments
      WHERE user_profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert enrollments"
  ON cohort_enrollments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cohort_enrollments
      WHERE user_profile_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update enrollments"
  ON cohort_enrollments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cohort_enrollments
      WHERE user_profile_id = auth.uid() AND role = 'admin'
    )
  );

-- Step 5: Update foreign key columns in other tables
ALTER TABLE attendance
  RENAME COLUMN accf_user_id TO enrollment_id;

ALTER TABLE reflection_responses
  RENAME COLUMN accf_user_id TO enrollment_id;

ALTER TABLE cohort_activity_log
  RENAME COLUMN actor_id TO enrollment_id;

-- Step 6: Rename imports table
ALTER TABLE accf_user_imports RENAME TO enrollment_imports;

-- Step 7: Comments
COMMENT ON TABLE cohort_enrollments IS 'User enrollments in cohorts - one row per user per cohort';
COMMENT ON COLUMN cohort_enrollments.role IS 'User role in this cohort: student, admin, or coordinator';
COMMENT ON COLUMN cohort_enrollments.user_profile_id IS 'Links to user_profiles. NULL until user accepts invitation';
COMMENT ON COLUMN attendance.enrollment_id IS 'Links to cohort_enrollments';
COMMENT ON COLUMN reflection_responses.enrollment_id IS 'Links to cohort_enrollments';
```

---

## 🚀 Execution Plan

### **Step 1: Backup (Just in Case)**
```bash
# Backup current database
npx supabase db dump -f backup_before_rename.sql
```

### **Step 2: Run Migration**
```bash
# Create migration file
npx supabase migration new rename_to_cohort_enrollments

# Copy SQL from above into the new migration file

# Apply migration
npx supabase db reset  # Safe since test data
```

### **Step 3: Update Code**
```bash
# Global find/replace in your editor:
# 1. 'accf_users' → 'cohort_enrollments'
# 2. accf_user_id → enrollment_id
# 3. accf_user_imports → enrollment_imports
```

### **Step 4: Test**
```bash
# Check TypeScript
npm run check

# Start dev server
npm run dev

# Test these flows:
# - Student login
# - View dashboard
# - Submit reflection
# - Admin view cohorts
# - Admin mark reflections
```

### **Step 5: Commit**
```bash
git add .
git commit -m "refactor: rename accf_users to cohort_enrollments for clarity"
```

---

## 📝 Updated CLAUDE.md Section

Add this to your CLAUDE.md after migration:

```markdown
## Database Tables (Updated 2025-10-07)

### Core Tables
- `cohort_enrollments` - User enrollments in cohorts (formerly accf_users)
- `user_profiles` - User account data linked to auth.users
- `cohorts` - Course cohort instances (Feb 2025, Aug 2025, etc.)
- `modules` - Course content templates (Foundations, Scripture, etc.)
- `module_sessions` - Individual sessions within modules (1-8)
- `module_materials` - Content for each session
- `module_reflection_questions` - Reflection prompts per session
- `hubs` - Physical learning locations with coordinators
- `attendance` - Session attendance records (links to enrollment_id)
- `reflection_responses` - Student reflection submissions (links to enrollment_id)

### Table Name Changes
- **OLD:** `accf_users` → **NEW:** `cohort_enrollments`
- **OLD:** `accf_user_id` → **NEW:** `enrollment_id` (in attendance, reflection_responses)
- **OLD:** `accf_user_imports` → **NEW:** `enrollment_imports`
```

---

## 💡 Why This Approach Works

1. **Clean Names NOW** - Fix while data is disposable
2. **Finish ACCF** - Build it properly with good names
3. **Multi-Program LATER** - Add programs table when ACCF is done

**Timeline:**
- This cleanup: **2-3 hours**
- Finish ACCF: **2-3 weeks**
- Add multi-program: **1-2 weeks** (easy because names are already right)

---

## ✅ Success Checklist

After migration, verify:
- [ ] Can create new cohort
- [ ] Can enroll students
- [ ] Students can log in
- [ ] Students can view dashboard
- [ ] Students can submit reflections
- [ ] Admins can view cohorts
- [ ] Admins can mark reflections
- [ ] Attendance tracking works
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Database queries work

---

**Bottom Line:** Get the names right now, build ACCF with confidence, add multi-program features later when everything works perfectly.

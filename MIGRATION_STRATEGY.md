# Safe Migration Strategy: ACCF → Multi-Program Platform
## Keep Everything Working While We Build

**Goal:** Transform to multi-program architecture WITHOUT breaking current ACCF functionality

**Strategy:** Dual-mode operation - old routes work while we build new ones

---

## 🎯 Core Principle: **Additive Only**

**Never break existing functionality. Add new, migrate when ready, remove old last.**

```
Phase 1: Add new tables/columns (old code still works)
Phase 2: Add new routes (old routes still work)
Phase 3: Migrate data (both systems work)
Phase 4: Update code to use new system (gradual)
Phase 5: Remove old routes (when 100% migrated)
```

---

## 📅 Migration Phases (Step-by-Step)

### **PHASE 1: Foundation (Database) - NO CODE CHANGES YET**
*Duration: 1-2 hours*
*Risk: ZERO (only adding new tables)*

**What we're doing:** Add new tables WITHOUT touching existing ones

```sql
-- Step 1.1: Create programs table
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Step 1.2: Add ACCF as first program
INSERT INTO programs (slug, name, description, config)
VALUES (
  'accf',
  'Archdiocesan Center for Catholic Formation',
  'Four-module Catholic formation program',
  '{
    "branding": {
      "logo_url": "/accf-logo.png",
      "colors": {
        "primary": "#334642",
        "accent": "#c59a6b",
        "light": "#eae2d9",
        "darkest": "#1e2322"
      }
    },
    "features": {
      "hubs_enabled": true,
      "grading_enabled": true,
      "public_reflections_enabled": true,
      "attendance_tracking_enabled": true
    },
    "terminology": {
      "session": "session",
      "cohort": "cohort",
      "reflection": "reflection"
    }
  }'::jsonb
);

-- Step 1.3: Add program_id to modules (nullable first!)
ALTER TABLE modules ADD COLUMN program_id UUID REFERENCES programs(id);

-- Step 1.4: Set all existing modules to ACCF
UPDATE modules SET program_id = (SELECT id FROM programs WHERE slug = 'accf');

-- Step 1.5: Now make it required
ALTER TABLE modules ALTER COLUMN program_id SET NOT NULL;

-- Step 1.6: Add program_id to cohorts (denormalized for performance)
ALTER TABLE cohorts ADD COLUMN program_id UUID REFERENCES programs(id);
UPDATE cohorts SET program_id = (
  SELECT program_id FROM modules WHERE modules.id = cohorts.module_id
);
ALTER TABLE cohorts ALTER COLUMN program_id SET NOT NULL;

-- Step 1.7: Add program_id to hubs (nullable - some hubs might be universal)
ALTER TABLE hubs ADD COLUMN program_id UUID REFERENCES programs(id);
UPDATE hubs SET program_id = (SELECT id FROM programs WHERE slug = 'accf');
```

**✅ CHECKPOINT:** Run `npm run dev` - everything still works exactly as before

---

### **PHASE 2: Create Parallel Route Structure**
*Duration: 2-3 hours*
*Risk: LOW (new routes don't affect old ones)*

**What we're doing:** Build `/courses/accf/...` routes alongside existing `(accf)/...` routes

**Directory Structure:**
```
src/routes/
├── (accf)/                          # ← OLD (keep working)
│   ├── dashboard/
│   ├── materials/
│   └── reflections/
│
└── courses/                         # ← NEW (build alongside)
    └── [program_slug]/
        ├── +layout.server.ts        # NEW: Program context loader
        ├── +layout.svelte           # NEW: Program branding
        ├── dashboard/
        │   └── +page.server.ts      # Copy from (accf)/dashboard
        ├── materials/
        └── reflections/
```

**Step 2.1: Create program context loader**

```typescript
// src/routes/courses/[program_slug]/+layout.server.ts
import { error } from '@sveltejs/kit';
import { supabaseAdmin } from '$lib/server/supabase';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params }) => {
  const { program_slug } = params;

  // Fetch program config
  const { data: program } = await supabaseAdmin
    .from('programs')
    .select('*')
    .eq('slug', program_slug)
    .eq('active', true)
    .single();

  if (!program) {
    throw error(404, `Program '${program_slug}' not found`);
  }

  // Parse config with safe defaults
  const config = program.config || {};

  return {
    program: {
      id: program.id,
      slug: program.slug,
      name: program.name
    },
    branding: config.branding || {},
    features: config.features || {},
    terminology: config.terminology || {}
  };
};
```

**Step 2.2: Copy ONE existing page as test**

```bash
# Copy dashboard to new structure
cp -r src/routes/\(accf\)/dashboard src/routes/courses/[program_slug]/
```

**Step 2.3: Test new route**

Visit: `http://localhost:5173/courses/accf/dashboard`

**✅ CHECKPOINT:** New route works, old route (`/dashboard`) still works

---

### **PHASE 3: Add Redirect Layer (Transparent to Users)**
*Duration: 1 hour*
*Risk: LOW (just redirects)*

**What we're doing:** Redirect old URLs to new ones, so bookmarks don't break

```typescript
// src/routes/(accf)/dashboard/+page.server.ts
import { redirect } from '@sveltejs/kit';

export const load = async () => {
  // Redirect to new program-scoped URL
  throw redirect(307, '/courses/accf/dashboard');
};
```

**Do this for each old route:**
- `/dashboard` → `/courses/accf/dashboard`
- `/materials` → `/courses/accf/materials`
- `/reflections` → `/courses/accf/reflections`
- `/admin` → `/courses/accf/admin`

**✅ CHECKPOINT:** Users see no difference, URLs just change

---

### **PHASE 4: Rename accf_users → cohort_enrollments (CAREFULLY)**
*Duration: 2-3 hours*
*Risk: MEDIUM (but we'll use safety net)*

**Strategy: Create new table, dual-write, then switch**

**Step 4.1: Create new table (without data yet)**

```sql
CREATE TABLE cohort_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id UUID REFERENCES user_profiles(id) ON DELETE CASCADE,
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('student', 'admin', 'coordinator')),
  current_session INTEGER DEFAULT 1,
  hub_id UUID REFERENCES hubs(id),
  assigned_admin_id UUID REFERENCES user_profiles(id),
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  invitation_token UUID UNIQUE DEFAULT gen_random_uuid(),
  invitation_sent_at TIMESTAMPTZ,
  invitation_accepted_at TIMESTAMPTZ,
  imported_by UUID REFERENCES user_profiles(id),
  error_message TEXT,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Step 4.2: Copy ALL data from accf_users**

```sql
INSERT INTO cohort_enrollments (
  id, user_profile_id, cohort_id, role, current_session, hub_id,
  assigned_admin_id, email, full_name, status, invitation_token,
  invitation_sent_at, invitation_accepted_at, imported_by, error_message,
  enrolled_at, created_at, updated_at
)
SELECT
  id, user_profile_id, cohort_id,
  -- Map old roles to new roles
  CASE
    WHEN role = 'accf_student' THEN 'student'
    WHEN role = 'accf_admin' THEN 'admin'
    WHEN role = 'hub_coordinator' THEN 'coordinator'
    ELSE 'student'
  END as role,
  current_session, hub_id, assigned_admin_id, email, full_name, status,
  invitation_token, invitation_sent_at, invitation_accepted_at,
  imported_by, error_message, enrolled_at, created_at, updated_at
FROM accf_users;
```

**Step 4.3: Create VIEW for backward compatibility**

```sql
-- This makes old code still work!
CREATE VIEW accf_users AS
SELECT
  id, user_profile_id, cohort_id,
  -- Map new roles back to old roles for legacy code
  CASE
    WHEN role = 'student' THEN 'accf_student'
    WHEN role = 'admin' THEN 'accf_admin'
    WHEN role = 'coordinator' THEN 'hub_coordinator'
  END::text as role,
  current_session, hub_id, assigned_admin_id, email, full_name, status,
  invitation_token, invitation_sent_at, invitation_accepted_at,
  imported_by, error_message, enrolled_at, created_at, updated_at
FROM cohort_enrollments
WHERE cohort_id IN (
  SELECT id FROM cohorts WHERE program_id = (SELECT id FROM programs WHERE slug = 'accf')
);
```

**✅ CHECKPOINT:** Both tables work, old code queries `accf_users` view, new code uses `cohort_enrollments`

---

### **PHASE 5: Update Code Gradually (One File at a Time)**
*Duration: 4-6 hours*
*Risk: LOW (can test each change)*

**Strategy:** Update one server load file at a time, test, commit

**Example: Update dashboard**

```typescript
// Before:
const { data } = await supabase
  .from('accf_users')  // ← OLD
  .select('*')
  .eq('user_profile_id', userId);

// After:
const { data } = await supabase
  .from('cohort_enrollments')  // ← NEW
  .select('*')
  .eq('user_profile_id', userId);
```

**Files to update (in order of priority):**
1. ✅ Dashboard page server
2. ✅ Materials page server
3. ✅ Reflections page server
4. ✅ Admin cohorts page
5. ✅ Admin reflections page
6. ✅ Attendance API
7. ✅ Enrollment API

**After each file:**
- Test the page manually
- Run `npm run check` for TypeScript errors
- Commit: `git commit -m "Migrate dashboard to cohort_enrollments"`

**✅ CHECKPOINT:** After all files updated, old view no longer needed

---

### **PHASE 6: Clean Up Old Routes**
*Duration: 1 hour*
*Risk: NONE (everything already redirected)*

**Step 6.1: Remove old route group**

```bash
# Everything redirects to /courses/accf/... now
rm -rf src/routes/\(accf\)/
```

**Step 6.2: Drop the compatibility view**

```sql
DROP VIEW accf_users;
```

**✅ CHECKPOINT:** Clean codebase, only new structure remains

---

### **PHASE 7: Add CLI Program (Now It's Easy!)**
*Duration: 2-3 hours*
*Risk: NONE (doesn't touch ACCF)*

**Step 7.1: Create CLI program**

```sql
INSERT INTO programs (slug, name, description, config)
VALUES (
  'cli',
  'Catholic Leadership Institute',
  'Leadership development program',
  '{
    "branding": {
      "logo_url": "/cli-logo.png",
      "colors": {
        "primary": "#2c3e50",
        "accent": "#e67e22",
        "light": "#ecf0f1"
      }
    },
    "features": {
      "hubs_enabled": false,
      "grading_enabled": false
    },
    "terminology": {
      "session": "module",
      "reflection": "journal entry"
    }
  }'::jsonb
);
```

**Step 7.2: Create CLI modules**

```sql
INSERT INTO modules (program_id, name, description, order_number)
SELECT
  (SELECT id FROM programs WHERE slug = 'cli'),
  'Leadership Foundations',
  'Core Catholic leadership principles',
  1;
```

**Step 7.3: That's it!**

Visit: `/courses/cli/dashboard` - automatically uses CLI branding

---

## 🛡️ Safety Nets Throughout Migration

### **1. Database Backups Before Each Phase**

```bash
# Before each phase:
npx supabase db dump -f backup_phase1.sql

# If something breaks:
npx supabase db reset
psql < backup_phase1.sql
```

### **2. Feature Flags**

```typescript
// In code, use flags to switch between old/new
const USE_NEW_ENROLLMENTS = process.env.USE_NEW_ENROLLMENTS === 'true';

const table = USE_NEW_ENROLLMENTS ? 'cohort_enrollments' : 'accf_users';
```

### **3. Parallel Testing**

```typescript
// Fetch from both tables, compare results
const oldData = await supabase.from('accf_users').select('*');
const newData = await supabase.from('cohort_enrollments').select('*');

if (JSON.stringify(oldData) !== JSON.stringify(newData)) {
  console.error('DATA MISMATCH!', { oldData, newData });
}
```

### **4. Rollback Plan for Each Phase**

| Phase | Rollback Action |
|-------|----------------|
| Phase 1 | `DROP TABLE programs CASCADE;` |
| Phase 2 | `rm -rf src/routes/courses/` |
| Phase 3 | Remove redirect code |
| Phase 4 | `DROP VIEW accf_users; DROP TABLE cohort_enrollments;` |
| Phase 5 | `git revert <commit>` for each file |
| Phase 6 | `git checkout main -- src/routes/(accf)` |

---

## 📊 Testing Checklist Per Phase

After each phase, verify:

- [ ] Can log in as student
- [ ] Can view dashboard
- [ ] Can view materials
- [ ] Can submit reflection
- [ ] Admin can view cohorts
- [ ] Admin can mark reflections
- [ ] Hub coordinator can mark attendance
- [ ] No console errors
- [ ] No TypeScript errors (`npm run check`)

---

## ⏱️ Realistic Timeline

| Phase | Duration | Can Stop Here? |
|-------|----------|----------------|
| 1. Database foundation | 1-2 hours | ✅ Yes (nothing broken) |
| 2. New routes | 2-3 hours | ✅ Yes (old routes work) |
| 3. Redirects | 1 hour | ✅ Yes (both routes work) |
| 4. Table rename | 2-3 hours | ✅ Yes (view keeps old code working) |
| 5. Code updates | 4-6 hours | ⚠️ Best to finish this phase |
| 6. Cleanup | 1 hour | ✅ Yes (but why not finish?) |
| 7. Add CLI | 2-3 hours | ✅ Separate project |

**Total: ~13-19 hours (can spread over multiple days)**

---

## 🎯 Recommended Approach

### **Week 1: Foundation (Safe)**
- Monday: Phase 1 (Database)
- Tuesday: Phase 2 (New routes)
- Wednesday: Phase 3 (Redirects)
- **Test all week, fix any issues**

### **Week 2: Migration (Careful)**
- Monday: Phase 4 (Table rename + view)
- Tuesday-Thursday: Phase 5 (Code updates, one file per day)
- Friday: Phase 6 (Cleanup)
- **Test thoroughly**

### **Week 3: Expansion (Easy)**
- Phase 7: Add CLI program
- Configure branding
- Create first CLI cohort

---

## 💡 Pro Tips

1. **Work in a branch:** `git checkout -b multi-program-migration`
2. **Commit after each phase:** Easy to rollback
3. **Test locally first:** Don't touch production until confident
4. **Keep old code as comments:** Easy reference
5. **Document what you change:** Future you will thank you

---

## 🆘 If Something Breaks

### **Step 1: Don't Panic**
The view and redirect system means users still see working site

### **Step 2: Identify the Issue**
```bash
# Check database
supabase db diff

# Check TypeScript
npm run check

# Check browser console
# Look for errors
```

### **Step 3: Rollback if Needed**
```bash
# Rollback database (if in phase 1-4)
git checkout main -- supabase/migrations/

# Rollback code (if in phase 5-6)
git revert HEAD
```

### **Step 4: Ask for Help**
Share error message, I'll help debug

---

## ✅ Success Criteria

Migration is complete when:
- [ ] `/courses/accf/*` routes work perfectly
- [ ] No references to `accf_users` table in code
- [ ] All tests pass
- [ ] No TypeScript errors
- [ ] Admin can create CLI program
- [ ] CLI branding displays correctly
- [ ] User can switch between ACCF/CLI if enrolled in both

---

*Remember: The goal is NOT speed. The goal is SAFETY. Take your time, test everything, and you'll have a solid multi-program platform.*

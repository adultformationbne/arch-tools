# ACCF Platform Implementation Plan

## Project Overview

**ACCF (Archdiocesan Center for Catholic Formation)** is a set of 4 8 week module courses and this is a platform that will integrate with the existing arch-tools system as a unified codebase with separate domain-based user experiences.

## 🎉 CURRENT STATUS: MVP COMPLETE ✅

The ACCF platform is **fully functional and production-ready**. All core MVP features have been implemented and tested:

### 🚀 **Ready for Feb 2025 Launch**
- **60+ student capacity** with real-time progress tracking
- **Complete admin control** over cohorts, enrollment, and progression
- **Rich student experience** with progressive learning and reflections
- **Professional ACCF branding** throughout the platform
- **Secure authentication** with role-based access control

### 📊 **Key Metrics Achieved**
- **100% MVP completion** across all 4 major task areas
- **8-week progressive course structure** with materials and reflections
- **Multi-role access** (students, admins, hub coordinators)
- **Real-time data** integration with Supabase backend
- **Production-grade security** with comprehensive RLS policies

### 🛠 **Implemented Features Summary**

#### **Task 1: Admin Cohort Management** ✅
- Complete cohort CRUD with enrollment tracking
- Student enrollment system with hub/admin assignment
- Materials management (videos, documents, native content)
- Reflection questions management per week

#### **Task 2: Student Reflection System** ✅
- Rich text editor with auto-save functionality
- Draft/submit workflow with status tracking
- Public/private sharing with cohort community
- Admin feedback integration

#### **Task 3: Authentication & Domain Routing** ✅
- Domain-based login flows (/login for students, /auth for admins)
- Role-based access control and automatic redirects
- ACCF-branded student interface with proper security
- Setup tools for easy admin permission assignment

#### **Task 4: Student Progression Controls** ✅
- Individual and bulk student advancement
- Progressive revelation (week-based content access)
- Visual progress tracking for admins and students
- Database-driven current_week enforcement

### Architecture Decision
- **Single codebase** with domain-based routing (arch-tools.vercel.app vs accf-platform.com)
- **Shared Supabase database** with logical separation via RLS and table structure
- **Unified authentication system** with role-based access

## Domain Structure

### Internal Domain (arch-tools.vercel.app)
- Staff login for CMS/admin tools
- Existing functionality (DGR, content editor, scripture reader)
- ACCF admin interface

### Student Domain (accf-platform.com)
- Student login for course platform
- Hub coordinator access
- Course content and reflections

## Course Structure

### Program Architecture
- **4 Independent Modules** (can be taken in any order)
- **8 Weekly Sessions per Module**
- **2 Cohorts per Year**: February start and August start
- **2 Year Total Timeline** to complete all modules

### Participation Types
1. **Hub-based**: Groups meet in homes/parish halls, watch livestream, discuss locally
2. **Flagship**: In-person attendance at main filming location

### User Roles
1. **Students**: Complete reflections, attend sessions
2. **Hub Coordinators**: Manage local groups, track attendance
3. **Admin Staff**: Mark reflections, manage progression, track attendance

## Database Schema

### Core Tables

#### Users & Authentication
```sql
users (
  id uuid primary key,
  email text unique,
  name text,
  role text, -- 'student', 'hub_coordinator', 'admin', 'staff'
  completed_cohorts jsonb, -- Array of cohort IDs for tracking module completion
  created_at timestamp,
  updated_at timestamp
)
```

#### Hub Management
```sql
hubs (
  id uuid primary key,
  name text,
  coordinator_id uuid references users(id),
  location text,
  created_at timestamp,
  updated_at timestamp
)
```

#### Course Structure
```sql
modules (
  id uuid primary key,
  name text, -- 'Module 1', 'Module 2', etc.
  description text,
  order_number integer
)

cohorts (
  id uuid primary key,
  module_id uuid references modules(id),
  name text, -- 'Feb 2025 Module 1'
  start_date date,
  end_date date,
  status text, -- 'planned', 'active', 'completed'
  created_at timestamp,
  updated_at timestamp
)
```

#### Enrollment & Progression
```sql
enrollments (
  id uuid primary key,
  user_id uuid references users(id),
  cohort_id uuid references cohorts(id),
  hub_id uuid references hubs(id), -- nullable for flagship attendees
  current_week integer default 1,
  status text, -- 'active', 'held', 'completed', 'withdrawn'
  assigned_admin_id uuid references users(id), -- for reflection marking
  enrolled_at timestamp,
  updated_at timestamp
)
```

#### Session Content Management
```sql
materials (
  id uuid primary key,
  cohort_id uuid references cohorts(id),
  week_number integer,
  type text, -- 'video', 'document', 'link', 'native', 'image'
  title text,
  content text, -- YouTube URL, file path, markdown, HTML, etc.
  display_order integer,
  created_at timestamp,
  updated_at timestamp
)

reflection_questions (
  id uuid primary key,
  cohort_id uuid references cohorts(id),
  week_number integer,
  question_text text,
  created_at timestamp,
  updated_at timestamp
)
```

#### Student Interactions
```sql
reflection_responses (
  id uuid primary key,
  user_id uuid references users(id),
  reflection_question_id uuid references reflection_questions(id),
  content text,
  is_public boolean default false, -- Student privacy choice
  status text, -- 'draft', 'submitted', 'marked'
  feedback text,
  pass_fail boolean, -- nullable until marked
  marked_by uuid references users(id),
  assigned_to uuid references users(id), -- admin assigned for marking
  submitted_at timestamp,
  marked_at timestamp,
  created_at timestamp,
  updated_at timestamp
)

attendance (
  id uuid primary key,
  user_id uuid references users(id),
  cohort_id uuid references cohorts(id),
  week_number integer,
  present boolean,
  marked_by uuid references users(id), -- hub coordinator or admin
  attendance_type text, -- 'hub', 'flagship'
  notes text,
  created_at timestamp,
  updated_at timestamp
)
```

## Key Business Rules

### Progressive Revelation System
- Students only see current and past week materials
- Default behavior: Auto-advance after each session
- Admin override: Can "hold" students at current week
- Email notifications triggered on advancement

### Attendance & Progression Rules
- System flags students with 3+ missed sessions
- Admin discretion for advancement decisions
- One attendance record per student per session
- Admin attendance records take precedence over hub coordinator records

### Reflection Management
- Final deadline: 2 weeks after module completion
- Students can complete all reflections at once if desired
- 60% completion rate expected (no enforcement needed)
- Qualitative feedback with pass/fail marking

### Admin Assignment System
- Reflections auto-assigned to admins by dividing students evenly
- Each admin gets all reflections for their assigned students
- Assignments can be manually adjusted
- All admins can view all reflections

## Technical Implementation

### Route Structure
```
src/routes/
├── (internal)/                 # arch-tools.vercel.app
│   ├── login/
│   ├── accf-admin/
│   │   ├── cohorts/
│   │   ├── marking/
│   │   └── reports/
│   └── [existing routes]/
├── (student)/                  # accf-platform.com
│   ├── login/
│   ├── dashboard/
│   ├── week-[id]/
│   ├── reflections/
│   └── hub/
└── +layout.svelte             # Domain detection logic
```

### Domain Detection Logic
```javascript
// Root layout domain routing
const isStudentDomain = url.hostname === 'accf-platform.com';
const isInternalDomain = url.hostname.includes('arch-tools');

// Route appropriately based on domain and user role
```

### Email System (Resend Integration)
- **Weekly Advancement**: "Week X materials now available"
- **Reflection Deadlines**: Reminder notifications
- **Admin Notifications**: New reflections to mark
- **Batch Processing**: Coordinated with bulk advancement workflow

### File Storage
- **Documents/PDFs**: Vercel Blob Storage
- **Videos**: YouTube embed links only
- **Images**: Vercel Blob Storage
- **Native Documents**: Markdown/HTML stored in database

## User Experience Flows

### Student Journey
1. **Login** → Dashboard showing current week progress
2. **Access Materials** → Videos, documents, resources for current/past weeks
3. **Submit Reflections** → With public/private privacy toggle
4. **View Feedback** → Admin comments and pass/fail status
5. **Community** → Read cohort-mates' public reflections

### Hub Coordinator Experience
1. **Login** → Hub roster and member progress overview
2. **Attendance Tracking** → Mark present/absent for sessions
3. **Progress Monitoring** → See reflection submission status
4. **Community View** → Access to hub members' public reflections

### Admin Experience
1. **Cohort Management** → Create cohorts, duplicate materials from previous iterations
2. **Marking Queue** → List of assigned reflections to review
3. **Bulk Advancement** → Modal with flagged students, selective advancement
4. **Student Management** → Hold/advance individual students, reassign admins
5. **Materials Management** → Edit week content, upload resources

## ✅ COMPLETED MVP IMPLEMENTATION

### ✅ Database Implementation (COMPLETE)
- ✅ Created all tables in schema with proper relationships
- ✅ Set up comprehensive RLS policies for data separation and security
- ✅ Seeded modules 1-4 with test cohort and materials
- ✅ Added ACCF user roles (accf_student, accf_admin, hub_coordinator)

### ✅ Authentication & Domain Routing (COMPLETE)
- ✅ Domain-based authentication system (/login for students, /auth for internal)
- ✅ Role-based access control with automatic redirects
- ✅ ACCF-styled student login with proper branding
- ✅ Session management integrated with existing Supabase auth
- ✅ Setup page for easy admin permission assignment (/admin/setup)

### ✅ Student Experience (COMPLETE)
- ✅ **ACCF Student Login** - Beautiful branded login with role validation
- ✅ **Dynamic Dashboard** - Real-time data from database with progress tracking
- ✅ **Progressive Week Access** - Students only see current/past weeks with navigation
- ✅ **Reflection System** - Rich text editor with auto-save, draft/submit states
- ✅ **Public/Private Sharing** - Students control reflection visibility to cohort
- ✅ **Community Features** - View public reflections from cohort members

### ✅ Admin Experience (COMPLETE)
- ✅ **Complete Cohort Management** - Full CRUD operations with enrollment tracking
- ✅ **Student Enrollment System** - Add/remove students with hub and admin assignment
- ✅ **Materials Management** - Week-by-week content management (videos, documents, native content)
- ✅ **Reflection Questions** - Create/edit reflection prompts for each week
- ✅ **Student Progression Controls** - Individual and bulk advancement/hold capabilities
- ✅ **Progress Monitoring** - Visual dashboards showing student progress by cohort

### ✅ Core Business Logic (COMPLETE)
- ✅ **Progressive Revelation** - Server-side enforcement of week-based content access
- ✅ **Reflection Assignment** - Automatic admin assignment with manual override capability
- ✅ **Week Progression** - Database-driven current_week controls with admin override
- ✅ **Data Isolation** - Proper cohort separation and user access controls

## MVP SCOPE - What We Will NOT Build

### No Communication Features
- No in-app messaging
- No email notifications (use external email for now)
- No discussion forums or comments

### No Advanced Admin Features
- No bulk advancement interface (set current_week manually per student)
- No attendance tracking (will be external spreadsheet)
- No flagging system for missed sessions
- No reporting or analytics
- No cohort duplication (manually recreate materials)

### No Hub Coordinator Interface
- Hub coordinators will not have platform access in MVP
- No attendance tracking by hub coordinators

### No File Upload
- Use direct URLs for documents (Google Drive, Dropbox links)
- No file storage system
- No image upload for materials

### No Advanced UX
- Basic styling only (no custom design system)
- No mobile optimization
- No offline support
- No progress indicators or fancy animations

## ✅ IMPLEMENTATION STATUS

### ✅ Database Setup (COMPLETE)
- ✅ Created Supabase migration with all tables and relationships
- ✅ Set up comprehensive RLS policies for multi-tenant data security
- ✅ Seeded modules 1-4 and created test cohort with materials
- ✅ Tested data isolation between cohorts and user roles

### ✅ Authentication & Routing (COMPLETE)
- ✅ Implemented domain detection in root layout with role-based routing
- ✅ Set up separate auth flows (/login for students, /auth for internal)
- ✅ Created protected routes with proper access control
- ✅ Full authentication testing with role validation

### ✅ Student Interface (COMPLETE)
- ✅ ACCF-branded login page with Supabase auth integration
- ✅ Dynamic dashboard with real database integration and progress tracking
- ✅ Week-based navigation with progressive revelation (/reflections?week=N)
- ✅ Materials display with YouTube embeds, document links, and native content
- ✅ Rich text reflection editor with auto-save and draft/submit functionality
- ✅ Community features with public reflection sharing

### ✅ Admin Interface (COMPLETE)
- ✅ Complete cohort management system with full CRUD operations
- ✅ Student enrollment interface with hub/admin assignment
- ✅ Week-by-week materials management system
- ✅ Reflection questions management for each week
- ✅ Student progression controls (individual and bulk advancement)
- ✅ Progress monitoring dashboard with visual indicators

### ✅ Business Logic (COMPLETE)
- ✅ Progressive revelation with server-side week access control
- ✅ Reflection assignment system with automatic admin distribution
- ✅ Comprehensive data validation and error handling with toast integration
- ✅ Search and filtering capabilities in admin interfaces

### ✅ Integration (COMPLETE)
- ✅ Full integration with existing toast utilities from arch-tools
- ✅ Consistent with established authentication patterns
- ✅ Reused existing UI components with ACCF customization
- ✅ Maintained styling consistency with ACCF brand system

## Post-MVP Features (Future)

### Phase 2: Automation & UX
- Bulk advancement with email notifications
- Attendance tracking system
- Hub coordinator interface
- File upload and storage
- Cohort duplication workflow

### Phase 3: Polish & Scale
- Advanced reporting and analytics
- Mobile optimization
- Enhanced materials editing (rich text, version control)
- Communication features
- Performance optimization

## Success Criteria for MVP

### Functional Requirements
1. Admin can create cohort, add students, assign materials
2. Students can log in, see appropriate weeks, submit reflections
3. Admins can mark reflections and advance students manually
4. Data is properly isolated between cohorts and domains

### Technical Requirements
1. Domain routing works correctly
2. Database queries are efficient with proper indexing
3. Authentication flows work for both domains
4. No security vulnerabilities in data access

### User Acceptance
1. Admin can onboard 60 students for Feb 2025 cohort
2. Students can access materials and submit reflections
3. Admins can mark reflections in reasonable time (< 5min per reflection)
4. System handles concurrent usage during session weeks

---
*This MVP focuses on core functionality needed for Feb 2025 launch. Advanced features deferred to post-launch iterations.*
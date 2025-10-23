# ArchMin Courses - Long-Term SaaS Roadmap
**Platform Vision:** Free, white-labeled course management platform for churches and faith-based organizations

**Last Updated:** 2025-10-08
**Status:** Planning Phase

---

## 🎯 Vision & Business Model

### **Product Vision**
A free-forever, white-labeled course platform where churches and faith organizations can:
- Choose from ready-to-go programs (ACCF, CLI, etc.)
- Build their own custom programs and curriculum
- Manage students, cohorts, and content with minimal technical knowledge
- Have their branding dynamically applied across the entire platform

### **Target Customers**
- Churches running formation programs
- Dioceses/Archdioceses
- Catholic schools and retreat centers
- Faith-based educational organizations

### **Business Model**
- **Free forever** for all organizations
- Organizations apply and are invited to create accounts
- Minimal costs through Supabase free tier + efficient architecture
- Max expected: ~100 organizations

---

## 👥 User Hierarchy & Roles

### **Platform Admin (You)**
- Creates and approves organizations
- Platform-level monitoring and support
- Can view all orgs (read-only for debugging)

### **Organization Owner (Org-Admin)**
- Initial sign-up user (tied to auth.uid)
- Creates and manages programs within their organization
- Can invite additional org admins
- Manages organization branding (logo, colors)
- Controls which programs are active

### **Program Admin**
- Manages specific program(s) within the organization
- Creates cohorts, modules, and materials
- Enrolls students and assigns coordinators
- Marks reflections and tracks attendance
- Can be assigned by org-admin

### **Hub/Group Coordinator**
- Manages local hub/group within a cohort
- Marks attendance for their group
- Views their group members' progress
- Optional role (not all programs use hubs)

### **Participant (Student)**
- Enrolled in one or more cohorts
- Views materials, submits reflections
- Participates in cohort messaging
- Sees branding of the program they're enrolled in

---

## 🏗️ Technical Architecture

### **Multi-Tenancy Strategy**
- **Row-level security (RLS)** in single Supabase database
- All organizations share one database with strict RLS policies
- Expected scale: ~100 orgs (well within Supabase free tier limits)
- Data isolation via `organization_id` foreign keys

### **Subdomain Architecture**
- **Primary domain:** `archmin.courses` (or similar)
- **Org subdomains:** `{org-slug}.archmin.courses`
  - Example: `stlouis.archmin.courses`
  - Example: `holyspirit.archmin.courses`
- **Vercel wildcard domain setup** (requires nameserver method)
- Dynamic routing: `/[org_slug]/courses/[program_slug]/...`

### **White-Labeling Strategy**
- Minimal "ArchMin Courses" platform branding
- On login, system pulls enrolled program's branding from DB
- CSS variables dynamically applied per program
- Logo, colors, fonts all configurable per program
- User never sees "ArchMin" once logged in—only program branding

### **Database Schema Additions**

#### New: `organizations` table
```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,  -- Used in subdomain
  name TEXT NOT NULL,
  description TEXT,

  -- Ownership
  owner_id UUID NOT NULL REFERENCES auth.users(id),

  -- Branding (org-level, can be overridden by programs)
  logo_url TEXT,
  primary_color TEXT DEFAULT '#334642',

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'active', 'suspended')),
  approved_by UUID REFERENCES user_profiles(id),
  approved_at TIMESTAMPTZ,

  -- Metadata
  contact_email TEXT,
  website TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_owner ON organizations(owner_id);
CREATE INDEX idx_organizations_status ON organizations(status);

COMMENT ON TABLE organizations IS 'Churches and organizations that run programs';
COMMENT ON COLUMN organizations.slug IS 'Used for subdomain: {slug}.archmin.courses';
```

#### Modified: `programs` table
```sql
ALTER TABLE programs
  ADD COLUMN organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

CREATE INDEX idx_programs_organization ON programs(organization_id);

COMMENT ON COLUMN programs.organization_id IS 'Organization that owns this program';
```

#### New: `organization_admins` table
```sql
CREATE TABLE organization_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'admin' CHECK (role IN ('owner', 'admin')),
  invited_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(organization_id, user_profile_id)
);

CREATE INDEX idx_org_admins_org ON organization_admins(organization_id);
CREATE INDEX idx_org_admins_user ON organization_admins(user_profile_id);
```

---

## 📱 Mobile App Strategy

### **Problem**
- SvelteKit app can't be deployed directly to iOS/Android app stores
- Admin interface too complex for mobile anyway

### **Solution: Separate Mobile App**
Build a **lightweight React Native or Flutter app** for student-facing features only:

#### **Mobile App Scope (Student-Focused)**
- ✅ View course materials (videos, documents, resources)
- ✅ Submit reflections
- ✅ Cohort messaging (instant messaging like FB Messenger)
- ✅ View progress and grades
- ✅ Push notifications for deadlines and messages
- ❌ No admin controls (use web for admin tasks)

#### **Technology Options**

**Option 1: React Native (Expo)**
- **Pros:** JavaScript (familiar), Expo Go for easy testing, large ecosystem
- **Cons:** Slightly larger app size
- **Cost:** Free (self-hosted)

**Option 2: Flutter**
- **Pros:** Single codebase, excellent performance, smaller app size
- **Cons:** Dart language (new learning curve)
- **Cost:** Free (self-hosted)

**Recommendation:** **React Native with Expo** for faster development and JavaScript consistency

#### **Mobile App Architecture**
- Same Supabase database (shared with web app)
- Same RLS policies for security
- Auth via Supabase Auth (SSO with web)
- Realtime messaging via Supabase Realtime
- Program branding pulled from database (same as web)

---

## 💬 Messaging System

### **Requirements**
- Instant messaging (like Facebook Messenger)
- Cohort-level group chats
- Direct messages between students and admins (future)
- Real-time delivery
- **Ultra-low cost** (free tier preferred)

### **Solution: Supabase Realtime**

#### **Why Supabase Realtime?**
- ✅ **Already using Supabase** (no new dependencies)
- ✅ **Free tier:** 2 projects, 500 concurrent connections, 2GB bandwidth/month
- ✅ **Pricing beyond free:** $2.50 per 1M messages (extremely cheap)
- ✅ **Built-in auth integration**
- ✅ **RLS support** for secure messaging
- ✅ **Works on web and mobile** (React Native SDK available)

#### **Alternative Considered: Separate Chat Service**
- Firebase: More expensive, vendor lock-in
- Appwrite: Requires separate hosting
- Stream Chat: Not free, $99/month minimum
- **Verdict:** Supabase Realtime is best fit for budget

#### **Messaging Schema**

```sql
CREATE TABLE chat_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,  -- "Feb 2025 Foundations Chat"
  type TEXT DEFAULT 'cohort' CHECK (type IN ('cohort', 'direct', 'hub')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT now(),
  edited_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

CREATE TABLE chat_room_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ DEFAULT now(),
  joined_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(room_id, user_profile_id)
);

-- RLS Policies
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their rooms"
  ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_room_members
      WHERE room_id = chat_messages.room_id
        AND user_profile_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages in their rooms"
  ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_room_members
      WHERE room_id = chat_messages.room_id
        AND user_profile_id = auth.uid()
    )
  );
```

#### **Realtime Subscription (Client)**
```typescript
// Subscribe to cohort chat room
const subscription = supabase
  .channel(`chat:${roomId}`)
  .on('postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'chat_messages',
      filter: `room_id=eq.${roomId}`
    },
    (payload) => {
      // New message received, update UI
      appendMessage(payload.new);
    }
  )
  .subscribe();
```

---

## 🗺️ Migration Path from Current State

### **Current Architecture (ACCF-Only)**
```
/routes/(accf)/
  - login, dashboard, reflections
  - admin/ (cohorts, marking, students)
```

### **Step 1: Add Multi-Program Support** (from COURSES.md)
- Implement `programs` table with JSONB config
- Rename `accf_users` → `cohort_enrollments`
- Move routes to `/courses/[program_slug]/`
- Dynamic branding per program

### **Step 2: Add Organizations Layer** (Multi-Tenancy)
- Create `organizations` table
- Add `organization_id` to `programs`
- Implement subdomain routing
- Org admin signup and approval workflow

### **Step 3: Program Templates & Builder**
- Create "ready-to-go" program templates (ACCF, CLI, etc.)
- Build program creation wizard for org admins
- Module/content builder interface
- Material upload and management

### **Step 4: Messaging System**
- Implement chat schema
- Build web chat interface (cohort messaging)
- Add Supabase Realtime subscriptions
- Notifications for new messages

### **Step 5: Mobile App (React Native)**
- Set up Expo project
- Student authentication (Supabase Auth)
- Materials viewer (videos, documents)
- Reflection submission
- Chat interface (Supabase Realtime)
- Push notifications

### **Step 6: Polish & Scale**
- Analytics dashboard for orgs
- Email notification system
- In-app announcements
- Student certificates
- Bulk enrollment tools

---

## 📊 Phased Roadmap

### **Phase 1: Multi-Program Foundation** (4-6 weeks)
**Goal:** Support multiple programs under one organization (ACCF + CLI)

- [ ] Database migration from COURSES.md (programs, enrollments)
- [ ] Route restructure: `/courses/[program_slug]/`
- [ ] Dynamic branding system (CSS variables)
- [ ] Program switcher UI
- [ ] Permission system per enrollment
- [ ] Test with ACCF + CLI programs

**Deliverable:** Web app supports multiple programs with isolated branding

---

### **Phase 2: Organization Multi-Tenancy** (3-4 weeks)
**Goal:** Multiple organizations can create their own programs

- [ ] Create `organizations` table and schema
- [ ] Org signup and approval workflow
- [ ] Subdomain routing with Vercel wildcards
- [ ] Organization admin interface
- [ ] Org-to-program relationship
- [ ] RLS policies for data isolation
- [ ] Platform admin dashboard (approve orgs)

**Deliverable:** Orgs can sign up and manage programs on their subdomain

---

### **Phase 3: Program Templates & Builder** (4-5 weeks)
**Goal:** Orgs can choose templates or build custom programs

- [ ] Create program template library (ACCF, CLI, Youth Ministry, etc.)
- [ ] Program creation wizard
  - Choose template or build from scratch
  - Set program branding
  - Configure features (hubs, grading, etc.)
- [ ] Module builder interface
  - Add sessions (weeks)
  - Upload materials (videos, docs, links)
  - Create reflection questions
- [ ] Content management UI
- [ ] Program preview before activation

**Deliverable:** Org admins can create and customize programs without code

---

### **Phase 4: Messaging System** (2-3 weeks)
**Goal:** Students and admins can message within cohorts

- [ ] Create chat schema (rooms, messages, members)
- [ ] Implement Supabase Realtime subscriptions
- [ ] Build web chat interface
  - Cohort group chat
  - Message list and input
  - Real-time updates
  - Unread message indicators
- [ ] RLS policies for message security
- [ ] Test message delivery and performance

**Deliverable:** Cohort messaging works on web app

---

### **Phase 5: Mobile App (React Native)** (6-8 weeks)
**Goal:** Students can access materials and chat on iOS/Android

#### **5.1: Project Setup & Auth**
- [ ] Initialize Expo React Native project
- [ ] Set up Supabase client for React Native
- [ ] Implement authentication flow
  - Login screen
  - Session management
  - Auto-login on app open
- [ ] Bottom tab navigation (Materials, Chat, Profile)

#### **5.2: Materials Viewer**
- [ ] Fetch enrolled cohort and program
- [ ] Display current week materials
- [ ] Video player (YouTube embed or native)
- [ ] Document viewer (PDF, links)
- [ ] Progress indicator

#### **5.3: Reflection Submission**
- [ ] Fetch reflection questions for current week
- [ ] Text input for responses
- [ ] Submit to database
- [ ] View past reflections and grades

#### **5.4: Chat Implementation**
- [ ] Chat room list (user's cohorts)
- [ ] Message list with real-time updates
- [ ] Message input and send
- [ ] Unread badges
- [ ] Supabase Realtime subscription

#### **5.5: Push Notifications**
- [ ] Set up Expo push notifications
- [ ] Trigger notifications for new messages
- [ ] Trigger notifications for upcoming deadlines
- [ ] Notification settings

#### **5.6: Branding & Polish**
- [ ] Apply program branding dynamically
- [ ] Splash screen with program logo
- [ ] App icon generation
- [ ] Test on iOS and Android
- [ ] Submit to App Store and Google Play

**Deliverable:** Native mobile app for students (iOS + Android)

---

### **Phase 6: Polish & Features** (Ongoing)
**Goal:** Enhance UX and add quality-of-life features

- [ ] Email notification system (weekly reminders)
- [ ] Analytics dashboard for org admins
- [ ] Bulk student enrollment (CSV import)
- [ ] Student completion certificates (PDF generation)
- [ ] In-app announcements
- [ ] Advanced reporting (attendance, completion rates)
- [ ] Hub coordinator mobile access
- [ ] Direct messaging (student to admin)
- [ ] File attachments in chat
- [ ] Search functionality (materials, messages)

---

## 💰 Cost Analysis (100 Orgs)

### **Supabase (Primary Backend)**
- **Free Tier:** 2 projects, 500MB DB, 10k MAUs, 2GB bandwidth
- **Estimated Need:** Pro plan ($25/month) for production scale
  - 100GB database
  - 100k MAUs
  - 250GB bandwidth
  - Realtime: $2.50 per 1M messages (minimal cost)
- **Total:** ~$25-50/month

### **Vercel (Hosting)**
- **Free Tier:** Unlimited deployments, 100GB bandwidth
- **Estimated Need:** Pro plan ($20/month) for custom domains
  - Unlimited bandwidth
  - Advanced analytics
  - Wildcard domain support
- **Total:** ~$20/month

### **Expo (Mobile App)**
- **Free Tier:** Unlimited builds, push notifications
- **Paid (Optional):** EAS Build ($29/month) for faster builds
- **Total:** $0 (free tier sufficient)

### **Domain & SSL**
- Domain registration: ~$12/year
- SSL: Free (Vercel auto-SSL)
- **Total:** ~$1/month

### **Push Notifications**
- Expo Push Notifications: Free for reasonable usage
- **Total:** $0

### **Total Monthly Cost: ~$46-71/month** for 100 organizations

**Per-org cost:** $0.46-0.71/month (sustainable for free model)

---

## 🔒 Security Considerations

### **RLS Policies (Critical)**
- All tables require `organization_id` checks
- Users can only access data from their enrolled organizations
- Platform admin has separate super-user access
- Test RLS thoroughly with multiple orgs

### **Subdomain Isolation**
- Each org's subdomain shows only their programs
- No cross-org data leakage in UI
- Auth tokens scoped to organization

### **Mobile App Security**
- Supabase JWT tokens for authentication
- Refresh tokens stored securely
- No sensitive data cached locally
- SSL pinning for API requests

### **Invitation System**
- Org admins can only invite to their organization
- Token-based invitations with expiration
- Email verification required

---

## 🧪 Testing Strategy

### **Multi-Tenancy Testing**
1. Create 3 test organizations
2. Each org creates 2 programs
3. Enroll test users in multiple orgs
4. Verify data isolation (no cross-org access)
5. Test subdomain routing
6. Test branding application per org

### **Mobile App Testing**
1. Test on iOS simulator and Android emulator
2. Test on physical devices (iOS + Android)
3. Test push notifications
4. Test offline behavior
5. Test deep links from emails

### **Load Testing**
1. Simulate 100 concurrent users
2. Simulate 10k messages sent in 1 hour
3. Monitor database performance
4. Monitor Realtime connection limits

---

## 📚 Documentation Needs

### **For Org Admins**
- How to sign up and create organization
- How to create a program from template
- How to build custom program
- How to enroll students (manual + CSV)
- How to manage cohorts and sessions
- How to use messaging

### **For Students**
- How to accept invitation
- How to view materials
- How to submit reflections
- How to use chat
- How to download mobile app

### **For Platform Admin (You)**
- How to approve organizations
- How to monitor system health
- How to handle support requests
- Database backup procedures
- Scaling guidelines

---

## 🚀 Quick Start Priorities

**To get to MVP fastest, I recommend this order:**

1. **Phase 1: Multi-Program** (4-6 weeks) - Builds on COURSES.md work
2. **Phase 2: Organizations** (3-4 weeks) - Enables multi-tenancy
3. **Phase 4: Messaging** (2-3 weeks) - High-value student feature
4. **Phase 3: Program Builder** (4-5 weeks) - Enables self-service
5. **Phase 5: Mobile App** (6-8 weeks) - Expands reach

**Total to Full SaaS MVP: ~19-26 weeks (5-6 months)**

---

## 🎯 Success Metrics

### **Technical Metrics**
- Page load time < 2 seconds
- Message delivery latency < 500ms
- Mobile app size < 50MB
- Database query time < 100ms avg
- 99.9% uptime

### **User Metrics**
- Org signup to first program: < 30 minutes
- Student enrollment to first login: < 5 minutes
- Mobile app rating: > 4.5 stars
- Support requests per org: < 2/month

### **Business Metrics**
- Organizations onboarded: 100
- Active students: 5,000
- Monthly cost per org: < $1
- Retention rate: > 90%

---

## 🛠️ Technology Stack Summary

### **Web App**
- SvelteKit 5 (frontend + SSR)
- Tailwind CSS v4 (styling)
- Supabase (database, auth, realtime)
- Vercel (hosting, subdomains)

### **Mobile App**
- React Native (iOS/Android)
- Expo (build tooling)
- Supabase JS client (data + auth)
- Expo Push Notifications

### **Database**
- PostgreSQL (via Supabase)
- Row-level security (multi-tenancy)
- Realtime subscriptions (messaging)

### **Infrastructure**
- Vercel wildcard domains (subdomains)
- Supabase Pro plan ($25/month)
- Expo free tier (mobile builds)

---

## ❓ Open Questions

1. **App Name:** "ArchMin Courses" or something else?
2. **Ready-to-go programs:** What programs should we template first?
   - ACCF (Foundations, Scripture, Sacraments, Moral Teaching)
   - CLI (Leadership)
   - Youth Ministry?
   - Bible Study?
3. **Approval process:** Auto-approve orgs or manual review?
4. **Content licensing:** Can orgs export their content? Own their data?
5. **Mobile app branding:** One app for all orgs, or org-specific apps?
6. **Hub coordinator mobile access:** Include in mobile app or web-only?

---

## 📝 Next Steps

1. **Review this roadmap** - Does it align with your vision?
2. **Prioritize phases** - Which phase to start with?
3. **Finalize naming** - Lock in platform name for branding
4. **Set timeline goals** - What's the target launch date?
5. **Begin Phase 1** - Start multi-program migration from COURSES.md

---

*This is a living document. Update as vision evolves and implementation progresses.*

**Last Updated:** 2025-10-08
**Next Review:** After Phase 1 completion

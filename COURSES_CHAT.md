# Courses Chat System

Last Updated: 2026-03-05

---

## Overview

Cohort-level real-time messaging for coordinators and admins. Coordinators access chat via a slide-out sidebar while browsing course pages. Admins access it as a full page with cohort selector. Messages are scoped per cohort.

---

## Database Tables

### `courses_chat_messages`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, auto-generated |
| `cohort_id` | uuid | Scopes messages to a cohort |
| `sender_id` | uuid | References `auth.users` |
| `sender_name` | text | Denormalized display name |
| `sender_role` | text | `'admin'` or `'coordinator'` |
| `hub_name` | text | Nullable, coordinator's hub |
| `content` | text | Max 2000 chars |
| `created_at` | timestamptz | Default `now()` |
| `deleted_at` | timestamptz | Nullable, soft delete |

### `courses_chat_read_status`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `cohort_id` | uuid | |
| `user_id` | uuid | References `auth.users` |
| `last_read_at` | timestamptz | Upsert on `(cohort_id, user_id)` |

Used for unread dot indicator — binary "new messages since last read", not per-message tracking.

---

## API Endpoints

Base: `/api/courses/[slug]/chat`

### GET — Fetch messages
```
?cohort_id=<uuid>&limit=50&before=<ISO timestamp>
→ { success, data: Message[], hasMore }
```
Cursor-based pagination. Returns oldest-first. Excludes soft-deleted.

### POST — Send message
```
{ content, cohort_id }
→ { success, data: Message }
```
Blocked with 403 if `chatEnabled === false` in course settings.

### PATCH — Edit message
```
{ message_id, cohort_id, content }
→ { success, data: Message }
```
Own messages only.

### DELETE — Delete message or clear all
```
{ cohort_id, message_id }           → delete single (own or admin)
{ cohort_id, clear_all: true }      → soft-delete all (admin only)
```

### POST `/chat/read-status` — Mark as read
```
{ cohort_id }
→ { success }
```

---

## Auth & Access

Two-layer access via `verifyChatAccess()`:

1. **Platform admins** (`platform.admin` or `courses.admin` module) → full access to any cohort
2. **Enrolled coordinators/admins** → access to their own cohort only

**Delete permissions:**
- Own messages: any chat participant
- Others' messages / clear all: admins only

---

## ChatRoom Component

**File:** `$lib/components/ChatRoom.svelte`

### Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `messages` | `Message[]` | `[]` | Initial messages |
| `cohortId` | `string` | required | |
| `userMeta` | `{ userId, userName, userRole, hubName }` | required | |
| `courseSlug` | `string` | required | For API calls |
| `supabase` | `SupabaseClient` | required | For Realtime |
| `onClose` | `() => void` | `null` | Shows X button in header when set |
| `chatEnabled` | `boolean` | `true` | Hides input when `false` |

### Features

- **Optimistic sends** — message appears instantly, replaced by Realtime event
- **Infinite scroll** — loads older messages when scrolling to top
- **Auto-growing textarea** — expands up to 120px, resets on send
- **Message actions** — edit/delete via hover menu beside the bubble
- **Date/time separators** — "Today", "Yesterday", 5+ minute gaps
- **Online presence** — tracks active users via Supabase Presence
- **Admin clear** — confirmation modal, soft-deletes all messages
- **Chat paused** — shows "Chat is currently paused" when disabled

---

## Coordinator Sidebar

**Files:** `courses/[slug]/+layout.svelte`, `CourseNavigation.svelte`

- Chat icon button in top-right nav (desktop + mobile)
- Unread dot when new messages arrive while sidebar is closed
- **Only visible to coordinators** (not students, not admins)
- Sidebar pushes main content left on desktop (400px width)
- Full-screen drawer on mobile
- **Lazy-loads** messages on first open via API GET
- Re-fetches when opening with unread messages
- Persists across page navigation (lives in layout)

### Layout Server Data

`+layout.server.ts` provides: `cohortId`, `userId`, `userName`, `userRole`, `hubName`, `hasUnreadChat`, `chatEnabled`

---

## Admin Chat Page

**Files:** `admin/courses/[slug]/chat/+page.svelte`, `+page.server.ts`

- Full page with ChatRoom component (max 900px)
- Cohort selected via `?cohort=<uuid>` URL param (admin sidebar provides selector)
- **Chat toggle** — slider to enable/disable chat for the course
- Toggle saves to `settings.features.chatEnabled` via settings API
- Empty state shown when no cohort selected

---

## Feature Toggle: `chatEnabled`

**Type:** `CourseSettings.features.chatEnabled` (default `true`)

**Defined in:** `$lib/types/course-settings.ts`

**When disabled:**
- ChatRoom hides input, shows "Chat is currently paused"
- API POST returns 403
- Existing messages remain visible
- Admin can still clear messages

---

## Realtime Subscriptions

### Unread tracking (layout level)
```
Channel: chat-unread:{cohortId}
Event: INSERT on courses_chat_messages
→ Sets hasUnreadChat = true if sidebar closed and sender is someone else
```

### Live messages (ChatRoom component)
```
Channel: chat:{cohortId}
Events: INSERT, UPDATE (edit/soft-delete) on courses_chat_messages
Presence: tracks online users (user_id, user_name, user_role, hub_name)
```

---

## Key Files

| File | Purpose |
|------|---------|
| `$lib/components/ChatRoom.svelte` | Shared chat UI component |
| `api/courses/[slug]/chat/+server.ts` | Chat CRUD API |
| `api/courses/[slug]/chat/read-status/+server.ts` | Read status API |
| `courses/[slug]/+layout.svelte` | Coordinator sidebar + unread tracking |
| `courses/[slug]/+layout.server.ts` | Loads cohortId, hubName, chatEnabled, hasUnreadChat |
| `courses/[slug]/chat/+page.svelte` | Coordinator full-page fallback |
| `courses/[slug]/chat/+page.server.ts` | Coordinator chat page load |
| `courses/[slug]/CourseNavigation.svelte` | Chat icon button in nav |
| `admin/courses/[slug]/chat/+page.svelte` | Admin chat page + toggle |
| `admin/courses/[slug]/chat/+page.server.ts` | Admin chat page load |
| `$lib/types/course-settings.ts` | chatEnabled type + defaults |

# Chat Feature - Future Plans

**Created:** March 4, 2026
**Current State:** MVP — one cohort-wide chat, admins + hub coordinators only

---

## Planned Enhancements

### 1. Hub-Level Chats

Add per-hub chat channels alongside the existing coordinator chat.

**Architecture:**
- Add optional `hub_id` column to `courses_chat_messages`
- `hub_id = NULL` → cohort-level coordinator chat (current behavior)
- `hub_id = X` → hub-specific chat

**Layered model:**
```
Coordinators Chat    ← admins + all HCs (logistics, cross-hub)
Hub: St Mary's       ← HC Jane + her participants
Hub: Sacred Heart    ← HC Bob + his participants
Hub: Holy Family     ← HC Maria + her participants
```

- Participants only see their own hub's chat (not the coordinator chat)
- HCs see both their hub chat and the coordinator chat
- Admins can view all channels

### 2. Chat Access Settings

Configurable per course/cohort:

| Setting | Who sees what |
|---------|--------------|
| `coordinators_only` | Cohort-wide chat for admins + HCs only (current MVP) |
| `hub_members` | Coordinator chat + hub-level chats for participants |
| `disabled` | No chat |

Ties into the management model work:
- **Admin-Led:** `coordinators_only` by default
- **Hub-Led:** `hub_members` by default
- **Self-Directed:** `disabled` by default (no hubs, no chat)

### 3. Admin Hub Chat Viewer

When hub chats are enabled, the admin chat page gets a channel selector:
- Dropdown or tab bar: Coordinators Chat / St Mary's / Sacred Heart / etc.
- Admin can read and participate in any hub's chat
- Unread indicators per channel

### 4. Privacy & Encryption (Stretch)

For sensitive hub conversations (e.g., RCIA groups, pastoral care):
- HC-only hub chat that admins cannot view
- Potential E2E encryption for private channels
- Significant technical lift — requires key management, prevents server-side search
- Consider whether database-level RLS access control is sufficient vs true encryption

### 5. Additional Features

- **Message reactions** — lightweight emoji reactions instead of reply-to
- **Pinned messages** — admin/HC can pin important messages to top
- **File/image sharing** — attach photos or documents to messages
- **Message search** — search across chat history
- **Notifications** — push/email notifications for @mentions or new messages when offline
- **Typing indicators** — use Supabase Broadcast (ephemeral, already supported by the channel)
- **Message editing/deletion** — soft delete with `deleted_at` column (table already supports adding this)

---

*This is a planning document. Implementation details may change.*

# Arch Tools - Development Guide

This is a comprehensive guide to the Arch Tools codebase architecture, development workflow, and key patterns.

## Table of Contents
1. [Build, Test & Development Commands](#build-test--development-commands)
2. [Architecture & Technology Stack](#architecture--technology-stack)
3. [Project Structure](#project-structure)
4. [Key Development Patterns](#key-development-patterns)
5. [Important Systems](#important-systems)
6. [Design System & Styling](#design-system--styling)

---

### Environment Setup
- Copy `.env.example` to `.env` and fill in:
  - `PUBLIC_SUPABASE_URL` - Supabase project URL
  - `PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
  - `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role (for admin operations)
  - `RESEND_API_KEY` - Email service API key
  - `PUBLIC_SITE_URL` - Site URL (defaults to localhost:5173)


## Architecture & Technology Stack

### Core Framework
- **SvelteKit** (v2.37.1) - Full-stack web framework with server-side rendering
- **Svelte 5** (v5.38.7) - Reactive UI components with new runes-based reactivity
- **Vite** (v7.1.4) - Lightning-fast build tool

### Database & Backend
- **Supabase** - PostgreSQL database + authentication
  - Server-side client (`@supabase/ssr` v0.7.0) for SSR handling
  - Client-side client (`@supabase/supabase-js` v2.56.0) for browser
  - Admin client via service role key in hooks and server routes
- **Authentication** - Supabase Auth with Supabase SSR adapter
  - Two authentication helper libraries for different contexts
  - Session management via SvelteKit hooks

### Styling & UI
- **Tailwind CSS v4** with custom theme configuration
- **PostCSS v8** for CSS processing
- **Lucide SVelte** (v0.542.0) - Icon library
- **Design System** with reusable components (Button, Card, etc.)
- **Custom theme system** per course with color customization

### Key Dependencies
- **CodeMirror v6** - Code/HTML editor with language support
- **Email**: Resend (v6.1.1) for sending emails
- **Data Processing**: 
  - `fast-xml-parser` (v5.2.5) for XML parsing
  - `csv-parse` (v6.1.0) for CSV handling
  - `js-beautify` (v1.15.4) for code formatting
  - `dompurify` (v3.2.6) for HTML sanitization
  - `jsdom` (v26.1.0) for DOM operations
- **Utilities**: `dotenv`, `tailwind-merge`

---

## Project Structure

### Root Directory Organization
```
arch-tools/
├── src/                          # Source code
├── supabase/                     # Supabase migrations and functions
├── scripts/                      # Utility scripts (26 files)
├── data/                         # Static data files
├── static/                       # Public assets
├── node_modules/                 # Dependencies
├── .supabase/                    # Supabase local CLI config
│
├── svelte.config.js              # SvelteKit configuration
├── vite.config.ts                # Vite build configuration
├── tsconfig.json                 # TypeScript configuration
├── postcss.config.js             # PostCSS configuration
├── .prettierrc                   # Code formatting rules
│
├── .env                          # Environment variables (not committed)
├── .env.example                  # Environment template
├── package.json                  # Dependencies & scripts
├── package-lock.json             # Locked versions
│
└── Documentation files           # Various .md files for features
    ├── README.md
    ├── API_QUICKSTART.md
    ├── API_README.md
    ├── AUTH_SYSTEM.md
    ├── COURSES.md
    ├── EMAIL_SYSTEM.md
    ├── AGENTS.MD                 # Supabase MCP workflow
    └── [15+ other documentation files]
```

### Source Code Structure (`src/`)

#### Routes (`src/routes/`)
SvelteKit file-based routing system. Key route groups:

**Public Routes:**
- `/` - Home page
- `/auth` - Authentication pages
- `/readings` - Public liturgical readings API endpoint
- `/data-policy` - Privacy policy

**Internal Admin Routes (grouped as `(internal)`):**
- `/(internal)/admin/users` - User management
- `/(internal)/profile` - User profile
- `/(internal)/dgr/` - Daily Gospel Readings management
  - `/dgr/templates` - Template management
  - `/dgr/publish` - Publishing workflows
- `/(internal)/editor/` - Content editor (books, blocks, chapters)
- `/(internal)/test-emails` - Email testing

**Course Routes (`/courses/[slug]/`):**
- `/courses/` - Course listing and enrollment
- `/courses/[slug]/dashboard` - Student dashboard
- `/courses/[slug]/materials` - Course materials
- `/courses/[slug]/reflections` - Student reflections
- `/courses/[slug]/profile` - Course-specific profile
- `/courses/[slug]/admin/` - Course admin panel
  - `/admin/courses` - Course CRUD
  - `/admin/modules` - Module management
  - `/admin/attendance` - Attendance tracking
  - `/admin/reflections` - Reflection management

**API Routes (`/api/`):**
- `/api/v1/today` - Today's liturgical readings
- `/api/v1/readings` - Readings by date
- `/api/courses/` - Course-related endpoints (5 endpoints)

#### Libraries (`src/lib/`)
```
lib/
├── components/              # 57 Svelte components
│   ├── Modal.svelte
│   ├── TemplateEditor.svelte
│   ├── EditorHeader.svelte
│   ├── DGRForm.svelte
│   ├── ToastContainer.svelte
│   └── [52 more...]
│
├── design-system/           # Reusable UI components & tokens
│   ├── Button.svelte       # Flexible button component
│   ├── Card.svelte         # Container component
│   ├── tokens.js           # Color, spacing, shadow definitions
│   ├── index.js            # Exports
│   └── README.md
│
├── stores/                  # Svelte stores (reactive state)
│   ├── ui.svelte.js       # UI state (sidebar, view mode)
│   ├── toast.svelte.js    # Toast notification system
│   ├── state.svelte.js    # Global application state
│   ├── content.svelte.js  # Content/editor state
│   ├── ui.js              # Legacy UI store
│   └── content.js         # Legacy content store
│
├── server/                  # Server-only utilities
│   ├── supabase.js        # Supabase admin client & helper functions
│   ├── auth.ts            # Server auth helpers (for API routes)
│   ├── content-utils.js   # Content processing utilities
│   └── resend.js          # Email service integration
│
├── utils/                   # Shared client/server utilities
│   ├── api-handler.js     # API request wrapper with toast integration
│   ├── toast-helpers.js   # Toast notification helpers
│   ├── form-validator.js  # Form validation system
│   ├── auth-helpers.ts    # Auth helpers for (internal) routes
│   ├── html.js            # HTML processing utilities
│   ├── html-formatter.js  # HTML formatting
│   ├── wordpress-safe-html.js  # WordPress HTML safety
│   ├── email-service.js   # Email utility functions
│   ├── scripture.js       # Scripture reference utilities
│   ├── storage.js         # LocalStorage utilities
│   ├── template-actions.js # Template manipulation
│   └── [more utilities...]
│
├── styles/                  # Global CSS
│   ├── tooltip.css
│   └── [other styles]
│
├── data/                    # Static data
│   ├── bible-books.json
│   ├── help-content.js
│   └── [data files]
│
├── assets/                  # Static assets
│   └── favicon.svg
│
├── email-templates/         # Email template files
│
├── database.types.ts        # Auto-generated Supabase types
└── index.ts                 # Library exports
```

#### Hooks and Config (`src/`)
```
src/
├── hooks.server.ts          # SvelteKit server hooks
│                             # - Initializes Supabase client
│                             # - Sets up auth session handling
│                             # - Filters response headers
│
├── routes/
│   ├── +layout.server.ts   # Root layout server logic
│   │                        # - Loads user session & profile
│   │                        # - Handles authorization checks
│   │                        # - Builds course theme & branding
│   │                        # - Manages redirects
│   │
│   ├── +layout.svelte      # Root layout component
│   │                        # - Imports global CSS
│   │                        # - Sets up auth state subscription
│   │                        # - Renders ToastContainer
│   │
│   └── +layout.ts          # Type definitions
│
└── app.html                 # HTML template
```

---

## Key Development Patterns

### 1. Authentication & Authorization

**Unified authentication system** in `$lib/server/auth.ts`:

The auth system supports two response modes:
- **throw_error** (default): Returns HTTP 401/403 (for API routes)
- **redirect**: Returns 303 redirect (for page routes)

#### Platform-Level Auth
```typescript
import { requireModule, requireModuleLevel, requireAnyModule } from '$lib/server/auth';

// Require specific module access (matches any level)
export const load: PageServerLoad = async (event) => {
  const { user, profile } = await requireModule(event, 'users');
  // For page routes with redirect:
  const { user, profile } = await requireModule(event, 'users', { mode: 'redirect', redirectTo: '/my-courses' });
};

// Require exact module.level
const { user, profile } = await requireModuleLevel(event, 'courses.admin');
const { user, profile } = await requireModuleLevel(event, 'courses.participant', { mode: 'redirect' });

// Require any of multiple modules
const { user, profile } = await requireAnyModule(event, ['courses.manager', 'courses.admin']);
```

#### Course-Level Auth
```typescript
import { requireCourseAdmin, requireCourseAccess, requireCourseRole } from '$lib/server/auth';

// Require course admin access
// Allows: courses.admin module OR (courses.manager module + enrolled as admin)
const { user, profile, enrollment, viaModule } = await requireCourseAdmin(event, courseSlug);

// Require any enrollment in course
const { user, enrollment } = await requireCourseAccess(event, courseSlug);

// Require specific course role
const { user, enrollment } = await requireCourseRole(event, courseSlug, ['admin', 'coordinator']);
```

**Platform Modules** (in `user_profiles.modules`):
- `users` - User management, invitations, permissions
- `editor` - Content editor access
- `dgr` - Daily Gospel Reflections management
- `courses.participant` - Access enrolled courses via `/my-courses`
- `courses.manager` - Manage courses where enrolled as admin
- `courses.admin` - Manage all courses platform-wide

**Course Roles** (in `courses_enrollments.role` per enrollment):
- `admin` - Can manage this specific course
- `student` - Enrolled student in this course
- `coordinator` - Hub coordinator for this course

### 2. API Requests & Toast Integration

All API requests use `apiRequest()` for automatic toast notifications:

```typescript
import { apiPost, apiGet, apiDelete } from '$lib/utils/api-handler.js';
import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';

// Basic usage
const data = await apiGet('/api/endpoint', {
  showToast: true,
  loadingMessage: 'Loading...',
  successMessage: 'Done!'
});

// Form submission
const result = await apiPost('/api/endpoint', { name: 'value' }, {
  successMessage: 'Saved successfully'
});

// With error handling
try {
  await apiDelete('/api/endpoint/123');
} catch (error) {
  // Error already displayed in toast
}

// Multi-step operations
const handler = createMultiStepHandler([
  { message: 'Step 1', title: 'Processing' },
  { message: 'Step 2', title: 'Validating' },
  { message: 'Step 3', title: 'Saving' }
]);

handler.start();
await handler.executeStep(async () => { /* ... */ });
await handler.executeStep(async () => { /* ... */ });
handler.complete();
```

### 3. Form Validation

Composable validator system:

```typescript
import { validate, validators } from '$lib/utils/form-validator.js';

const result = validate(formData, {
  email: [validators.required, validators.email],
  password: [validators.required, validators.minLength(6)],
  name: [validators.required, validators.maxLength(50)]
});

if (!result.isValid) {
  console.log(result.errors); // { email: 'Invalid email format' }
}
```

**Built-in validators:**
- `required` - Non-empty value
- `minLength(n)` - String length >= n
- `maxLength(n)` - String length <= n
- `email` - Valid email format
- `password` - Min 6 characters
- `matches(compareValue, fieldName)` - Value equality
- Custom functions can be created

### 4. Reactive State (Svelte 5 Runes)

Modern Svelte 5 uses runes for reactivity. **Key changes from Svelte 4:**

| Svelte 4 Syntax           | Svelte 5 Syntax                    |
| ------------------------- | ---------------------------------- |
| `let count = 0;`          | `let count = $state(0);`           |
| `$: doubled = count * 2;` | `let doubled = $derived(count * 2);` |
| `$: { ... }` (effects)    | `$effect(() => { ... });`          |
| `export let foo;`         | `let { foo, ...rest } = $props();` |
| `on:click={...}`          | `onclick={...}`                    |
| `createEventDispatcher()` | Use props for callbacks instead    |

**Common patterns:**

```typescript
// In stores
export let count = $state(0);
export let isOpen = $state(false);
export let expandedItems = $state(new Set());

// In components
let isOpen = $state(false);
let count = $state(0);

// Derived state
let doubled = $derived(count * 2);

// Side effects (replaces $: reactive statements)
$effect(() => {
  console.log(`Count changed to ${count}`);
});

// Cleanup on unmount
$effect(() => {
  const interval = setInterval(() => {}, 1000);
  return () => clearInterval(interval);
});

// Advanced runes
$state.frozen(obj);  // Immutable state
$inspect(value);     // Dev-only logging
$effect.pre(() => {  // Run before DOM updates
  // ...
});
```

### 5. Supabase Client Usage

**Server-side (always use admin client):**
```typescript
import { supabaseAdmin } from '$lib/server/supabase.js';

const { data, error } = await supabaseAdmin
  .from('table_name')
  .select('id, name, email')
  .eq('user_id', userId)
  .limit(10);
```

**Client-side (in components):**
```typescript
// Access via event.locals in +layout.server.ts
export async function load({ locals: { supabase, safeGetSession } }) {
  const { session, user } = await safeGetSession();
  
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();
}
```

### 6. Component Structure

Components follow Svelte 5 runes syntax:

```svelte
<script>
  import { Button, Card } from '$lib/design-system';

  // Props using $props() instead of export let
  let { isOpen = false, onClose, data } = $props();

  // Local reactive state
  let localState = $state(false);

  // Event handlers are passed as props (no createEventDispatcher)
  function handleClick() {
    localState = true;
    onClose?.();  // Call parent callback
  }
</script>

<Modal {isOpen} title="Title" on:close={onClose}>
  <div class="space-y-4">
    <p>{data?.name}</p>
    <!-- Event binding uses onclick= instead of on:click= -->
    <Button onclick={handleClick}>Submit</Button>
  </div>
</Modal>
```

**Snippets** for reusable markup within components:

```svelte
{#snippet listItem(item)}
  <li class="item">{item.name}</li>
{/snippet}

<ul>
  {#each items as item}
    {@render listItem(item)}
  {/each}
</ul>
```

---

## Important Systems

### 1. Toast Notification System

Located in `$lib/stores/toast.svelte.js` with helpers in `$lib/utils/toast-helpers.js`:

```typescript
import { 
  toastSuccess, 
  toastError, 
  toastWarning, 
  toastLoading,
  updateToastStatus,
  toastMultiStep
} from '$lib/utils/toast-helpers.js';

// Simple notifications
toastSuccess('Saved!', 'Success', 3000);
toastError('Failed to save', 'Error', 5000);
toastWarning('Warning message', 'Warning');

// Loading toast (returns ID for updates)
const id = toastLoading('Processing...', 'Loading');
// ... do work ...
updateToastStatus(id, 'success', 'Completed!', 'Done', 3000);

// Multi-step process
const id = toastMultiStep([
  { message: 'Step 1', title: 'Processing' },
  { message: 'Step 2', title: 'Validating' }
], false);
toastNextStep(id);  // Advance to next step
```

**Duration constants:**
- `DURATIONS.short` = 3000ms
- `DURATIONS.medium` = 5000ms (errors)
- `DURATIONS.long` = 8000ms



### 3. Design System

Located in `src/lib/design-system/`:

**Button Component:**
```svelte
<Button 
  variant="primary|secondary|success|danger|warning|ghost|outline"
  size="xs|sm|md|lg|xl"
  disabled={false}
  loading={false}
  icon={EditIcon}
  iconPosition="left|right"
  on:click={handler}
>
  Button Text
</Button>
```

**Card Component:**
```svelte
<Card 
  padding="none|sm|md|lg|xl"
  shadow="none|sm|md|lg|xl"
  rounded="none|sm|md|lg|xl"
  border={false}
>
  Content
</Card>
```

**Design Tokens:**
- Colors: Primary, success, danger, warning, gray palettes
- Spacing: xs (8px) to 3xl (64px)
- Shadows: sm, md, lg, xl
- Tag colors: Predefined colors for content block types
- Border radius: sm (6px) to xl (16px)

### 4. Content & Editor Utilities

- `$lib/lib/xmlParser.js` - XML document parsing
- `$lib/lib/betterExtraction.js` - Content extraction
- `$lib/utils/dgr-utils.js` - Daily Gospel Reading utilities
- `$lib/utils/dgr-template-renderer.js` - Template rendering
- `$lib/utils/html.js` - HTML utilities
- `$lib/utils/html-formatter.js` - Code formatting
- `$lib/utils/wordpress-safe-html.js` - WordPress HTML sanitization

### 5. Email System

Resend integration at `$lib/server/resend.js` and `$lib/utils/email-service.js`:

```typescript
import { sendEmail } from '$lib/utils/email-service.js';

await sendEmail({
  to: 'user@example.com',
  subject: 'Welcome',
  html: '<h1>Welcome</h1>',
  template: 'invitation'  // Optional
});
```

Email templates stored in `src/lib/email-templates/`.

### 6. Scripture System

Utilities for Bible references in `$lib/utils/scripture.js`:

```typescript
import { parseScripture, formatScripture } from '$lib/utils/scripture.js';

const ref = parseScripture('Matthew 5:1-12');  // Parse reference
const display = formatScripture(ref);           // Format for display
```

Bible books data available in `$lib/data/bible-books.json`.

---

## Design System & Styling

### Tailwind CSS v4 Configuration

Custom theme in `src/app.css`:

```css
@theme {
  /* Course Brand Colors (defaults) */
  --color-accf-darkest: #1e2322;
  --color-accf-dark: #334642;
  --color-accf-accent: #c59a6b;
  --color-accf-light: #eae2d9;
  --color-accf-lightest: #ffffff;
  
  /* Standard colors, spacing, fonts... */
}
```

### Color System for Content Blocks

Tag-based colors in `$lib/design-system/tokens.js`:

```javascript
tagColors = {
  // Headers
  h1: 'bg-red-100 text-red-700 border-red-200',
  h2: 'bg-orange-100 text-orange-700 border-orange-200',
  h3: 'bg-amber-100 text-amber-700 border-amber-200',
  
  // Content
  paragraph: 'bg-gray-100 text-gray-700 border-gray-200',
  quote: 'bg-blue-100 text-blue-700 border-blue-200',
  scripture: 'bg-teal-100 text-teal-700 border-teal-200',
  prayer: 'bg-green-100 text-green-700 border-green-200',
  
  // Meta
  author: 'bg-pink-100 text-pink-700 border-pink-200',
  date: 'bg-slate-100 text-slate-700 border-slate-200',
}
```

### Prettier Code Formatting

Configuration in `.prettierrc`:

```json
{
  "useTabs": true,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 100,
  "plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
  "tailwindStylesheet": "./src/app.css"
}
```

---

## Database Schema Overview

Key tables (managed via Supabase):

- `user_profiles` - User account information
- `courses` - Course definitions with settings & branding
- `courses_modules` - Course modules
- `courses_cohorts` - Student cohorts/groups
- `courses_enrollments` - Student enrollments
- `courses_materials` - Course materials/content
- `courses_reflections` - Student reflection submissions
- `editor_books` - Content book versions
- `editor_blocks` - Content blocks with versioning
- `editor_chapters` - Content chapters
- `editor_logs` - Activity audit logs
- `api_readings` - Public API readings data (liturgical calendar)

See `src/lib/database.types.ts` for auto-generated TypeScript types.

---

## Important Documentation Files

- **AGENTS.MD** - Supabase MCP workflow for schema changes
- **API_QUICKSTART.md** - Quick start for public readings API
- **AUTH_SYSTEM.md** - Authentication & authorization detailed guide
- **COURSES.md** - Course system architecture
- **EMAIL_SYSTEM.md** - Email system setup and templates
- **LECTIONARY.md** - Liturgical calendar system

These files in the root directory contain important architectural decisions and domain knowledge.

---

## Common Development Tasks

### Adding a New Route
1. Create directory in `src/routes/` following SvelteKit conventions
2. Add `+page.svelte` for UI
3. Add `+page.server.ts` for server logic
4. If needed: `+layout.server.ts` for parent data, `+server.ts` for API endpoints

### Adding a New Component
1. Create `.svelte` file in `src/lib/components/`
2. Use Svelte 5 runes syntax (`let x = $state(...)`)
3. Export props using `$props()`
4. Consider adding to design system if reusable

### Database Changes
1. Follow AGENTS.MD workflow
2. Use Supabase CLI for migrations: `supabase migration new migration_name`
3. Apply via MCP: `mcp__supabase__apply_migration({ name, query })`
4. Check advisors: `mcp__supabase__get_advisors({ type: "security" })`

### Styling Components
1. Use Tailwind CSS classes
2. Reference design tokens from `$lib/design-system/tokens.js`
3. Run Prettier: code will auto-sort Tailwind classes
4. Use CSS custom properties for course-specific colors

---
### Common Patterns

**Form submission with validation:**
```svelte
<script>
  import { validate, validators } from '$lib/utils/form-validator.js';
  import { apiPost } from '$lib/utils/api-handler.js';
  
  let formData = $state({});
  let errors = $state({});
  
  async function handleSubmit() {
    const result = validate(formData, {
      email: [validators.required, validators.email],
      password: [validators.required, validators.minLength(6)]
    });
    
    if (!result.isValid) {
      errors = result.errors;
      return;
    }
    
    await apiPost('/api/submit', formData);
  }
</script>
```

**Conditional rendering with permissions:**
```svelte
<script>
  export let userProfile;
  import { hasAnyModule } from '$lib/server/auth';
</script>

{#if hasAnyModule(userProfile.modules, ['editor', 'admin'])}
  <button>Edit Content</button>
{/if}
```

---

## Notes for Future Development

1. **Testing** - No test framework configured yet. Consider adding Jest or Vitest
2. **API Documentation** - Public API docs available at `/api/v1`
3. **Supabase RLS** - Row-level security policies handle authorization
4. **Performance** - Consider caching for frequently accessed data (courses, settings)
5. **Error Handling** - Always use toast system for user-facing errors
6. **Accessibility** - Components include ARIA labels; maintain standards
7. **TypeScript** - Strict mode enabled; leverage generated Supabase types

---

Generated for Claude Code | Last Updated: October 2025

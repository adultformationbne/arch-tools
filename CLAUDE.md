# arch-tools - Archdiocesan Ministry Tools Platform

## Project Overview
**arch-tools** is a comprehensive content management platform designed for Catholic archdiocesan ministries. It provides advanced content editing, scripture reading, Daily Gospel Reflection (DGR) management, and multi-format publishing capabilities.

## Quick Start
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

Development server runs at: http://localhost:5173/

## Tech Stack
- **Frontend**: SvelteKit + Svelte 5 (latest with runes syntax)
- **Styling**: Tailwind CSS v4 with @tailwindcss/vite
- **Database**: Supabase (PostgreSQL with Row Level Security)
- **Build Tool**: Vite
- **Language**: TypeScript
- **Icons**: lucide-svelte
- **Auth**: Supabase Auth with SSR support

## Core Modules

### 1. Content Editor (/editor)
Advanced block-based content management system with:
- **Immutable versioning** - Never overwrites, always creates new versions
- **Block types**: paragraphs, headings (h1-h3), lists, chapters, callouts, quotes, prayers
- **Real-time collaboration** with optimistic updates
- **Metadata system** for content organization
- **Export capabilities** for InDesign and web

### 2. Scripture Reader (/scripture)
- Daily Gospel readings from Brisbane Catholic liturgical calendar
- Bible verse lookup
- Universalis API integration
- Mobile-responsive design

### 3. DGR System (/dgr, /dgr-admin)
Complete Daily Gospel Reflection management:
- Contributor scheduling with preferences
- Automated assignment system
- Email notifications with queue management
- Token-based secure submissions
- WordPress publishing integration
- Visual calendar admin dashboard

## Database Schema

### Core Tables
- `blocks` - Immutable content blocks with versioning
- `books` - Document versions with block ordering
- `chapters` - Chapter organization
- `editor_logs` - Complete audit trail
- `dgr_contributors` - Contributor profiles
- `dgr_schedule` - Daily assignments
- `dgr_email_queue` - Email management



## Supabase CLI Setup
- **CLI Version**: 2.40.7 (installed via Homebrew)
- **Project Reference**: snuifqzfezxqnkzizija
- **Local Development**: Runs on ports 54321-54327
- **Connection Status**: ✅ Fully operational

### CLI Commands
```bash
# Generate TypeScript types
supabase gen types typescript --project-id snuifqzfezxqnkzizija

# Check local status
supabase status


## Development Commands

### Common Tasks
```bash
# Run development server
npm run dev

# Check for TypeScript errors
npm run check

# Format code
npm run format

# Run linter
npm run lint

# Build for production
npm run build
```

### Git Workflow
```bash
# Check status
git status

# Stage changes
git add .

# Commit with message
git commit -m "Your message"

# Push to main
git push origin main
```

## Key Features

### Immutable Content Architecture
- Every edit creates a new version
- Complete history preserved
- Block-level granularity
- Unique, stable IDs for all content

### Publishing Pipeline
- Single source for multiple outputs
- Direct InDesign integration via XML
- Web publishing with responsive design
- PDF generation capabilities

### Security
- Supabase Row Level Security (RLS)
- Token-based public access
- Session management with SSR
- Comprehensive audit logging

### Centralized Toast & API System
- **Toast Helpers** (`/src/lib/utils/toast-helpers.js`) - Simplified toast management
- **API Handlers** (`/src/lib/utils/api-handler.js`) - Standardized API calls with automatic toast feedback
- **Form Handlers** - Validation and submission utilities with integrated toasts
- **Multi-step Workflows** - Progress tracking for complex operations
- **Error Handling** - Centralized error parsing and user feedback
- **80% Code Reduction** - Eliminates duplicate toast patterns across 7+ pages


## Utility Scripts
Key scripts in `/scripts`:
- Database migration tools
- Content analysis utilities
- XML processing scripts
- Chapter organization tools
- PDF extraction utilities

## Documentation
- `svelte5-cheatsheet.md` - Framework reference

## Design System
- Custom Tailwind configuration
- Consistent color palette
- Responsive breakpoints
- Typography scale
- Component patterns

## Testing & Quality
```bash
# Type checking
npm run check

# Linting
npm run lint

# Format code
npm run format
```

## Production Deployment
1. Build the application: `npm run build`
2. Preview locally: `npm run preview`
3. Deploy to hosting platform (Vercel, Netlify, etc.)
4. Set environment variables on hosting platform

## Important Notes

### Svelte 5 Syntax
This project uses the latest Svelte 5 with runes:
- Use `$state()` instead of `let` for reactive state
- Use `$derived()` for computed values
- Use `$effect()` instead of `$:` for reactive statements

### Database Versioning
- All content is immutable (append-only)
- Never update existing blocks, create new versions
- Maintain referential integrity with unique IDs

### Authentication Flow
- Supabase handles all auth
- Sessions managed server-side
- Public routes use token authentication

### Toast & API Patterns (New Utilities)
Use the centralized utilities instead of raw toast store:

```javascript
// Simple toasts
import { toastSuccess, toastError } from '$lib/utils/toast-helpers.js';
toastSuccess('Profile updated successfully');

// API calls with automatic toasts
import { apiPost, supabaseRequest } from '$lib/utils/api-handler.js';
await apiPost('/api/users', userData, {
  loadingMessage: 'Creating user...',
  successMessage: 'User created successfully'
});

// Supabase operations
await supabaseRequest(
  () => supabase.from('users').update(data).eq('id', userId),
  { successMessage: 'User updated successfully' }
);
```

See `TOAST_GUIDE.md` for complete documentation and migration guide.

### Form Validation System (New Framework)
Centralized, future-proof validation with consistent error handling:

```javascript
// Import validators and components
import { validators, commonRules, validate } from '$lib/utils/form-validator.js';
import FormField from '$lib/components/FormField.svelte';

// Simple field validation
<FormField
  label="Email Address"
  type="email"
  bind:value={email}
  validators={commonRules.email}
  placeholder="Enter your email"
/>

// Form-wide validation
const result = validate(formData, {
  email: [validators.required, validators.email],
  password: [validators.required, validators.minLength(6)]
});

// Password confirmation
<FormField
  label="Confirm Password"
  type="password"
  bind:value={confirmPassword}
  validators={passwordConfirmation(password)}
/>
```

## Troubleshooting

### Dev Server Issues
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Database Connection
- Check Supabase credentials in `.env`
- Verify Supabase project is running
- Check RLS policies if access denied

### Build Errors
- Run `npm run check` for TypeScript errors
- Check for missing dependencies
- Verify all imports are correct

## Contact & Support
For issues or questions about this codebase, reference this documentation and the detailed guides in the project.

---
*Last updated: 2025-09-08*
*Platform: Archdiocesan Ministry Tools*
*Version: Production-ready*
# Arch Tools

Platform for Archdiocesan ministries: course management (ACCF), Daily Gospel Reflections (DGR), liturgical calendar, and book editing tools.

## Stack

- **SvelteKit + Svelte 5** - Framework
- **Supabase** - Database & Auth
- **Tailwind CSS v4** - Styling
- **Resend** - Email

## Setup

```bash
cp .env.example .env   # Add Supabase + Resend keys
npm install
npm run dev
```

## Documentation

- `CLAUDE.md` - Quick reference for development patterns
- `AUTHENTICATION.md` - Auth system details
- `COURSES.md` - Course platform architecture
- `DGR.md` - Daily Gospel Reflections system
- `LITURGICAL_SYSTEM.md` - Liturgical calendar and readings
- `UNIFIED_EMAIL_SYSTEM.md` - Email template system
- `SVELTE5_BEST_PRACTICES.md` - Svelte 5 patterns
- `AGENTS.MD` - Database migration workflow

## Commands

```bash
npm run dev           # Start dev server
npm run build         # Production build
npm test              # Run tests
npm run validate-api  # Check API contracts
npm run update-types  # Regenerate DB types
```

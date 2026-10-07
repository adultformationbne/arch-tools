# Public guide designs

The public guide pages (`/p/<course>`) and their PDFs come in two tiers.

**Standard** — any course. Content is the block JSON edited in the admin
(`courses_modules.public_page_content`, `courses_sessions.public_page_content`),
rendered by `PublicPageBlockRenderer.svelte` with the default look.

**Designed** — in-house courses. The content still lives in the database, so the
admin editor, the print version and the daily PDFs keep working, but the course has
a folder here that changes how it looks:

```
public-guides/
  theme.ts            PublicPageTheme type, default theme, --pp-* property reference
  themes.ts           slug → theme + version (data only; safe to import on the server)
  index.ts            slug → design (components and block overrides)
  sections.ts         groups sessions by courses_sessions.section_name
  <course-slug>/
    theme.ts          colours, fonts, font stylesheets
    index.ts          which parts this course overrides
    *.svelte          the overriding components
```

## What a course can override

| Part | Where it shows | Props |
|------|----------------|-------|
| `theme` | everywhere, as `--pp-*` custom properties | — |
| `components.LandingHero` | top of the guide landing page | `course`, `module`, `sessions` |
| `components.Backdrop` | behind the landing and session pages (not print) | `course`, `module`, `session?` |
| `components.SessionHeader` | top of a session, on its page and in print | `course`, `module`, `session`, `print` |
| `components.SessionList` | the landing page's list of sessions | `course`, `module`, `groups` |
| `components.PrintCover` | start of the whole-guide print version / PDF | `course`, `module`, `sessions` |
| `blocks[type]` | wherever a block of that type appears | `block`, `print` |
| `sessionArtwork(n)` | a function returning the session's illustration; the hub-leader home draws it in the theme's highlight colour | session number |

Anything not overridden falls back to the standard rendering.

`blocks` works for the standard types (`quote`, `summary`, `questions`, …) and for
types of the course's own: put `{ "type": "presenter", … }` in the content JSON and
register a `presenter` component. A block type with no component, standard or
custom, renders nothing.

A `title` override should put `id={block.anchor}` on its heading: the session page's
side navigation links to those anchors.

Components read colours and fonts from the `--pp-*` properties so they follow the
theme, and should handle `print` (no interaction, nothing collapsed, avoid page
breaks inside a card).

## Adding a designed guide

1. Create `<course-slug>/theme.ts` and register it in `themes.ts`.
2. Optionally add components and an `index.ts`, and register it in `index.ts`.
3. Static assets go in `static/`, alongside the course's marketing site if it has one.
4. When a component or block override changes the print layout, bump the course's
   `version` in `themes.ts` so its PDFs are rebuilt on the next cron run.

## Artwork

Single-colour illustrations (botanical engravings and the like) are drawn with
`$lib/components/GuideArtwork.svelte`. It uses the image as a mask, so the artwork
takes its colour from the theme (`--pp-highlight` by default) and prints cleanly.

Convert a folder of EPS, PDF or PNG files for a course with:

```bash
node scripts/convert-guide-artwork.mjs <course-slug> <source-folder>
```

That writes `static/guides/<course-slug>/artwork/*.webp` and regenerates the
course's `artwork.ts` (name → file and size). The course's own components decide
where the artwork goes — see `alivingunion/` for a margin `Backdrop`, a
`SessionHeader` with a flower per session, and an `illustration` content block.

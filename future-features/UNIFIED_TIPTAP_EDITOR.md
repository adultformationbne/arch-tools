# Unified TipTap Rich Text Editor

## Current Architecture (The Problem)

We have a confusing layered architecture with duplicate toolbars:

```
┌─────────────────────────────────────────────────────────────────┐
│                     CURRENT EDITOR STACK                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  EmailBodyEditor.svelte (wrapper)                               │
│  ├── Has its OWN sidebar toolbar ← DUPLICATE UI                 │
│  ├── Email preview frame                                        │
│  ├── Variable picker dropdown                                   │
│  └── Wraps ↓                                                    │
│                                                                 │
│      TipTapEmailEditor.svelte (core)                            │
│      ├── TipTap/ProseMirror engine                              │
│      ├── Has its OWN optional toolbar (showFixedToolbar)        │
│      ├── Custom extensions (Variable, EmailButton, Divider)     │
│      └── Link/Button popovers                                   │
│                                                                 │
│  SimplifiedRichTextEditor.svelte (completely separate)          │
│  ├── Raw contenteditable (NOT TipTap)                           │
│  ├── Has Safari bugs (workarounds applied)                      │
│  └── Used for reflections & course materials                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### The Issues

| Component | Technology | Used For | Issues |
|-----------|-----------|----------|--------|
| `TipTapEmailEditor` | TipTap | Core editor engine | Has optional toolbar that's rarely used |
| `EmailBodyEditor` | Wrapper | Email editing UI | **Duplicates toolbar** from TipTapEmailEditor |
| `SimplifiedRichTextEditor` | Raw contenteditable | Reflections, Materials | Safari bugs, fragile |

**Key Problem**: `EmailBodyEditor` wraps `TipTapEmailEditor` but implements its own toolbar instead of using `TipTapEmailEditor`'s built-in toolbar. This means:
- Two sets of toolbar buttons to maintain
- Fixes need to be applied in multiple places (e.g., link button disable state)
- Inconsistent behavior possible between toolbars

## Solution

Create a single unified TipTap-based editor with:
1. **One toolbar implementation** (not duplicated in wrapper)
2. **Configurable presets** for different use cases
3. **Toolbar layout options** (horizontal, vertical sidebar)

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     TARGET EDITOR STACK                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  UnifiedRichTextEditor.svelte                                   │
│  ├── TipTap/ProseMirror engine                                  │
│  ├── Single toolbar (configurable layout)                       │
│  ├── Preset system (email, reflection, minimal)                 │
│  ├── Optional email preview wrapper                             │
│  └── All extensions (loaded based on preset)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Usage

```svelte
<!-- For reflections -->
<UnifiedRichTextEditor
  bind:content
  preset="reflection"
  placeholder="Begin writing your reflection..."
/>

<!-- For emails with sidebar toolbar -->
<UnifiedRichTextEditor
  bind:content
  preset="email"
  toolbarLayout="sidebar"
  {availableVariables}
/>

<!-- For emails with preview frame -->
<UnifiedRichTextEditor
  bind:content
  preset="email"
  toolbarLayout="sidebar"
  showPreviewFrame={true}
  brandName="Course Name"
  {accentColor}
/>
```

### Presets

| Feature | `email` | `reflection` | `minimal` |
|---------|---------|--------------|-----------|
| Bold | ✅ | ✅ | ✅ |
| Italic | ✅ | ✅ | ✅ |
| Underline | ✅ | ✅ | ❌ |
| Headings | H1, H2, H3 | H2 only | ❌ |
| Bullet list | ✅ | ✅ | ❌ |
| Numbered list | ✅ | ✅ | ❌ |
| Links | ✅ | ❌ | ❌ |
| Email buttons | ✅ | ❌ | ❌ |
| Dividers | ✅ | ❌ | ❌ |
| Variables `{{name}}` | ✅ | ❌ | ❌ |

### Toolbar Layouts

| Layout | Description | Used For |
|--------|-------------|----------|
| `horizontal` | Above editor, wraps on mobile | General use |
| `sidebar` | Vertical left side, sticky | Email editing |
| `minimal` | Floating on selection | Clean writing experience |
| `none` | No toolbar (keyboard shortcuts only) | Embedded uses |

### Feature Overrides

```svelte
<UnifiedRichTextEditor
  bind:content
  preset="reflection"
  features={{ links: true }}  <!-- Add links to reflection preset -->
/>
```

## Implementation Approach

### Phase 1: Consolidate TipTap Editors

1. Move toolbar from `EmailBodyEditor` INTO `TipTapEmailEditor`
2. Add `toolbarLayout` prop to `TipTapEmailEditor` (horizontal/sidebar/none)
3. Remove duplicate toolbar from `EmailBodyEditor`
4. `EmailBodyEditor` becomes a thin wrapper for preview frame only

### Phase 2: Add Preset System

1. Add `preset` prop to `TipTapEmailEditor`
2. Conditionally load extensions based on preset
3. Conditionally render toolbar buttons based on preset
4. Rename to `UnifiedRichTextEditor`

### Phase 3: Replace SimplifiedRichTextEditor

1. Test `UnifiedRichTextEditor` with `preset="reflection"`
2. Replace usages:
   - `/courses/[slug]/write/[questionId]/+page.svelte`
   - `MaterialEditor.svelte`
   - `AddMaterialModal.svelte`
3. Delete `SimplifiedRichTextEditor.svelte`

### TipTap Extensions by Preset

```javascript
// Base extensions (all presets)
const baseExtensions = [
  StarterKit.configure({
    heading: false,
    bulletList: false,
    orderedList: false
  }),
  Placeholder.configure({ placeholder }),
  ListExitExtension  // Exit lists on Enter when empty
];

// Preset-specific extensions
const presetExtensions = {
  email: [
    Heading.configure({ levels: [1, 2, 3] }),
    BulletList, OrderedList,
    Link, Variable, EmailButton, EmailDivider
  ],
  reflection: [
    Heading.configure({ levels: [2] }),
    BulletList, OrderedList,
    Underline
  ],
  minimal: [
    // Just bold/italic from StarterKit
  ]
};
```

## Migration Path

| Step | Task | Effort |
|------|------|--------|
| 1 | Consolidate toolbars (Phase 1) | 1 hour |
| 2 | Add preset system (Phase 2) | 1-2 hours |
| 3 | Test email editing still works | 30 min |
| 4 | Replace SimplifiedRichTextEditor usages | 30 min |
| 5 | Test reflections in Safari | 30 min |
| 6 | Delete old components | 10 min |

**Total: ~4 hours**

## Files to Modify/Delete

### Modify
- `TipTapEmailEditor.svelte` → becomes `UnifiedRichTextEditor.svelte`
- `EmailBodyEditor.svelte` → thin wrapper, toolbar removed

### Delete
- `SimplifiedRichTextEditor.svelte`
- `RichTextEditor.svelte` (already deleted - was dead code)

## Benefits

- **No Safari bugs**: TipTap handles all browser quirks
- **Single toolbar**: One place to fix/enhance toolbar behavior
- **Single source of truth**: One editor component to maintain
- **Consistent UX**: Same editing experience across the app
- **Easier to extend**: Add features once, available to all presets

## Current Workarounds

Until this refactor is done:

**SimplifiedRichTextEditor** has these Safari fixes:
- Debounced DOM normalization (300ms)
- Focus handler to place cursor inside paragraphs
- Internal update flag to prevent effect re-initialization
- CSS fixes for `-apple-system` font and `text-rendering`

**TipTapEmailEditor + EmailBodyEditor** both have:
- Link button disabled when no text selected (fixed in both places)
- List exit on empty Enter

These workarounds are functional but the duplicate toolbar is technical debt.

# Unified TipTap Rich Text Editor

## Problem

Currently we have multiple editor components with different approaches:

| Component | Technology | Used For | Issues |
|-----------|-----------|----------|--------|
| `TipTapEmailEditor` | TipTap (ProseMirror) | Email editing | None - works well |
| `SimplifiedRichTextEditor` | Raw contenteditable | Reflections, Course materials | Safari bugs, cursor issues |

The raw contenteditable approach in `SimplifiedRichTextEditor` causes Safari-specific bugs where characters appear on separate lines due to DOM manipulation interfering with browser input handling.

## Solution

Create a single unified TipTap-based editor with configurable presets.

### Usage

```svelte
<UnifiedRichTextEditor
  bind:content
  preset="reflection"
  placeholder="Begin writing your reflection..."
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
| Placeholder | ✅ | ✅ | ✅ |

### Feature Overrides

Presets can be overridden with individual feature flags:

```svelte
<UnifiedRichTextEditor
  bind:content
  preset="reflection"
  features={{ links: true }}  <!-- Add links to reflection preset -->
/>
```

## Implementation Approach

1. **Single component**: `UnifiedRichTextEditor.svelte`
2. **Modular extensions**: TipTap extensions loaded conditionally based on preset
3. **Dynamic toolbar**: Only render buttons for enabled features
4. **Shared styling**: CSS that works across all presets

### TipTap Extensions by Preset

```javascript
// Base extensions (all presets)
const baseExtensions = [
  StarterKit.configure({ heading: false, bulletList: false, orderedList: false }),
  Placeholder.configure({ placeholder })
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

1. Create `UnifiedRichTextEditor.svelte`
2. Test with reflection preset
3. Replace `SimplifiedRichTextEditor` usage:
   - `/courses/[slug]/write/[questionId]/+page.svelte`
   - `MaterialEditor.svelte`
   - `AddMaterialModal.svelte`
4. Optionally migrate `TipTapEmailEditor` to use the unified component
5. Delete `SimplifiedRichTextEditor.svelte`

## Estimated Effort

- Initial implementation: 1-2 hours
- Testing across browsers: 30 min
- Migration of existing usages: 30 min

## Benefits

- **No Safari bugs**: TipTap handles all browser quirks
- **Single source of truth**: One editor component to maintain
- **Consistent UX**: Same editing experience across the app
- **Easier to extend**: Add features once, available to all presets

## Current Workarounds

Until this is implemented, `SimplifiedRichTextEditor` has these Safari fixes applied:
- Debounced DOM normalization (300ms)
- Focus handler to place cursor inside paragraphs
- Internal update flag to prevent effect re-initialization
- CSS fixes for `-apple-system` font and `text-rendering`

These workarounds are functional but fragile. The TipTap migration is the proper long-term fix.

# AHWGP Design System

## Overview

A consistent design system built for the Archdiocesan Ministries Platform editor application using Svelte 5 and Tailwind CSS.

## Components

### Button

Flexible button component with multiple variants and sizes.

```svelte
<script>
	import { Button } from '$lib/design-system';
	import { Edit } from '$lib/icons';
</script>

<Button variant="primary" size="lg" icon={Edit} onclick={handleClick}>Edit Content</Button>
```

**Props:**

- `variant`: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost' | 'outline'
- `size`: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
- `disabled`: boolean
- `loading`: boolean
- `icon`: Lucide icon component
- `iconPosition`: 'left' | 'right'

### Card

Container component with consistent styling.

```svelte
<Card padding="lg" shadow="md" rounded="xl">
	<h2>Content Title</h2>
	<p>Content goes here...</p>
</Card>
```

**Props:**

- `padding`: 'none' | 'sm' | 'md' | 'lg' | 'xl'
- `shadow`: 'none' | 'sm' | 'md' | 'lg' | 'xl'
- `rounded`: 'none' | 'sm' | 'md' | 'lg' | 'xl'
- `border`: boolean

## Design Tokens

### Colors

- **Primary**: Blue color palette for primary actions
- **Success**: Green for positive actions
- **Danger**: Red for destructive actions
- **Warning**: Amber for cautionary actions
- **Gray**: Neutral colors for text and backgrounds

### Tag Colors

Predefined color combinations for content block tags:

- Headers: h1 (red), h2 (orange), h3 (amber)
- Content: paragraph (gray), quote (blue), scripture (teal)
- Meta: author (pink), date (slate), note (yellow)

### Spacing

Consistent spacing scale from `xs` (8px) to `3xl` (64px).

### Shadows & Border Radius

Standardized elevation and corner radius values.

## Usage Best Practices

1. **Consistency**: Always use design tokens instead of custom values
2. **Accessibility**: Buttons include focus states and proper contrast
3. **Responsive**: Components work across all device sizes
4. **Performance**: Components use Svelte 5 runes for optimal reactivity

## Component Architecture

### Editor Components

- `EditorHeader`: Document title and navigation
- `EditorFilters`: Search, filters, and view controls
- `EditorListView`: Block list with enhanced actions
- `EditorEmptyState`: No content state
- `BlockActionsBar`: Labeled action buttons (compact & full size)

### Benefits of Refactoring

- **Modularity**: 70% reduction in main component size
- **Reusability**: Components can be used across routes
- **Maintainability**: Clear separation of concerns
- **Design Consistency**: Centralized styling system
- **Developer Experience**: Better code organization

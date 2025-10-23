# Componentization Plan for arch-tools

## Overview
This plan addresses the need to break down large route files into smaller, reusable components to improve maintainability, readability, and reusability.

## Priority 1: Critical Pages (1000+ lines)

### 1. `/routes/dgr/+page.svelte` (1134 lines)
**Current Issues:**
- Massive single file with complex table, modals, forms all inline
- Multiple responsibilities: schedule management, contributor management, promo tiles
- Inline table rendering with complex status logic
- Multiple modal states managed in parent

**Components to Extract:**

#### DGRScheduleTable.svelte
- Lines: ~300-400
- Contains: Schedule table with columns, sorting, status badges
- Props: `schedule`, `contributors`, `onUpdateAssignment`, `onUpdateStatus`, `onDelete`, `onReview`, `onSendToWordPress`

#### DGRContributorManager.svelte
- Lines: ~200-250
- Contains: Contributors list, add form, preferences management
- Props: `contributors`, `onAdd`, `onUpdate`, `onDelete`

#### DGRPromoTilesEditor.svelte
- Lines: ~150-200
- Contains: Promo tile management UI with add/remove/edit
- Props: `tiles`, `onSave`, `savingState`

#### DGRScheduleGenerator.svelte
- Lines: ~50-80
- Contains: Generate schedule form
- Props: `formData`, `onGenerate`, `loading`

#### DGRDeleteConfirmModal.svelte
- Lines: ~40-60
- Contains: Delete confirmation modal 

- Props: `open`, `entry`, `onConfirm`, `onCancel`

#### DGRTabNavigation.svelte
- Lines: ~30-50
- Contains: Tab navigation component
- Props: `activeTab`, `onTabChange`, `counts`

## Priority 2: Split View Pages (400-600 lines)

### 2. `/routes/dgr-publish/+page.svelte` (578 lines)
**Current Issues:**
- Split view layout duplicated with dgr-templates
- Complex preview logic mixed with form handling
- Paste from Word processing inline

**Components to Extract:**

#### DGRSplitLayout.svelte
- Lines: ~100-150
- Contains: Reusable split view container with responsive behavior
- Props: `leftPanel`, `rightPanel`, `leftWidth`, `showRight`

#### DGRPreviewPanel.svelte
- Lines: ~80-100
- Contains: Preview pane with header and content area
- Props: `previewHtml`, `status`, `title`

#### DGRPublishHeader.svelte
- Lines: ~30-40
- Contains: Header with title and publish button
- Props: `publishing`, `onPublish`

#### WordPasteProcessor.svelte
- Lines: ~150-200
- Contains: Word paste handling and parsing logic
- Props: `onParsed`, `onError`

### 3. `/routes/dgr-templates/+page.svelte` (458 lines)
**Current Issues:**
- Template management and editing in same file
- Version management UI inline
- Similar split view structure to dgr-publish

**Components to Extract:**

#### TemplateManagementView.svelte
- Lines: ~150-200
- Contains: Template list with cards (already has TemplateCard)
- Props: `templates`, `onEdit`, `onActivate`, `onDelete`, `onDuplicate`

#### TemplateVersionManager.svelte
- Lines: ~80-100
- Contains: Version dropdown and management
- Props: `versions`, `currentVersion`, `onVersionChange`

(Note: Already has TemplateEditor and TemplateCard components)

## Priority 3: Large Administrative Pages (400-500 lines)

### 4. `/routes/admin/users/+page.svelte` (505 lines)
**Current Issues:**
- User management, role editing, password reset all inline
- Modal management mixed with list rendering

**Components to Extract:**

#### UserTable.svelte
- Lines: ~150-200
- Contains: User list table with inline editing
- Props: `users`, `currentUser`, `onRoleUpdate`

#### CreateUserModal.svelte
- Lines: ~100-120
- Contains: New user creation form and modal
- Props: `open`, `onCreate`, `onCancel`

#### PasswordResetModal.svelte
- Lines: ~80-100
- Contains: Password reset modal
- Props: `open`, `userId`, `onReset`, `onCancel`

#### UserRoleBadge.svelte
- Lines: ~20-30
- Contains: Role badge with colors
- Props: `role`

### 5. `/routes/editor/+page.svelte` (488 lines)
**Current Issues:**
- Already fairly well componentized
- Could extract filter logic

**Components to Extract:**

#### EditorToolbar.svelte
- Lines: ~50-70
- Contains: Toolbar with all editor actions
- Props: `selectedCount`, `onAction`

(Note: Already has many components extracted)

## Priority 4: Medium-Sized Pages (300-400 lines)

### 6. `/routes/profile/+page.svelte` (315 lines)
**Components to Extract:**

#### ProfileForm.svelte
- Lines: ~150-200
- Contains: Profile editing form
- Props: `profile`, `onSave`, `saving`

#### SecuritySettings.svelte
- Lines: ~80-100
- Contains: Password change and 2FA settings
- Props: `onPasswordChange`, `on2FAToggle`

### 7. `/routes/dgr-publish/submit/[token]/+page.svelte` (394 lines)
**Components to Extract:**

#### TokenSubmissionForm.svelte
- Lines: ~200-250
- Contains: Main submission form
- Props: `token`, `scheduleData`, `onSubmit`

## Implementation Strategy

### Phase 1 (Week 1-2): Critical Components
1. Start with `/routes/dgr/+page.svelte` - highest impact
   - Extract DGRScheduleTable first (most complex)
   - Then DGRContributorManager
   - Then smaller modals and forms

### Phase 2 (Week 3): Reusable Layout Components
2. Create shared split-view components
   - DGRSplitLayout (used by multiple pages)
   - Consolidate preview panels

### Phase 3 (Week 4): Administrative Components
3. Componentize admin pages
   - User management components
   - Profile components

## Shared/Reusable Components

### Design System Components
These should be created in `/lib/components/design-system/`:

1. **SplitViewLayout.svelte** - Reusable split view for editors
2. **DataTable.svelte** - Generic data table with sorting, filtering
3. **ConfirmModal.svelte** - Reusable confirmation modal
4. **TabNavigation.svelte** - Generic tab navigation
5. **StatusBadge.svelte** - Status indicator component
6. **FormSection.svelte** - Consistent form section wrapper
7. **EmptyState.svelte** - Reusable empty state component
8. **LoadingSpinner.svelte** - Consistent loading indicator

## Testing Strategy

1. **Component Testing**: Test each extracted component in isolation
2. **Integration Testing**: Ensure parent pages still work correctly
3. **Visual Testing**: Verify no UI regressions
4. **Performance Testing**: Ensure no performance degradation

## Migration Approach

For each component extraction:

1. **Identify boundaries**: Mark the code section to extract
2. **Define props interface**: Determine data flow and events
3. **Extract component**: Move code to new file
4. **Update imports**: Add component import to parent
5. **Test thoroughly**: Verify functionality preserved
6. **Clean up**: Remove any duplicate code

## Success Metrics

- Reduce largest file from 1134 lines to under 300 lines
- Achieve 60%+ component reusability across pages
- Improve build time by 20%
- Reduce duplicate code by 40%
- Improve developer onboarding time

## Timeline

- **Week 1-2**: Priority 1 (DGR main page)
- **Week 3**: Priority 2 (Split view pages)
- **Week 4**: Priority 3 (Admin pages)
- **Week 5**: Priority 4 & cleanup

## Notes

1. All new components should use Svelte 5 runes syntax
2. Follow existing naming conventions
3. Maintain TypeScript types where applicable
4. Update documentation as components are created
5. Consider accessibility in all new components
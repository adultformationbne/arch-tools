# Dropdown Utility Usage Guide (Svelte 5)

This utility solves the persistent problem of dropdown menus being clipped by `overflow: hidden` containers. It uses Floating UI to position dropdowns with `position: fixed` and automatically updates their position during scroll/resize.

## Installation

The `@floating-ui/dom` package is already installed in the project.

---

## Svelte 5 Method (Recommended)

For Svelte 5 with runes, use a custom action to register both button and menu elements:

```svelte
<script>
  import { createDropdown } from '$lib/utils/dropdown.js';
  import { MoreVertical } from 'lucide-svelte';

  let dropdownRefs = $state(new Map());
  let dropdownControllers = $state(new Map());

  // Svelte action to register dropdown elements
  function dropdownAction(node, params) {
    const { id, type } = params; // id = unique identifier, type = 'button' | 'menu'

    // Store element reference
    if (!dropdownRefs.has(id)) {
      dropdownRefs.set(id, {});
    }
    const refs = dropdownRefs.get(id);
    refs[type] = node;

    // Initialize dropdown if both elements exist
    if (refs.button && refs.menu) {
      const controller = createDropdown(refs.button, refs.menu, {
        placement: 'bottom-end',
        offset: 4
      });
      dropdownControllers.set(id, controller);
    }

    return {
      destroy() {
        // Cleanup handled by main effect
      }
    };
  }

  // Cleanup all dropdowns when component unmounts
  $effect(() => {
    return () => {
      dropdownControllers.forEach(controller => controller.destroy());
    };
  });

  function getController(id) {
    return dropdownControllers.get(id);
  }
</script>

<!-- Button with action -->
<button
  use:dropdownAction={{ id: 'my-dropdown', type: 'button' }}
  onclick={() => {
    const controller = getController('my-dropdown');
    if (controller) controller.toggle();
  }}
  class="p-2 hover:bg-gray-100 rounded"
>
  <MoreVertical class="w-4 h-4" />
</button>

<!-- Menu with action -->
<div
  use:dropdownAction={{ id: 'my-dropdown', type: 'menu' }}
  style="display: none;"
  class="bg-white border border-gray-200 rounded-lg shadow-lg p-2 min-w-[150px]"
>
  <button
    onclick={() => {
      const controller = getController('my-dropdown');
      if (controller) controller.hide();
      // Do action
    }}
    class="w-full text-left px-3 py-2 hover:bg-gray-100 rounded"
  >
    Edit
  </button>
  <button
    onclick={() => {
      const controller = getController('my-dropdown');
      if (controller) controller.hide();
      // Do action
    }}
    class="w-full text-left px-3 py-2 hover:bg-red-50 text-red-600 rounded"
  >
    Delete
  </button>
</div>
```

---

## Table Row Example

Perfect for action menus in tables where clipping is common:

```svelte
<script>
  import { MoreVertical } from 'lucide-svelte';
  import { createDropdown } from '$lib/utils/dropdown.js';

  let items = $state([
    { id: 1, name: 'Item 1' },
    { id: 2, name: 'Item 2' }
  ]);

  let dropdownRefs = $state(new Map());
  let dropdownControllers = $state(new Map());

  function dropdownAction(node, params) {
    const { itemId, type } = params;

    if (!dropdownRefs.has(itemId)) {
      dropdownRefs.set(itemId, {});
    }
    const refs = dropdownRefs.get(itemId);
    refs[type] = node;

    if (refs.button && refs.menu) {
      const controller = createDropdown(refs.button, refs.menu, {
        placement: 'bottom-end',
        offset: 4
      });
      dropdownControllers.set(itemId, controller);
    }

    return {
      destroy() {}
    };
  }

  $effect(() => {
    return () => {
      dropdownControllers.forEach(controller => controller.destroy());
    };
  });
</script>

<div class="overflow-x-auto">
  <table class="min-w-full">
    <tbody>
      {#each items as item (item.id)}
        <tr>
          <td>{item.name}</td>
          <td class="text-right">
            <button
              use:dropdownAction={{ itemId: item.id, type: 'button' }}
              onclick={() => {
                const controller = dropdownControllers.get(item.id);
                if (controller) controller.toggle();
              }}
              class="p-1 rounded hover:bg-gray-100"
            >
              <MoreVertical class="w-4 h-4" />
            </button>

            <div
              use:dropdownAction={{ itemId: item.id, type: 'menu' }}
              style="display: none;"
              class="bg-white rounded-lg shadow-lg border p-2 min-w-[150px]"
            >
              <button
                onclick={() => {
                  const controller = dropdownControllers.get(item.id);
                  if (controller) controller.hide();
                  console.log('Edit', item.id);
                }}
                class="w-full text-left px-3 py-2 hover:bg-gray-100 rounded"
              >
                Edit
              </button>
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `placement` | string | `'bottom-start'` | Where to place the menu relative to trigger. Options: `'top'`, `'top-start'`, `'top-end'`, `'bottom'`, `'bottom-start'`, `'bottom-end'`, `'left'`, `'left-start'`, `'left-end'`, `'right'`, `'right-start'`, `'right-end'` |
| `offset` | number | `4` | Gap between trigger and menu in pixels |
| `padding` | number | `8` | Minimum distance from viewport edges in pixels |
| `autoClose` | boolean | `true` | Close dropdown when clicking outside |
| `closeOnEscape` | boolean | `true` | Close dropdown on Escape key |
| `onShow` | function | `undefined` | Callback when dropdown opens |
| `onHide` | function | `undefined` | Callback when dropdown closes |

---

## Controller Methods

The `createDropdown()` function returns a controller object with:

- `show()` - Open the dropdown
- `hide()` - Close the dropdown
- `toggle()` - Toggle dropdown visibility
- `destroy()` - Clean up all event listeners
- `isOpen` - Getter for current open state (boolean)

---

## Why This Approach?

1. **Breaks out of clipping containers** - Uses `position: fixed` with Floating UI
2. **Auto-updates on scroll/resize** - Menu stays anchored to button
3. **Svelte 5 compatible** - Works with runes and modern Svelte
4. **Works in tables** - Perfect for action menus that might be clipped by `overflow-x-auto`
5. **Accessible** - Handles Escape key and click-outside automatically

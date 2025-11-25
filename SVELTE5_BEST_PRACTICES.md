# Svelte 5 Best Practices - Lessons Learned

This guide documents best practices for Svelte 5 based on real-world refactoring experience.

---

## 1. State Management with `$state`

### ✅ DO: Use Direct Mutations (Deep Reactivity Works!)

```javascript
let sessionData = $state({});

// ✅ CORRECT - Direct mutation triggers reactivity
sessionData[selectedSession].title = newTitle;
sessionData[selectedSession].materials = newMaterials;
```

### ❌ DON'T: Use Immutable Updates (Unnecessary!)

```javascript
// ❌ WRONG - Unnecessary spread operators
sessionData = {
  ...sessionData,
  [selectedSession]: {
    ...sessionData[selectedSession],
    title: newTitle
  }
};
```

**Why:** `$state` creates deep reactive proxies automatically. Direct mutations on nested properties trigger reactivity without needing immutable updates.

**Exception:** Only use immutable updates if you've opted into `$state.raw()` (see below).

---

## 2. Avoid Variable Shadowing

### ✅ DO: Mutate State Directly

```javascript
// Global derived
const currentSession = $derived(sessionData[selectedSession]);

// Handler - mutate sessionData directly
const handleChange = (newValue) => {
  sessionData[selectedSession].title = newValue; // ✅ Direct mutation
};
```

### ❌ DON'T: Create Local References

```javascript
const handleChange = (newValue) => {
  const currentSession = sessionData[selectedSession]; // ❌ Local var
  currentSession.title = newValue; // ❌ Can cause reactivity delays
};
```

**Why:** Local variables can shadow global derived values and cause reactivity timing issues. Always mutate the source directly.

---

## 3. Cleanup Pattern in `$effect`

### ✅ DO: Return Cleanup from Same Effect

```javascript
let pendingTitle = $state('');

// ✅ CORRECT - Cleanup in same effect
$effect(() => {
  if (!pendingTitle) return;

  const timeout = setTimeout(() => {
    saveTitleToDatabase(pendingTitle);
    pendingTitle = '';
  }, 1000);

  // Cleanup runs before next effect or on unmount
  return () => clearTimeout(timeout);
});
```

### ❌ DON'T: Separate Cleanup Effect

```javascript
let titleSaveTimeout = null;

// ❌ WRONG - Separate cleanup effect
$effect(() => {
  return () => {
    if (titleSaveTimeout) clearTimeout(titleSaveTimeout);
  };
});

const handleTitleInput = (newTitle) => {
  if (titleSaveTimeout) clearTimeout(titleSaveTimeout);
  titleSaveTimeout = setTimeout(() => save(newTitle), 1000);
};
```

**Why:** Svelte automatically calls the cleanup function before re-running the effect or on unmount. Keep setup and cleanup together.

---

## 4. `$effect` vs `$derived`

### Use `$derived` for: Computing Values

```javascript
// ✅ CORRECT - Derived for computed values
const filteredSessions = $derived(
  data.sessions.filter(s => s.module_id === selectedModule?.id)
);

const currentSession = $derived(sessionData[selectedSession] || {
  materials: [],
  reflection: '',
  title: 'New Session'
});
```

### Use `$effect` for: Side Effects

```javascript
// ✅ CORRECT - Effect for side effects (DOM, API, analytics)
$effect(() => {
  // Initialize data from server when module changes
  const moduleId = selectedModule?.id;
  if (moduleId) {
    processServerData(moduleId);
  }
});
```

**Rule of Thumb:**
- **Returns a value?** → Use `$derived`
- **Has side effects?** → Use `$effect`
- **Updates other state?** → Usually needs `$effect` (but consider if it should be `$derived` instead)

---

## 5. Props Are Automatically Reactive

### ✅ DO: Just Use Props Directly

```javascript
let { data } = $props();

// ✅ CORRECT - Props auto-update, no watching needed
const sessions = $derived(
  data.sessions.filter(s => s.module_id === selectedModule?.id)
);
```

### ❌ DON'T: Watch Props with `$effect`

```javascript
// ❌ WRONG - Unnecessary watching
$effect(() => {
  // Props already reactive, no need for this!
  syncDataFromProps(data);
});
```

**Why:** When parent passes new props, child components automatically re-run. Use `$derived` to transform prop data, not `$effect`.

---

## 6. When to Use `$state.raw()`

### Use `$state.raw()` when:

```javascript
// ✅ USE RAW: Frequently replacing entire objects
let chartData = $state.raw([]);

setInterval(() => {
  chartData = await fetchLatestData(); // Full replacement
}, 200);
```

### Use regular `$state()` when:

```javascript
// ✅ USE REGULAR: Mutating nested properties
let sessionData = $state({});

sessionData[0].title = "New Title"; // Direct mutation
sessionData[0].materials.push(newMaterial); // Array mutation
```

**Rule:** Use `$state.raw()` only when you're replacing entire objects frequently. Otherwise, use regular `$state()` and enjoy deep reactivity.

---

## 7. Debouncing Pattern

### ✅ DO: Use Reactive State + Effect

```javascript
let pendingValue = $state('');

// Effect auto-debounces via cleanup
$effect(() => {
  if (!pendingValue) return;

  const timeout = setTimeout(() => {
    saveToDatabase(pendingValue);
    pendingValue = '';
  }, 1000);

  return () => clearTimeout(timeout);
});

const handleInput = (newValue) => {
  // Update UI immediately (optimistic)
  sessionData[selectedSession].title = newValue;

  // Trigger debounced save
  pendingValue = newValue;
};
```

**Why:** The effect automatically cancels the previous timeout when `pendingValue` changes, giving you clean debouncing without manual timeout management.

---

## 8. Event Handlers (Svelte 5 Syntax)

### ✅ DO: Use Attribute Syntax

```javascript
<button onclick={handleClick}>Click</button>
<input oninput={handleInput} onblur={handleBlur} />
<div onmouseenter={() => hovered = true}>Hover me</div>
```

### ❌ DON'T: Use Svelte 4 Syntax

```javascript
<button on:click={handleClick}>Click</button>  // ❌ Old syntax
<input on:input={handleInput} />                // ❌ Old syntax
```

---

## 9. Runes Quick Reference

| Rune | Use Case | Example |
|------|----------|---------|
| `$state()` | Reactive local state | `let count = $state(0)` |
| `$state.raw()` | Non-deep reactive state | `let data = $state.raw([])` |
| `$derived()` | Computed values | `let doubled = $derived(count * 2)` |
| `$derived.by()` | Complex computed logic | `let result = $derived.by(() => { ... })` |
| `$effect()` | Side effects (after DOM) | `$effect(() => { console.log(count) })` |
| `$effect.pre()` | Side effects (before DOM) | `$effect.pre(() => { ... })` |
| `$props()` | Component props | `let { data } = $props()` |
| `$inspect()` | Debugging | `$inspect(count, doubled)` |

---

## 10. Common Pitfalls

### ❌ Pitfall 1: Creating Unnecessary Objects

```javascript
// ❌ BAD - Creates new objects on every keystroke
const handleInput = (value) => {
  sessionData = { ...sessionData, [id]: { ...sessionData[id], title: value } };
};

// ✅ GOOD - Direct mutation (deep reactivity)
const handleInput = (value) => {
  sessionData[id].title = value;
};
```

### ❌ Pitfall 2: Using `$effect` for Computed Values

```javascript
// ❌ BAD - Effect for computing values
let doubled = $state(0);
$effect(() => {
  doubled = count * 2;
});

// ✅ GOOD - Derived for computing values
let doubled = $derived(count * 2);
```

### ❌ Pitfall 3: Manual Cleanup Outside Effect

```javascript
// ❌ BAD - Manual timeout tracking
let timeout = null;
const handleInput = () => {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => save(), 1000);
};

// ✅ GOOD - Effect with cleanup
let pending = $state('');
$effect(() => {
  if (!pending) return;
  const timeout = setTimeout(() => save(pending), 1000);
  return () => clearTimeout(timeout);
});
```

---

## Summary: Key Takeaways

1. ✅ **Direct mutations work** - `$state` has deep reactivity
2. ✅ **Mutate source directly** - Avoid local variable references
3. ✅ **Cleanup in same effect** - Return cleanup function
4. ✅ **`$derived` for values** - `$effect` for side effects
5. ✅ **Props auto-update** - No watching needed
6. ✅ **Use `onclick=`** - Not `on:click=`
7. ✅ **Debounce with effects** - Let cleanup handle cancellation
8. ✅ **Trust the framework** - Simpler patterns are usually correct

---

## Resources

- [Svelte 5 Documentation](https://svelte.dev/docs/svelte)
- [Svelte 5 Tutorial](https://svelte.dev/tutorial/svelte)
- [Svelte 5 Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [$state Documentation](https://svelte.dev/docs/svelte/$state)
- [$effect Documentation](https://svelte.dev/docs/svelte/$effect)
- [$derived Documentation](https://svelte.dev/docs/svelte/$derived)

---

**Last Updated:** Based on session editor refactoring (Nov 2024)
**Svelte Version:** 5.x

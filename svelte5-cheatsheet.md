# Svelte 5 Syntax & Best Practices Cheat Sheet

## 🔹 Svelte 5 Syntax Changes

### 1. Runes: New Reactive Primitives

- **`$state(...)`** — Declare reactive variables. Replaces plain `let` in Svelte 4.

```svelte
<!-- Svelte 4 -->
<script>let count = 0;</script>

<!-- Svelte 5 -->
<script>let count = $state(0);</script>
```

- **`$derived(...)`** — Compute reactive values based on state or other derived sources.

- **`$effect(...)`** — Runs a function when dependencies change. Replaces the old `$:` reactive statement when side-effects are intended.

```svelte
$effect(() => {
  if (count > 5) alert('Too high!');
});
```

- **`$inspect(...)`** — Logs changes to a state value (in dev mode only).

- **Other runes**: `$state.frozen`, `$effect.pre`, `$effect.active`, `$effect.root` — for advanced reactivity.

---

### 2. Component Props & Event Handling

- **Component props** are now gathered via `$props()` instead of `export let`:

```svelte
<script>
	let { foo, bar, ...rest } = $props();
</script>
```

- **Event handlers** now use standard prop syntax—not `on:click`:

```svelte
<button onclick={handleClick}>Click me</button>
```

- **Custom events** — `createEventDispatcher` is deprecated; pass callbacks like normal props.

---

### 3. Snippets & Expanded Syntax Locations

- **Snippets** (`#snippet ...`) allow reusable chunks of markup inside components.

- **Extended syntax support**: You can now use Svelte syntax in `.svelte.js` and `.svelte.ts` modules.

---

### 4. Misc Syntax Improvements & Tools

- Faster hydration and improved compiler warnings.
- Better performance and smaller bundles.
- Migration tooling: `npx sv migrate svelte-5` or VS Code's **Migrate Component to Svelte 5 Syntax**.

---

## 💡 Svelte 5 Best Practices

1. **Gradually migrate** — Update components incrementally to `$state`, `$props()`.
2. **Use `$effect`, not `$:`** for side-effects.
3. **Leverage `$inspect()`** during development to debug state changes.
4. **Favor snippets** for reusable markup inside components.
5. **Event binding** — Move to prop-style handlers (`onclick={fn}`).
6. **Use `.svelte.js` / `.svelte.ts`** for logic modules with full syntax.
7. **Monitor bundle size & performance** regularly.

---

## 📊 Summary Table

| Svelte 4 Syntax           | Svelte 5 Syntax                    |
| ------------------------- | ---------------------------------- |
| `let count = 0;`          | `let count = $state(0);`           |
| `$: ...`                  | `$effect(() => { ... });`          |
| `export let foo;`         | `let { foo, ...rest } = $props();` |
| `on:click={...}`          | `onclick={...}`                    |
| `createEventDispatcher()` | Use props for callbacks instead    |

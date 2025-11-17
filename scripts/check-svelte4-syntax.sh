#!/bin/bash

# Check for Svelte 4 syntax patterns in routes directory
# Usage: ./scripts/check-svelte4-syntax.sh

echo "🔍 Checking for Svelte 4 syntax patterns in src/routes/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

total_issues=0

# Function to count and display results
check_pattern() {
    local pattern="$1"
    local description="$2"
    local files=$(grep -r "$pattern" src/routes --include="*.svelte" -l 2>/dev/null)
    local count=$(echo "$files" | grep -c "^" 2>/dev/null)

    if [ ! -z "$files" ] && [ "$count" -gt 0 ]; then
        echo "❌ $description ($count files)"
        echo "$files" | sed 's/^/   /'
        echo ""
        total_issues=$((total_issues + count))
    fi
}

# Check for Svelte 4 patterns
echo "Checking for Svelte 4 patterns..."
echo ""

# 1. export let (props syntax)
check_pattern "export let " "Props using 'export let' instead of '\$props()'"

# 2. on:click (event syntax)
check_pattern "on:click=" "Events using 'on:click' instead of 'onclick'"

# 3. on:submit
check_pattern "on:submit=" "Events using 'on:submit' instead of 'onsubmit'"

# 4. on:change
check_pattern "on:change=" "Events using 'on:change' instead of 'onchange'"

# 5. on:input
check_pattern "on:input=" "Events using 'on:input' instead of 'oninput'"

# 6. $: reactive statements (excluding $derived and $effect)
files_with_reactive=$(grep -r '^\s*\$:' src/routes --include="*.svelte" -l | \
    while read file; do
        if ! grep -q '\$derived\|\$effect' "$file"; then
            echo "$file"
        fi
    done)

if [ ! -z "$files_with_reactive" ]; then
    count=$(echo "$files_with_reactive" | grep -c "^" 2>/dev/null)
    if [ "$count" -gt 0 ]; then
        echo "❌ Reactive statements using '\$:' instead of '\$derived' or '\$effect' ($count files)"
        echo "$files_with_reactive" | sed 's/^/   /'
        echo ""
        total_issues=$((total_issues + count))
    fi
fi

# 7. createEventDispatcher
check_pattern "createEventDispatcher" "Using 'createEventDispatcher' instead of callback props"

# 8. $$restProps
check_pattern '\$\$restProps' "Using '\$\$restProps' instead of rest props in \$props()"

# 9. bind:this (still supported but check if used)
files_with_bind_this=$(grep -r 'bind:this=' src/routes --include="*.svelte" -l 2>/dev/null)
if [ ! -z "$files_with_bind_this" ]; then
    count=$(echo "$files_with_bind_this" | grep -c "^" 2>/dev/null)
    if [ "$count" -gt 0 ]; then
        echo "ℹ️  Files using 'bind:this' (still supported, but check if needed) ($count files)"
        echo "$files_with_bind_this" | sed 's/^/   /'
        echo ""
    fi
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $total_issues -eq 0 ]; then
    echo "✅ No Svelte 4 syntax patterns found! All routes appear to use Svelte 5 syntax."
else
    echo "⚠️  Found Svelte 4 patterns in $total_issues file instances"
    echo ""
    echo "To migrate:"
    echo "  - Replace 'export let foo' with 'let { foo } = \$props()'"
    echo "  - Replace 'on:click=' with 'onclick='"
    echo "  - Replace '\$: reactive' with '\$derived()' or '\$effect()'"
    echo "  - Replace 'createEventDispatcher' with callback props"
fi
echo ""

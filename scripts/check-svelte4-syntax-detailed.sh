#!/bin/bash

# Detailed check for Svelte 4 syntax patterns in routes directory
# Usage: ./scripts/check-svelte4-syntax-detailed.sh [directory]
# Default directory: src/routes

SEARCH_DIR="${1:-src/routes}"

echo "🔍 Detailed Svelte 4 syntax check in $SEARCH_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

total_issues=0
files_with_issues=()

# Function to check and display detailed results
check_pattern_detailed() {
    local pattern="$1"
    local description="$2"
    local files=$(grep -rn "$pattern" "$SEARCH_DIR" --include="*.svelte" 2>/dev/null)

    if [ ! -z "$files" ]; then
        local count=$(echo "$files" | wc -l | tr -d ' ')
        echo "❌ $description"
        echo ""
        echo "$files" | while IFS=: read -r file line content; do
            echo "   📄 $file:$line"
            echo "      $(echo "$content" | sed 's/^[[:space:]]*//')"

            # Track unique files
            if [[ ! " ${files_with_issues[@]} " =~ " ${file} " ]]; then
                files_with_issues+=("$file")
            fi
        done
        echo ""
        total_issues=$((total_issues + count))
    fi
}

# 1. Check for 'export let' props
echo "1️⃣  Checking for 'export let' (should be \$props())"
echo "────────────────────────────────────────────────────"
check_pattern_detailed "export let " "Props using Svelte 4 'export let' syntax"

# 2. Check for on:event syntax
echo "2️⃣  Checking for 'on:' event handlers (should be 'on' + event name)"
echo "────────────────────────────────────────────────────"
check_pattern_detailed "on:click=" "Event handlers using 'on:click' instead of 'onclick'"
check_pattern_detailed "on:submit=" "Event handlers using 'on:submit' instead of 'onsubmit'"
check_pattern_detailed "on:change=" "Event handlers using 'on:change' instead of 'onchange'"
check_pattern_detailed "on:input=" "Event handlers using 'on:input' instead of 'oninput'"

# 3. Check for $: reactive statements
echo "3️⃣  Checking for '\$:' reactive statements (should be \$derived or \$effect)"
echo "────────────────────────────────────────────────────"
reactive_files=$(grep -rn '^\s*\$:' "$SEARCH_DIR" --include="*.svelte" 2>/dev/null)
if [ ! -z "$reactive_files" ]; then
    echo "❌ Reactive statements using '\$:' syntax"
    echo ""
    echo "$reactive_files" | while IFS=: read -r file line content; do
        # Check if file uses $derived or $effect
        if grep -q '\$derived\|\$effect' "$file"; then
            echo "   📄 $file:$line (⚠️ Mixed: file has both \$: and \$derived/\$effect)"
        else
            echo "   📄 $file:$line"
        fi
        echo "      $(echo "$content" | sed 's/^[[:space:]]*//')"

        if [[ ! " ${files_with_issues[@]} " =~ " ${file} " ]]; then
            files_with_issues+=("$file")
        fi
    done
    echo ""
    count=$(echo "$reactive_files" | wc -l | tr -d ' ')
    total_issues=$((total_issues + count))
fi

# 4. Check for createEventDispatcher
echo "4️⃣  Checking for createEventDispatcher (should use callback props)"
echo "────────────────────────────────────────────────────"
check_pattern_detailed "createEventDispatcher" "Using Svelte 4 'createEventDispatcher'"

# 5. Check for $$restProps
echo "5️⃣  Checking for \$\$restProps (should use rest in \$props())"
echo "────────────────────────────────────────────────────"
check_pattern_detailed '\$\$restProps' "Using Svelte 4 '\$\$restProps'"

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $total_issues -eq 0 ]; then
    echo "✅ No Svelte 4 syntax patterns found!"
    echo "   All files in $SEARCH_DIR use Svelte 5 syntax."
else
    # Get unique files
    unique_files=($(printf '%s\n' "${files_with_issues[@]}" | sort -u))
    unique_count=${#unique_files[@]}

    echo "⚠️  Found $total_issues Svelte 4 pattern instances"
    echo "   Across $unique_count unique files:"
    echo ""

    for file in "${unique_files[@]}"; do
        echo "   📄 $file"
    done

    echo ""
    echo "🔧 Migration Guide:"
    echo "   1. export let foo → let { foo } = \$props()"
    echo "   2. on:click=     → onclick="
    echo "   3. on:submit=    → onsubmit="
    echo "   4. \$: computed   → let computed = \$derived(...)"
    echo "   5. \$: effect     → \$effect(() => { ... })"
    echo "   6. dispatch()    → Use callback props instead"
    echo ""
    echo "📚 See: https://svelte.dev/docs/svelte/v5-migration-guide"
fi
echo ""

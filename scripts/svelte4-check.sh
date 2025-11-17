#!/bin/bash

# Quick check for Svelte 4 syntax patterns
# Usage: ./scripts/svelte4-check.sh [path]
# Examples:
#   ./scripts/svelte4-check.sh                    # Check all routes
#   ./scripts/svelte4-check.sh src/routes/users   # Check specific route
#   ./scripts/svelte4-check.sh src/lib            # Check lib folder

SEARCH_PATH="${1:-src/routes}"

echo "🔍 Svelte 4 Syntax Check: $SEARCH_PATH"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

total=0
issues=()

# Helper function
check() {
    local pattern="$1"
    local name="$2"
    local files=$(grep -rl "$pattern" "$SEARCH_PATH" --include="*.svelte" 2>/dev/null | sort -u)

    if [ ! -z "$files" ]; then
        local count=$(echo "$files" | wc -l | tr -d ' ')
        echo -e "${RED}✗${NC} $name ($count files)"
        echo "$files" | sed 's/^/  /'
        echo ""
        total=$((total + count))

        # Add to issues array
        while IFS= read -r file; do
            if [[ ! " ${issues[@]} " =~ " ${file} " ]]; then
                issues+=("$file")
            fi
        done <<< "$files"
    fi
}

# Run checks
check "export let " "export let (use \$props())"
check "on:click=" "on:click= (use onclick=)"
check "on:submit=" "on:submit= (use onsubmit=)"
check "on:change=" "on:change= (use onchange=)"
check "createEventDispatcher" "createEventDispatcher (use callback props)"

# Check $: patterns (excluding $derived, $effect, $state, $props)
svelte4_reactive=$(grep -rl '^\s*\$:' "$SEARCH_PATH" --include="*.svelte" 2>/dev/null | \
    while read file; do
        if ! grep -q '\$derived\|\$effect' "$file"; then
            echo "$file"
        fi
    done | sort -u)

if [ ! -z "$svelte4_reactive" ]; then
    count=$(echo "$svelte4_reactive" | wc -l | tr -d ' ')
    echo -e "${RED}✗${NC} \$: reactive (use \$derived/\$effect) ($count files)"
    echo "$svelte4_reactive" | sed 's/^/  /'
    echo ""

    while IFS= read -r file; do
        if [[ ! " ${issues[@]} " =~ " ${file} " ]]; then
            issues+=("$file")
        fi
    done <<< "$svelte4_reactive"
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
unique_count=${#issues[@]}

if [ $unique_count -eq 0 ]; then
    echo -e "${GREEN}✓ All files use Svelte 5 syntax!${NC}"
else
    echo -e "${YELLOW}⚠ Found Svelte 4 syntax in $unique_count files${NC}"
    echo ""
    echo "Files needing migration:"
    printf '  %s\n' "${issues[@]}" | sort -u
    echo ""
    echo "Run detailed check: ./scripts/check-svelte4-syntax-detailed.sh $SEARCH_PATH"
fi
echo ""

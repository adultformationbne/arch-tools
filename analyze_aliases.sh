#!/bin/bash

# AHWGP Analysis Aliases
# Source this file in your shell to get easy commands
# Add to .zshrc: source /Users/liamdesic/AF/AHWGP/analyze_aliases.sh

# Change to AHWGP directory
alias ahwgp='cd /Users/liamdesic/AF/AHWGP'

# Quick analysis commands
alias analyze-test='cd /Users/liamdesic/AF/AHWGP && ./analyze.sh test'
alias analyze-10='cd /Users/liamdesic/AF/AHWGP && ./analyze.sh run-10'
alias analyze-50='cd /Users/liamdesic/AF/AHWGP && ./analyze.sh run-50'
alias analyze-100='cd /Users/liamdesic/AF/AHWGP && ./analyze.sh run-100'
alias analyze-all='cd /Users/liamdesic/AF/AHWGP && ./analyze.sh run'
alias analyze-status='cd /Users/liamdesic/AF/AHWGP && ./analyze.sh status'
alias analyze-reset='cd /Users/liamdesic/AF/AHWGP && ./analyze.sh reset'
alias analyze-backup='cd /Users/liamdesic/AF/AHWGP && ./analyze.sh backup'

# Custom number of blocks
analyze-custom() {
    if [ -z "$1" ]; then
        echo "Usage: analyze-custom [number]"
        echo "Example: analyze-custom 25"
        return 1
    fi
    cd /Users/liamdesic/AF/AHWGP && ./analyze.sh custom "$1"
}

echo "AHWGP Analysis aliases loaded!"
echo "Commands: analyze-test, analyze-10, analyze-50, analyze-100, analyze-all"
echo "          analyze-status, analyze-reset, analyze-backup"
echo "          analyze-custom [n]"
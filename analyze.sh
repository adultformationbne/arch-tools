#!/bin/bash

# AHWGP Content Analysis Script Wrapper
# Easy-to-use commands for running the LLM analysis

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Default values
DEFAULT_BATCH=10
DEFAULT_OUTPUT="evaluation.json"

# Help function
show_help() {
    echo -e "${GREEN}AHWGP Content Analysis Tool${NC}"
    echo -e "Analyzes paragraph blocks using local LLM (Ollama)\n"
    echo -e "${YELLOW}Usage:${NC}"
    echo -e "  ./analyze.sh [command] [options]\n"
    echo -e "${YELLOW}Commands:${NC}"
    echo -e "  ${GREEN}test${NC}          Test with 5 blocks only"
    echo -e "  ${GREEN}test-blocks${NC}   Test specific blocks by ID (space-separated)"
    echo -e "  ${GREEN}run${NC}           Run full analysis (all unanalyzed blocks)"
    echo -e "  ${GREEN}run-10${NC}        Analyze next 10 blocks"
    echo -e "  ${GREEN}run-50${NC}        Analyze next 50 blocks"
    echo -e "  ${GREEN}run-100${NC}       Analyze next 100 blocks"
    echo -e "  ${GREEN}status${NC}        Show analysis progress"
    echo -e "  ${GREEN}reset${NC}         Delete evaluation.json and start fresh"
    echo -e "  ${GREEN}backup${NC}        Create backup of current evaluation.json"
    echo -e "  ${GREEN}help${NC}          Show this help message\n"
    echo -e "${YELLOW}Advanced Options:${NC}"
    echo -e "  ${GREEN}custom${NC} [n]    Analyze next [n] blocks"
    echo -e "  ${GREEN}batch${NC} [n]     Set batch size (default: 10)"
    echo -e "  ${GREEN}output${NC} [file] Use custom output file\n"
    echo -e "${YELLOW}Examples:${NC}"
    echo -e "  ./analyze.sh test           # Test with 5 blocks"
    echo -e "  ./analyze.sh test-blocks id1 id2 id3  # Test specific blocks"
    echo -e "  ./analyze.sh run-50         # Analyze next 50 blocks"
    echo -e "  ./analyze.sh custom 25      # Analyze next 25 blocks"
    echo -e "  ./analyze.sh status         # Check progress"
    echo -e "  ./analyze.sh reset          # Start fresh analysis"
}

# Check if virtual environment exists
check_venv() {
    if [ ! -d "venv" ]; then
        echo -e "${RED}Virtual environment not found!${NC}"
        echo "Creating virtual environment..."
        python3 -m venv venv
        source venv/bin/activate
        pip install requests
    else
        source venv/bin/activate
    fi
}

# Show analysis status
show_status() {
    if [ -f "$DEFAULT_OUTPUT" ]; then
        echo -e "${GREEN}Analysis Status:${NC}"
        python3 -c "
import json
with open('$DEFAULT_OUTPUT', 'r') as f:
    data = json.load(f)
    meta = data['metadata']
    print(f'Total evaluated: {meta[\"total_evaluations\"]}')
    print(f'Successful: {meta[\"successful_evaluations\"]}')
    print(f'Failed: {meta[\"failed_evaluations\"]}')
    print(f'Model: {meta[\"model_used\"]}')
    
# Count remaining
with open('editor-app/static/AHWGP_master.json', 'r') as f:
    master = json.load(f)
    total_paragraphs = sum(1 for b in master['blocks'] if b.get('tag') == 'paragraph')
    print(f'\\nTotal paragraph blocks: {total_paragraphs}')
    print(f'Remaining to analyze: {total_paragraphs - meta[\"total_evaluations\"]}')
"
    else
        echo -e "${YELLOW}No evaluation file found. Run analysis first.${NC}"
    fi
}

# Create backup
create_backup() {
    if [ -f "$DEFAULT_OUTPUT" ]; then
        timestamp=$(date +%Y%m%d_%H%M%S)
        backup_name="evaluation_backup_${timestamp}.json"
        cp "$DEFAULT_OUTPUT" "$backup_name"
        echo -e "${GREEN}Backup created: $backup_name${NC}"
    else
        echo -e "${YELLOW}No evaluation file to backup.${NC}"
    fi
}

# Main script logic
check_venv

case "$1" in
    test)
        echo -e "${GREEN}Running test analysis (5 blocks)...${NC}"
        python3 analyze_content.py --test
        ;;
    
    test-blocks)
        if [ $# -lt 2 ]; then
            echo -e "${RED}Error: Please specify block IDs${NC}"
            echo "Usage: ./analyze.sh test-blocks [block-id1] [block-id2] ..."
            exit 1
        fi
        shift  # Remove the 'test-blocks' argument
        echo -e "${GREEN}Testing specific blocks: $*${NC}"
        python3 analyze_content.py --test-blocks "$@"
        ;;
    
    run)
        echo -e "${GREEN}Running full analysis...${NC}"
        python3 analyze_content.py --batch-size $DEFAULT_BATCH
        ;;
    
    run-10)
        echo -e "${GREEN}Analyzing next 10 blocks...${NC}"
        python3 analyze_content.py --batch-size 5 --max-blocks 10
        ;;
    
    run-50)
        echo -e "${GREEN}Analyzing next 50 blocks...${NC}"
        python3 analyze_content.py --batch-size 10 --max-blocks 50
        ;;
    
    run-100)
        echo -e "${GREEN}Analyzing next 100 blocks...${NC}"
        python3 analyze_content.py --batch-size 20 --max-blocks 100
        ;;
    
    custom)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify number of blocks${NC}"
            echo "Usage: ./analyze.sh custom [number]"
            exit 1
        fi
        echo -e "${GREEN}Analyzing next $2 blocks...${NC}"
        python3 analyze_content.py --batch-size 10 --max-blocks "$2"
        ;;
    
    batch)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify batch size${NC}"
            echo "Usage: ./analyze.sh batch [size]"
            exit 1
        fi
        echo -e "${GREEN}Running with batch size $2...${NC}"
        python3 analyze_content.py --batch-size "$2"
        ;;
    
    output)
        if [ -z "$2" ]; then
            echo -e "${RED}Error: Please specify output file${NC}"
            echo "Usage: ./analyze.sh output [filename]"
            exit 1
        fi
        echo -e "${GREEN}Using output file: $2${NC}"
        python3 analyze_content.py --output "$2"
        ;;
    
    status)
        show_status
        ;;
    
    reset)
        echo -e "${YELLOW}This will delete your evaluation.json file!${NC}"
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            if [ -f "$DEFAULT_OUTPUT" ]; then
                # Create automatic backup before reset
                create_backup
                rm "$DEFAULT_OUTPUT"
                echo -e "${GREEN}Evaluation file reset. Starting fresh!${NC}"
            else
                echo -e "${YELLOW}No evaluation file to reset.${NC}"
            fi
        else
            echo -e "${YELLOW}Reset cancelled.${NC}"
        fi
        ;;
    
    backup)
        create_backup
        ;;
    
    help|--help|-h|"")
        show_help
        ;;
    
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        echo "Use './analyze.sh help' for usage information"
        exit 1
        ;;
esac
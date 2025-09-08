#!/bin/bash

# Simple Resource Monitor for LLM Analysis
# Shows CPU, Memory, and Ollama usage during analysis

echo "🔍 Starting Resource Monitor..."
echo "Run your analysis in another terminal, then press Ctrl+C to stop monitoring"
echo ""

# Function to get Ollama memory usage
get_ollama_memory() {
    ps aux | grep '[o]llama serve' | awk '{print $6}' | head -1
}

# Function to get Ollama CPU usage
get_ollama_cpu() {
    ps aux | grep '[o]llama serve' | awk '{print $3}' | head -1
}

# Function to get system memory usage
get_system_memory() {
    vm_stat | awk '
    /Pages free/ { free = $3 }
    /Pages active/ { active = $3 }
    /Pages inactive/ { inactive = $3 }
    /Pages wired/ { wired = $3 }
    END {
        # Convert from pages (16KB) to GB
        total_gb = (free + active + inactive + wired) * 16384 / 1024 / 1024 / 1024
        used_gb = (active + inactive + wired) * 16384 / 1024 / 1024 / 1024
        printf "%.1f/%.1f GB (%.0f%%)", used_gb, total_gb, (used_gb/total_gb)*100
    }'
}

# Header
printf "%-8s %-20s %-15s %-15s %-10s\n" "TIME" "SYSTEM MEMORY" "SYSTEM CPU" "OLLAMA MEM" "OLLAMA CPU"
printf "%-8s %-20s %-15s %-15s %-10s\n" "-----" "-------------" "----------" "----------" "----------"

# Monitor loop
while true; do
    timestamp=$(date +%H:%M:%S)
    system_memory=$(get_system_memory)
    system_cpu=$(top -l 1 -n 0 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
    ollama_memory_kb=$(get_ollama_memory)
    ollama_cpu=$(get_ollama_cpu)
    
    # Convert Ollama memory from KB to MB
    if [ -n "$ollama_memory_kb" ]; then
        ollama_memory_mb=$((ollama_memory_kb / 1024))
        ollama_memory="${ollama_memory_mb}MB"
    else
        ollama_memory="Not Found"
    fi
    
    if [ -z "$ollama_cpu" ]; then
        ollama_cpu="0.0%"
    else
        ollama_cpu="${ollama_cpu}%"
    fi
    
    if [ -z "$system_cpu" ]; then
        system_cpu="N/A"
    else
        system_cpu="${system_cpu}%"
    fi
    
    printf "%-8s %-20s %-15s %-15s %-10s\n" "$timestamp" "$system_memory" "$system_cpu" "$ollama_memory" "$ollama_cpu"
    
    sleep 2
done
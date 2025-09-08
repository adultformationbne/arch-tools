#!/bin/bash
# Development Environment Setup Script

echo "🚀 Setting up Book Production Development Environment"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

echo "✅ Docker is running"

# Build the development environment
echo "🔨 Building Docker environment..."
docker-compose build

# Create necessary directories
echo "📁 Creating project directories..."
mkdir -p extracted_content/{text,images}
mkdir -p processed_xml
mkdir -p output/{pdf,epub}
mkdir -p scripts
mkdir -p templates/indesign

echo "✅ Development environment ready!"
echo ""
echo "🎯 Quick Start Commands:"
echo "  Start dev environment:    ./dev.sh"
echo "  Run PDF extraction:       ./dev.sh extract"
echo "  Process to XML:           ./dev.sh process"
echo "  Start Jupyter:            ./dev.sh jupyter"
echo "  Clean environment:        ./dev.sh clean"
echo ""
echo "📚 Next steps:"
echo "  1. Place your PDF in the current directory"
echo "  2. Run: ./dev.sh extract"
echo "  3. Review extracted content in extracted_content/"
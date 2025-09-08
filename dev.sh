#!/bin/bash
# Development Helper Script

case "$1" in
    "setup")
        echo "🚀 Setting up development environment..."
        chmod +x dev-setup.sh
        ./dev-setup.sh
        ;;
    
    "start"|"")
        echo "🔧 Starting development environment..."
        docker-compose up -d book-production
        echo "✅ Environment started. Entering container..."
        docker-compose exec book-production bash
        ;;
    
    "extract")
        echo "📄 Extracting PDF content..."
        docker-compose run --rm book-production python scripts/extract_pdf.py
        ;;
    
    "process")
        echo "🔄 Processing text to XML..."
        docker-compose run --rm book-production python scripts/process_to_xml.py
        ;;
    
    "jupyter")
        echo "📓 Starting Jupyter notebook..."
        docker-compose --profile jupyter up -d jupyter
        echo "🌐 Jupyter available at: http://localhost:8888"
        echo "💡 Use Ctrl+C to stop, then run: ./dev.sh stop-jupyter"
        ;;
    
    "stop-jupyter")
        docker-compose --profile jupyter down
        echo "🛑 Jupyter stopped"
        ;;
    
    "shell")
        echo "🐚 Opening shell in container..."
        docker-compose exec book-production bash
        ;;
    
    "install")
        echo "📦 Installing additional package: $2"
        docker-compose exec book-production pip install "$2"
        ;;
    
    "clean")
        echo "🧹 Cleaning up containers and volumes..."
        docker-compose down -v
        docker system prune -f
        echo "✅ Cleanup complete"
        ;;
    
    "rebuild")
        echo "🔨 Rebuilding environment..."
        docker-compose down
        docker-compose build --no-cache
        echo "✅ Rebuild complete"
        ;;
    
    "logs")
        docker-compose logs book-production
        ;;
    
    "status")
        echo "📊 Container status:"
        docker-compose ps
        ;;
    
    *)
        echo "📖 Book Production Development Helper"
        echo ""
        echo "Usage: ./dev.sh [command]"
        echo ""
        echo "Commands:"
        echo "  setup          Setup development environment"
        echo "  start          Start dev environment (default)"
        echo "  extract        Extract PDF content"
        echo "  process        Process text to XML"
        echo "  jupyter        Start Jupyter notebook server"
        echo "  stop-jupyter   Stop Jupyter server"
        echo "  shell          Open shell in container"
        echo "  install PKG    Install additional Python package"
        echo "  clean          Clean up containers and volumes"
        echo "  rebuild        Rebuild Docker environment"
        echo "  logs           Show container logs"
        echo "  status         Show container status"
        echo ""
        echo "Examples:"
        echo "  ./dev.sh setup"
        echo "  ./dev.sh extract"
        echo "  ./dev.sh install beautifulsoup4"
        echo "  ./dev.sh jupyter"
        ;;
esac
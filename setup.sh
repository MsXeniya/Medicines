#!/bin/bash
# Medicines App - Quick Setup Script
# Usage: ./setup.sh [action]

set -e

ACTION=${1:-build}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔════════════════════════════════════════════════════════╗"
echo "║         Medicines App - Setup Script                   ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# Function to print status
print_status() {
    echo "$1"
}

# Function to print success
print_success() {
    echo "$1"
}

# Function to print error
print_error() {
    echo "$1"
}

# Check if Docker and Docker Compose are installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_success "Docker and Docker Compose are installed"
}

# Initialize environment
init_env() {
    if [ ! -f "$SCRIPT_DIR/.env" ]; then
        print_status "Creating .env from .env.example..."
        cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
        print_success ".env file created"
    else
        print_status ".env file already exists"
    fi
}

# Build images
build_images() {
    print_status "Building Docker images..."
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" build
    print_success "Docker images built successfully"
}

# Start services
start_services() {
    print_status "Starting services..."
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" up -d
    print_success "Services started"
    
    print_status "Waiting for services to be ready..."
    sleep 10
    
    echo ""
    echo "Access your application:"
    echo "   Frontend:        http://localhost/"
    echo "   API:             http://localhost/api"
    echo "   FastAPI Docs:    http://localhost/docs"
    echo "   MinIO Console:   http://localhost:9001"
    echo ""
    echo "Credentials:"
    echo "   MinIO: minioadmin / minioadmin"
    echo ""
}

stop_services() {
    print_status "Stopping services..."
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" down
    print_success "Services stopped"
}

show_logs() {
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" logs -f
}

run_tests() {
    print_status "Running tests..."
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" exec -T fastapi python -m pytest tests/ -v
    print_success "Tests completed"
}

cleanup() {
    print_status "Removing containers and volumes..."
    docker-compose -f "$SCRIPT_DIR/docker-compose.yml" down -v
    print_success "Cleanup completed"
}

# Main
check_docker

case "$ACTION" in
    init)
        init_env
        ;;
    build)
        init_env
        build_images
        ;;
    up|start)
        init_env
        build_images
        start_services
        ;;
    down|stop)
        stop_services
        ;;
    logs)
        show_logs
        ;;
    test)
        run_tests
        ;;
    clean)
        cleanup
        ;;
    *)
        echo "Usage: $0 {init|build|up|down|logs|test|clean}"
        echo ""
        echo "Actions:"
        echo "  init   - Initialize .env file"
        echo "  build  - Build Docker images"
        echo "  up     - Build and start services"
        echo "  down   - Stop services"
        echo "  logs   - Show service logs"
        echo "  test   - Run tests"
        echo "  clean  - Remove all containers and volumes"
        exit 1
        ;;
esac

print_success "Done!"

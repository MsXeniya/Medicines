.PHONY: help build up down logs clean test deploy

help:
	@echo " Medicines App - Docker Development
	@echo "Available commands:"
	@echo ""
	@echo "  make build              - Build all Docker images"
	@echo "  make up                 - Start all services"
	@echo "  make down               - Stop all services"
	@echo "  make logs               - View service logs"
	@echo "  make logs-fastapi       - View FastAPI logs"
	@echo "  make logs-frontend      - View Frontend logs"
	@echo "  make logs-backend       - View Backend logs"
	@echo "  make logs-nginx         - View Nginx logs"
	@echo "  make logs-minio         - View MinIO logs"
	@echo "  make ps                 - Show container status"
	@echo "  make clean              - Remove containers and volumes"
	@echo "  make shell-fastapi      - Open shell in FastAPI container"
	@echo "  make shell-frontend     - Open shell in Frontend container"
	@echo "  make shell-backend      - Open shell in Backend container"
	@echo "  make test               - Run all tests"
	@echo "  make test-backend       - Run backend tests"
	@echo "  make test-frontend      - Run frontend tests"
	@echo "  make restart            - Restart all services"
	@echo "  make restart-fastapi    - Restart FastAPI service"
	@echo "  make health             - Check service health"
	@echo "  make init               - Initialize project (.env from example)"
	@echo ""

build:
	@echo "Building Docker images..."
	docker-compose build

up:
	@echo "Starting services..."
	docker-compose up -d --build
	@echo "Services started!"
	@echo "Frontend: http://localhost/"
	@echo "API: http://localhost/api"
	@echo "FastAPI Docs: http://localhost/docs"
	@echo "MinIO Console: http://localhost:9001"
	@sleep 5
	@make health

down:
	@echo "Stopping services..."
	docker-compose down
	@echo "Services stopped!"

logs:
	docker-compose logs -f

logs-fastapi:
	docker-compose logs -f fastapi

logs-frontend:
	docker-compose logs -f frontend

logs-backend:
	docker-compose logs -f backend

logs-nginx:
	docker-compose logs -f nginx

logs-minio:
	docker-compose logs -f minio

ps:
	@echo "Service Status:"
	docker-compose ps

clean:
	@echo "Cleaning up..."
	docker-compose down -v
	@echo "Cleanup complete!"

shell-fastapi:
	@echo "Opening shell in FastAPI container..."
	docker-compose exec fastapi /bin/bash

shell-frontend:
	@echo "Opening shell in Frontend container..."
	docker-compose exec frontend /bin/sh

shell-backend:
	@echo "Opening shell in Backend container..."
	docker-compose exec backend /bin/sh

test:
	@echo "Running all tests..."
	docker-compose exec -T fastapi python -m pytest tests/ -v
	@echo "Tests completed!"

test-backend:
	@echo "Running backend tests..."
	docker-compose exec -T fastapi python -m pytest tests/ -v

test-frontend:
	@echo "Running frontend tests..."
	docker-compose exec -T frontend npm run test:unit

restart:
	@echo "Restarting all services..."
	docker-compose restart
	@echo "Services restarted!"

restart-fastapi:
	@echo "Restarting FastAPI..."
	docker-compose restart fastapi
	@echo "FastAPI restarted!"

health:
	@echo "Service Health Check:"
	@docker-compose ps | grep -E "(Up|Exited|Restarting)"
	@echo ""
	@echo "🔗 Testing connectivity:"
	@docker-compose exec -T nginx wget -q -O- http://localhost/ > /dev/null && echo "Frontend accessible" || echo "Frontend not accessible"
	@docker-compose exec -T nginx wget -q -O- http://backend:5000/ > /dev/null && echo "Backend accessible" || echo "Backend not accessible"
	@docker-compose exec -T nginx wget -q -O- http://fastapi:8000/docs > /dev/null && echo "FastAPI accessible" || echo "FastAPI not accessible"
	@docker-compose exec -T nginx wget -q -O- http://minio:9000/minio/health/live > /dev/null && echo "MinIO accessible" || echo "MinIO not accessible"

init:
	@if [ ! -f .env ]; then \
		echo "Creating .env from .env.example..."; \
		cp .env.example .env; \
		echo ".env created! Update it with your configuration."; \
	else \
		echo ".env already exists"; \
	fi

.DEFAULT_GOAL := help

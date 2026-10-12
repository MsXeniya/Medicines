# Medicines App - Quick Setup Script for Windows
param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("init", "build", "up", "down", "logs", "test", "clean")]
    [string]$Action = "build"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║         Medicines App - Setup Script (Windows)         ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Helper functions
function Print-Status {
    param([string]$Message)
    Write-Host "$Message" -ForegroundColor Yellow
}

function Print-Success {
    param([string]$Message)
    Write-Host "$Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "$Message" -ForegroundColor Red
}

# Check if Docker is installed
function Check-Docker {
    try {
        $null = docker --version
        $null = docker-compose --version
        Print-Success "Docker and Docker Compose are installed"
    }
    catch {
        Print-Error "Docker or Docker Compose is not installed. Please install them first."
        exit 1
    }
}

# Initialize environment
function Init-Env {
    $envFile = Join-Path $ScriptDir ".env"
    $envExampleFile = Join-Path $ScriptDir ".env.example"
    
    if (-not (Test-Path $envFile)) {
        Print-Status "Creating .env from .env.example..."
        Copy-Item $envExampleFile $envFile
        Print-Success ".env file created"
    }
    else {
        Print-Status ".env file already exists"
    }
}

# Build images
function Build-Images {
    Print-Status "Building Docker images..."
    & docker-compose -f "$ScriptDir\docker-compose.yml" build
    Print-Success "Docker images built successfully"
}

function Start-Services {
    Print-Status "Starting services..."
    & docker-compose -f "$ScriptDir\docker-compose.yml" up -d
    Print-Success "Services started"
    
    Print-Status "Waiting for services to be ready..."
    Start-Sleep -Seconds 10
    
    Write-Host ""
    Write-Host "Access your application:" -ForegroundColor Cyan
    Write-Host "   Frontend:        http://localhost/" -ForegroundColor White
    Write-Host "   API:             http://localhost/api" -ForegroundColor White
    Write-Host "   FastAPI Docs:    http://localhost/docs" -ForegroundColor White
    Write-Host "   MinIO Console:   http://localhost:9001" -ForegroundColor White
    Write-Host ""
    Write-Host "Credentials:" -ForegroundColor Cyan
    Write-Host "   MinIO: minioadmin / minioadmin" -ForegroundColor White
    Write-Host ""
}

function Stop-Services {
    Print-Status "Stopping services..."
    & docker-compose -f "$ScriptDir\docker-compose.yml" down
    Print-Success "Services stopped"
}

function Show-Logs {
    & docker-compose -f "$ScriptDir\docker-compose.yml" logs -f
}

function Run-Tests {
    Print-Status "Running tests..."
    & docker-compose -f "$ScriptDir\docker-compose.yml" exec -T fastapi python -m pytest tests/ -v
    Print-Success "Tests completed"
}

function Cleanup {
    Print-Status "Removing containers and volumes..."
    & docker-compose -f "$ScriptDir\docker-compose.yml" down -v
    Print-Success "Cleanup completed"
}

# Main execution
Check-Docker

switch ($Action) {
    "init" {
        Init-Env
    }
    "build" {
        Init-Env
        Build-Images
    }
    "up" {
        Init-Env
        Build-Images
        Start-Services
    }
    "down" {
        Stop-Services
    }
    "logs" {
        Show-Logs
    }
    "test" {
        Run-Tests
    }
    "clean" {
        Cleanup
    }
}

Print-Success "Done!"

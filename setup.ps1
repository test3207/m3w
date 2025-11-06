#!/usr/bin/env pwsh
# Cross-platform setup script for M3W project
# Works on Windows (PowerShell), Linux, and macOS

param(
    [switch]$UseDockerHub,
    [switch]$SkipEnv,
    [switch]$Help
)

function Show-Help {
    Write-Host @"
M3W Project Setup Script
========================

Usage: ./setup.ps1 [options]

Options:
  -UseDockerHub    Use Docker Hub images instead of GHCR (requires proxy in China)
  -SkipEnv        Skip environment variable setup
  -Help           Show this help message

Examples:
  ./setup.ps1                    # Default: Use GHCR images
  ./setup.ps1 -UseDockerHub      # Use Docker Hub images
  ./setup.ps1 -SkipEnv           # Skip .env.local setup

"@ -ForegroundColor Cyan
}

if ($Help) {
    Show-Help
    exit 0
}

Write-Host "🚀 M3W Project Setup" -ForegroundColor Green
Write-Host "===================" -ForegroundColor Green
Write-Host ""

# Detect OS (PowerShell 6+ has built-in readonly automatic variables)
# Note: $IsWindows, $IsLinux, $IsMacOS are built-in and readonly in PowerShell Core 6+
# PSScriptAnalyzer may show false warnings - these are safe to use (read-only, not assignment)
Write-Host "📋 Detected OS: " -NoNewline
if ($IsWindows) { Write-Host "Windows" -ForegroundColor Yellow }
elseif ($IsLinux) { Write-Host "Linux" -ForegroundColor Yellow }
elseif ($IsMacOS) { Write-Host "macOS" -ForegroundColor Yellow }
Write-Host ""

# Check prerequisites
Write-Host "🔍 Checking prerequisites..." -ForegroundColor Cyan

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "  ✓ Node.js: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ Node.js not found. Please install Node.js 20+" -ForegroundColor Red
    exit 1
}

# Check npm
try {
    $npmVersion = npm --version
    Write-Host "  ✓ npm: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "  ✗ npm not found" -ForegroundColor Red
    exit 1
}

# Check Podman or Docker
$containerTool = $null
try {
    podman --version | Out-Null
    $containerTool = "podman"
    Write-Host "  ✓ Podman detected" -ForegroundColor Green
    
    # Check podman-compose
    try {
        podman-compose --version | Out-Null
        Write-Host "  ✓ podman-compose detected" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ podman-compose not found" -ForegroundColor Red
        Write-Host "    Please install: pip install podman-compose" -ForegroundColor Yellow
        exit 1
    }
    
    # Check Podman Machine (Windows/macOS)
    if ($IsWindows -or $IsMacOS) {
        $machineStatus = podman machine list 2>&1
        if ($machineStatus -match "Currently running") {
            Write-Host "  ✓ Podman Machine is running" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️  Podman Machine not running" -ForegroundColor Yellow
            Write-Host "    Starting Podman Machine..." -ForegroundColor Gray
            podman machine start
            if ($LASTEXITCODE -ne 0) {
                Write-Host "  ✗ Failed to start Podman Machine" -ForegroundColor Red
                exit 1
            }
            Write-Host "  ✓ Podman Machine started" -ForegroundColor Green
        }
    }
} catch {
    try {
        docker --version | Out-Null
        $containerTool = "docker"
        Write-Host "  ✓ Docker detected" -ForegroundColor Green
    } catch {
        Write-Host "  ✗ Neither Podman nor Docker found" -ForegroundColor Red
        Write-Host "    Please install Podman Desktop: https://podman-desktop.io/" -ForegroundColor Yellow
        Write-Host "    Then run: pip install podman-compose" -ForegroundColor Yellow
        exit 1
    }
}

Write-Host ""

# Install dependencies
Write-Host "📦 Installing npm dependencies..." -ForegroundColor Cyan
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ npm install failed" -ForegroundColor Red
    exit 1
}
Write-Host "  ✓ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Setup environment variables
if (-not $SkipEnv) {
    Write-Host "🔐 Setting up environment variables..." -ForegroundColor Cyan
    if (-not (Test-Path ".env.local")) {
        Copy-Item ".env.example" ".env.local"
        Write-Host "  ✓ Created .env.local from template" -ForegroundColor Green
        Write-Host "  ⚠️  Please edit .env.local and add your GitHub OAuth credentials" -ForegroundColor Yellow
        Write-Host "     Visit: https://github.com/settings/developers" -ForegroundColor Gray
    } else {
        Write-Host "  ℹ️  .env.local already exists" -ForegroundColor Blue
    }
    Write-Host ""
}

# Select compose file
$composeFile = "docker-compose.yml"
if ($UseDockerHub) {
    $composeFile = "docker-compose.dockerhub.yml"
    Write-Host "  Using Docker Hub images" -ForegroundColor Yellow
} else {
    Write-Host "  Using GHCR images (better for China)" -ForegroundColor Green
}
Write-Host ""

# Start containers
Write-Host "🐳 Starting containers..." -ForegroundColor Cyan
if ($containerTool -eq "podman") {
    podman-compose -f $composeFile up -d
} else {
    docker-compose -f $composeFile up -d
}

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ✗ Failed to start containers" -ForegroundColor Red
    Write-Host "  💡 Tip: Check if ports 5432 or 6379 are already in use" -ForegroundColor Yellow
    exit 1
}
Write-Host "  ✓ Containers started" -ForegroundColor Green
Write-Host ""

# Wait for database
Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Cyan
$maxAttempts = 30
$attempt = 0
while ($attempt -lt $maxAttempts) {
    try {
        if ($containerTool -eq "podman") {
            podman exec m3w-postgres pg_isready -U postgres 2>&1 | Out-Null
        } else {
            docker exec m3w-postgres pg_isready -U postgres 2>&1 | Out-Null
        }
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✓ PostgreSQL is ready" -ForegroundColor Green
            break
        }
    } catch {}
    $attempt++
    Start-Sleep -Seconds 1
}

if ($attempt -eq $maxAttempts) {
    Write-Host "  ✗ PostgreSQL failed to start" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Run Prisma migrations
Write-Host "🗄️  Running database migrations..." -ForegroundColor Cyan
npx prisma generate
npx prisma migrate dev --name init
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ⚠️  Migration failed - this is normal for first run" -ForegroundColor Yellow
} else {
    Write-Host "  ✓ Migrations completed" -ForegroundColor Green
}
Write-Host ""

# Success message
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Edit .env.local and add GitHub OAuth credentials" -ForegroundColor White
Write-Host "  2. Run: npm run dev" -ForegroundColor White
Write-Host "  3. Visit: http://localhost:3000" -ForegroundColor White
Write-Host ""
Write-Host "Useful commands:" -ForegroundColor Cyan
Write-Host "  npm run dev              - Start development server" -ForegroundColor White
Write-Host "  npm run db:studio        - Open Prisma Studio" -ForegroundColor White
Write-Host "  npm run podman:down      - Stop containers" -ForegroundColor White
Write-Host "  npm run podman:logs      - View container logs" -ForegroundColor White
Write-Host ""

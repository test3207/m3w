# Docker Build Script (PowerShell Wrapper)
# Builds all artifacts inside a Linux container for consistent cross-platform results
#
# Usage:
#   .\scripts\docker-build.ps1              # Build artifacts to docker-build-output/
#   .\scripts\docker-build.ps1 -BuildImage  # Build artifacts and Docker image
#
# This script:
# 1. Runs the shell script inside a container (isolated from host node_modules)
# 2. Outputs build artifacts to docker-build-output/
# 3. Optionally builds Docker images

param(
    [switch]$BuildImage,
    [string]$ImageTag = "m3w:local"
)

$ErrorActionPreference = "Stop"

Write-Host "🐳 M3W Docker Build" -ForegroundColor Cyan
Write-Host "===================" -ForegroundColor Cyan

# Ensure we're in the project root
$projectRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $projectRoot

# Read NODE_IMAGE from docker/docker-version.conf (single source of truth)
$dockerVersionFile = Join-Path $projectRoot "docker/docker-version.conf"
$NodeImage = "node:25.2.1-alpine"  # fallback
if (Test-Path $dockerVersionFile) {
    $content = Get-Content $dockerVersionFile | Where-Object { $_ -match "^NODE_IMAGE=" }
    if ($content) {
        $NodeImage = ($content -split "=", 2)[1].Trim()
    }
}

# Create output directory
$outputDir = Join-Path $projectRoot "docker-build-output"
if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Write-Host ""
Write-Host "📦 Step 1: Building artifacts in container..." -ForegroundColor Yellow
Write-Host "   Using image: $NodeImage" -ForegroundColor Gray

# Run build script in container
# Source is mounted read-only, output goes to docker-build-output/
$cmd = "podman run --rm " +
       "-v `"${projectRoot}:/app:ro`" " +
       "-v `"${outputDir}:/output`" " +
       "$NodeImage " +
       "sh -c `"mkdir -p /build && sh /app/scripts/docker-build.sh`""

Invoke-Expression $cmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Artifacts built successfully!" -ForegroundColor Green
Write-Host "   Output: $outputDir" -ForegroundColor Gray

# Copy output to project root for Docker build
Write-Host ""
Write-Host "📋 Step 2: Copying artifacts to project root..." -ForegroundColor Yellow

# Copy shared
if (Test-Path "$outputDir/shared/dist") {
    Copy-Item -Path "$outputDir/shared/dist" -Destination "shared/" -Recurse -Force
    Copy-Item -Path "$outputDir/shared/package.json" -Destination "shared/" -Force
}

# Copy backend  
if (Test-Path "$outputDir/backend/dist") {
    Copy-Item -Path "$outputDir/backend/dist" -Destination "backend/" -Recurse -Force
    # For node_modules, remove existing and copy new (Linux binaries)
    if (Test-Path "backend/node_modules.linux") {
        Remove-Item -Path "backend/node_modules.linux" -Recurse -Force
    }
    # Don't overwrite Windows node_modules, save Linux version separately
    Copy-Item -Path "$outputDir/backend/node_modules" -Destination "backend/node_modules.linux" -Recurse -Force
}

# Copy frontend
if (Test-Path "$outputDir/frontend/dist") {
    Copy-Item -Path "$outputDir/frontend/dist" -Destination "frontend/" -Recurse -Force
}

Write-Host "✅ Artifacts copied!" -ForegroundColor Green

if ($BuildImage) {
    Write-Host ""
    Write-Host "🐳 Step 3: Building Docker image..." -ForegroundColor Yellow
    
    # For Docker build, we need Linux node_modules in the right place
    # Temporarily swap node_modules
    $backendDir = Join-Path $projectRoot "backend"
    $windowsModules = Join-Path $backendDir "node_modules"
    $linuxModules = Join-Path $backendDir "node_modules.linux"
    $backupModules = Join-Path $backendDir "node_modules.windows"
    
    $swapped = $false
    if ((Test-Path $windowsModules) -and (Test-Path $linuxModules)) {
        Write-Host "   Swapping node_modules for build..." -ForegroundColor Gray
        Rename-Item -Path $windowsModules -NewName "node_modules.windows"
        Rename-Item -Path $linuxModules -NewName "node_modules"
        $swapped = $true
    }
    
    try {
        podman build -f docker/Dockerfile -t $ImageTag .
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Docker image built: $ImageTag" -ForegroundColor Green
        } else {
            Write-Host "❌ Docker build failed!" -ForegroundColor Red
        }
    }
    finally {
        # Restore node_modules
        if ($swapped) {
            Write-Host "   Restoring node_modules..." -ForegroundColor Gray
            Rename-Item -Path $windowsModules -NewName "node_modules.linux"
            Rename-Item -Path $backupModules -NewName "node_modules"
        }
    }
}

Write-Host ""
Write-Host "🎉 Done!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan

if (!$BuildImage) {
    Write-Host "  Build Docker image:" -ForegroundColor White
    Write-Host "    .\scripts\docker-build.ps1 -BuildImage" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  Or manually:" -ForegroundColor White
    Write-Host "    # Swap node_modules first (Linux binaries needed)" -ForegroundColor Gray
    Write-Host "    mv backend/node_modules backend/node_modules.windows" -ForegroundColor Yellow
    Write-Host "    mv backend/node_modules.linux backend/node_modules" -ForegroundColor Yellow
    Write-Host "    podman build -f docker/Dockerfile -t m3w:local ." -ForegroundColor Yellow
    Write-Host "    # Restore after build" -ForegroundColor Gray
    Write-Host "    mv backend/node_modules backend/node_modules.linux" -ForegroundColor Yellow
    Write-Host "    mv backend/node_modules.windows backend/node_modules" -ForegroundColor Yellow
} else {
    Write-Host "  Run the container:" -ForegroundColor White
    Write-Host "    podman run -d --name m3w -p 4000:4000 --env-file backend/.env.docker $ImageTag" -ForegroundColor Yellow
}

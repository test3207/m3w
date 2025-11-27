# Docker Image Build Script for Windows
# 
# This script:
# 1. Builds artifacts in a Linux container (cross-platform compatible)
# 2. Builds Docker images from the artifacts
# 3. Optionally tests the built images
#
# Usage:
#   .\scripts\build-docker.ps1 -Type prod              # Production build
#   .\scripts\build-docker.ps1 -Type rc -RcNumber 1    # RC build
#   .\scripts\build-docker.ps1 -Type prod -Push        # Build and push
#   .\scripts\build-docker.ps1 -Type prod -Test        # Build and test AIO image
#   .\scripts\build-docker.ps1 -Type prod -SkipArtifacts  # Skip artifact build

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("rc", "prod")]
    [string]$Type,
    
    [Parameter(Mandatory=$false)]
    [int]$RcNumber = 1,
    
    [Parameter(Mandatory=$false)]
    [string]$Registry = "ghcr.io/test3207",
    
    [Parameter(Mandatory=$false)]
    [switch]$Push,
    
    [Parameter(Mandatory=$false)]
    [switch]$Test,
    
    [Parameter(Mandatory=$false)]
    [switch]$SkipArtifacts
)

$ErrorActionPreference = "Stop"

# Paths
$ProjectRoot = (Get-Item $PSScriptRoot).Parent.FullName
$OutputDir = Join-Path $ProjectRoot "docker-build-output"

# Read version from package.json
$packageJson = Get-Content (Join-Path $ProjectRoot "package.json") | ConvertFrom-Json
$baseVersion = $packageJson.version

# Build version string and tags
if ($Type -eq "rc") {
    $version = "v${baseVersion}-rc.${RcNumber}"
    $additionalTags = @("rc")
} else {
    $version = "v${baseVersion}"
    $minorVersion = $baseVersion -replace '\.\d+$', ''
    $majorVersion = $baseVersion -replace '\.\d+\.\d+$', ''
    $additionalTags = @("v${minorVersion}", "v${majorVersion}", "latest")
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  M3W Docker Build Script (Windows)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Version:  $version" -ForegroundColor Green
Write-Host "  Type:     $Type" -ForegroundColor Green
Write-Host "  Registry: $Registry" -ForegroundColor Green
Write-Host ""

# ============================================
# Step 1: Build artifacts in container
# ============================================
if (-not $SkipArtifacts) {
    Write-Host "📦 Step 1: Building artifacts in Linux container..." -ForegroundColor Yellow
    Write-Host ""
    
    # Clean output directory
    if (Test-Path $OutputDir) {
        Remove-Item -Recurse -Force $OutputDir
    }
    New-Item -ItemType Directory -Path $OutputDir | Out-Null
    
    # Determine build target based on type
    $buildTarget = if ($Type -eq "rc") { "rc" } else { "prod" }
    
    # Run build in container
    Write-Host "   Running container build (BUILD_TARGET=$buildTarget)..." -ForegroundColor Gray
    
    podman run --rm `
        -v "${ProjectRoot}:/app:ro" `
        -v "${OutputDir}:/output" `
        -e "BUILD_TARGET=$buildTarget" `
        node:25.2.1-alpine `
        sh -c "mkdir -p /build && sh /app/scripts/docker-build.sh"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Artifact build failed!" -ForegroundColor Red
        exit 1
    }
    
    Write-Host ""
    Write-Host "✅ Artifacts built successfully" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "⏭️  Skipping artifact build (-SkipArtifacts)" -ForegroundColor Yellow
    Write-Host ""
    
    if (-not (Test-Path $OutputDir)) {
        Write-Host "❌ Output directory not found: $OutputDir" -ForegroundColor Red
        Write-Host "   Run without -SkipArtifacts first" -ForegroundColor Red
        exit 1
    }
}

# ============================================
# Step 2: Build Docker images
# ============================================
Write-Host "🐳 Step 2: Building Docker images..." -ForegroundColor Yellow
Write-Host ""

# All tags for this version
$allTags = @($version) + $additionalTags

# Function to build image with tags
function Build-DockerImage {
    param(
        [string]$Name,
        [string]$Dockerfile
    )
    
    Write-Host "  Building $Name..." -ForegroundColor Cyan
    
    $tagArgs = @()
    foreach ($tag in $allTags) {
        $tagArgs += "-t"
        $tagArgs += "${Registry}/${Name}:${tag}"
    }
    
    $dockerfilePath = Join-Path $ProjectRoot $Dockerfile
    
    # Build from output directory
    podman build @tagArgs -f $dockerfilePath $OutputDir
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to build $Name" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "  ✅ $Name built" -ForegroundColor Green
}

# Build all images
Build-DockerImage -Name "m3w" -Dockerfile "docker/Dockerfile"
Build-DockerImage -Name "m3w-backend" -Dockerfile "docker/Dockerfile.backend"
Build-DockerImage -Name "m3w-frontend" -Dockerfile "docker/Dockerfile.frontend"

Write-Host ""
Write-Host "✅ All images built successfully" -ForegroundColor Green

# ============================================
# Step 3: Show results
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Build Results" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Show image sizes
Write-Host "📊 Image sizes:" -ForegroundColor Yellow
podman images --filter "reference=${Registry}/m3w*" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}" | Select-Object -First 12

Write-Host ""
Write-Host "📋 Built tags:" -ForegroundColor Yellow
foreach ($img in @("m3w", "m3w-backend", "m3w-frontend")) {
    Write-Host "  ${Registry}/${img}: $($allTags -join ', ')" -ForegroundColor Gray
}

# ============================================
# Step 4: Push (optional)
# ============================================
if ($Push) {
    Write-Host ""
    Write-Host "🚀 Pushing images to registry..." -ForegroundColor Yellow
    Write-Host ""
    
    foreach ($img in @("m3w", "m3w-backend", "m3w-frontend")) {
        foreach ($tag in $allTags) {
            Write-Host "  Pushing ${Registry}/${img}:${tag}..." -ForegroundColor Gray
            podman push "${Registry}/${img}:${tag}"
            if ($LASTEXITCODE -ne 0) {
                Write-Host "❌ Failed to push ${img}:${tag}" -ForegroundColor Red
                exit 1
            }
        }
    }
    
    Write-Host ""
    Write-Host "✅ All images pushed" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "💡 To push: .\scripts\build-docker.ps1 -Type $Type -Push" -ForegroundColor Yellow
}

# ============================================
# Step 5: Test (optional)
# ============================================
if ($Test) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Testing AIO Image" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Check prerequisites
    $envDockerFile = Join-Path $ProjectRoot "backend\.env.docker"
    if (-not (Test-Path $envDockerFile)) {
        Write-Host "⚠️  backend/.env.docker not found" -ForegroundColor Yellow
        
        $envDockerExample = Join-Path $ProjectRoot "backend\.env.docker.example"
        $envFile = Join-Path $ProjectRoot "backend\.env"
        
        if (Test-Path $envFile) {
            Write-Host "   Creating from backend/.env..." -ForegroundColor Gray
            # Copy from .env and update endpoints for Docker network
            $envContent = Get-Content $envFile -Raw
            $envContent = $envContent -replace 'DATABASE_URL=postgresql://[^@]+@localhost:', 'DATABASE_URL=postgresql://postgres:postgres@m3w-postgres:'
            $envContent = $envContent -replace 'MINIO_ENDPOINT=localhost', 'MINIO_ENDPOINT=m3w-minio'
            $envContent = $envContent -replace 'CORS_ORIGIN=http://localhost:3000', 'CORS_ORIGIN=http://localhost:4000'
            $envContent | Set-Content $envDockerFile
            Write-Host "   ✅ Created with Docker network settings" -ForegroundColor Green
        } elseif (Test-Path $envDockerExample) {
            Write-Host "   Creating from .env.docker.example..." -ForegroundColor Gray
            Copy-Item $envDockerExample $envDockerFile
            Write-Host "   ✅ Created from template" -ForegroundColor Green
            Write-Host "   ⚠️  Please update GitHub OAuth credentials in backend/.env.docker" -ForegroundColor Yellow
        } else {
            Write-Host "❌ Neither .env nor .env.docker.example found" -ForegroundColor Red
            exit 1
        }
    }
    
    # Check if m3w_default network exists
    $networkExists = podman network ls --format "{{.Name}}" | Select-String -Pattern "^m3w_default$"
    if (-not $networkExists) {
        Write-Host "⚠️  Docker network 'm3w_default' not found" -ForegroundColor Yellow
        Write-Host "   Starting PostgreSQL and MinIO with docker-compose..." -ForegroundColor Gray
        
        Push-Location $ProjectRoot
        podman-compose up -d
        Pop-Location
        
        Start-Sleep -Seconds 5
    }
    
    # Stop existing test container
    $existingContainer = podman ps -a --filter "name=m3w-test" --format "{{.Names}}"
    if ($existingContainer) {
        Write-Host "   Stopping existing test container..." -ForegroundColor Gray
        podman stop m3w-test 2>$null
        podman rm m3w-test 2>$null
    }
    
    # Start test container using docker-compose.test.yml
    Write-Host ""
    Write-Host "🚀 Starting AIO container..." -ForegroundColor Yellow
    
    $testComposeFile = Join-Path $ProjectRoot "docker\docker-compose.test.yml"
    $env:M3W_IMAGE = "${Registry}/m3w:${version}"
    
    Push-Location $ProjectRoot
    podman-compose -f $testComposeFile up -d
    Pop-Location
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Failed to start test container" -ForegroundColor Red
        exit 1
    }
    
    # Wait for container to be ready
    Write-Host "   Waiting for container to be ready..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
    
    # Health check
    Write-Host ""
    Write-Host "🔍 Running health checks..." -ForegroundColor Yellow
    
    $maxRetries = 10
    $retryCount = 0
    $healthy = $false
    
    while ($retryCount -lt $maxRetries -and -not $healthy) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:4000/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($response.StatusCode -eq 200) {
                $healthy = $true
            }
        } catch {
            $retryCount++
            if ($retryCount -lt $maxRetries) {
                Write-Host "   Retry $retryCount/$maxRetries..." -ForegroundColor Gray
                Start-Sleep -Seconds 2
            }
        }
    }
    
    if ($healthy) {
        Write-Host "   ✅ API health check passed" -ForegroundColor Green
        
        # Test frontend
        try {
            $frontendResponse = Invoke-WebRequest -Uri "http://localhost:4000/" -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
            if ($frontendResponse.StatusCode -eq 200 -and $frontendResponse.Content -match "<!DOCTYPE html>") {
                Write-Host "   ✅ Frontend serving correctly" -ForegroundColor Green
            }
        } catch {
            Write-Host "   ⚠️  Frontend check failed" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  Test Passed! 🎉" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "  AIO container running at: http://localhost:4000" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Commands:" -ForegroundColor Gray
        Write-Host "    View logs:  podman logs -f m3w-test" -ForegroundColor Gray
        Write-Host "    Stop:       podman-compose -f docker/docker-compose.test.yml down" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host "   ❌ Health check failed after $maxRetries retries" -ForegroundColor Red
        Write-Host ""
        Write-Host "   Container logs:" -ForegroundColor Yellow
        podman logs m3w-test 2>&1 | Select-Object -Last 30
        exit 1
    }
}

Write-Host ""
Write-Host "✨ Done!" -ForegroundColor Green
Write-Host ""

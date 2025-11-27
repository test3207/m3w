# Docker Image Build Script for Windows
# 
# This script:
# 1. Builds artifacts in a Linux container (cross-platform compatible)
# 2. Builds Docker images from the artifacts
#
# Usage:
#   .\scripts\build-docker.ps1 -Type prod              # Production build
#   .\scripts\build-docker.ps1 -Type rc -RcNumber 1    # RC build
#   .\scripts\build-docker.ps1 -Type prod -Push        # Build and push
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
    
    # Run build in container
    Write-Host "   Running container build..." -ForegroundColor Gray
    
    podman run --rm `
        -v "${ProjectRoot}:/app:ro" `
        -v "${OutputDir}:/output" `
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

Write-Host ""
Write-Host "✨ Done!" -ForegroundColor Green
Write-Host ""

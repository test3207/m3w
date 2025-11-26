# Docker Image Build Script
# Usage: .\scripts\build-docker.ps1 -Type rc -RcNumber 1
# Usage: .\scripts\build-docker.ps1 -Type prod

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("rc", "prod")]
    [string]$Type,
    
    [Parameter(Mandatory=$false)]
    [int]$RcNumber = 1,
    
    [Parameter(Mandatory=$false)]
    [string]$Registry = "ghcr.io/test3207"
)

# Read version from package.json
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$baseVersion = $packageJson.version

# Build version string and tags
if ($Type -eq "rc") {
    $version = "v${baseVersion}-rc.${RcNumber}"
    $buildTarget = "rc"
    # RC build: only update 'rc' tag, not 'latest'
    $additionalTags = @("rc")
} else {
    $version = "v${baseVersion}"
    $buildTarget = "prod"
    # Production build: update 'latest' and version tags
    $minorVersion = $baseVersion -replace '\.\d+$', ''  # 0.1.0 -> 0.1
    $majorVersion = $baseVersion -replace '\.\d+\.\d+$', ''  # 0.1.0 -> 0
    $additionalTags = @("v${minorVersion}", "v${majorVersion}", "latest")
}

Write-Host "🔨 Building M3W Docker Images" -ForegroundColor Cyan
Write-Host "   Version: $version" -ForegroundColor Green
Write-Host "   Type: $Type" -ForegroundColor Green
Write-Host "   Registry: $Registry" -ForegroundColor Green
Write-Host ""

# 1. Build All-in-One image
Write-Host "📦 Building All-in-One image..." -ForegroundColor Yellow

# Build main version tag
$buildCmd = "podman build -t `"${Registry}/m3w:${version}`""

# Add additional tags
foreach ($tag in $additionalTags) {
    $buildCmd += " -t `"${Registry}/m3w:${tag}`""
}

$buildCmd += " -f docker/Dockerfile --build-arg BUILD_TARGET=$buildTarget ."

# Execute build
Invoke-Expression $buildCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ All-in-One build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ All-in-One image built successfully" -ForegroundColor Green
Write-Host ""

# 2. Build Backend-only image
Write-Host "📦 Building Backend-only image..." -ForegroundColor Yellow

# Build main version tag
$buildCmd = "podman build -t `"${Registry}/m3w-backend:${version}`""

# Add additional tags
foreach ($tag in $additionalTags) {
    $buildCmd += " -t `"${Registry}/m3w-backend:${tag}`""
}

$buildCmd += " -f docker/Dockerfile.backend --build-arg BUILD_TARGET=$buildTarget ."

# Execute build
Invoke-Expression $buildCmd

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Backend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Backend image built successfully" -ForegroundColor Green
Write-Host ""

# 3. Build frontend static files
Write-Host "📦 Building Frontend static files..." -ForegroundColor Yellow
Push-Location frontend
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Compress frontend dist directory
$frontendArchive = "m3w-frontend-${version}.tar.gz"
tar -czf $frontendArchive -C frontend/dist .
Write-Host "✅ Frontend archive created: $frontendArchive" -ForegroundColor Green
Write-Host ""

# Display build results
Write-Host "🎉 Build completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Built images:" -ForegroundColor Cyan
Write-Host "   All-in-One:" -ForegroundColor White
Write-Host "     - ${Registry}/m3w:${version}" -ForegroundColor Gray
foreach ($tag in $additionalTags) {
    Write-Host "     - ${Registry}/m3w:${tag}" -ForegroundColor Gray
}
Write-Host ""
Write-Host "   Backend-only:" -ForegroundColor White
Write-Host "     - ${Registry}/m3w-backend:${version}" -ForegroundColor Gray
foreach ($tag in $additionalTags) {
    Write-Host "     - ${Registry}/m3w-backend:${tag}" -ForegroundColor Gray
}
Write-Host ""
Write-Host "📦 Frontend archive:" -ForegroundColor Cyan
Write-Host "   - $frontendArchive" -ForegroundColor White
Write-Host ""

# Ask whether to push
$push = Read-Host "Push images to registry? (y/N)"
if ($push -eq "y" -or $push -eq "Y") {
    Write-Host ""
    Write-Host "🚀 Pushing images..." -ForegroundColor Yellow
    
    # Push all tags
    podman push "${Registry}/m3w:${version}"
    foreach ($tag in $additionalTags) {
        podman push "${Registry}/m3w:${tag}"
    }
    
    podman push "${Registry}/m3w-backend:${version}"
    foreach ($tag in $additionalTags) {
        podman push "${Registry}/m3w-backend:${tag}"
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Images pushed successfully!" -ForegroundColor Green
        
        # For Production builds, prompt to update version
        if ($Type -eq "prod") {
            Write-Host ""
            Write-Host "📌 Next steps:" -ForegroundColor Cyan
            Write-Host "   1. Bump version for next release:" -ForegroundColor White
            Write-Host "      .\scripts\bump-version.ps1 -Type patch|minor|major" -ForegroundColor Yellow
            Write-Host "   2. Push the version commit:" -ForegroundColor White
            Write-Host "      git push" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Push failed!" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host ""
    Write-Host "⏭️  Skipping push. Images are only local." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To push manually:" -ForegroundColor Cyan
    Write-Host "   podman push ${Registry}/m3w:${version}" -ForegroundColor White
    Write-Host "   podman push ${Registry}/m3w-backend:${version}" -ForegroundColor White
}

Write-Host ""
Write-Host "✨ Done!" -ForegroundColor Green

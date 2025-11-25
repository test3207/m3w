# Version Bump Script
# Usage: .\scripts\bump-version.ps1 -Type patch|minor|major

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("patch", "minor", "major")]
    [string]$Type
)

# Read current version
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$currentVersion = $packageJson.version

Write-Host "📦 Current version: v$currentVersion" -ForegroundColor Cyan

# Parse version number
if ($currentVersion -match '^(\d+)\.(\d+)\.(\d+)$') {
    $major = [int]$matches[1]
    $minor = [int]$matches[2]
    $patch = [int]$matches[3]
} else {
    Write-Host "❌ Invalid version format: $currentVersion" -ForegroundColor Red
    exit 1
}

# Calculate new version
switch ($Type) {
    "patch" {
        $patch++
        $newVersion = "$major.$minor.$patch"
    }
    "minor" {
        $minor++
        $patch = 0
        $newVersion = "$major.$minor.$patch"
    }
    "major" {
        $major++
        $minor = 0
        $patch = 0
        $newVersion = "$major.$minor.$patch"
    }
}

Write-Host "🆕 New version: v$newVersion" -ForegroundColor Green
Write-Host ""

# Confirm
$confirm = Read-Host "Update package.json to v$newVersion? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "❌ Aborted" -ForegroundColor Yellow
    exit 0
}

# Update package.json
$packageJson.version = $newVersion
$packageJson | ConvertTo-Json -Depth 100 | Set-Content "package.json"

# Update frontend/package.json
$frontendPackageJson = Get-Content "frontend/package.json" | ConvertFrom-Json
$frontendPackageJson.version = $newVersion
$frontendPackageJson | ConvertTo-Json -Depth 100 | Set-Content "frontend/package.json"

# Update backend/package.json
$backendPackageJson = Get-Content "backend/package.json" | ConvertFrom-Json
$backendPackageJson.version = $newVersion
$backendPackageJson | ConvertTo-Json -Depth 100 | Set-Content "backend/package.json"

# Update shared/package.json
$sharedPackageJson = Get-Content "shared/package.json" | ConvertFrom-Json
$sharedPackageJson.version = $newVersion
$sharedPackageJson | ConvertTo-Json -Depth 100 | Set-Content "shared/package.json"

Write-Host "✅ Updated package.json files" -ForegroundColor Green
Write-Host ""

# Ask whether to create git commit
$commit = Read-Host "Create git commit? (y/N)"
if ($commit -eq "y" -or $commit -eq "Y") {
    git add package.json frontend/package.json backend/package.json shared/package.json
    git commit -m "chore: bump version to v$newVersion"
    
    Write-Host "✅ Committed version bump" -ForegroundColor Green
    Write-Host ""
    Write-Host "📌 Next steps:" -ForegroundColor Cyan
    Write-Host "   1. Review the commit: git log -1" -ForegroundColor White
    Write-Host "   2. Push to remote: git push" -ForegroundColor White
} else {
    Write-Host "⏭️  Skipped git commit" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "📌 Remember to commit manually:" -ForegroundColor Cyan
    Write-Host "   git add package.json frontend/package.json backend/package.json shared/package.json" -ForegroundColor White
    Write-Host "   git commit -m `"chore: bump version to v$newVersion`"" -ForegroundColor White
}

Write-Host ""
Write-Host "✨ Done! Version bumped from v$currentVersion to v$newVersion" -ForegroundColor Green

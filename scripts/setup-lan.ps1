#!/usr/bin/env pwsh
# M3W LAN Access Setup Script
# Configures the application for local area network access

param(
    [switch]$SkipFirewall,
    [string]$CustomIP
)

Write-Host "=== M3W LAN Access Setup ===" -ForegroundColor Cyan
Write-Host ""

# Get local IP address
Write-Host "🔍 Detecting local IP address..." -ForegroundColor Yellow

$localIP = $CustomIP
if (-not $localIP) {
    $ipAddresses = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*"
    }
    
    if ($ipAddresses.Count -eq 0) {
        Write-Host "❌ No local IP address found!" -ForegroundColor Red
        Write-Host "   Please run with -CustomIP parameter" -ForegroundColor Yellow
        exit 1
    }
    
    if ($ipAddresses.Count -gt 1) {
        Write-Host "   Multiple IP addresses found:" -ForegroundColor Yellow
        for ($i = 0; $i -lt $ipAddresses.Count; $i++) {
            Write-Host "   [$i] $($ipAddresses[$i].IPAddress) (Interface: $($ipAddresses[$i].InterfaceAlias))"
        }
        $selection = Read-Host "   Select IP address [0]"
        if ([string]::IsNullOrWhiteSpace($selection)) {
            $selection = "0"
        }
        $localIP = $ipAddresses[[int]$selection].IPAddress
    } else {
        $localIP = $ipAddresses[0].IPAddress
    }
}

Write-Host "✅ Using IP address: $localIP" -ForegroundColor Green
Write-Host ""

# Update backend .env
Write-Host "📝 Updating backend/.env..." -ForegroundColor Yellow

$backendEnvPath = Join-Path $PSScriptRoot "backend\.env"

if (-not (Test-Path $backendEnvPath)) {
    Write-Host "   Creating backend/.env from .env.example..." -ForegroundColor Yellow
    $examplePath = Join-Path $PSScriptRoot "backend\.env.example"
    if (Test-Path $examplePath) {
        Copy-Item $examplePath $backendEnvPath
    } else {
        Write-Host "❌ backend/.env.example not found!" -ForegroundColor Red
        exit 1
    }
}

$backendEnv = Get-Content $backendEnvPath -Raw

# Update HOST
if ($backendEnv -match "HOST=.*") {
    $backendEnv = $backendEnv -replace "HOST=.*", "HOST=0.0.0.0"
} else {
    $backendEnv += "`nHOST=0.0.0.0"
}

# Update CORS_ORIGIN
if ($backendEnv -match "CORS_ORIGIN=.*") {
    $backendEnv = $backendEnv -replace "CORS_ORIGIN=.*", "CORS_ORIGIN=http://${localIP}:3000"
} else {
    $backendEnv += "`nCORS_ORIGIN=http://${localIP}:3000"
}

# Update API_BASE_URL
if ($backendEnv -match "API_BASE_URL=.*") {
    $backendEnv = $backendEnv -replace "API_BASE_URL=.*", "API_BASE_URL=http://${localIP}:4000"
} else {
    $backendEnv += "`nAPI_BASE_URL=http://${localIP}:4000"
}

# Update GITHUB_CALLBACK_URL
if ($backendEnv -match "GITHUB_CALLBACK_URL=.*") {
    $backendEnv = $backendEnv -replace "GITHUB_CALLBACK_URL=.*", "GITHUB_CALLBACK_URL=http://${localIP}:4000/api/auth/callback"
}

Set-Content $backendEnvPath $backendEnv -NoNewline

Write-Host "✅ Backend configuration updated" -ForegroundColor Green
Write-Host ""

# Update frontend .env
Write-Host "📝 Updating frontend/.env..." -ForegroundColor Yellow

$frontendEnvPath = Join-Path $PSScriptRoot "frontend\.env"

if (-not (Test-Path $frontendEnvPath)) {
    Write-Host "   Creating frontend/.env from .env.example..." -ForegroundColor Yellow
    $examplePath = Join-Path $PSScriptRoot "frontend\.env.example"
    if (Test-Path $examplePath) {
        Copy-Item $examplePath $frontendEnvPath
    } else {
        Write-Host "❌ frontend/.env.example not found!" -ForegroundColor Red
        exit 1
    }
}

$frontendEnv = Get-Content $frontendEnvPath -Raw

# Update VITE_API_URL
if ($frontendEnv -match "VITE_API_URL=.*") {
    $frontendEnv = $frontendEnv -replace "VITE_API_URL=.*", "VITE_API_URL=http://${localIP}:4000"
} else {
    $frontendEnv += "`nVITE_API_URL=http://${localIP}:4000"
}

Set-Content $frontendEnvPath $frontendEnv -NoNewline

Write-Host "✅ Frontend configuration updated" -ForegroundColor Green
Write-Host ""

# Configure firewall
if (-not $SkipFirewall) {
    Write-Host "🔥 Configuring Windows Firewall..." -ForegroundColor Yellow
    
    # Check if running as admin
    $isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    
    if ($isAdmin) {
        # Remove old rules if they exist
        $existingRules = Get-NetFirewallRule -DisplayName "M3W*" -ErrorAction SilentlyContinue
        if ($existingRules) {
            Write-Host "   Removing old firewall rules..." -ForegroundColor Yellow
            Remove-NetFirewallRule -DisplayName "M3W*"
        }
        
        # Add new rules
        Write-Host "   Adding firewall rules for ports 3000 and 4000..." -ForegroundColor Yellow
        
        New-NetFirewallRule -DisplayName "M3W Frontend (Vite)" `
            -Direction Inbound `
            -LocalPort 3000 `
            -Protocol TCP `
            -Action Allow `
            -Profile Any `
            -Description "Allow M3W frontend access on port 3000" | Out-Null
        
        New-NetFirewallRule -DisplayName "M3W Backend (Hono)" `
            -Direction Inbound `
            -LocalPort 4000 `
            -Protocol TCP `
            -Action Allow `
            -Profile Any `
            -Description "Allow M3W backend API access on port 4000" | Out-Null
        
        Write-Host "✅ Firewall rules configured" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Not running as administrator - skipping firewall configuration" -ForegroundColor Yellow
        Write-Host "   To configure firewall, run this script as administrator or use:" -ForegroundColor Yellow
        Write-Host "   New-NetFirewallRule -DisplayName 'M3W Frontend' -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow" -ForegroundColor Cyan
        Write-Host "   New-NetFirewallRule -DisplayName 'M3W Backend' -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow" -ForegroundColor Cyan
    }
} else {
    Write-Host "⏭️  Skipping firewall configuration (use -SkipFirewall:$false to enable)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Setup Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "📱 Access URLs:" -ForegroundColor Cyan
Write-Host "   Frontend: http://${localIP}:3000" -ForegroundColor White
Write-Host "   Backend:  http://${localIP}:4000" -ForegroundColor White
Write-Host "   Health:   http://${localIP}:4000/health" -ForegroundColor White
Write-Host ""
Write-Host "🚀 To start the services, run:" -ForegroundColor Cyan
Write-Host "   npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Yellow
Write-Host "   - Make sure Docker services are running (docker-compose up -d)" -ForegroundColor White
Write-Host "   - Test backend: curl http://${localIP}:4000/health" -ForegroundColor White
Write-Host "   - Check firewall: netstat -an | Select-String '3000|4000'" -ForegroundColor White
Write-Host "   - Full documentation: docs/LAN_ACCESS.md" -ForegroundColor White
Write-Host ""

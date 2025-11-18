# LAN Access Configuration Guide

## Overview

This guide explains how to expose M3W services to the local area network, allowing other devices on the same network to access them.

## Quick Start (Automated)

For quick setup, use the automated configuration script:

```powershell
# From project root directory
.\scripts\setup-lan.ps1

# Or with a custom IP address
.\scripts\setup-lan.ps1 -CustomIP "10.4.196.6"

# Skip firewall configuration (run manually as admin later)
.\scripts\setup-lan.ps1 -SkipFirewall
```

The script will automatically:

- Detect your LAN IP address (or use the provided one)
- Update `backend/.env` with correct HOST, CORS_ORIGIN, and callback URLs
- Update `frontend/.env` with correct API URL
- Configure Windows Firewall rules (if running as administrator)
- Display access URLs for testing

For manual configuration or troubleshooting, continue reading below.

## Configuration Steps

### 1. Get Your Local IP Address

Run in PowerShell:

```powershell
# Get local LAN IP address
Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*"}
```

Assume your IP address is `192.168.1.100`

### 2. Update Backend Environment Variables

Edit `backend/.env`:

```bash
# Server Configuration
PORT=4000
HOST=0.0.0.0  # Listen on all network interfaces

# CORS Configuration - Allow LAN access
CORS_ORIGIN=http://192.168.1.100:3000

# GitHub OAuth callback URL (if using GitHub login)
GITHUB_CALLBACK_URL=http://192.168.1.100:4000/api/auth/callback

# API Base URL
API_BASE_URL=http://192.168.1.100:4000
```

**Note**: If you need to support multiple client access, you can set `CORS_ORIGIN` to `*`, but only use this in development:

```bash
CORS_ORIGIN=*
```

### 3. Update Frontend Environment Variables

Edit `frontend/.env`:

```bash
# Use local LAN IP
VITE_API_URL=http://192.168.1.100:4000
```

### 4. Frontend Vite Configuration

`frontend/vite.config.ts` is already configured to listen on all network interfaces:

```typescript
server: {
  host: '0.0.0.0', // ✅ Already configured
  port: 3000,
  open: true,
}
```

### 5. Firewall Configuration

#### Windows Firewall

You need to allow the following ports:

- **3000**: Vite frontend service
- **4000**: Hono backend API
- **5432**: PostgreSQL (if you need to access database from other machines)
- **9000**: MinIO (if direct access is needed)

#### Method 1: Using PowerShell (Administrator privileges required)

```powershell
# Allow Vite (3000)
New-NetFirewallRule -DisplayName "M3W Frontend" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow

# Allow Hono (4000)
New-NetFirewallRule -DisplayName "M3W Backend" -Direction Inbound -LocalPort 4000 -Protocol TCP -Action Allow
```

#### Method 2: Using GUI

1. Open `Windows Defender Firewall`
2. Click `Advanced Settings`
3. Select `Inbound Rules` → `New Rule`
4. Select `Port` → `TCP` → Enter port numbers `3000, 4000`
5. Select `Allow the connection`
6. Apply to all profiles
7. Name the rule "M3W Development"

### 6. Start Services

```powershell
# In project root directory
npm run dev
```

### 7. Access Services

#### From Local Machine

- Frontend: <http://localhost:3000>
- Backend: <http://localhost:4000>

#### From Other Devices on LAN

- Frontend: <http://192.168.1.100:3000>
- Backend: <http://192.168.1.100:4000>

## Testing Connection

### Test Backend API

Access from another device's browser:

```Text
http://192.168.1.100:4000/health
```

Should return:

```json
{
  "status": "ok",
  "timestamp": "2025-11-12T...",
  "uptime": 123.45
}
```

### Test Frontend

Access from another device's browser:

```Text
http://192.168.1.100:3000
```

You should see the M3W login page.

## Troubleshooting

### Issue 1: Cannot Connect to Service

**Checklist**:

1. ✅ Firewall rules added
2. ✅ Services are running (`npm run dev`)
3. ✅ IP address is correct (check with `ipconfig` or `Get-NetIPAddress`)
4. ✅ Client and server are on the same network
5. ✅ CORS_ORIGIN is configured correctly

**Debug commands**:

```powershell
# Check if ports are listening
netstat -an | Select-String "3000|4000"

# Should see output like:
# TCP    0.0.0.0:3000           0.0.0.0:0              LISTENING
# TCP    0.0.0.0:4000           0.0.0.0:0              LISTENING
```

### Issue 2: CORS Error

If frontend cannot call backend API, check:

1. Is `CORS_ORIGIN` in `backend/.env` set to include frontend address
2. Does browser console show CORS errors

**Temporary solution** (development only):

```bash
# backend/.env
CORS_ORIGIN=*
```

### Issue 3: GitHub OAuth Failure

GitHub OAuth callback URL must match the actual access address:

- If accessing from `http://192.168.1.100:3000`, callback URL should be `http://192.168.1.100:4000/api/auth/callback`
- You need to add this callback URL in GitHub OAuth App settings

## Production Environment Notes

⚠️ **The above configuration is only for development and LAN testing**

Production deployment should:

1. Use domain names instead of IP addresses
2. Enable HTTPS/TLS
3. Use reverse proxy (Nginx/Traefik)
4. Restrict CORS to specific domains
5. Configure appropriate security policies

## References

- Backend configuration: `backend/.env.example`
- Frontend configuration: `frontend/.env.example`
- Vite configuration: `frontend/vite.config.ts`
- Project architecture: `.github/instructions/project-context.instructions.md`

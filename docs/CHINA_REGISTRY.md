# Container Registry Configuration for China

Due to Docker Hub access restrictions in China, this guide provides solutions for pulling container images.

The project’s default `docker-compose.yml` references official Docker Hub images because some dependencies are not mirrored elsewhere. We currently do **not** publish or maintain GHCR mirrors, so the guidance below focuses entirely on keeping Docker Hub reachable or preparing images offline.

## TL;DR - Quick Recommendations

### Access Status in China (2025)

| Registry | Status | Speed | Recommendation |
|----------|--------|-------|----------------|
| **Docker Hub** (`docker.io`) | ❌ Blocked | N/A | Configure proxy or mirrors *(default compose relies on this)* |
| **DaoCloud** (`docker.m.daocloud.io`) | ✅ Working | 🟢 Fast | **Recommended mirror** |
| **Aliyun** | ✅ Fast | 🟢 Fast | Requires personal accelerator URL |
| **Quay.io** | ⚠️ Unstable | 🔴 Slow | Not recommended |

### Best Strategy

1. **Use the bundled config file** `podman-mirrors.conf` for quick setup
2. **Combine proxies and mirrors** for the most reliable pulls
3. **Keep offline tarballs available** if network outages are common

---

## Quick Start

Before making manual changes, try the bundled scripts: `./setup.ps1` (PowerShell) or `./setup.sh` (bash). They always use `docker-compose.yml` and print helpful links to this document.

If connectivity issues persist, apply one or more of the following strategies:

1. **Quick Config** - Use the bundled `scripts/podman-mirrors.conf` file (recommended)
2. **Proxy** - Route Docker Hub traffic through a proxy
3. **Offline Cache** - Pre-download images on another host and import them locally
4. **Hybrid** - Combine the above for best reliability

---

## Method 1: Use Bundled Mirror Configuration (Recommended)

The project includes a pre-configured `scripts/podman-mirrors.conf` file with verified working mirrors.

### One-Line Setup (PowerShell)

```powershell
# Copy config to Podman Machine and restart
Get-Content .\scripts\podman-mirrors.conf | podman machine ssh "sudo tee /etc/containers/registries.conf.d/mirrors.conf > /dev/null"
podman machine stop; podman machine start
```

### Verify Configuration

```powershell
# Test image pull (should use DaoCloud mirror automatically)
podman pull postgres:16-alpine
```

You should see output like:

```text
Trying to pull docker.m.daocloud.io/library/postgres:16-alpine...
```

### Manual Setup Steps

If the one-liner doesn't work:

**Step 1**: Access Podman Machine

```powershell
podman machine ssh
```

**Step 2**: Create config directory and file

```bash
sudo mkdir -p /etc/containers/registries.conf.d
sudo nano /etc/containers/registries.conf.d/mirrors.conf
```

**Step 3**: Copy content from `podman-mirrors.conf` into the editor, save and exit

**Step 4**: Restart Podman

```bash
exit
```

```powershell
podman machine stop
podman machine start
```

---

## Method 2: Configure Mirror Registries Manually

If you prefer manual configuration or need custom mirrors:

### Step 1: Access Podman Machine

```powershell
# Start Podman Desktop first, then:
podman machine ssh
```

### Step 2: Create Registry Configuration

```bash
# Create config directory
sudo mkdir -p /etc/containers/registries.conf.d

# Edit configuration
sudo nano /etc/containers/registries.conf.d/mirrors.conf
```

### Step 3: Add Mirror Configuration

```toml
# Unqualified image search registries
unqualified-search-registries = ["docker.io"]

# Docker Hub mirrors
[[registry]]
location = "docker.io"

# DaoCloud mirror (verified working as of Nov 2025)
[[registry.mirror]]
location = "docker.m.daocloud.io"
```

### Step 4: Restart Podman

```bash
# Exit from Podman Machine
exit

# Restart Podman Machine
podman machine stop
podman machine start
```

### Docker Desktop Mirror Example

Docker Desktop users can add mirrors via `daemon.json`:

```json
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io"
  ]
}
```

Steps:

1. Edit `%ProgramData%/Docker/config/daemon.json` (Windows) or `/etc/docker/daemon.json` (Linux/macOS).
2. Restart Docker Desktop / Docker Engine.
3. Re-run `docker-compose up -d`.

---

## Method 3: Configure Proxy

### Option A: Podman Desktop GUI

1. Open **Podman Desktop**
2. Go to **Settings** → **Proxy**
3. Enable proxy and enter your proxy details:
   - **HTTP Proxy**: `http://127.0.0.1:7890` (adjust port)
   - **HTTPS Proxy**: `http://127.0.0.1:7890`
   - **No Proxy**: `localhost,127.0.0.1`
4. Click **Apply**
5. Restart Podman Machine

### Option B: Command Line Configuration

#### Windows (PowerShell)

```powershell
# Set environment variables for current session
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
$env:NO_PROXY="localhost,127.0.0.1"

# Then start Podman commands
podman pull postgres:16-alpine
```

#### Docker Desktop

Set proxy variables for Docker CLI sessions:

```powershell
$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
docker compose up -d
```

For long-term configuration, create or edit `%UserProfile%/.docker/config.json`:

```json
{
  "proxies": {
    "default": {
      "httpProxy": "http://127.0.0.1:7890",
      "httpsProxy": "http://127.0.0.1:7890",
      "noProxy": "localhost,127.0.0.1"
    }
  }
}
```

#### Configure in Podman Machine

```powershell
# SSH into Podman Machine
podman machine ssh

# Create systemd drop-in directory
sudo mkdir -p /etc/systemd/system/podman.service.d

# Create proxy configuration
sudo nano /etc/systemd/system/podman.service.d/proxy.conf
```

Add the following content:

```ini
[Service]
Environment="HTTP_PROXY=http://host.containers.internal:7890"
Environment="HTTPS_PROXY=http://host.containers.internal:7890"
Environment="NO_PROXY=localhost,127.0.0.1"
```

**Note**: `host.containers.internal` is the special hostname that points to your Windows host from inside the Podman Machine.

Reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart podman
exit
```

Then restart Podman Machine:

```powershell
podman machine stop
podman machine start
```

---

## Method 4: Hybrid Configuration (Best Reliability)

Combine proxy with mirrors for maximum reliability:

1. **Configure mirrors** using `podman-mirrors.conf` (Method 1)
2. **Configure proxy** (Method 3) as backup
3. Podman will try mirrors first, then fall back to proxy

---

## Testing Configuration

### Test Image Pull

```powershell
# Test PostgreSQL image
podman pull postgres:16-alpine

# Test MinIO image
podman pull minio/minio:latest

```

### Verify Registry and Proxy Settings

```powershell
# SSH into Podman Machine
podman machine ssh

# Check registry configuration
cat /etc/containers/registries.conf.d/mirrors.conf

# Check proxy settings
systemctl show podman | grep Environment
```

---

## Common Proxy Ports

Different proxy software uses different default ports:

| Proxy Software | Default HTTP Port | Default SOCKS5 Port |
|----------------|-------------------|---------------------|
| Clash          | 7890              | 7891                |
| V2Ray          | 10809             | 10808               |
| Shadowsocks    | 1080              | 1080                |
| Clash Verge    | 7890              | 7891                |

**Adjust the port number in your configuration accordingly.**

---

## Troubleshooting

### Issue: Still Cannot Pull Images

**Solution 1**: Check if proxy is running

```powershell
# Test proxy connectivity
curl -x http://127.0.0.1:7890 https://www.google.com
```

**Solution 2**: Verify Podman Machine can access host

```powershell
podman machine ssh
ping host.containers.internal
curl -x http://host.containers.internal:7890 https://www.google.com
exit
```

**Solution 3**: Try different mirror

Edit mirrors.conf and reorder mirrors, putting the fastest one first.

### Issue: Proxy Settings Not Working

**Check Windows Firewall**:

1. Open **Windows Defender Firewall** → **Advanced Settings**
2. Create inbound rule for your proxy port (e.g., 7890)
3. Allow connections from WSL/Podman subnet

**Allow Proxy LAN Connections**:

Most proxy clients need to enable "Allow connections from LAN" option:

- **Clash**: Settings → Allow LAN
- **V2Ray**: Enable LAN connections in settings

### Issue: DNS Resolution Problems

```powershell
podman machine ssh

# Edit DNS configuration
sudo nano /etc/resolv.conf

# Add public DNS servers
nameserver 8.8.8.8
nameserver 1.1.1.1

exit
```

---

## Recommended Setup for China Users

**Best configuration for reliability**:

1. ✅ Use a reliable proxy (Clash/V2Ray recommended)
2. ✅ Configure proxy in Podman Desktop GUI or Docker settings
3. ✅ Add mirror registries as backup
4. ✅ Run `./setup.ps1` or `./setup.sh` for initial provisioning
5. ✅ Test with multiple images

**Environment Variables for Scripts**:

Copy `scripts/podman-env.ps1.example` to `podman-env.ps1` and adjust settings:

```powershell
cp .\scripts\podman-env.ps1.example .\podman-env.ps1
# Edit podman-env.ps1 to configure your proxy port

$env:HTTP_PROXY="http://127.0.0.1:7890"
$env:HTTPS_PROXY="http://127.0.0.1:7890"
$env:NO_PROXY="localhost,127.0.0.1"

Write-Host "Proxy environment variables set:" -ForegroundColor Green
Write-Host "  HTTP_PROXY: $env:HTTP_PROXY"
Write-Host "  HTTPS_PROXY: $env:HTTPS_PROXY"
```

Usage:

```powershell
# Load proxy settings
. .\podman-env.ps1

# Now run Podman commands
npm run podman:up
```

---

## Alternative: Pre-download Images

If all else fails, you can download images on a machine with internet access:

```bash
# On a machine with internet access
podman pull postgres:16-alpine
podman pull minio/minio:latest

# Save images to files
podman save -o postgres-16-alpine.tar postgres:16-alpine
podman save -o minio-latest.tar minio/minio:latest

# Transfer files to your machine, then load:
podman load -i postgres-16-alpine.tar
podman load -i minio-latest.tar
```

---

## Next Steps

After configuration:

1. Test image pulling
2. Run `npm run podman:up` to start services
3. If successful, proceed with project setup

## References

- [Podman Registry Configuration](https://github.com/containers/image/blob/main/docs/containers-registries.conf.5.md)
- [Podman Proxy Configuration](https://podman.io/getting-started/network)
- [Available China Mirrors](https://github.com/DaoCloud/public-image-mirror)

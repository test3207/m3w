# Container Registry Configuration for China

Due to Docker Hub access restrictions in China, this guide provides solutions for pulling container images.

## TL;DR - Quick Recommendations

### Access Status in China (2025)

| Registry | Status | Speed | Recommendation |
|----------|--------|-------|----------------|
| **Docker Hub** (`docker.io`) | ❌ Blocked | N/A | Use mirrors or proxy |
| **GHCR** (`ghcr.io`) | ✅ Accessible | 🟡 Moderate | **Recommended** |
| **Quay.io** | ⚠️ Unstable | 🔴 Slow | Not recommended |
| **Aliyun/Tencent** | ✅ Fast | 🟢 Fast | Good for mirrors |

### Best Strategy

1. **Use GHCR images when available** (no proxy needed)
2. **Configure proxy for Docker Hub images**
3. **Add mirror registries as fallback**

---

## Quick Start

Choose one of the following methods:

1. **GHCR Images** - Use GitHub Container Registry (best for China)
2. **Proxy** - Use your proxy for Docker Hub (recommended if available)
3. **Mirror Registries** - Use China-based mirrors (may be unstable)
4. **Hybrid** - Combine all for best reliability

---

## Using GitHub Container Registry (Recommended)

### Why GHCR?

✅ **Directly accessible in China** (no proxy needed in most cases)  
✅ **Free for public images**  
✅ **Better reliability than Docker Hub**  
✅ **Integrated with GitHub Actions**

### Popular GHCR Images

Many official images are mirrored to GHCR:

```yaml
# Example: docker-compose.yml using GHCR
services:
  postgres:
    # Option 1: Official PostgreSQL on GHCR (if available)
    image: ghcr.io/cloudnative-pg/postgresql:16
    
    # Option 2: Use Docker Hub with proxy/mirrors
    # image: postgres:16-alpine
    
  redis:
    # Redis on GHCR
    image: ghcr.io/redis/redis-stack:latest
    
    # Or official Docker Hub image
    # image: redis:7-alpine
```

### Finding GHCR Images

1. **Search on GitHub**: `https://github.com/orgs/[org]/packages`
2. **Common organizations**:
   - `ghcr.io/linuxserver/` - LinuxServer.io images
   - `ghcr.io/home-assistant/` - Home Assistant
   - `ghcr.io/cloudnative-pg/` - PostgreSQL

3. **Check if your image is on GHCR**:

   ```bash
   # Try pulling from GHCR
   podman pull ghcr.io/library/postgres:16
   ```

### Using GHCR in Our Project

You can modify `docker-compose.yml` to use GHCR images:

```yaml
services:
  postgres:
    # Using CloudNativePG PostgreSQL image from GHCR
    image: ghcr.io/cloudnative-pg/postgresql:16
    # Rest of config remains the same
    
  redis:
    # Redis stack from GHCR (includes Redis + modules)
    image: ghcr.io/redis/redis-stack-server:latest
    # Or stick with official if accessible
    # image: redis:7-alpine
```

**Note**: GHCR images might have different tags/features. Test before using in production.

---

## Method 1: Configure Mirror Registries

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
prefix = "docker.io"
location = "docker.io"

# China-based mirrors (add multiple for redundancy)
[[registry.mirror]]
location = "dockerpull.com"

[[registry.mirror]]
location = "dockerproxy.cn"

[[registry.mirror]]
location = "docker.1panel.live"

[[registry.mirror]]
location = "docker.rainbond.cc"

[[registry.mirror]]
location = "docker.fxxk.dedyn.io"

# GitHub Container Registry (GHCR)
[[registry]]
prefix = "ghcr.io"
location = "ghcr.io"

[[registry.mirror]]
location = "ghcr.dockerproxy.cn"
```

### Step 4: Restart Podman

```bash
# Exit from Podman Machine
exit

# Restart Podman Machine
podman machine stop
podman machine start
```

---

## Method 2: Configure Proxy (Recommended)

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

## Method 3: Hybrid Configuration (Best Reliability)

Combine proxy with mirrors for maximum reliability:

1. **Configure proxy** (as shown in Method 2)
2. **Configure mirrors** (as shown in Method 1)
3. Podman will try proxy first, then fall back to mirrors

---

## Testing Configuration

### Test Image Pull

```powershell
# Test PostgreSQL image
podman pull postgres:16-alpine

# Test Redis image
podman pull redis:7-alpine

# Test from GHCR
podman pull ghcr.io/home-assistant/home-assistant:latest
```

### Verify Configuration

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
2. ✅ Configure proxy in Podman Desktop GUI
3. ✅ Add mirror registries as backup
4. ✅ Test with multiple images

**Environment Variables for Scripts**:

Create a file `podman-env.ps1` in your project:

```powershell
# podman-env.ps1
# Source this file before running Podman commands

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
podman pull redis:7-alpine

# Save images to files
podman save -o postgres-16-alpine.tar postgres:16-alpine
podman save -o redis-7-alpine.tar redis:7-alpine

# Transfer files to your machine, then load:
podman load -i postgres-16-alpine.tar
podman load -i redis-7-alpine.tar
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

# Podman Setup Guide

## Why Podman?

- **Daemonless**: No background service required, more secure
- **Rootless**: Runs without root privileges by default
- **Docker Compatible**: Use `docker-compose.yml` without changes
- **Kubernetes Native**: Built-in support for K8s YAML
- **Free & Open Source**: No subscription fees

## Installation

### Windows

1. **Download Podman Desktop**: <https://podman-desktop.io/>
2. **Install and launch** the application
3. It will automatically set up WSL 2 if needed
4. **Restart your computer** to add `podman` to PATH
5. **Install podman-compose** (required for docker-compose.yml support):

   ```powershell
   # Check if Python/pip is installed
   python --version
   pip --version
   
   # Install podman-compose
   pip install podman-compose
   ```

6. **Start Podman Machine**:

   ```powershell
   podman machine init
   podman machine start
   ```

### macOS

1. **Install via Homebrew**:

   ```bash
   brew install podman podman-compose
   ```

2. **Initialize and start**:

   ```bash
   podman machine init
   podman machine start
   ```

### Linux

1. **Install Podman**:

   ```bash
   # Debian/Ubuntu
   sudo apt-get update
   sudo apt-get install -y podman
   
   # RHEL/Fedora
   sudo dnf install -y podman
   ```

2. **Install podman-compose**:

   ```bash
   pip install podman-compose
   ```

### Verify Installation

```bash
podman --version           # Should show: podman version 5.x.x
podman-compose --version   # Should show: podman-compose version 1.x.x
podman machine list        # Should show running machine (Windows/macOS)
```

## Usage

### Start Services

```bash
# Navigate to project directory
cd m3w

# Start PostgreSQL and MinIO
podman-compose up -d

# Check running containers
podman ps
```

### Stop Services

```bash
podman-compose down
```

### View Logs

```bash
# All services
podman-compose logs -f

# Specific service
podman-compose logs -f postgres
```

### Clean Up

```bash
# Stop and remove volumes
podman-compose down -v
```

## Podman Desktop GUI

Podman Desktop provides a user-friendly interface:

- **Containers**: View and manage running containers
- **Images**: Browse and manage container images
- **Volumes**: Manage data persistence
- **Pods**: Create and manage pod definitions
- **Kubernetes**: Deploy to local or remote K8s clusters

## Docker Compatibility

If you're used to Docker commands, Podman is a drop-in replacement:

```bash
# These commands work identically
podman run ...    # same as: docker run ...
podman build ...  # same as: docker build ...
podman ps         # same as: docker ps
```

### Optional: Create Docker Alias

**PowerShell:**

```powershell
# Add to your PowerShell profile
Set-Alias -Name docker -Value podman
Set-Alias -Name docker-compose -Value podman-compose
```

**Bash/Zsh:**

```bash
# Add to ~/.bashrc or ~/.zshrc
alias docker=podman
alias docker-compose=podman-compose
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
netstat -ano | findstr :5432

# Stop services and clean up
podman-compose down -v
```

### WSL 2 Issues

If you encounter WSL 2 errors:

1. Open PowerShell as Administrator
2. Run: `wsl --update`
3. Restart Podman Desktop

### Container Won't Start

```bash
# View detailed logs
podman-compose logs postgres

# Restart services
podman-compose restart
```

### Image Pull Issues (China Users)

If you cannot pull images due to network restrictions:

1. **Configure Proxy**: See [China Registry Configuration](./CHINA_REGISTRY.md)
2. **Use Mirror Registries**: Configure China-based mirrors
3. **Load proxy before pulling**:

   ```powershell
   # Copy example and configure
   cp .\scripts\podman-env.ps1.example .\podman-env.ps1
   # Edit podman-env.ps1, then source it
   . .\podman-env.ps1
   podman pull postgres:16-alpine
   ```

For detailed proxy and mirror configuration, refer to [CHINA_REGISTRY.md](./CHINA_REGISTRY.md).

## Performance Tips

1. **Allocate Sufficient Resources**: Configure memory/CPU in Podman Desktop settings
2. **Use Volumes Wisely**: Named volumes are faster than bind mounts
3. **Prune Regularly**: Remove unused images/containers

   ```bash
   podman system prune -a
   ```

## Migration from Docker

If you have Docker installed:

1. Export Docker images (if needed):

   ```bash
   docker save -o myimage.tar myimage:tag
   podman load -i myimage.tar
   ```

2. Uninstall Docker Desktop (optional)
3. Install Podman Desktop
4. Your `docker-compose.yml` works without changes!

## Next Steps

- Read the [Podman Documentation](https://docs.podman.io/)
- Explore Podman Desktop features
- Try deploying to local Kubernetes (Kind/Minikube)

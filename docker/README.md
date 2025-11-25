# M3W Docker Deployment Guide

This guide covers local Docker builds and deployment. For automated CI/CD builds, see [Issue #61](https://github.com/test3207/m3w/issues/61).

## Image Variants

M3W provides three Docker image variants:

| Image | Purpose | Use Case |
|-------|---------|----------|
| `m3w` | All-in-One (Frontend + Backend) | Simple deployment, demos, development |
| `m3w-backend` | Backend API only | Microservices, separated frontend hosting |
| `m3w-frontend` | Frontend static files + web server | CDN deployment, edge hosting (TBD) |

**Note**: Production images will be published to `ghcr.io/test3207` and `docker.io/test3207` (see [Issue #61](https://github.com/test3207/m3w/issues/61)).

## Build Targets

Each image supports two build targets:

- **Production** (`BUILD_TARGET=prod`): Optimized, no demo code
- **RC** (`BUILD_TARGET=rc`): Includes demo mode features (storage limits, data reset)

```bash
# Build production image
podman build -t m3w:prod -f docker/Dockerfile --build-arg BUILD_TARGET=prod .

# Build RC image with demo support
podman build -t m3w:rc -f docker/Dockerfile --build-arg BUILD_TARGET=rc .
```

## Local Build Scripts

Use PowerShell scripts for automated multi-image builds:

```powershell
# Build RC images (increments RC number)
.\scripts\build-docker.ps1 -Type rc -RcNumber 1

# Build production images (use current version from package.json)
.\scripts\build-docker.ps1 -Type prod

# Bump version for next release
.\scripts\bump-version.ps1 -Type patch  # or minor, major
```

See [scripts/build-docker.ps1](../scripts/build-docker.ps1) for details.

## Deployment Examples

### 1. Simple (All-in-One)

✅ Best for: Personal use, testing, quick setup

```bash
cd docker/examples/simple
docker-compose up -d
```

**Access**: <http://localhost:4000>

[→ Full Documentation](./examples/simple/README.md)

---

### 2. Standard (Separated + Built-in Nginx)

✅ Best for: Medium traffic, staging environments

```bash
cd docker/examples/standard
docker-compose up -d
```

**Access**: <http://localhost>

[→ Full Documentation](./examples/standard/README.md)

---

### 3. Production (Custom Reverse Proxy)

✅ Best for: Production with HTTPS, custom domain

```bash
cd docker/examples/production
docker-compose up -d
# Then configure your host Nginx (see nginx-host-example.conf)
```

**Access**: <https://music.example.com>

[→ Full Documentation](./examples/production/README.md)

---

## Quick Comparison

| Feature | Simple | Standard | Production |
|---------|--------|----------|------------|
| Containers | 1 (All-in-One) | 2 (Frontend + Backend) | 2 (Frontend + Backend) |
| Reverse Proxy | Backend serves frontend | Internal Nginx | Your Nginx/Caddy |
| Port | 4000 | 80 | 80/443 (your config) |
| Scaling | ❌ Coupled | ✅ Independent | ✅ Independent |
| HTTPS | ❌ Manual setup | ❌ Manual setup | ✅ Built-in |
| CDN Ready | ❌ | ⚠️ With extra config | ✅ |

## Runtime Configuration

### Frontend API URL Configuration

Frontend `API_BASE_URL` can be configured at runtime:

**All-in-One deployment** (m3w):

- ✅ Supports runtime config via entrypoint script
- Config injected into index.html on container start
- Example: `docker run -e API_BASE_URL=http://localhost:4000 m3w:latest`

**Separated deployment** (m3w-frontend):

- ✅ Supports runtime config via entrypoint script
- Use relative path `/api` when behind reverse proxy
- Example: `docker run -e API_BASE_URL=/api m3w-frontend:latest`

**Backend deployment** (m3w-backend):

- Use `CORS_ORIGIN` and `API_BASE_URL` env vars for backend configuration
- No frontend runtime config needed

## Database Migrations

Run migrations before first startup:

```bash
# Option 1: One-time command
docker exec m3w-backend npx prisma migrate deploy

# Option 2: Add to docker-compose.yml command
command: sh -c "npx prisma migrate deploy && node dist/index.js"
```

## Environment Variables

See `.env.example` files in each example directory. Key variables:

**Backend**:

- `DATABASE_URL`: PostgreSQL connection
- `MINIO_ENDPOINT`: Object storage endpoint
- `JWT_SECRET`: **MUST CHANGE** in production
- `GITHUB_CLIENT_ID/SECRET`: OAuth credentials
- `API_BASE_URL`: Public URL for backend
- `CORS_ORIGIN`: Allowed frontend origin

**Frontend** (runtime):

- `API_BASE_URL`: Where to call backend API (default: `/api`)

## Demo Mode (RC Builds Only)

When using RC builds (`BUILD_TARGET=rc`):

```yaml
environment:
  - DEMO_MODE=true
  - DEMO_STORAGE_LIMIT=5368709120  # 5GB
  - DEMO_RESET_ENABLED=false       # ⚠️ Dangerous!
```

## Building Locally

### Quick Build

```bash
# All-in-One (production)
podman build -t m3w:local -f docker/Dockerfile --build-arg BUILD_TARGET=prod .

# Backend only
podman build -t m3w-backend:local -f docker/Dockerfile.backend --build-arg BUILD_TARGET=prod .
```

### Using Build Scripts

For automated builds with proper tagging:

```powershell
# Build all variants (AIO + Backend) with version tags
.\scripts\build-docker.ps1 -Type prod

# Push to registry
.\scripts\build-docker.ps1 -Type prod -Registry ghcr.io/test3207
```

## Image Optimization

Current image size: **~626 MB** (see [Issue #60](https://github.com/test3207/m3w/issues/60) for optimization plan)

**Target**: <400 MB through production dependencies only (`npm ci --omit=dev`)

## Troubleshooting

### "Prisma Client not generated"

Run migrations: `docker exec m3w-backend npx prisma migrate deploy`

### "CORS error"

Check `CORS_ORIGIN` matches frontend URL exactly (including protocol and port)

### "GitHub OAuth callback mismatch"

Ensure `GITHUB_CALLBACK_URL` matches the URL registered in GitHub OAuth app

### Frontend shows "Network Error"

1. Check `API_BASE_URL` in frontend environment
2. Verify backend is reachable from frontend container
3. Check CORS configuration

## Security Checklist

- [ ] Change `JWT_SECRET` from default
- [ ] Use strong PostgreSQL password
- [ ] Change MinIO credentials
- [ ] Enable HTTPS in production
- [ ] Set `DEMO_MODE=false` in production (or use prod build)
- [ ] Review CORS_ORIGIN settings
- [ ] Keep Docker images updated

## Support

- Issues: <https://github.com/test3207/m3w/issues>
- Discussions: <https://github.com/test3207/m3w/discussions>

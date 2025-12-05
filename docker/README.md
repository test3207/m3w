# M3W Docker Deployment Guide

This guide covers Docker image builds and deployment. For automated CI/CD builds, see [Issue #61](https://github.com/test3207/m3w/issues/61).

## Image Variants

M3W provides three Docker image variants:

| Image | Purpose | Use Case |
|-------|---------|----------|
| `m3w` | All-in-One (Frontend + Backend) | Simple deployment, demos, development |
| `m3w-backend` | Backend API only | Microservices, separated frontend hosting |
| `m3w-frontend` | Frontend static files + Nginx | CDN deployment, edge hosting |

**Note**: Production images are published to `ghcr.io/test3207`.

## Build Architecture

**All Dockerfiles use COPY-only approach** - no `npm install` inside containers.

Build process:

1. **Build artifacts** in a Linux container (cross-platform compatible)
2. **Build images** from pre-built artifacts (just COPY operations)

This ensures:

- ✅ Consistent builds across Windows/macOS/Linux
- ✅ Host node_modules preserved (no corruption)
- ✅ Smallest possible images (no build tools)
- ✅ Fast image builds (just COPY operations)

## Quick Start (Recommended)

All platforms use Node.js scripts for consistency:

```bash
# Build all images (artifacts + Docker images)
node scripts/build-docker.cjs --type prod
# Or via npm: npm run docker:build

# Build RC version
node scripts/build-docker.cjs --type rc --rc 1
# Or via npm: npm run docker:build:rc

# Build and test AIO image
node scripts/build-docker.cjs --type prod --test
# Or via npm: npm run docker:build:test

# Skip artifact build (use existing docker-build-output/)
node scripts/build-docker.cjs --type prod --skip-artifacts

# Build and push to registry
node scripts/build-docker.cjs --type prod --push

# Specify custom registry
node scripts/build-docker.cjs --type prod --registry ghcr.io/test3207
```

See full options with: `node scripts/build-docker.cjs --help`

## Local Testing

Use the `--test` flag to automatically test built images:

```bash
node scripts/build-docker.cjs --type prod --test
# Or: npm run docker:build:test
```

This will:

1. Check for `backend/.env.docker` (creates from `.env` if missing)
2. Ensure PostgreSQL and MinIO are running (starts docker-compose if needed)
3. Start the AIO container with correct network settings
4. Run health checks on API and frontend
5. Report test results

**Prerequisites for testing**:

- `backend/.env.docker` with GitHub OAuth credentials
- Docker network `m3w_default` (created by main docker-compose.yml)

**Manual testing** (if not using `-Test` flag):

```bash
# 1. Create .env.docker from template
cp backend/.env.docker.example backend/.env.docker
# Edit with your credentials

# 2. Start dependencies
docker-compose up -d

# 3. Run test container
docker-compose -f docker/docker-compose.test.yml up -d

# 4. Check logs
docker logs -f m3w-test

# 5. Open http://localhost:4000

# 6. Cleanup
docker-compose -f docker/docker-compose.test.yml down
```

## Manual Build Steps

If you need to run steps manually:

### Step 1: Build Artifacts

```bash
# Create output directory
mkdir -p docker-build-output

# Run build in container (source read-only, output writable)
docker run --rm \
  -v "${PWD}:/app:ro" \
  -v "${PWD}/docker-build-output:/output" \
  node:25.2.1-alpine \
  sh -c "mkdir -p /build && sh /app/scripts/docker-build.sh"
```

Output structure:

```text
docker-build-output/
├── shared/
│   ├── dist/
│   └── package.json
├── backend/
│   ├── dist/
│   ├── node_modules/  (Linux production deps)
│   ├── prisma/
│   └── package.json
├── frontend/
│   └── dist/
└── docker/
    ├── docker-entrypoint-allinone.sh
    ├── docker-entrypoint-frontend.sh
    └── nginx.conf
```

### Step 2: Build Docker Images

```bash
# Build from docker-build-output/ directory
docker build -f docker/Dockerfile -t m3w:latest docker-build-output/
docker build -f docker/Dockerfile.backend -t m3w-backend:latest docker-build-output/
docker build -f docker/Dockerfile.frontend -t m3w-frontend:latest docker-build-output/
```

### Step 3: Run

```bash
# Start dependencies
docker-compose up -d m3w-postgres m3w-minio

# Run All-in-One image
docker run -d --name m3w \
  --network m3w_default \
  -p 4000:4000 \
  --env-file backend/.env.docker \
  m3w:latest
```

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

**Auto-migration (default)**: All entrypoint scripts automatically run `prisma migrate deploy` on startup. No manual action required.

For manual migration control:

```bash
# Skip auto-migration (if needed)
docker run -e SKIP_MIGRATIONS=true m3w:latest

# Manual migration
docker exec m3w-backend npx prisma migrate deploy
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

Image sizes after optimization ([Issue #60](https://github.com/test3207/m3w/issues/60)):

| Image | Before | After | Savings |
|-------|--------|-------|---------|
| `m3w` (All-in-One) | ~626 MB | ~382 MB | ~39% |
| `m3w-backend` | ~580 MB | ~379 MB | ~35% |
| `m3w-frontend` | N/A | ~57 MB | N/A |

**Optimization techniques applied**:

1. **COPY-only Dockerfiles**: No npm install in containers, only copy pre-built artifacts
2. **Production dependencies only**: `npm ci --omit=dev` (saves ~200 MB)
3. **Lightweight pinyin library**: Replaced `pinyin` (59MB) with `pinyin-pro` (927KB) for Chinese sorting (98% size reduction)
4. **Prisma engine cleanup**: Remove unused database engines (MySQL, SQLite, SQL Server, CockroachDB)
5. **Post-generation cleanup**: Remove `prisma`, `typescript`, `@types/*` after Prisma Client generation
6. **Single-layer optimization**: Build artifacts once, copy into minimal runtime image

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

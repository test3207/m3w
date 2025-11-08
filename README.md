# M3W - Next.js Full-Stack Application

Production-grade web application built with Next.js, PostgreSQL, and Redis.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: PostgreSQL 16 (Prisma ORM)
- **Cache**: Redis 7
- **Authentication**: NextAuth.js v5 (GitHub OAuth)
- **Styling**: Tailwind CSS v4
- **Logging**: Pino
- **Container Runtime**: Docker or Podman (your choice)

## Getting Started

### Prerequisites

- Node.js 20+
- **Container Runtime** (choose one):
  - **Docker**: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (easier for beginners)
  - **Podman**: [Podman Desktop](https://podman-desktop.io/) (daemonless, rootless, open source)
- **For China users**: Configure Docker Hub proxy/mirrors as needed (see [docs/CHINA_REGISTRY.md](./docs/CHINA_REGISTRY.md))

#### Container Runtime Setup

**Option A: Docker** (Recommended for most users)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Start Docker Desktop
3. Verify installation:

   ```bash
   docker --version
   docker-compose --version
   ```

**Option B: Podman** (Alternative for advanced users)

1. Install [Podman Desktop](https://podman-desktop.io/)
2. **Restart your computer** after installation
3. Install podman-compose:

   ```bash
   pip install podman-compose
   ```

4. Start Podman Machine (Windows/macOS):

   ```bash
   podman machine start
   ```

5. Verify installation:

   ```bash
   podman --version
   podman-compose --version
   ```

See [docs/PODMAN.md](./docs/PODMAN.md) for detailed Podman setup instructions.

### Quick Start (Automated)

**Windows (PowerShell):**

```powershell
./setup.ps1
```

**Linux/macOS:**

```bash
chmod +x setup.sh
./setup.sh
```

The setup script will:

- Install npm dependencies
- Create `.env` from template
- Start PostgreSQL and Redis containers (using Docker Hub images)
- Run database migrations
- Provide next steps

### Manual Setup

If you prefer manual setup or the script fails:

### 1. Clone and Install

```bash
git clone <repository-url>
cd m3w
npm install
```

**For users in China**: Edit `.npmrc` and uncomment the Taobao mirror line:

```ini
# Uncomment this line
registry=https://registry.npmmirror.com/
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Then edit `.env` and add your GitHub OAuth credentials:

1. Go to <https://github.com/settings/developers>
2. Create a new OAuth App
3. Set Authorization callback URL to: `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret to `.env`

### 3. Start Database Services

Choose your container runtime and start the services:

**With Docker:**

```bash
docker-compose up -d
```

**With Podman:**

```bash
podman-compose up -d
```

**Network notes (especially for China users)**:

- The default `docker-compose.yml` relies on official Docker Hub images.
- If Docker Hub access is restricted, configure a proxy or registry mirror as described in [docs/CHINA_REGISTRY.md](./docs/CHINA_REGISTRY.md).

This will start:

- PostgreSQL on `localhost:5432`
- Redis on `localhost:6379`

### 4. Run Database Migrations

```bash
npx prisma migrate dev
```

### 5. Start Development Server

```bash
npm run dev
```

Visit <http://localhost:3000>

## Project Structure

```text
m3w/
├── .github/                      # Workflows, shared instructions, automation
├── assets/                       # Source design artifacts (not imported at runtime)
│   ├── fonts/                    # Custom typefaces and licensing docs
│   ├── image/                    # High-res logos, favicons, marketing art
│   └── raw/                      # Working files (PSD, SVG, AI) grouped by feature
├── docker/                       # Container definitions and helper scripts
├── docs/                         # Developer documentation and regional guides
├── prisma/                       # Database schema and migrations
├── public/                       # Optimized static assets served verbatim by Next.js
├── src/
│   ├── app/                      # App Router entry points, route groups, static icons
│   │   ├── (auth)/               # Authentication routes
│   │   ├── (dashboard)/          # Authenticated dashboard routes
│   │   ├── api/                  # Route handlers (REST endpoints)
│   │   └── icon.png              # App Router favicon source
│   ├── components/               # UI building blocks (features, layouts, primitives)
│   ├── lib/                      # Business logic, adapters, utilities
│   ├── locales/                  # i18n message catalogs
│   ├── test/                     # Unit and integration test helpers
│   └── types/                    # Shared TypeScript declarations
├── package.json                  # Project manifest and npm scripts
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript compiler options
└── vitest.config.ts              # Vitest test runner configuration
```

### Asset Workflow

- Keep original artwork under `assets/` and avoid importing from this directory in application code.
- Export web-ready derivatives to `public/` (for static assets) or `src/app/*.png` for App Router icons such as favicons and touch-icons.
- Mirror the folder layout between `assets/` and `public/` when practical so provenance is obvious (for example `assets/image/library/hero.png` → `public/images/library/hero.png`).
- Document optimization commands (for example Squoosh CLI, ImageMagick) in `assets/README.md` whenever introducing a new asset family or pipeline.
- Prune intermediate files in `assets/raw/` once their optimized counterparts are committed to keep the repository lean.

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Testing & Code Quality

- Run unit tests with Vitest: `npm run test`
- Prefer factory helpers or type aliases for Prisma and metadata fixtures instead of chaining `as unknown as`
- When a mock cannot fully satisfy an interface, document the gap and keep its shape aligned with the contract
- Extract shared fixtures once the same test data appears twice to avoid missing fields
- Reusable factories live in `src/test/fixtures/metadata.ts` and `src/test/fixtures/prisma.ts`

## Database Management

```bash
# Create a new migration
npx prisma migrate dev --name <migration-name>

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio
```

## Container Management

Use the commands for your chosen container runtime:

**Docker:**

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Clean volumes (removes all data)
docker-compose down -v
```

**Podman:**

```bash
# Start services
podman-compose up -d

# Stop services
podman-compose down

# View logs
podman-compose logs -f

# Clean volumes (removes all data)
podman-compose down -v
```

## Docker vs Podman

Both are excellent choices for running M3W. Choose based on your needs:

| Feature | Docker | Podman |
|---------|--------|--------|
| **Ease of Use** | ✅ More intuitive for beginners | Requires Python and podman-compose |
| **Installation** | Single installer | Desktop + podman-compose |
| **Performance** | Excellent | Excellent |
| **Security** | Daemon-based | Daemonless, rootless (more secure) |
| **Compose Support** | Native `docker-compose` | Requires `podman-compose` |
| **Kubernetes** | Basic support | Native Kubernetes support |
| **License** | Free for personal use | Fully open source (Apache 2.0) |
| **Recommendation** | Best for most users | Best for security-conscious users |

**Our recommendation**: Start with **Docker** if you're new to containers. Try **Podman** if you prefer open source tools or need rootless containers.

## Production Deployment

See `.github/copilot-instructions.md` for architecture details and deployment strategy.

## Additional Documentation

- [Podman Setup Guide](./docs/PODMAN.md) - Detailed Podman installation and usage
- [China Registry Configuration](./docs/CHINA_REGISTRY.md) - Proxy and mirror setup for China users

## License

ISC

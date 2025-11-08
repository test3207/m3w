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
- **Container Runtime**: Podman (or Docker)

## Getting Started

### Prerequisites

- Node.js 20+
- Python 3.x + pip (for podman-compose)
- Podman Desktop (or Docker Desktop)
- **For China users**: GHCR images are used by default (no proxy needed in most cases)

**Installation Steps**:

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

See [docs/PODMAN.md](./docs/PODMAN.md) for detailed installation instructions.

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
- Start PostgreSQL and Redis containers (using GHCR images)
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

**Note for China users**:

- **Option 1** (Recommended): Use GHCR images (better accessibility):

  ```bash
  podman-compose -f docker-compose.ghcr.yml up -d
  ```

- **Option 2**: Configure proxy for Docker Hub images:

  ```powershell
  # Copy and edit proxy configuration
  cp podman-env.ps1.example podman-env.ps1
  # Edit podman-env.ps1 to set your proxy port

  # Load proxy settings
  . .\podman-env.ps1
  ```

**With Podman:**

```bash
# Using GHCR images (recommended for China)
podman-compose -f docker-compose.ghcr.yml up -d

# Or using Docker Hub images (requires proxy/mirrors)
podman-compose up -d
```

**With Docker:**

```bash
docker-compose up -d
```

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

**Podman Commands:**

```bash
# Start services
podman-compose up -d

# Stop services
podman-compose down

# View logs
podman-compose logs -f

# Clean volumes
podman-compose down -v
```

**Docker Commands:**

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Clean volumes
docker-compose down -v
```

## Installing Podman Desktop

Download from: <https://podman-desktop.io/>

**Features:**

- Compatible with Docker Compose files
- Lightweight and rootless
- Native Kubernetes support
- Free and open source

**Podman vs Docker:**

- Podman is daemonless (more secure)
- Drop-in replacement for Docker CLI
- Better for development and K8s workflows
- No subscription required

## Production Deployment

See `.github/copilot-instructions.md` for architecture details and deployment strategy.

## Additional Documentation

- [Podman Setup Guide](./docs/PODMAN.md) - Detailed Podman installation and usage
- [China Registry Configuration](./docs/CHINA_REGISTRY.md) - Proxy and mirror setup for China users

## License

ISC

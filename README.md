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
- Create `.env.local` from template
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

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Then edit `.env.local` and add your GitHub OAuth credentials:

1. Go to <https://github.com/settings/developers>
2. Create a new OAuth App
3. Set Authorization callback URL to: `http://localhost:3000/api/auth/callback/github`
4. Copy Client ID and Client Secret to `.env.local`

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
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (auth)/      # Auth pages
│   │   ├── (dashboard)/ # Protected pages
│   │   └── api/         # API routes
│   ├── components/      # React components
│   │   ├── ui/         # Base UI components
│   │   ├── features/   # Feature components
│   │   └── layouts/    # Layout components
│   ├── lib/            # Shared libraries
│   │   ├── auth/       # Authentication
│   │   ├── db/         # Database client
│   │   ├── services/   # Business logic
│   │   └── utils/      # Utilities
│   └── types/          # TypeScript types
├── prisma/             # Database schema
└── docker/             # Docker configs
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

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

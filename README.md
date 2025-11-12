# M3W - Music Player

Production-grade self-hosted music player built with Vite, Hono, PostgreSQL, and Redis.

## Tech Stack

### Frontend

- **Framework**: Vite 5
- **Runtime**: React 19 + Node.js 25.1.0
- **Language**: TypeScript 5
- **Routing**: React Router 6
- **UI**: shadcn/ui + Tailwind CSS v4
- **State**: Zustand
- **Data Fetching**: TanStack Query 5
- **PWA**: Vite PWA Plugin

### Backend

- **Framework**: Hono 4 (Node.js 25.1.0)
- **Language**: TypeScript 5
- **Database**: PostgreSQL 16 (Prisma ORM)
- **Cache**: Redis 7
- **Storage**: MinIO (S3-compatible)
- **Authentication**: JWT with GitHub OAuth
- **Logging**: Pino

### Infrastructure

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

- Install dependencies for root, frontend, backend, and shared packages
- Create `backend/.env` and `frontend/.env` from templates
- Start PostgreSQL, Redis, and MinIO containers (using Docker Hub images)
- Run database migrations
- Provide next steps

### Manual Setup

If you prefer manual setup or the script fails:

### 1. Clone and Install

```bash
git clone <repository-url>
cd m3w

# Install all dependencies
npm install                    # Root dependencies
cd frontend && npm install && cd ..
cd backend && npm install && cd ..
cd shared && npm install && cd ..
```

**For users in China**: Edit `.npmrc` and uncomment the Taobao mirror line:

```ini
# Uncomment this line
registry=https://registry.npmmirror.com/
```

### 2. Configure Environment Variables

**Backend:**

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your GitHub OAuth credentials:

1. Go to <https://github.com/settings/developers>
2. Create a new OAuth App
3. Set Authorization callback URL to: `http://localhost:4000/api/auth/callback`
4. Copy Client ID and Client Secret to `backend/.env`

**Frontend (optional):**

```bash
cp frontend/.env.example frontend/.env
```

The default `VITE_API_URL=http://localhost:4000` should work out of the box.

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
- MinIO on `localhost:9000`

### 4. Run Database Migrations

```bash
cd backend
npx prisma migrate dev
cd ..
```

### 5. Start Development Servers

Start both frontend and backend together:

```bash
npm run dev
```

Or start them separately:

```bash
# Terminal 1 - Frontend (port 3000)
npm run dev:frontend

# Terminal 2 - Backend (port 4000)
npm run dev:backend
```

Visit:

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:4000>

## Project Structure

```text
m3w/
├── .github/                      # Workflows, shared instructions, automation
├── assets/                       # Source design artifacts (not served at runtime)
│   ├── fonts/                    # Custom typefaces and licensing docs
│   ├── image/                    # High-res logos, favicons, marketing art
│   └── raw/                      # Working files (PSD, SVG, AI)
├── backend/                      # Hono backend (REST API)
│   ├── prisma/                   # Database schema and migrations
│   ├── src/
│   │   ├── index.ts              # Main entry point
│   │   ├── lib/                  # Shared utilities (JWT, Prisma, Logger)
│   │   └── routes/               # API route handlers
│   │       ├── auth.ts           # Authentication (GitHub OAuth, JWT)
│   │       ├── libraries.ts      # Library CRUD
│   │       ├── playlists.ts      # Playlist management
│   │       ├── songs.ts          # Song metadata and streaming
│   │       └── upload.ts         # File upload handling
│   ├── .env                      # Backend environment variables (git-ignored)
│   └── package.json              # Backend dependencies
├── docker/                       # Container definitions
├── docs/                         # Developer documentation
├── frontend/                     # Vite frontend (React SPA)
│   ├── public/                   # Static assets (favicon, PWA icons)
│   ├── src/
│   │   ├── components/           # UI components (features, layouts, ui)
│   │   │   ├── features/         # Feature-specific components
│   │   │   │   ├── dashboard/    # Dashboard cards and initializers
│   │   │   │   ├── network/      # Network status indicator
│   │   │   │   ├── player/       # Mini player and playback controls
│   │   │   │   ├── pwa/          # PWA prompts and utilities
│   │   │   │   └── upload/       # Upload form and file handling
│   │   │   ├── layouts/          # Layout components (navbar, shell)
│   │   │   ├── providers/        # Context providers (auth, protected route)
│   │   │   └── ui/               # shadcn/ui base components
│   │   ├── hooks/                # React hooks (useAuthRefresh, etc.)
│   │   ├── lib/                  # Client utilities and services
│   │   │   ├── api/              # Low-level HTTP client
│   │   │   ├── audio/            # Audio player and queue management
│   │   │   └── logger-client.ts  # Client-side logging
│   │   ├── locales/              # i18n message catalogs
│   │   ├── pages/                # React Router page components
│   │   ├── services/             # Service layer (API clients)
│   │   │   └── api/              # API service with layered architecture
│   │   │       └── main/         # Main API client layer
│   │   │           ├── client.ts         # JSON API client
│   │   │           ├── stream-client.ts  # Binary data client
│   │   │           └── resources/        # API resource services
│   │   ├── stores/               # Zustand state stores
│   │   └── main.tsx              # Vite entry point
│   ├── .env                      # Frontend environment variables (git-ignored)
│   ├── index.html                # HTML entry point
│   ├── vite.config.ts            # Vite configuration
│   └── package.json              # Frontend dependencies
├── shared/                       # Shared types and schemas
│   ├── src/
│   │   ├── api-contracts.ts      # API route contracts with offline capability flags
│   │   ├── schemas.ts            # Zod validation schemas
│   │   └── types.ts              # TypeScript type definitions
│   └── package.json              # Shared package dependencies
├── scripts/                      # Build and utility scripts
│   ├── build-i18n.js             # i18n type generation
│   └── generate-icons.js         # PWA icon generation
├── docker-compose.yml            # Local development services
├── package.json                  # Root package with unified scripts
└── README.md                     # This file
```

### Asset Workflow

- Keep original artwork under `assets/` and avoid importing from this directory in application code.
- Export web-ready derivatives to `frontend/public/` for static assets.
- Generate PWA icons with: `npm run icons:generate` (uses `scripts/generate-icons.js`)
- Mirror the folder layout between `assets/` and `frontend/public/` when practical.
- Document optimization commands in `assets/README.md` for new asset families.

## Available Scripts

### Root Scripts (run from project root)

- `npm run dev` - Start both frontend and backend
- `npm run dev:frontend` - Start frontend only (port 3000)
- `npm run dev:backend` - Start backend only (port 4000)
- `npm run build` - Build both frontend and backend
- `npm run build:frontend` - Build frontend (output: `frontend/dist/`)
- `npm run build:backend` - Build backend (output: `backend/dist/`)

### Frontend Scripts (run from `frontend/`)

- `npm run dev` - Start Vite dev server with i18n watch
- `npm run build` - Build for production with i18n type generation
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run Vitest unit tests
- `npm run i18n:build` - Rebuild i18n types
- `npm run icons:generate` - Generate PWA icons

### Backend Scripts (run from `backend/`)

- `npm run dev` - Start Hono dev server
- `npm run build` - Compile TypeScript to `dist/`

### Database Scripts (run from project root)

- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema changes
- `npm run db:migrate` - Run migrations
- `npm run db:studio` - Open Prisma Studio

### Container Scripts (run from project root)

- `npm run docker:up` / `npm run podman:up` - Start services
- `npm run docker:down` / `npm run podman:down` - Stop services
- `npm run docker:logs` / `npm run podman:logs` - View logs

## Testing & Code Quality

- Run unit tests with Vitest: `npm run test`
- Prefer factory helpers or type aliases for Prisma and metadata fixtures instead of chaining `as unknown as`
- When a mock cannot fully satisfy an interface, document the gap and keep its shape aligned with the contract
- Extract shared fixtures once the same test data appears twice to avoid missing fields
- Reusable factories live in `src/test/fixtures/metadata.ts` and `src/test/fixtures/prisma.ts`

## Internationalization (i18n)

M3W uses a custom Proxy-based i18n system with full type safety.

### Quick Start

**In Client Components:**

```typescript
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';

export default function MyComponent() {
  useLocale(); // Required for reactivity
  return <h1>{I18n.dashboard.title}</h1>;
}
```

**In API Routes:**

```typescript
import { I18n } from '@/locales/i18n';

export async function POST() {
  return NextResponse.json({
    message: I18n.error.unauthorized
  });
}
```

**Switching Language:**

```typescript
import { setLocale } from '@/locales/i18n';

<button onClick={() => setLocale('zh-CN')}>中文</button>
```

### Adding New Text

1. Add to `src/locales/messages/en.json`:

   ```json
   {
     "feature": {
       "newText": "Your new text"
     }
   }
   ```

2. Run `npm run i18n:build` (or restart dev server)

3. Add translation to `src/locales/messages/zh-CN.json` (optional)

4. Use in code: `I18n.feature.newText`

### Features

- **Type Safety**: Full TypeScript autocomplete and error checking
- **Hot Reload**: Changes to `en.json` auto-rebuild types in dev mode
- **No Page Refresh**: Language switching updates instantly
- **Hover Hints**: JSDoc shows English text on hover

For detailed documentation, see [i18n system instructions](.github/instructions/i18n-system.instructions.md).

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

### Local Production Build Testing

Test the production build locally before deployment:

#### 1. Configure Docker Environment

```bash
# Copy and configure environment for containers
cp .env.docker.example .env.docker
# Edit .env.docker with your settings
```

#### 2. Build Production Image

```bash
# With Podman
podman build -t m3w:local -f docker/Dockerfile .

# With Docker
docker build -t m3w:local -f docker/Dockerfile .
```

#### 3. Run Production Container

**Important**: The container must join the `m3w_default` network created by docker-compose to access PostgreSQL, Redis, and MinIO.

```bash
# With Podman
podman run -d --name m3w-prod --network m3w_default -p 3000:3000 --env-file .env.docker m3w:local

# With Docker
docker run -d --name m3w-prod --network m3w_default -p 3000:3000 --env-file .env.docker m3w:local
```

#### 4. View Logs

```bash
# With Podman
podman logs -f m3w-prod

# With Docker
docker logs -f m3w-prod
```

#### 5. Stop and Clean Up

```bash
# With Podman
podman stop m3w-prod
podman rm m3w-prod

# With Docker
docker stop m3w-prod
docker rm m3w-prod
```

**Key Differences in `.env.docker`:**

- Use container service names (`m3w-postgres`, `m3w-redis`, `m3w-minio`) instead of `localhost` when the container joins the compose network
- Set `NODE_ENV=production`
- Configure proxy with `host.containers.internal` if needed for external API access (e.g., GitHub OAuth)

See `.github/copilot-instructions.md` for architecture details and deployment strategy.

## Additional Documentation

- [Frontend API Client Architecture](./frontend/src/services/api/README.md) - Layered API client design and usage patterns
- [LAN Access Configuration](./docs/LAN_ACCESS.md) - Expose services to local network for testing on multiple devices
- [Podman Setup Guide](./docs/PODMAN.md) - Detailed Podman installation and usage
- [China Registry Configuration](./docs/CHINA_REGISTRY.md) - Proxy and mirror setup for China users
- [i18n System Guide](./.github/instructions/i18n-system.instructions.md) - Internationalization implementation details

## License

ISC

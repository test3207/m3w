# M3W Development Guide

This document covers development setup, project structure, and contribution guidelines.

## Prerequisites

- **Node.js** 25+ (see [nodejs.org](https://nodejs.org/))
- **Docker Desktop** or **Podman Desktop** (for PostgreSQL and MinIO)
- For Podman users: `pip install podman-compose`

## Quick Start (Development)

### Option A: Automated Setup (Recommended)

```bash
git clone https://github.com/test3207/m3w.git
cd m3w
node scripts/setup.cjs
```

This single command will:

- Install all dependencies
- Create `.env` files from templates
- Start PostgreSQL and MinIO containers
- Run database migrations

### Option B: Manual Setup

#### 1. Clone and Install

```bash
git clone https://github.com/test3207/m3w.git
cd m3w
npm install
```

#### 2. Start Infrastructure Services

**Docker:**

```bash
docker-compose up -d
```

**Podman:**

```bash
podman-compose up -d
```

This starts PostgreSQL (port 5432) and MinIO (ports 9000/9001).

#### 3. Configure Environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your settings (GitHub OAuth, etc.)

# Frontend
cp frontend/.env.example frontend/.env
# Usually no changes needed for local dev
```

#### 4. Initialize Database

```bash
npm run db:migrate
```

#### 5. Start Development Servers

```bash
npm run dev
```

This starts both frontend (port 3000) and backend (port 4000) with hot reload.

Visit:

- Frontend: <http://localhost:3000>
- Backend API: <http://localhost:4000>
- MinIO Console: <http://localhost:9001> (minioadmin/minioadmin)

## Technology Stack

### Frontend

- **Framework**: Vite 5 + React 19
- **Language**: TypeScript 5
- **Routing**: React Router 6
- **State Management**: Zustand
- **UI Components**: shadcn/ui (Radix UI + Tailwind CSS v4)
- **Data Fetching**: TanStack Query 5
- **Audio**: Howler.js
- **PWA**: Vite PWA Plugin + Custom Service Worker
- **Offline Storage**: Dexie (IndexedDB) + Cache Storage API

### Backend

- **Framework**: Hono 4 (Node.js)
- **ORM**: Prisma
- **Database**: PostgreSQL 16
- **Object Storage**: MinIO (S3-compatible)
- **Authentication**: JWT + GitHub OAuth
- **Validation**: Zod
- **Logging**: Pino

## Project Structure

```text
m3w/
├── .github/                      # Workflows, instructions, automation
├── assets/                       # Source design artifacts (not served at runtime)
│   ├── fonts/                    # Custom typefaces
│   ├── image/                    # Logos, favicons, marketing art
│   └── raw/                      # Working files (PSD, SVG, AI)
├── backend/                      # Hono backend (REST API)
│   ├── prisma/                   # Database schema and migrations
│   ├── src/
│   │   ├── index.ts              # Entry point
│   │   ├── lib/                  # Utilities (JWT, Prisma, Logger)
│   │   └── routes/               # API route handlers
│   ├── .env                      # Environment variables (git-ignored)
│   └── package.json
├── frontend/                     # Vite frontend (React SPA)
│   ├── public/                   # Static assets (PWA icons)
│   ├── src/
│   │   ├── components/           # UI components
│   │   │   ├── features/         # Feature-specific (player, upload, etc.)
│   │   │   ├── layouts/          # Layout components
│   │   │   └── ui/               # shadcn/ui base components
│   │   ├── hooks/                # React hooks
│   │   ├── lib/                  # Client utilities
│   │   │   ├── api/              # HTTP client
│   │   │   ├── audio/            # Audio player
│   │   │   └── offline-proxy/    # Offline mode handlers
│   │   ├── locales/              # i18n message catalogs
│   │   ├── pages/                # Route page components
│   │   ├── services/             # API service layer
│   │   └── stores/               # Zustand stores
│   ├── .env                      # Environment variables (git-ignored)
│   └── package.json
├── shared/                       # Shared types and schemas
│   └── src/
│       ├── schemas.ts            # Zod validation schemas
│       └── types/                # TypeScript definitions
├── docker/                       # Container definitions and examples
├── docs/                         # Documentation
├── scripts/                      # Build and utility scripts
├── docker-compose.yml            # Local dev services
└── package.json                  # Root workspace config
```

## Available Scripts

### Root Level

| Command | Description |
|---------|-------------|
| `npm run dev` | Start frontend + backend |
| `npm run dev:frontend` | Start frontend only (port 3000) |
| `npm run dev:backend` | Start backend only (port 4000) |
| `npm run build` | Build both frontend and backend |
| `npm run lint` | Run ESLint on all packages |
| `npm run test` | Run all tests |

### Database

| Command | Description |
|---------|-------------|
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:push` | Push schema changes (dev only) |
| `npm run db:migrate` | Run migrations |
| `npm run db:studio` | Open Prisma Studio |

### Container

| Command | Description |
|---------|-------------|
| `npm run docker:up` | Start Docker services |
| `npm run docker:down` | Stop Docker services |
| `npm run docker:logs` | View Docker logs |
| `npm run podman:up` | Start Podman services |
| `npm run podman:down` | Stop Podman services |

## Internationalization (i18n)

M3W uses a custom Proxy-based i18n system with full type safety.

### Usage

**In Components:**

```typescript
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';

export function MyComponent() {
  useLocale(); // Required for reactivity
  return <h1>{I18n.dashboard.title}</h1>;
}
```

**Switching Language:**

```typescript
import { setLocale } from '@/locales/i18n';

<button onClick={() => setLocale('zh-CN')}>中文</button>
```

### Adding New Text

1. Add to `frontend/src/locales/messages/en.json`
2. Run `npm run i18n:build` (or restart dev server)
3. Optionally add translation to `zh-CN.json`
4. Use in code: `I18n.category.key`

For detailed documentation, see [i18n system instructions](../.github/instructions/i18n-system.instructions.md).

## Testing

### Run Tests

```bash
# All tests
npm run test

# Frontend only
cd frontend && npm run test

# Backend only
cd backend && npm run test

# Watch mode
npm run test -- --watch
```

### Test Guidelines

- Use factory helpers for test fixtures
- Extend shared fixtures in `src/test/fixtures/`
- Mock Prisma with typed helpers
- Keep tests focused and independent

## API Architecture

The frontend uses a layered API client architecture:

```Text
Business Logic (Components, Hooks)
         │
    ┌────┴────┐
    │         │
mainApiClient  streamApiClient
 (JSON APIs)   (Binary Data)
    │         │
    └────┬────┘
         │
     apiClient
   (Low-level HTTP)
         │
   fetch / router
```

- Use `api.main.*` service layer for JSON APIs
- Use `streamApiClient` for audio/binary data
- Never use `apiClient` directly in business logic

See [API Client README](../frontend/src/services/api/README.md) for details.

## Docker vs Podman

| Feature | Docker | Podman |
|---------|--------|--------|
| Ease of Use | ✅ More intuitive | Requires podman-compose |
| Security | Daemon-based | Daemonless, rootless |
| License | Free for personal | Fully open source |

**Recommendation**: Use Docker for simplicity, Podman for security.

## Building Production Images

### Local Build Test

```bash
# Build artifacts and Docker images
node scripts/build-docker.cjs --type prod

# Or manually:
docker build -t m3w:local -f docker/Dockerfile docker-build-output/
```

### Run Production Container

```bash
# Ensure postgres and minio are running
docker-compose up -d

# Run production image
docker run -d --name m3w-test \
  --network m3w_default \
  -p 4000:4000 \
  --env-file backend/.env.docker \
  m3w:local
```

See [development-standards.instructions.md](../.github/instructions/development-standards.instructions.md) for detailed build and test procedures.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Follow [Conventional Commits](https://www.conventionalcommits.org/)
4. Run tests and lint before committing
5. Submit a Pull Request

## Additional Resources

- [Project Context](../.github/instructions/project-context.instructions.md) - Architecture and domain context
- [Development Standards](../.github/instructions/development-standards.instructions.md) - Coding conventions
- [API Patterns](../.github/instructions/api-patterns.instructions.md) - API response patterns
- [User Stories](../.github/instructions/user-stories.instructions.md) - Product requirements

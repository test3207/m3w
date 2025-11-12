# Project Context Instruction

## Current Execution Snapshot

### Architecture Overview

**Frontend**: Vite 5 + React 19 + React Router 6
**Backend**: Hono 4 (Node.js) + Prisma + PostgreSQL + MinIO + Redis

The project has been **migrated from Next.js to a separated frontend/backend architecture**:
- **Frontend** (`/frontend`): Pure SPA using Vite, React Router, and TanStack Query
- **Backend** (`/backend`): REST API using Hono framework with JWT authentication

### Completed
- Architecture design
- Technology stack selection
- Project structure planning
- Vite + React + Hono project initialization
- TypeScript configuration
- Prisma setup
- GitHub OAuth integration (JWT-based)
- Docker Compose local environment (Docker Hub baseline with China proxy guidance)
- Cross-platform setup scripts (PowerShell and Bash)
- China network configuration (Docker Hub proxy/mirror documentation)
- Basic authentication flow (sign-in and dashboard)
- Project structure validation
- UI component library integration (shadcn/ui)
- Modern UI implementation (homepage, signin, dashboard)
- Library services and API routes with dashboard management UI (create and delete, counts)
- Playlist services, ordering, API routes, and dashboard management UI
- Upload and metadata services covered by Vitest unit tests
- Toast feedback system unified via `use-toast` store and wired into playlist and library dashboard actions
- Audio streaming via API proxy with Range request support (MinIO access internalized)
- Internationalization (i18n) system with custom Proxy-based architecture, build tooling, and reactive language switching
- **PWA Integration**
  - Service Worker with Workbox for offline caching
  - IndexedDB via Dexie for offline data storage
  - Audio file caching with progress tracking
  - Metadata sync queue for offline mutations
  - Storage quota monitoring and management
  - Offline-capable router with fallback to IndexedDB proxy
- **Vite Migration Complete**
  - All pages migrated: Dashboard, Libraries, Playlists, Upload, Detail pages
  - React Router 6 implementation with dynamic routes
  - TanStack Query for data fetching
  - All Next.js imports removed
  - Server actions replaced with direct fetch API calls
- **Authentication System**
  - Hono backend with JWT tokens (6-hour access, 90-day refresh)
  - GitHub OAuth flow
  - Auto token refresh (triggers at 1 hour remaining, checks every 5 minutes)
  - Session persistence with Zustand store
- **Monorepo Structure**
  - Frontend and backend separated into distinct directories
  - Shared package for common types and schemas
  - Independent package.json for each workspace
  - Scripts directory for build tooling (.cjs files)
  - Environment variables properly segregated (backend/.env, frontend/.env)
- **Frontend API Architecture**
  - Layered client architecture with clear separation of concerns
  - `api.main.*` service layer for all business logic (libraries, playlists, songs, upload, player, auth)
  - `mainApiClient` for JSON API calls with automatic response unwrapping
  - `streamApiClient` for binary data (audio streams, blobs, files)
  - Low-level `apiClient` for internal use only (wrapped by higher-level clients)
  - Complete migration from direct API calls to service layer pattern
- **Network Status Monitoring**
  - Integrated network status indicator in dashboard navbar
  - Dual-layer detection: physical network (navigator.onLine) + backend API reachability
  - Custom event system for real-time connectivity updates
  - i18n support for status labels (online/offline/syncing)

### Active Initiatives (In Progress)
- **Demo & Evaluation**
  - User testing and first deployment
  - Read-only demo environment so stakeholders can trial the app without data liability
- **Deployment Pathfinding**
  - Lightweight deployment path (GitHub Actions → Aliyun/Azure) mirroring the local setup
- **Delivery & Infrastructure**
  - CI/CD pipeline
    - Build & release automation (lint/test/build/versioning/artifact)
    - Deployment automation (staging/prod rollouts & promotion gates)
  - Deployment strategy
    - Example/demo deployment flow (read-only environment)
    - Production deployment with observability & platform integrations
      - Kubernetes deployment configurations
      - Alignment of infrastructure tooling (Kubernetes, PostgreSQL, ELK, etc.) with the observability stack for production readiness
### Planned Initiatives (Upcoming)
- **Core Product Enhancements**
  - Enhanced user profile management
  - Redis integration for caching
  - Testing expansion (Playwright end-to-end, coverage targets)
- **PWA Enhancements**
  - Background sync for offline mutations
  - Push notifications for sync status
  - Advanced cache strategies and eviction policies
- **Observability & Operations**
  - Observability stack with Elasticsearch, Logstash, and Kibana for future production monitoring

## Project Overview

M3W is a multi-platform music player with a native-like experience, focusing on self-hosted deployment and complete ownership of the music library.

## Project Structure

```
m3w/
├── .github/                      # Automation, shared instructions, workflow configs
├── assets/                       # Source design assets (not served directly)
│   ├── fonts/                    # Custom typefaces and licensing docs
│   ├── image/                    # High-res logos, favicons, marketing art
│   └── raw/                      # Working files (PSD, SVG, AI) grouped by feature
├── backend/                      # Hono backend server (Node.js)
│   ├── src/
│   │   ├── index.ts              # Main entry point
│   │   ├── lib/                  # Shared utilities (JWT, Prisma, Logger)
│   │   └── routes/               # API route handlers
│   │       ├── auth.ts           # Authentication (GitHub OAuth, JWT)
│   │       ├── libraries.ts      # Library CRUD operations
│   │       ├── playlists.ts      # Playlist management
│   │       ├── songs.ts          # Song metadata and streaming
│   │       ├── upload.ts         # File upload handling
│   │       └── player.ts         # Playback state and preferences
│   ├── prisma/                   # Database schema and migrations
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── .env                      # Backend environment variables (git-ignored)
│   ├── .env.example              # Backend environment template
│   ├── package.json              # Backend dependencies
│   └── tsconfig.json             # Backend TypeScript config
├── frontend/                     # Vite frontend (React SPA)
│   ├── src/
│   │   ├── components/           # UI primitives, features, and layouts
│   │   │   ├── features/         # Feature-specific components
│   │   │   │   ├── dashboard/    # Dashboard cards and initializers
│   │   │   │   ├── network/      # Network status indicator
│   │   │   │   ├── player/       # Mini player and playback controls
│   │   │   │   ├── pwa/          # PWA prompts and utilities
│   │   │   │   └── upload/       # Upload form and file handling
│   │   │   ├── layouts/          # Layout components (navbar, shell)
│   │   │   ├── providers/        # Context providers (auth, etc.)
│   │   │   └── ui/               # shadcn/ui base components
│   │   ├── hooks/                # React hooks (useAuthRefresh, etc.)
│   │   ├── lib/                  # Client utilities and services
│   │   │   ├── api/              # Low-level HTTP client and routing
│   │   │   │   ├── client.ts     # Base HTTP client (internal use)
│   │   │   │   └── router.ts     # Request routing (online/offline)
│   │   │   ├── audio/            # Audio player and queue management
│   │   │   ├── sync/             # Offline sync service (planned)
│   │   │   └── logger-client.ts  # Client-side logging
│   │   ├── locales/              # i18n message catalogs
│   │   │   ├── messages/         # en.json, zh-CN.json
│   │   │   ├── generated/        # Auto-generated types
│   │   │   ├── i18n.ts           # Proxy-based i18n runtime
│   │   │   └── use-locale.ts     # React hook for reactivity
│   │   ├── pages/                # React Router page components
│   │   │   ├── HomePage.tsx      # Landing page
│   │   │   ├── SignInPage.tsx    # OAuth sign-in
│   │   │   ├── DashboardPage.tsx # Main dashboard
│   │   │   ├── LibrariesPage.tsx # Library list/create
│   │   │   ├── LibraryDetailPage.tsx # Library songs view
│   │   │   ├── PlaylistsPage.tsx # Playlist list/create
│   │   │   ├── PlaylistDetailPage.tsx # Playlist songs management
│   │   │   └── UploadPage.tsx    # File upload
│   │   ├── services/             # Service layer
│   │   │   └── api/              # API clients and resources
│   │   │       ├── index.ts      # Main export (api.main.*)
│   │   │       ├── README.md     # API architecture documentation
│   │   │       └── main/         # Main API service
│   │   │           ├── client.ts         # JSON API client
│   │   │           ├── stream-client.ts  # Binary data client
│   │   │           ├── endpoints.ts      # URL builders
│   │   │           ├── types.ts          # Shared types
│   │   │           └── resources/        # API resource services
│   │   │               ├── auth.ts       # Authentication
│   │   │               ├── libraries.ts  # Library management
│   │   │               ├── playlists.ts  # Playlist management
│   │   │               ├── songs.ts      # Song operations
│   │   │               ├── upload.ts     # File upload
│   │   │               └── player.ts     # Playback state
│   │   ├── stores/               # Zustand state stores
│   │   │   └── authStore.ts      # Auth state with auto-refresh
│   │   ├── test/                 # Unit and integration test helpers
│   │   ├── types/                # Shared TypeScript declarations
│   │   └── main.tsx              # Vite entry point with routing
│   ├── public/                   # Static assets (PWA icons, etc.)
│   ├── .env                      # Frontend environment variables (git-ignored)
│   ├── .env.example              # Frontend environment template
│   ├── index.html                # HTML entry point
│   ├── package.json              # Frontend dependencies and scripts
│   ├── vite.config.ts            # Vite configuration
│   ├── postcss.config.cjs        # PostCSS configuration
│   ├── tailwind.config.ts        # Tailwind CSS configuration
│   ├── tsconfig.json             # TypeScript compiler options
│   └── vitest.config.ts          # Vitest test runner configuration
├── shared/                       # Shared code between frontend and backend
│   ├── src/
│   │   ├── schemas/              # Zod validation schemas
│   │   └── types/                # Shared TypeScript types
│   ├── package.json              # Shared dependencies
│   └── tsconfig.json             # Shared TypeScript config
├── scripts/                      # Build and development scripts
│   ├── build-i18n.cjs            # i18n type generation
│   ├── watch-i18n.cjs            # i18n watch mode
│   └── generate-icons.cjs        # PWA icon generation
├── docker/                       # Container definitions and supporting scripts
│   ├── Dockerfile                # Backend production image
│   └── Dockerfile.dev            # Development image (if needed)
├── docs/                         # Developer documentation and regional guides
├── package.json                  # Root workspace configuration
├── docker-compose.yml            # Local development services
├── .dockerignore                 # Docker build exclusions
├── README.md                     # Project documentation
└── setup.ps1 / setup.sh          # Cross-platform setup scripts
```

### Asset Management

- Treat `assets/` as the source-of-truth for original design files; never import from this directory at runtime.
- Store optimized, production-ready files in `frontend/public/` for Vite to serve statically.
- Mirror directory names between `assets/` and `frontend/public/` when practical (for example `assets/image/library/hero.png` → `frontend/public/images/library/hero.png`) to keep provenance obvious.
- Keep derivative exports automated where possible (for example ImageMagick or Squoosh CLI); document the command used in `assets/README.md` when adding new asset families.
- PWA icon workflow: update the master artwork in `assets/image/fav.png`, then run `npm run icons:generate` from frontend directory to generate all required icon sizes.
- Avoid committing oversized or unused binaries—prune intermediates under `assets/raw/` once handed off to `image/` or `frontend/public/`.

### Core Features
- Self-hosted music library with full ownership
- Intelligent song metadata and lyrics matching
- Progressive Web App with offline-first architecture
- Near-native experience using Web Workers and proxy patterns
- Offline user experience designed for stability

## User Stories and Core Flows

### First-Time User Experience
- When a new user logs in, they see an empty library list with onboarding guidance.
- They can create their first music library.
- They understand that libraries are private.

### Music Library Management
- A user can create multiple music libraries.
- Users upload audio files to each library.
- The system extracts metadata (ID3 tags) and matches lyrics.
- Users view all libraries and the songs in each library.

### Playlist Creation
- Users create playlists that combine songs from multiple libraries.
- Users reorder songs within a playlist.
- Playlists remain private to each user.

### Offline Playback
- When online, a user marks songs or playlists to save locally.
- The system downloads audio files and metadata to IndexedDB or Cache Storage.
- When offline, downloaded songs remain playable.
- The UI indicates which songs are available offline.

### Long-Term Authentication
- Sessions persist for 90 days with refresh tokens.
- Users stay logged in unless a token is revoked server-side.
- Access tokens last 6 hours for uninterrupted music listening.
- Auto-refresh triggers when 1 hour remains, checking every 5 minutes.

### Storage Management
- Users request persistent storage to prevent data eviction.
- Users view storage quota usage (for example, "5.2 GB / 60 GB used").
- Users manage which libraries or playlists stay offline.

## Core Architecture Decisions

### Overall Architecture: Separated Frontend/Backend
- **Frontend**: Vite 5 + React 19 SPA with React Router 6
- **Backend**: Hono 4 REST API with JWT authentication
- End-to-end TypeScript type safety
- Independent deployment of frontend and backend
- Clear separation of concerns

```
┌─────────────────────────────────────────────┐
│        Vite Frontend (React SPA)            │
├─────────────────────────────────────────────┤
│  ├── React Router 6 (Client-side routing)   │
│  ├── TanStack Query (Data fetching)         │
│  ├── Zustand (Global state)                 │
│  ├── UI Components (shadcn/ui + Tailwind)   │
│  └── PWA (Service Worker + IndexedDB)       │
└─────────────────────────────────────────────┘
          ↓ HTTP/Fetch (port 3000 → 4000)
┌─────────────────────────────────────────────┐
│         Hono Backend (REST API)             │
│  ├── API Routes (/api/*)                   │
│  ├── Route Handlers (Hono)                 │
│  ├── Business Logic (Services)             │
│  ├── Database Access (Prisma ORM)          │
│  └── Authentication (JWT)                  │
├─────────────────────────────────────────────┤
│  Middleware Layer                           │
│  ├── Auth Middleware (JWT verification)    │
│  ├── CORS (hono/cors)                       │
│  ├── Logging (hono/logger + Pino)          │
│  └── Rate Limiting (Future)                 │
└─────────────────────────────────────────────┘
          ↓           ↓           ↓
    PostgreSQL     Redis      MinIO
```

### Technology Stack

#### Frontend Layer
- **Framework**: Vite 5
- **Runtime**: React 19
- **Language**: TypeScript 5
- **Routing**: React Router 6
- **UI Component Library**: shadcn/ui (Radix UI with Tailwind CSS)
- **Styling**: Tailwind CSS v4
- **Internationalization**: Custom Proxy-based i18n with auto-generated TypeScript types
- **State Management**: Zustand (auth, player state)
- **Form Handling**: React Hook Form with Zod
- **Data Fetching**: TanStack Query 5
- **Audio Processing**: Howler.js
- **Metadata Extraction (Client)**: `music-metadata-browser`
- **PWA**: Vite PWA Plugin
- **Offline Storage**: Dexie (IndexedDB wrapper)
- **Fuzzy Search**: Fuse.js

#### Backend Layer
- **Framework**: Hono 4 (Node.js)
- **ORM**: Prisma
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **File Storage**: MinIO (S3-compatible)
- **Authentication**: JWT (jsonwebtoken) with GitHub OAuth
- **Validation**: Zod
- **Logging**: Pino
- **Metadata Extraction**: `music-metadata`

#### PWA and Offline Features
- Service Worker: Vite PWA Plugin (Workbox)
- Cache Strategy:
  - Audio files: CacheFirst with range request support
  - API calls: NetworkFirst with fallback
  - Static assets: Precache
- IndexedDB usage:
  - Songs metadata
  - Playlists
  - Lyrics cache
  - Offline queue
- Web Workers for audio processing, lyrics matching, and background sync

#### Infrastructure

Local Development:
- Podman Desktop or Docker Desktop
- Next.js app (dev mode)
- PostgreSQL
- Redis
- MinIO

Production:
- Kubernetes deployment
- Container runtime: containerd
- Ingress: Nginx or Traefik
- Stateful services for PostgreSQL, Redis, MinIO
- Persistent volumes
- CI/CD via GitHub Actions
- Container registry: Docker Hub (official images)

### Database Design

The database uses PostgreSQL 16 with Prisma as the ORM. File storage follows a hash-based deduplication strategy with reference counting to avoid duplicate uploads.

Key points:
- File records are unique per SHA256 hash.
- Song metadata is user-specific and separate from physical file data.
- Reference counting determines when to delete unreferenced files.
- Upload flow checks for existing hashes to enable instant uploads.
- Metadata extraction occurs on both client and server, giving priority to user edits.

Refer to `prisma/schema.prisma` for the schema definition.

### Authentication Strategy
- Provider: GitHub OAuth
- Token Management: JWT (jsonwebtoken)
  - Access Token: 6 hours (configurable via `JWT_ACCESS_EXPIRY`)
  - Refresh Token: 90 days (configurable via `JWT_REFRESH_EXPIRY`)
- Auto-refresh: Triggers when 1 hour remains, checks every 5 minutes
- Security: HTTP-only cookies for Service Worker, JWT in Authorization header for API calls
- Session persistence: Zustand store with localStorage

### Deployment Strategy

Local Development:
- Start services with Podman or Docker Compose
- Run `npm run dev` for the Vite frontend (port 3000)
- Run `npm run dev` in `/backend` for the Hono server (port 4000)
- Apply database migrations with `npx prisma migrate dev`

Production Pipeline:
- GitHub Actions builds Docker images and pushes to Docker Hub
- Kubernetes performs rolling updates with health checks
- An init container runs `prisma migrate deploy`

Observability plans include Pino logging, optional Prometheus and Grafana, optional OpenTelemetry, and alerting via Kubernetes events.

### Scalability Considerations
- Both frontend and backend are stateless and support horizontal scaling.
- JWT tokens enable stateless authentication across multiple instances.
- Redis provides shared caching.
- Future microservice extraction possible with clear backend separation.
- Integration points reserved for message queues, search, object storage, email, and upload pipelines.

## Pending Decisions
- Detailed testing strategy (Vitest, Playwright, coverage targets)
- CI/CD automation specifics (test pipeline, deployment approvals, environment management)
- User language preference persistence strategy (database-backed recommended)

## i18n System Architecture

The project uses a custom Proxy-based internationalization system that provides full type safety and reactive language switching without page refresh.

### Key Features
- **Property Access Syntax**: `I18n.dashboard.title` (not function calls)
- **Type Safety**: Auto-generated TypeScript definitions with JSDoc hover hints
- **Reactive Updates**: Event-driven language switching triggers component re-renders
- **Build Integration**: Automatic type generation on `npm run dev` and `npm run build`
- **Hot Reload**: Watch mode during development auto-rebuilds on changes

### File Structure
- `src/locales/messages/en.json` - Source of truth (218+ keys, nested structure)
- `src/locales/messages/zh-CN.json` - Chinese translations
- `src/locales/generated/types.d.ts` - Auto-generated TypeScript definitions
- `src/locales/i18n.ts` - Proxy runtime with event system
- `src/locales/use-locale.ts` - React hook for component reactivity
- `scripts/build-i18n.js` - Type generation and translation merging
- `scripts/watch-i18n.js` - Development hot reload

### Usage Patterns

**Client Components:**
```typescript
import { I18n } from '@/locales/i18n';
import { useLocale } from '@/locales/use-locale';

export default function MyComponent() {
  useLocale(); // Subscribe to language changes
  return <h1>{I18n.dashboard.title}</h1>;
}
```

**API Routes:**
```typescript
import { I18n } from '@/locales/i18n';

export async function POST() {
  return NextResponse.json({
    message: I18n.error.unauthorized
  });
}
```

**Language Switching:**
```typescript
import { setLocale } from '@/locales/i18n';

<button onClick={() => setLocale('zh-CN')}>中文</button>
```

### Adding New Text
1. Add key to `src/locales/messages/en.json`
2. Build script auto-generates TypeScript types
3. Add translation to `zh-CN.json` (optional, defaults to English)
4. Use in code: `I18n.category.newKey`

### Architecture Decisions
- Full CSR (root layout marked `'use client'`) to avoid SSR hydration mismatches
- No localStorage persistence (reserved for future database-backed preferences)
- Module-level initialization ensures consistent server/client state
- `suppressHydrationWarning` on i18n text elements prevents React warnings

## References
- Next.js Documentation: https://nextjs.org/docs
- Prisma Documentation: https://www.prisma.io/docs
- NextAuth.js v5: https://authjs.dev
- Tailwind CSS: https://tailwindcss.com/docs
- TypeScript Handbook: https://www.typescriptlang.org/docs
# Project Context Instruction

## Current Execution Snapshot

### Completed
- Architecture design
- Technology stack selection
- Project structure planning
- Next.js project initialization
- TypeScript configuration
- Prisma setup
- NextAuth.js integration (GitHub OAuth)
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
- **Offline & Client Experience**
  - Full PWA integration with offline-first playback and caching flows
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
├── docker/                       # Container definitions and supporting scripts
├── docs/                         # Developer documentation and regional guides
├── prisma/                       # Database schema and migrations
├── public/                       # Web-ready static files served verbatim by Next.js
├── src/
│   ├── app/                      # App Router entry points, route groups, static icons
│   ├── components/               # UI primitives, features, and layouts
│   ├── lib/                      # Business logic, adapters, and cross-cutting utilities
│   ├── locales/                  # i18n message catalogs
│   ├── test/                     # Unit and integration test helpers
│   └── types/                    # Shared TypeScript declarations
├── package.json                  # Project manifest and npm scripts
├── tailwind.config.ts            # Tailwind CSS configuration
├── tsconfig.json                 # TypeScript compiler options
└── vitest.config.ts              # Vitest test runner configuration
```

### Asset Management

- Treat `assets/` as the source-of-truth for original design files; never import from this directory at runtime.
- Store optimized, production-ready files in `public/` or App Router icon slots (`src/app/icon.png`, `src/app/apple-icon.png`, and friends) so that Next.js can serve them statically.
- Mirror directory names between `assets/` and `public/` when practical (for example `assets/image/library/hero.png` → `public/images/library/hero.png`) to keep provenance obvious.
- Keep derivative exports automated where possible (for example ImageMagick or Squoosh CLI); document the command used in `assets/README.md` when adding new asset families.
- Favicon workflow: update the master artwork in `assets/image/fav.png`, then copy its optimized variant to `src/app/icon.png` (App Router favicon) and `public/favicon.png` (legacy fallbacks) during releases.
- Avoid committing oversized or unused binaries—prune intermediates under `assets/raw/` once handed off to `image/` or `public/`.

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
- Access tokens refresh automatically every 15 minutes.

### Storage Management
- Users request persistent storage to prevent data eviction.
- Users view storage quota usage (for example, "5.2 GB / 60 GB used").
- Users manage which libraries or playlists stay offline.

## Core Architecture Decisions

### Overall Architecture: Next.js Full-Stack (Monolithic)
- Single codebase with frontend and backend separation
- End-to-end TypeScript type safety
- Integrated SSR, SSG, and API routes
- Simplified single-container deployment for self-hosting
- Reduced network hops and synchronized deployments

```
┌─────────────────────────────────────────────┐
│           Next.js Application               │
├─────────────────────────────────────────────┤
│  Frontend Layer                             │
│  ├── App Router (/app)                      │
│  ├── Server Components (SSR)                │
│  ├── Client Components                      │
│  └── UI Components (React + Component Lib)  │
├─────────────────────────────────────────────┤
│  Backend Layer                              │
│  ├── API Routes (/app/api/*)                │
│  ├── Route Handlers (Node.js)               │
│  ├── Business Logic (Services)              │
│  ├── Database Access (ORM)                  │
│  └── Authentication (NextAuth.js)           │
├─────────────────────────────────────────────┤
│  Middleware Layer                           │
│  ├── Auth Check (middleware.ts)             │
│  ├── Logging                                │
│  └── Rate Limiting (Future)                 │
└─────────────────────────────────────────────┘
          ↓           ↓           ↓
    PostgreSQL     Redis      Other Services
```

### Technology Stack

#### Frontend Layer
- Framework: Next.js 15 (App Router)
- Runtime: React 18
- Language: TypeScript 5
- UI Component Library: shadcn/ui (Radix UI with Tailwind CSS)
- Styling: Tailwind CSS v4
- Internationalization: Custom Proxy-based i18n with auto-generated TypeScript types
- State Management: Zustand or Valtio (proxy-based reactivity)
- Form Handling: React Hook Form with Zod
- Data Fetching: `fetch` in server components and TanStack Query in client components
- Audio Processing: Howler.js
- Metadata Extraction (Client): `music-metadata-browser`
- PWA: `@serwist/next`
- Offline Storage: Dexie (IndexedDB wrapper)
- Fuzzy Search: Fuse.js

#### Backend Layer
- API: Next.js Route Handlers (`/app/api/*`)
- ORM: Prisma
- Database: PostgreSQL 16
- Cache: Redis 7
- File Storage: MinIO (S3-compatible)
- Authentication: NextAuth.js v5 with GitHub OAuth provider
- Validation: Zod
- Logging: Pino
- Metadata Extraction: `music-metadata`

#### PWA and Offline Features
- Service Worker: Workbox or Serwist
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
- Provider: GitHub OAuth via NextAuth.js v5
- Session storage: Prisma adapter with PostgreSQL
- Security: CSRF protection, HTTP-only cookies, secure cookies in production, session expiration handling

### Deployment Strategy

Local Development:
- Start services with Podman or Docker Compose
- Run `npm run dev` for the Next.js server
- Apply database migrations with `npx prisma migrate dev`

Production Pipeline:
- GitHub Actions builds Docker images and pushes to Docker Hub
- Kubernetes performs rolling updates with health checks
- An init container runs `prisma migrate deploy`

Observability plans include Pino logging, optional Prometheus and Grafana, optional OpenTelemetry, and alerting via Kubernetes events.

### Scalability Considerations
- The Next.js app is stateless and supports horizontal scaling.
- Sessions in the database enable multiple app instances.
- Redis provides shared caching.
- Future microservice extraction keeps Next.js as the backend-for-frontend while splitting specialized services if needed.
- Integration points reserved for message queues, search, object storage, email, and upload pipelines.

## Pending Decisions
- State management library choice beyond server components (Zustand or Jotai)
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
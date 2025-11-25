# Project Context Instruction

## Current Execution Snapshot

### Architecture Overview

**Frontend**: Vite 5 + React 19 + React Router 6
**Backend**: Hono 4 (Node.js) + Prisma + PostgreSQL + MinIO

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
- **PWA Integration** ✅ **COMPLETED** (Issue #49)
  - Custom Service Worker with token injection and Range request support
  - Cache Storage API for audio/cover files (replaces IndexedDB blobs)
  - IndexedDB via Dexie for metadata storage (libraries, playlists, songs)
  - Dual-layer token storage (localStorage + IndexedDB for Service Worker access)
  - Guest mode audio caching with `/guest/songs/:id/stream` URLs
  - Auth mode cache-first strategy with backend fallback
  - Range request support for seek functionality (206 Partial Content)
  - Playback state persistence (preferences, progress) via IndexedDB
  - Offline-capable router with fallback to IndexedDB proxy
- **Vite Migration Complete**
  - All pages migrated: Dashboard, Libraries, Playlists, Upload, Detail pages, Settings
  - React Router 6 implementation with dynamic routes
  - TanStack Query for data fetching
  - All Next.js imports removed
  - Server actions replaced with direct fetch API calls
- **Authentication System**
  - Hono backend with JWT tokens (6-hour access, 90-day refresh)
  - GitHub OAuth flow
  - Auto token refresh (triggers at 1 hour remaining, checks every 5 minutes)
  - Session persistence with Zustand store
  - Settings page with user profile display and logout functionality
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
- **Type System Unification**
  - Removed duplicate frontend Song type, imported from @m3w/shared
  - Unified coverUrl property (replaced coverArtUrl references)
  - Duration field accessed via song.file?.duration (optional file relation)
  - All 8 TypeScript errors resolved
- **Audio Playback System**
  - Howler.js integration with proper MIME type detection
  - Audio preload strategy using blob URLs for authentication
  - Playback progress persistence (resume from last position)
  - Auto-save progress with 2-second debounce
  - Full queue restoration from context (library/playlist)
- **Demo Mode** ✅ **COMPLETED**
  - Compile-time control via BUILD_TARGET environment variable (rc/prod)
  - Runtime toggle via DEMO_MODE backend environment variable
  - Storage limit enforcement (5GB default, configurable)
  - Hourly data reset with cron scheduler (optional)
  - User-facing banner with storage usage and free music resource links
  - Frontend API detection pattern (no frontend env vars needed)
  - Complete code tree-shaking in production builds
  - Accessible banner component using Stack, Text, Separator primitives
  - Local development and Docker deployment support
- **Guest Mode (Offline-First)** ✅ **COMPLETED** (PR #47)
  - Zero-friction entry: "Offline Mode" button on sign-in page
  - Full feature parity without account: upload, play, manage libraries/playlists
  - Router automatically routes guest requests to offline proxy
  - IndexedDB-based local storage with auto-initialization
  - Cover art extraction from audio files (music-metadata)
  - HMR fixes and proper initialization
  - No backend API calls in guest mode
- **Storage Quota Monitoring UI** ✅ **COMPLETED** (Issue #50, PR #52)
  - StorageManager component with real-time quota display
  - Three-layer cache synchronization (background sync + immediate validation + SW bridge)
  - Cascade delete with Dexie transaction and file reference counting
  - Persistent storage request handling with browser-specific messaging
  - Storage constants centralized in storage-constants.ts
  - Offline-proxy feature parity (playlist reorder, library sorting with pinyin)

### Active Initiatives (In Progress)
- **User Testing & Evaluation**
  - Ongoing user testing
  - Stakeholder feedback collection
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

- **Mobile-First UI Refactor** ✅ **COMPLETED** (2025-11-13)
  - Zustand state management (libraryStore, playlistStore, enhanced playerStore)
  - Mobile-first layout components (MobileLayout, MobileHeader, BottomNavigation)
  - Event-driven architecture for cross-component sync (EventBus)
  - Layout vertical scrollbar fix with precise height calculation
  - Redesigned library/playlist cards (stacked layout with 96px covers)
  - Removed redundant Now Playing page (simplified to 3-tab navigation)
  - Visual indicator for currently playing song in playlists
  - Redesigned full-screen player with anchored controls and text labels
  - Login redirect fix (/libraries instead of /now-playing)
  - Complete mobile UI/UX improvements

### Planned Initiatives (Upcoming)
- **Core Product Enhancements**
  - Enhanced user profile management
  - Testing expansion (Playwright end-to-end, coverage targets)
- **PWA Enhancements**
  - Cache management utilities (Issue #51)
  - Background sync for offline mutations
  - Push notifications for sync status
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
│   │   │   │   ├── libraries/    # Library management components
│   │   │   │   ├── navigation/   # Bottom navigation and FAB
│   │   │   │   ├── network/      # Network status indicator
│   │   │   │   ├── player/       # MiniPlayer, FullPlayer, PlayQueueDrawer
│   │   │   │   ├── playlists/    # Playlist management components
│   │   │   │   ├── pwa/          # PWA prompts and utilities
│   │   │   │   └── upload/       # Upload drawer and form handling
│   │   │   ├── layouts/          # Layout components (MobileLayout, MobileHeader)
│   │   │   ├── providers/        # Context providers (auth, etc.)
│   │   │   └── ui/               # shadcn/ui base components
│   │   ├── hooks/                # React hooks (useAuthRefresh, etc.)
│   │   ├── lib/                  # Client utilities and services
│   │   │   ├── api/              # Low-level HTTP client and routing
│   │   │   │   ├── client.ts     # Base HTTP client (internal use)
│   │   │   │   └── router.ts     # Request routing (online/offline)
│   │   │   ├── audio/            # Audio player and queue management
│   │   │   │   ├── player.ts     # Howler.js wrapper
│   │   │   │   └── prefetch.ts   # Audio preloading (skips Guest URLs)
│   │   │   ├── auth/             # Authentication utilities
│   │   │   │   └── token-storage.ts  # Dual-layer token sync (localStorage + IndexedDB)
│   │   │   ├── db/               # IndexedDB schema and utilities
│   │   │   │   └── schema.ts     # Dexie schema with metadata tables
│   │   │   ├── offline-proxy/    # Guest mode API simulation
│   │   │   │   ├── index.ts      # Main router composition
│   │   │   │   ├── routes/       # Domain-specific route handlers
│   │   │   │   │   ├── libraries.ts
│   │   │   │   │   ├── playlists.ts
│   │   │   │   │   ├── songs.ts
│   │   │   │   │   ├── upload.ts
│   │   │   │   │   └── player.ts
│   │   │   │   └── utils/        # Shared utilities (auth, sorting)
│   │   │   ├── pwa/              # PWA and caching utilities
│   │   │   │   └── cache-manager.ts  # Cache Storage API helpers
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
│   │   │           ├── types/            # Shared types (modular)
│   │   │           └── resources/        # API resource services
│   │   │               ├── auth.ts       # Authentication
│   │   │               ├── libraries.ts  # Library management
│   │   │               ├── playlists.ts  # Playlist management
│   │   │               ├── songs.ts      # Song operations
│   │   │               ├── upload.ts     # File upload
│   │   │               └── player.ts     # Playback state
│   │   ├── stores/               # Zustand state stores
│   │   │   ├── authStore.ts      # Auth state with auto-refresh
│   │   │   ├── libraryStore.ts   # Library management state
│   │   │   ├── playlistStore.ts  # Playlist management state
│   │   │   ├── playerStore.ts    # Audio player and queue state
│   │   │   └── uiStore.ts        # UI state (drawers, modals)
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
          ↓           ↓
    PostgreSQL     MinIO
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
- **PWA**: Vite PWA Plugin (injectManifest strategy)
- **Service Worker**: Custom implementation with token injection and Range request support
- **Offline Storage**: 
  - Dexie (IndexedDB wrapper) for metadata
  - Cache Storage API for audio/cover files
- **Fuzzy Search**: Fuse.js

#### Backend Layer
- **Framework**: Hono 4 (Node.js)
- **ORM**: Prisma
- **Database**: PostgreSQL 16
- **File Storage**: MinIO (S3-compatible)
- **Authentication**: JWT (jsonwebtoken) with GitHub OAuth
- **Validation**: Zod
- **Logging**: Pino
- **Metadata Extraction**: `music-metadata`

#### PWA and Offline Features
- Service Worker: Custom implementation (replaces Workbox)
  - Token injection from IndexedDB for authenticated requests
  - Range request support for audio seeking (206 Partial Content)
  - Cache-first strategy for media files
  - Guest mode URLs (`/guest/songs/*`) served from cache
- Cache Strategy:
  - Audio/cover files: Cache Storage API (Cache-first with Range support)
  - API calls: NetworkFirst with offline fallback
  - Static assets: Precached by Vite PWA Plugin
- IndexedDB usage (metadata only):
  - Libraries, playlists, songs (no blobs)
  - Player preferences and progress
  - Sync queue for offline mutations (planned)
- Token Storage:
  - Dual-layer: localStorage (main thread) + IndexedDB (Service Worker access)
  - Auto-sync on login/logout

#### Infrastructure

Local Development:
- Podman Desktop or Docker Desktop
- Next.js app (dev mode)
- PostgreSQL
- MinIO

Production:
- Kubernetes deployment
- Container runtime: containerd
- Ingress: Nginx or Traefik
- Stateful services for PostgreSQL, MinIO
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

### Default Resources Strategy

**Design Decision**: Use `isDefault` boolean flag to identify default resources.

When a user first signs in, the system auto-creates:
- **Default Library**: `isDefault: true`, `canDelete: false`, name = "Default Library"
- **Favorites Playlist**: `isDefault: true`, `canDelete: false`, name = "Favorites"

**Key Benefits**:
- **Unique IDs per User**: Each user gets unique cuid() generated IDs, avoiding multi-user conflicts
- **Simple Flag Check**: Use `isDefault` boolean to identify default resources
- **Database Best Practice**: Standard UUID primary keys, no special ID patterns
- **Type Safety**: Helper functions `isDefaultLibrary()` and `isFavoritesPlaylist()` in `@m3w/shared/constants`
- **i18n Display**: Frontend uses `getLibraryDisplayName()` and `getPlaylistDisplayName()` to show localized names instead of database names
- **Scalable**: Can easily add more default types (e.g., "work library") by adding more flags

**Implementation**:
```typescript
// Backend creation (auth.ts)
const defaultLibrary = await prisma.library.create({
  data: {
    name: 'Default Library',  // Frontend displays i18n translation
    userId,
    isDefault: true,
    canDelete: false,
  },
});

// Frontend display (LibrariesPage.tsx)
import { getLibraryDisplayName } from '@/lib/utils/defaults';
<h3>{getLibraryDisplayName(library)}</h3>  // Shows i18n translated name

// Frontend check (stores)
import { isDefaultLibrary } from '@m3w/shared';
const defaultLib = libraries.find(isDefaultLibrary);
```

**Helper Functions** (in `shared/src/constants.ts`):
- `isDefaultLibrary(library)` - Check if a Library is the default one
- `isFavoritesPlaylist(playlist)` - Check if a Playlist is the favorites one
- Frontend: `getLibraryDisplayName()`, `getPlaylistDisplayName()` - Get localized names
- Frontend: `getLibraryBadge()`, `getPlaylistBadge()` - Get status badges
- Frontend: `canDeleteLibrary()`, `canDeletePlaylist()` - Check deletion permissions

**Database Indexing**:
- Primary key on `id` (standard cuid())
- Composite indexes on `(userId, isDefault)` optimize queries for default resources
- Partial indexes (where `isDefault = true`) reduce index size for common lookups

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
- Future microservice extraction possible with clear backend separation.
- Integration points reserved for message queues, search, object storage, email, and upload pipelines.

## Architecture Decisions & Technical Debt

### Guest Mode vs Temporary Offline (2025-11-20)

**Decision**: Guest Mode and Authenticated User Offline share the same infrastructure.

**Rationale**:
- Both scenarios involve local data storage (IndexedDB)
- The only difference is whether to sync with backend
  - Guest User: Never syncs (no account)
  - Auth User Offline: Syncs when online (has account)
- Router determines routing based on `isGuest` flag and network status
- Unified data schema reduces duplication

**Implementation**:
```typescript
// Two dimensions define behavior:
// 1. User Type: Guest (no account) vs Auth (has account)
// 2. Network: Online vs Offline

// Router logic:
if (isGuest) {
  → Always use OfflineProxy (never call backend)
} else if (isOnline) {
  → Try backend, fallback to OfflineProxy if offline-capable
} else {
  → Use OfflineProxy if offline-capable, else error
}
```

**Known Issues** (Technical Debt):
1. **Sync Queue Design**: Current implementation replays API operations (create/update/delete), which causes conflicts and accumulation. Should be refactored to state-based synchronization with three-way merge.
2. **Storage Quota Monitoring**: No user-facing UI for storage usage (Issue #50).
3. **Cache Management**: Manual cleanup and statistics utilities needed (Issue #51).

### Offline Sync Strategy (2025-11-20)

**Current Implementation**: Operation Replay (Sync Queue)
- Queues API operations (create/update/delete) with full payload
- Replays operations on reconnect
- Problems: Conflicts, accumulation, dependency issues

**Future Direction**: State-Based Synchronization
- Track dirty entities with timestamps (not operations)
- Three-way merge: Backend state, Local state, Common ancestor
- Conflict resolution: Last-Write-Wins or User-Choose
- Implementation tracked in Milestone 1 technical debt issues

### Media Storage Strategy (2025-11-20)

**Current Implementation**: Cache Storage API ✅ **COMPLETED** (Issue #49)
- Audio files and covers stored in Cache Storage API
- Service Worker intercepts `/api/songs/:id/stream` and `/guest/songs/:id/stream`
- Range request support for seeking (206 Partial Content)
- Token injection from IndexedDB for authenticated requests

**Architecture**:
```
Service Worker
├─ Cache API: Audio files (Range request support)
└─ Cache API: Cover images

IndexedDB
├─ Songs metadata only
├─ Libraries
├─ Playlists
├─ Player preferences
└─ Player progress
```

**Benefits**:
- ✅ Larger storage quota (Cache Storage >> IndexedDB)
- ✅ Native HTTP caching support (Range requests, MIME types)
- ✅ Service Worker intercepts and serves requests
- ✅ Better browser optimization
- ✅ No `URL.createObjectURL()` memory leaks

**Follow-up**:
- Issue #50: Storage quota monitoring UI
- Issue #51: Cache management utilities

## Pending Decisions
- JWT tokens enable stateless authentication across multiple instances.
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
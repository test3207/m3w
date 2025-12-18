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
- **Multi-Region Architecture (Epic 3.6)** ✅ **Backend Complete** (#206)
  - Backend Redis integration for cross-region user routing
  - User model with `homeRegion` field for regional data sovereignty
  - JWT with `homeRegion` for intelligent routing via K8s Gateway
  - Redis-based duplicate prevention across regions (90-day TTL)
  - Graceful degradation for local development (Redis optional)
  - Next: K8s Gateway implementation (#204, #207), Cloudflare Pages (#208)
- **Delivery & Infrastructure**
  - CI/CD pipeline setup
  - Production deployment strategy

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
├── backend/        # Hono API + Prisma + PostgreSQL + MinIO
│   ├── src/        # routes/, lib/services/, lib/jwt.ts, lib/redis.ts
│   └── prisma/     # schema.prisma, migrations/
├── frontend/       # Vite SPA + React Router + TanStack Query
│   ├── src/        # components/, pages/, stores/, services/api/, lib/
│   └── public/     # PWA icons, static assets
├── shared/         # @m3w/shared types and schemas
├── scripts/        # .cjs build scripts (setup, i18n, docker, version)
└── docker/         # Dockerfiles and examples
```

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
  - Read cache for Auth offline (no dirty tracking)
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
- **User Renamable**: Names displayed from backend, users can rename default resources
- **Badge Display**: Frontend uses `getLibraryBadge()` and `getPlaylistBadge()` based on `isDefault` flag
- **Scalable**: Can easily add more default types (e.g., "work library") by adding more flags

**Implementation**:
```typescript
// Backend creation (auth.ts)
const defaultLibrary = await prisma.library.create({
  data: {
    name: 'Default Library',  // User can rename this
    userId,
    isDefault: true,
    canDelete: false,
  },
});

// Frontend display (LibrariesPage.tsx)
import { getLibraryDisplayName, getLibraryBadge } from '@/lib/utils/defaults';
<h3>{getLibraryDisplayName(library)}</h3>  // Shows database name (user can rename)
{getLibraryBadge(library) && <Badge>{getLibraryBadge(library)}</Badge>}  // Shows i18n badge if isDefault

// Frontend check (stores)
import { isDefaultLibrary } from '@m3w/shared';
const defaultLib = libraries.find(isDefaultLibrary);
```

**Helper Functions** (in `shared/src/constants.ts`):
- `isDefaultLibrary(library)` - Check if a Library is the default one
- `isFavoritesPlaylist(playlist)` - Check if a Playlist is the favorites one
- Frontend: `getLibraryDisplayName()`, `getPlaylistDisplayName()` - Get names from database (user-renamable)
- Frontend: `getLibraryBadge()`, `getPlaylistBadge()` - Get i18n status badges based on isDefault flag
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
1. **Storage Quota Monitoring**: No user-facing UI for storage usage (Issue #50).
2. **Cache Management**: Manual cleanup and statistics utilities needed (Issue #51).

### Offline Architecture (2025-12-11)

**Design Decision**: Simplified read-through cache with no dirty tracking.

- **Guest Mode**: Full CRUD in IndexedDB, no sync needed (local-only forever)
- **Auth Online**: All writes go directly to backend, IndexedDB caches GET responses
- **Auth Offline**: Read-only from IndexedDB cache (write operations blocked)

**Key Principle**: Backend is the single source of truth. No complex sync protocol.

**Metadata Sync** (`frontend/src/lib/sync/metadata-sync.ts`):
- Pull-only service - fetches latest data from backend
- Triggers: periodic (5min), online event
- Updates IndexedDB cache after each fetch

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



## References
- Next.js Documentation: https://nextjs.org/docs
- Prisma Documentation: https://www.prisma.io/docs
- NextAuth.js v5: https://authjs.dev
- Tailwind CSS: https://tailwindcss.com/docs
- TypeScript Handbook: https://www.typescriptlang.org/docs

# M3W Architecture Documentation

## Project Overview

**M3W** is a multi-platform music player with native-like experience, focusing on self-hosted deployment and complete ownership of music library.

**Core Features**:

- 🎵 Self-hosted music library with full ownership
- 🎯 Intelligent song metadata and lyrics matching
- 📱 Progressive Web App (PWA) with offline-first architecture
- ⚡ Near-native experience using Web Workers and Proxy patterns
- 🔄 Exceptional offline user experience

**Created**: 2025-11-06  
**Last Updated**: 2025-11-06

---

## User Stories & Core Flows

### 1. First-Time User Experience

**As a new user, when I first log in:**

- I see an empty library list with onboarding guidance
- I can create my first music library
- I understand that libraries are private (not shared with others)

### 2. Music Library Management

**As a user, I can:**

- Create multiple music libraries (e.g., "My Favorites", "Jazz Collection")
- Upload audio files to each library
- System automatically extracts metadata (ID3 tags) and matches lyrics
- View all my libraries and songs in each library

### 3. Playlist Creation

**As a user, I can:**

- Create playlists that combine songs from multiple libraries
- Reorder songs within a playlist
- Playlists remain private to me

### 4. Offline Playback

**As a user, when online:**

- I can select songs/playlists to "Save to Local"
- System downloads audio files and metadata to IndexedDB/Cache Storage
- When offline, I can play all downloaded songs seamlessly
- UI shows which songs are available offline

### 5. Long-Term Authentication

**As a user:**

- My login session persists for 90 days (refresh token)
- I don't need to re-login unless token is revoked server-side
- Access token auto-refreshes every 15 minutes

### 6. Storage Management

**As a user, I can:**

- Request persistent storage permission (prevent data eviction)
- View storage quota usage (e.g., "5.2 GB / 60 GB used")
- Manage which libraries/playlists are stored locally

---

## Core Architecture Decisions

### 1. Overall Architecture: Next.js Full-Stack (Monolithic)

**Rationale**:

- ✅ Single codebase with clear frontend/backend separation
- ✅ End-to-end TypeScript type safety
- ✅ Deep integration between SSR/SSG and API Routes
- ✅ Simplified single-container deployment for self-hosting
- ✅ Reduced network hops, better performance
- ✅ Atomic deployments, frontend/backend version synchronization

**Architecture Pattern**:

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

### 2. Technology Stack

#### Frontend Layer

- **Framework**: Next.js 15 (App Router)
- **Runtime**: React 18
- **Language**: TypeScript 5.x
- **UI Component Library**: shadcn/ui (Radix UI + Tailwind CSS)
- **Styling**: Tailwind CSS v4
- **State Management**: Zustand/Valtio (Proxy-based for reactivity)
- **Form Handling**: React Hook Form + Zod
- **Data Fetching**: Native fetch (Server Components) + TanStack Query (Client)
- **Audio Processing**: Howler.js (cross-browser audio library)
- **Metadata Extraction**: music-metadata-browser (ID3/metadata parsing)
- **PWA**: @serwist/next (Service Worker management)
- **Offline Storage**: Dexie (IndexedDB wrapper)
- **Fuzzy Search**: Fuse.js (lyrics/metadata matching)

#### Backend Layer

- **API**: Next.js Route Handlers (/app/api/\*)
- **ORM**: Prisma (type-safety first)
- **Database**: PostgreSQL 16
- **Cache**: Redis 7
- **File Storage**: MinIO (S3-compatible, self-hosted)
- **Authentication**: NextAuth.js v5 (Auth.js)
  - Provider: GitHub OAuth
- **Validation**: Zod
- **Logging**: Pino

#### PWA & Offline Features

- **Service Worker**: Workbox / Serwist
- **Cache Strategy**:
  - Audio files: CacheFirst (with Range requests support)
  - API: NetworkFirst with fallback
  - Static assets: Precache
- **IndexedDB**:
  - Songs metadata
  - Playlists
  - Lyrics cache
  - Offline queue
- **Web Workers**:
  - Audio processing (decoding, metadata extraction)
  - Lyrics matching (fuzzy search)
  - Background sync

#### Infrastructure

**Local Development**:

- Podman Desktop (or Docker Desktop)
  - Next.js App (dev mode)
  - PostgreSQL
  - Redis
  - MinIO (file storage)

**Production**:

- Kubernetes (K8s)
  - Container Runtime: containerd
  - Ingress: Nginx / Traefik
  - Next.js Deployment (multiple replicas)
  - PostgreSQL StatefulSet (or managed service)
  - Redis StatefulSet
  - MinIO StatefulSet
  - Persistent Volumes
- CI/CD: GitHub Actions
- Container Registry: GitHub Container Registry (GHCR)

### 3. Project Structure

```
m3w/
├── .github/
│   ├── copilot-instructions.md    # This document
│   └── workflows/                 # CI/CD configs
│
├── src/
│   ├── app/                       # Next.js App Router
│   │   ├── (auth)/               # Auth-related pages
│   │   │   ├── login/
│   │   │   └── signup/
│   │   ├── (dashboard)/          # Main app pages
│   │   │   └── dashboard/
│   │   ├── api/                  # Backend API Routes
│   │   │   ├── auth/             # NextAuth.js config
│   │   │   ├── users/
│   │   │   └── [...other]/
│   │   ├── layout.tsx            # Root layout
│   │   ├── page.tsx              # Home page
│   │   └── globals.css
│   │
│   ├── components/               # React components
│   │   ├── ui/                   # Base UI components
│   │   ├── features/             # Feature components
│   │   └── layouts/              # Layout components
│   │
│   ├── lib/                      # Shared libraries
│   │   ├── db/                   # Database client
│   │   │   ├── prisma.ts
│   │   │   └── music-db.ts       # Dexie IndexedDB
│   │   ├── redis/                # Redis client
│   │   ├── auth/                 # Auth utilities
│   │   ├── audio/                # Audio processing
│   │   │   ├── player.ts
│   │   │   └── queue.ts
│   │   ├── metadata/             # Metadata fetching
│   │   │   ├── fetcher.ts
│   │   │   └── matcher.ts
│   │   ├── storage/              # File storage
│   │   │   ├── minio-client.ts
│   │   │   └── cache-manager.ts
│   │   ├── services/             # Business logic
│   │   ├── utils/                # Utility functions
│   │   └── logger.ts             # Logger config
│   │
│   ├── workers/                  # Web Workers
│   │   ├── audio-processor.worker.ts
│   │   ├── lyrics-matcher.worker.ts
│   │   └── sync.worker.ts
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── api.ts
│   │   └── models.ts
│   │
│   └── middleware.ts             # Next.js middleware
│
├── prisma/
│   ├── schema.prisma             # Database schema
│   ├── migrations/               # DB migrations
│   └── seed.ts                   # Seed data
│
├── public/                       # Static assets
│
├── docker/                       # Container configs
│   ├── Dockerfile                # Production image
│   ├── Dockerfile.dev            # Dev image
│   └── docker-compose.yml        # Local dev orchestration (Podman/Docker compatible)
│
├── k8s/                          # Kubernetes configs (future)
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── ingress.yaml
│   └── configmap.yaml
│
├── .env.example                  # Environment variables template
├── .env.local                    # Local env vars (not committed)
├── next.config.js                # Next.js config
├── tsconfig.json                 # TypeScript config
├── tailwind.config.ts            # Tailwind CSS config
├── package.json
└── README.md
```

### 4. Database Design

**Database**: PostgreSQL 16

**ORM**: Prisma

- Type-safe queries
- Automatic migration management
- Built-in connection pooling

**Core Schema**:

```prisma
// prisma/schema.prisma

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  emailVerified DateTime?

  accounts      Account[]
  sessions      Session[]
  libraries     Library[]
  playlists     Playlist[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@map("users")
}

// Music Library (private, not shared)
model Library {
  id          String   @id @default(cuid())
  name        String
  description String?
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  songs       Song[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("libraries")
}

// Song
model Song {
  id          String   @id @default(cuid())
  title       String
  artist      String?
  album       String?
  duration    Int?     // seconds
  fileUrl     String   // MinIO file URL
  coverUrl    String?  // cover image

  libraryId   String
  library     Library  @relation(fields: [libraryId], references: [id], onDelete: Cascade)

  metadata    Json?    // raw ID3 data
  lyrics      Lyrics[]

  playlistSongs PlaylistSong[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([libraryId])
  @@map("songs")
}

// Lyrics
model Lyrics {
  id       String @id @default(cuid())
  songId   String
  song     Song   @relation(fields: [songId], references: [id], onDelete: Cascade)

  content  String @db.Text
  source   String // "netease" | "qq" | "spotify" | "manual"
  language String @default("zh-CN")

  createdAt DateTime @default(now())

  @@unique([songId, source])
  @@map("lyrics")
}

// Playlist (can contain songs from multiple libraries)
model Playlist {
  id          String   @id @default(cuid())
  name        String
  description String?
  coverUrl    String?

  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  songs       PlaylistSong[]

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("playlists")
}

// Playlist-Song relationship (supports ordering)
model PlaylistSong {
  playlistId String
  playlist   Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)

  songId     String
  song       Song     @relation(fields: [songId], references: [id], onDelete: Cascade)

  order      Int      @default(0)
  addedAt    DateTime @default(now())

  @@id([playlistId, songId])
  @@map("playlist_songs")
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@map("accounts")
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("sessions")
}
```

### 5. Authentication Strategy

**Auth Library**: NextAuth.js v5 (Auth.js)

**Provider**: GitHub OAuth

- Simple and reliable
- Developer-friendly
- Free with no limits

**Session Management**:

- Database Session (Prisma Adapter)
- Stored in PostgreSQL
- Redis cache for session data (optional optimization)

**Security Features**:

- CSRF protection (NextAuth.js built-in)
- HTTP-Only Cookies
- Secure Cookies (production)
- Session expiration management

### 6. Deployment Strategy

#### Local Development

```bash
# Start all services (Podman)
podman-compose up -d
# Or with Docker
docker-compose up -d

# Next.js dev server
npm run dev

# Database migrations
npx prisma migrate dev
```

#### Production Deployment Pipeline

1. **Build Phase**:

   - GitHub Actions triggered
   - Build Docker image
   - Push to GHCR

2. **Deploy Phase** (K8s):

   - Rolling Update strategy
   - Health Check probes
   - Automatic rollback

3. **Database Migration**:
   - Init Container runs `prisma migrate deploy`
   - Zero-downtime migration

#### Observability

- **Logging**: Pino → stdout → K8s log aggregation
- **Monitoring**: (Future) Prometheus + Grafana
- **Tracing**: (Future) OpenTelemetry
- **Alerting**: (Future) K8s Events + Alertmanager

### 7. Scalability Considerations

**Horizontal Scaling**:

- Next.js is stateless, can add replicas freely
- Sessions stored in database, supports multiple instances
- Redis for shared caching

**Future Microservice Split** (if needed):

```
Next.js App
  ├── Keep: UI + BFF (Backend for Frontend)
  └── Extract: Independent microservices
      ├── User Service (Node.js / Go)
      ├── Payment Service
      └── Notification Service
```

**Middleware Integration Points** (reserved):

- Message Queue: BullMQ + Redis
- Search Engine: Elasticsearch
- Object Storage: MinIO (S3-compatible)
- Email Service: Nodemailer
- File Upload: Multer / Uploadthing

---

## Development Standards

### TypeScript Standards

- Strict mode enabled (`strict: true`)
- No `any` (unless explicitly annotated with `// @ts-ignore`)
- Prefer `interface` for object type definitions
- Use Zod for runtime validation

### Code Organization

- Server Components first (reduce client-side JS)
- Client Components explicitly marked with `'use client'`
- Business logic extracted to `lib/services/`
- API Routes kept lightweight, call services

### Naming Conventions

- Components: PascalCase (`UserProfile.tsx`)
- Functions/Variables: camelCase (`getUserById`)
- Constants: UPPER_SNAKE_CASE (`API_BASE_URL`)
- Files: kebab-case (routes) / PascalCase (components)

### Git Workflow

- Branch strategy: `main` (production) / `develop` (development) / `feature/*`
- Commit convention: Conventional Commits
  - `feat:` New feature
  - `fix:` Bug fix
  - `docs:` Documentation update
  - `refactor:` Code refactoring
  - `test:` Test-related

---

## Pending Decisions

1. **State Management**:

   - [x] React Server Components first (current approach)
   - [ ] - Zustand (if client-side state needed)
   - [ ] - Jotai (atomic state alternative)

2. **Testing Strategy**:

   - [ ] Vitest (unit tests)
   - [ ] Playwright (E2E)
   - [ ] Test coverage targets

3. **CI/CD Details**:
   - [ ] Automated test pipeline
   - [ ] Deployment approval mechanism
   - [ ] Environment management (dev/staging/prod)

---

## Current Phase: Project Initialization

**Completed**:

- [x] Architecture design
- [x] Technology stack selection
- [x] Project structure planning
- [x] Next.js project initialization
- [x] TypeScript configuration
- [x] Prisma setup
- [x] NextAuth.js integration (GitHub OAuth)
- [x] Docker Compose local environment (GHCR + Docker Hub)
- [x] Cross-platform setup scripts (PowerShell + Bash)
- [x] China network configuration (GHCR default, proxy docs)
- [x] Basic authentication flow (sign-in, dashboard)
- [x] Project structure validation
- [x] UI component library integration (shadcn/ui)
- [x] Modern UI implementation (homepage, signin, dashboard)

**In Progress**:

- [ ] User testing and first deployment

**Upcoming**:

- [ ] Enhanced user profile management
- [ ] Business logic implementation (services layer)
- [ ] Redis integration for caching
- [ ] Testing framework (Vitest + Playwright)
- [ ] CI/CD pipeline
- [ ] K8s deployment configs

---

## References

- Next.js Documentation: <https://nextjs.org/docs>
- Prisma Documentation: <https://www.prisma.io/docs>
- NextAuth.js v5: <https://authjs.dev/>
- Tailwind CSS: <https://tailwindcss.com/docs>
- TypeScript Handbook: <https://www.typescriptlang.org/docs/>

---

**Document Version**: v1.0  
**Last Updated**: 2025-11-06

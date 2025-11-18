# Development Standards Instruction

## Project Portability Principles
- Keep the project portable and runnable without modification.
- Use `.env` (not `.env.local`) for all environment variables; `.env` stays git-ignored and `.env.example` is committed.
- Document all npm dependencies in `package.json`; use official npm registry by default and document mirror usage for restricted networks.
- Container configurations must rely on standard images with documented fallback mirrors.
- Handle paths with cross-platform utilities such as `path.join` and `path.resolve`; never hardcode absolute paths.
- Document prerequisites, setup instructions, and troubleshooting steps for all major platforms.
- Update this document immediately when new technical decisions are made.

## Module System Standards
- Root package.json has `"type": "module"` to treat .js files as ES modules.
- Build scripts use CommonJS (`require`, `module.exports`) and must have `.cjs` extension.
- Frontend and backend use ES modules (`import`/`export`) for all application code.
- Configuration files that use CommonJS must use `.cjs` extension (e.g., `postcss.config.cjs`).

## Testing and Type Safety
- Favor complete objects or factory helpers in tests to satisfy type constraints instead of chaining `as unknown as`.
- Introduce named type aliases for composite shapes to keep intent clear.
- Align mock return values with their interfaces; if a gap is unavoidable, use a single `as` with a clarifying comment.
- Extend shared fixtures in `frontend/src/test/fixtures/metadata.ts` and `backend/src/test/fixtures/prisma.ts` before creating new mock data sources.

## Key Technical Decisions
- File storage uses hash-based deduplication with reference counting; metadata remains user-specific.
- Audio cover art is extracted during upload, stored in MinIO under `covers/{fileHash}.jpg`, and always exposed as an absolute URL (built from `API_BASE_URL` + `/api/songs/:id/cover`) via the cover URL helper so future migrations (for example presigned URLs) do not require data changes and the fully separated frontend can consume the value directly.
- Audio streaming uses API proxy pattern (`/api/songs/[songId]/stream`) with Range request support; MinIO is never exposed to clients and remains internal to the backend network.
- Metadata extraction prioritizes user edits over backend extraction, and backend extraction over frontend extraction.
- Environment configuration requires separate `.env` files for frontend and backend.
- Backend environment variables in `backend/.env` (DATABASE_URL, JWT_SECRET, GITHUB_CLIENT_*, MinIO).
- Frontend environment variables in `frontend/.env` (VITE_API_URL).
- Container environments use `.env.docker` with `host.containers.internal` to access host services; local development uses `.env` with `localhost`.
- When the production container joins the docker-compose network (`m3w_default`), use container service names (`m3w-postgres`, `m3w-minio`) instead of `host.containers.internal`.
- Authentication uses JWT tokens with GitHub OAuth; no session database.
- PWA with offline-first architecture using IndexedDB via Dexie and Service Worker with Workbox.
- User feedback flows through the toast store defined in `frontend/src/components/ui/use-toast.ts` with a single `<Toaster />` in `frontend/src/main.tsx`.

## TypeScript Standards
- `strict: true` must remain enabled.
- Avoid `any` unless explicitly annotated with `// @ts-ignore` and justified.
- Prefer `interface` for object type definitions.
- Use Zod for runtime validation.

## Code Organization
- Keep business logic in `backend/src/lib/services`.
- Keep API routes thin and delegate to services.
- Frontend components organized by purpose: `components/ui` (primitives), `components/features` (domain), `components/layouts` (structure).
- Dashboard routes render inside `DashboardLayoutShell`; compose page sections with `AdaptiveLayout` and `AdaptiveSection` so base and minimum heights stay consistent across breakpoints.

## API Response Patterns
- API routes return `{ status, message, data? }` payloads for consistent error handling.
- Export shared response types from `shared/src/types` for consistency.
- Perform boundary validation with Zod or typed helpers before calling services.
- Log developer diagnostics through `backend/src/lib/logger.ts` while keeping user-facing messages concise.
- Client components map API responses to toasts using the `useToast` hook.

## Naming Conventions
- Components use PascalCase.
- Functions and variables use camelCase.
- Constants use UPPER_SNAKE_CASE.
- Files use kebab-case for routes and PascalCase for components.

## Git Workflow
- Branch strategy: `main` for production, `develop` for integration, `feature/*` for new work.
- **NEVER push directly to `main` branch**. Always create a feature branch and submit a Pull Request.
- Feature branch naming: `feature/<description>`, `fix/<description>`, `refactor/<description>`.
- PR workflow:
  1. Create feature branch from `main` or `develop`
  2. Make commits following Conventional Commits format
  3. Push feature branch to remote
  4. Create Pull Request with clear description
  5. Wait for review and approval before merging
- Follow Conventional Commits (for example `feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- Only commit or push when explicitly requested; keep the working state ready for commits at all times.

## Local Production Testing
- Build production images with `podman build -t m3w:local -f docker/Dockerfile .` or equivalent Docker command.
- Use `.env.docker` (created from `.env.docker.example`) for container environments.
- When using docker-compose services, the container must join the `m3w_default` network to access PostgreSQL and MinIO via their container names (`m3w-postgres`, `m3w-minio`).
- Run containers with `podman run -d --name m3w-prod --network m3w_default -p 4000:4000 --env-file backend/.env.docker m3w:local`.
- For standalone containers without compose, use `host.containers.internal` in `.env.docker` to access host services.
- Verify builds pass type checking, linting, and produce functional containers before deployment.
- Test authentication flows and database connectivity in the containerized environment.
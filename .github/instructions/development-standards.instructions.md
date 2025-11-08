# Development Standards Instruction

## Project Portability Principles
- Keep the project portable and runnable without modification.
- Use `.env` (not `.env.local`) for all environment variables; `.env` stays git-ignored and `.env.example` is committed.
- Document all npm dependencies in `package.json`; use official npm registry by default and document mirror usage for restricted networks.
- Container configurations must rely on standard images with documented fallback mirrors.
- Handle paths with cross-platform utilities such as `path.join` and `path.resolve`; never hardcode absolute paths.
- Document prerequisites, setup instructions, and troubleshooting steps for all major platforms.
- Update this document immediately when new technical decisions are made.

## Testing and Type Safety
- Favor complete objects or factory helpers in tests to satisfy type constraints instead of chaining `as unknown as`.
- Introduce named aliases (for example `LibraryWithCount`) for composite shapes to keep intent clear.
- Align mock return values with their interfaces; if a gap is unavoidable, use a single `as` with a clarifying comment.
- Extend shared fixtures in `src/test/fixtures/metadata.ts` and `src/test/fixtures/prisma.ts` before creating new mock data sources.

## Key Technical Decisions
- File storage uses hash-based deduplication with reference counting; metadata remains user-specific.
- Metadata extraction prioritizes user edits over backend extraction, and backend extraction over frontend extraction.
- Environment configuration requires central `.env` usage with dependencies recorded in `package.json`.
- Authentication relies on NextAuth.js v5 with GitHub OAuth and database-backed sessions.
- Offline-first architecture depends on Serwist service workers, IndexedDB via Dexie, and dual extraction for metadata.
- User feedback flows through the toast store defined in `src/components/ui/use-toast.ts` with a single `<Toaster />` in `src/app/layout.tsx`.

## TypeScript Standards
- `strict: true` must remain enabled.
- Avoid `any` unless explicitly annotated with `// @ts-ignore` and justified.
- Prefer `interface` for object type definitions.
- Use Zod for runtime validation.

## Code Organization
- Prefer server components to minimize client-side JavaScript.
- Mark client components with `'use client'`.
- Keep business logic in `src/lib/services`.
- Keep API routes thin and delegate to services.
- Dashboard routes render inside `DashboardLayoutShell`; compose page sections with `AdaptiveLayout` and `AdaptiveSection` so base and minimum heights stay consistent across breakpoints.

## Server Action Patterns
- Treat server actions as thin async wrappers around services that return `{ status, message, data? }` payloads for toast handling.
- Export shared initial state objects from action modules for consistent form state.
- Perform boundary validation with Zod or typed helpers before calling services.
- Log developer diagnostics through `src/lib/logger.ts` while keeping user-facing messages concise.

## Naming Conventions
- Components use PascalCase.
- Functions and variables use camelCase.
- Constants use UPPER_SNAKE_CASE.
- Files use kebab-case for routes and PascalCase for components.

## Git Workflow
- Branch strategy: `main` for production, `develop` for integration, `feature/*` for new work.
- Follow Conventional Commits (for example `feat:`, `fix:`, `docs:`, `refactor:`, `test:`).
- Only commit or push when explicitly requested; keep the working state ready for commits at all times.
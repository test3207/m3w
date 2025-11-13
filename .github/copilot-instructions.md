# M3W Copilot Instructions

## Metadata

**Created**: 2025-11-06  
**Last Updated**: 2025-11-12  
**Frontend Refactor Status**: Design Phase - User Stories Documented

## Mission Snapshot

- M3W is a self-hosted music player with separated frontend/backend architecture that prioritizes full library ownership and offline resilience.
- Immediate roadmap covers upload deduplication, playlist management, offline caching polish, and the first user-testing deployment.
- Core stack: Vite 5 + React 19 (frontend), Hono 4 + Node.js (backend), Prisma/PostgreSQL, MinIO, Redis (reserved), shadcn/ui, Tailwind CSS v4, PWA (planned), Dexie IndexedDB (planned).
- Internationalization: Custom Proxy-based i18n system with full type safety and reactive language switching.
- Frontend API: Unified service layer with type-safe clients (see project-context for details).

## Quick Reference (Hard Rules)

- Communicate with the user in Chinese; keep code, commands, and file contents in English unless existing text dictates otherwise.
- Prefer built-in VS Code tools; when commands are unavoidable, use Windows PowerShell syntax.
- Default to ASCII output; add concise English code comments only for non-obvious logic.
- Update the relevant instruction immediately after any confirmed technical decision or process change.
- Use Conventional Commit messages and only commit/push when explicitly requested by the user.

## Instruction Index

| File | Applies To | Purpose |
| --- | --- | --- |
| `.github/instructions/project-context.instructions.md` | `**/*` | Full project status, architecture, and domain context |
| `.github/instructions/development-standards.instructions.md` | `**/*` | Coding conventions, testing strategy, and workflow agreements |
| `.github/instructions/server-action-pattern.instructions.md` | `**/*` | API response pattern and usage guidance |
| `.github/instructions/ui-feedback-workflow.instructions.md` | `**/*` | Toast feedback pipeline and usage guidance |
| `.github/instructions/i18n-system.instructions.md` | `**/*` | Internationalization architecture and usage patterns |
| `.github/instructions/frontend-refactor-user-stories.instructions.md` | `frontend/**/*` | User stories and design decisions for frontend refactor (mobile-first) |
| `.github/instructions/frontend-refactor-api-changes.instructions.md` | `backend/**/*` | Required backend API changes for frontend refactor |

## How to Use These Instructions

- Need business context, core flows, or roadmap? Open `project-context.instructions.md`.
- Touching code style, typing, Git flow, or testing? Review `development-standards.instructions.md`.
- Writing or adjusting an API route? Revisit `server-action-pattern.instructions.md` before and after changes.
- Emitting user-visible feedback? Follow `ui-feedback-workflow.instructions.md` so all toasts stay consistent.
- Adding or modifying user-facing text? Follow `i18n-system.instructions.md` for proper i18n integration.
- **Working on frontend refactor?** Review `frontend-refactor-user-stories.instructions.md` for design decisions and user flows.
- **Implementing backend API changes?** Check `frontend-refactor-api-changes.instructions.md` for required endpoints and schema updates.

## Core Context Highlights

- **Architecture**: Separated frontend/backend with Vite SPA frontend and Hono REST API backend, Prisma for PostgreSQL, MinIO for deduplicated audio storage, Redis earmarked for caching.
- **Primary domains**: Library management, playlist authoring and ordering, upload deduplication with metadata extraction, offline playback via IndexedDB and Service Worker.
- **Current phase**: Vite migration complete, development environment operational. Next milestones include PWA integration, richer user profile data, Redis-backed caching, stronger automated testing, and CI/CD rollout.

## Working Agreements

- Keep business logic inside `backend/src/lib/services`; API routes stay thin wrappers.
- API routes return `{ status, message, data? }` for consistent error handling; client components convert these into toasts.
- Frontend API calls use `api.main.*` service layer (JSON) or `streamApiClient` (binary data); never use `apiClient` directly in business logic.
- Trigger toasts only from the client layer; never emit them directly inside API handlers.
- All user-facing text must use the i18n system (`I18n.category.key`); never hardcode strings.
- Client components using i18n must call `useLocale()` to respond to language changes; API routes only need `I18n` import.
- After editing any instruction, update the metadata block in this document.

## References

- Project context instructions: [project-context.instructions.md](./instructions/project-context.instructions.md)
- Development standards instructions: [development-standards.instructions.md](./instructions/development-standards.instructions.md)
- API response pattern: [server-action-pattern.instructions.md](./instructions/server-action-pattern.instructions.md)
- UI feedback workflow: [ui-feedback-workflow.instructions.md](./instructions/ui-feedback-workflow.instructions.md)
- i18n system: [i18n-system.instructions.md](./instructions/i18n-system.instructions.md)
- Frontend refactor user stories: [frontend-refactor-user-stories.instructions.md](./instructions/frontend-refactor-user-stories.instructions.md)
- Frontend refactor API changes: [frontend-refactor-api-changes.instructions.md](./instructions/frontend-refactor-api-changes.instructions.md)
- Frontend API client architecture: [frontend/src/services/api/README.md](../frontend/src/services/api/README.md)
- Vite Documentation: <https://vitejs.dev/>
- React Router Documentation: <https://reactrouter.com/>
- Hono Documentation: <https://hono.dev/>
- Prisma Documentation: <https://www.prisma.io/docs>
- Tailwind CSS: <https://tailwindcss.com/docs>
- TypeScript Handbook: <https://www.typescriptlang.org/docs/>

**Document Version**: v3.1  
**Last Updated**: 2025-11-12
- TypeScript Handbook: <https://www.typescriptlang.org/docs/>

**Document Version**: v3.1  
**Last Updated**: 2025-11-12

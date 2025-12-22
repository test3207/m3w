# M3W Copilot Instructions

## Metadata

**Created**: 2025-11-06  
**Last Updated**: 2025-12-22  
**Current Phase**: Multi-Region Architecture & Production Deployment

## Mission Snapshot

- M3W is a self-hosted music player with separated frontend/backend architecture that prioritizes full library ownership and offline resilience.
- Core online features complete: multi-library management, cross-library playlists, mobile-first UI, playback state management, PWA integration with offline capabilities.
- Demo mode complete: RC builds with storage limits, auto-reset, and user-facing banners for stakeholder evaluation.
- Current focus: User testing with RC builds, deployment preparation, and CI/CD pipeline setup.
- Core stack: Vite 5 + React 19 (frontend), Hono 4 + Node.js (backend), Prisma/PostgreSQL, MinIO, shadcn/ui, Tailwind CSS v4, PWA with Workbox, Dexie IndexedDB.
- Internationalization: Custom Proxy-based i18n system with full type safety and reactive language switching.
- Frontend API: Unified service layer with type-safe clients (see project-context for details).

## Quick Reference (Hard Rules)

- Communicate with the user in Chinese; keep code, commands, file contents, and **Pull Requests** in English unless existing text dictates otherwise.
- Prefer built-in VS Code tools; when commands are unavoidable, use Windows PowerShell syntax.
- Default to ASCII output; add concise English code comments only for non-obvious logic.
- Update the relevant instruction immediately after any confirmed technical decision or process change.
- Use Conventional Commit messages and only commit/push when explicitly requested by the user.
- **DO NOT create new documentation or test files without explicit user approval**. New content should be integrated into existing documents rather than creating scattered files.

## Instruction Index

| File | Applies To | Purpose |
| --- | --- | --- |
| `.github/instructions/project-context.instructions.md` | `**/*` | Project status, architecture, completed features |
| `.github/instructions/development-standards.instructions.md` | `**/*` | Code style, API patterns, i18n, testing, Git workflow, project management |
| `.github/instructions/user-stories.instructions.md` | `**/*` | Product requirements and user flows |
| `.github/instructions/release-workflow.instructions.md` | `**/*` | RC and production release procedures |

## How to Use These Instructions

- Architecture, status, completed features → `project-context.instructions.md`
- Code style, API patterns, i18n, Git workflow, project management → `development-standards.instructions.md`
- Product requirements, user flows → `user-stories.instructions.md`
- Release procedures (RC, production) → `release-workflow.instructions.md`

## Core Context Highlights

- **Architecture**: Separated frontend/backend with Vite SPA frontend and Hono REST API backend, Prisma for PostgreSQL, MinIO for deduplicated audio storage.
- **Primary domains**: Library management, playlist authoring and ordering, upload deduplication with metadata extraction, offline playback via IndexedDB and Service Worker.
- **Current phase**: Online and offline features complete. Demo mode deployed for stakeholder testing. Next milestone: Production deployment and CI/CD automation.

## Working Agreements

- Business logic in `backend/src/lib/services`; API routes stay thin
- API returns `{ success, data?, error? }`; toasts triggered from client only
- Frontend uses `api.main.*` (JSON) or `streamApiClient` (binary); never `apiClient` directly
- User-facing text uses `I18n.category.key`; no hardcoded strings
- After editing instructions, update metadata in this document

## References

- [project-context.instructions.md](./instructions/project-context.instructions.md)
- [development-standards.instructions.md](./instructions/development-standards.instructions.md)
- [user-stories.instructions.md](./instructions/user-stories.instructions.md)
- [release-workflow.instructions.md](./instructions/release-workflow.instructions.md)
- **GitHub Milestone 3** (Production Readiness): <https://github.com/test3207/m3w/milestone/3>
- **GitHub Project Board**: <https://github.com/users/test3207/projects/3>
- Vite Documentation: <https://vitejs.dev/>
- React Router Documentation: <https://reactrouter.com/>
- Hono Documentation: <https://hono.dev/>
- Prisma Documentation: <https://www.prisma.io/docs>
- Tailwind CSS: <https://tailwindcss.com/docs>
- TypeScript Handbook: <https://www.typescriptlang.org/docs/>

**Document Version**: v4.4  
**Last Updated**: 2025-12-22

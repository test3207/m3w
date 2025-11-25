# M3W Copilot Instructions

## Metadata

**Created**: 2025-11-06  
**Last Updated**: 2025-11-19  
**Current Phase**: User Testing & Deployment Preparation

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
| `.github/instructions/project-context.instructions.md` | `**/*` | Full project status, architecture, and domain context |
| `.github/instructions/development-standards.instructions.md` | `**/*` | Coding conventions, testing strategy, workflow agreements, and **project management** |
| `.github/instructions/api-patterns.instructions.md` | `**/*` | API response pattern and toast feedback workflow |
| `.github/instructions/i18n-system.instructions.md` | `**/*` | Internationalization architecture and usage patterns |
| `.github/instructions/user-stories.instructions.md` | `**/*` | Complete product requirements (online + offline experience) |

## How to Use These Instructions

- Need business context, core flows, or roadmap? Open `project-context.instructions.md`.
- Touching code style, typing, Git flow, or testing? Review `development-standards.instructions.md`.
- **Managing issues, epics, or milestones?** See the Project Management section in `development-standards.instructions.md`.
- Writing or adjusting an API route or toast feedback? Follow `api-patterns.instructions.md` for consistent response structure and user notifications.
- Adding or modifying user-facing text? Follow `i18n-system.instructions.md` for proper i18n integration.
- Understanding product requirements (online or offline)? Check `user-stories.instructions.md` for complete user flows and acceptance criteria.

## Core Context Highlights

- **Architecture**: Separated frontend/backend with Vite SPA frontend and Hono REST API backend, Prisma for PostgreSQL, MinIO for deduplicated audio storage.
- **Primary domains**: Library management, playlist authoring and ordering, upload deduplication with metadata extraction, offline playback via IndexedDB and Service Worker.
- **Current phase**: Online and offline features complete. Demo mode deployed for stakeholder testing. Next milestone: Production deployment and CI/CD automation.

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
- API patterns (response + toast): [api-patterns.instructions.md](./instructions/api-patterns.instructions.md)
- i18n system: [i18n-system.instructions.md](./instructions/i18n-system.instructions.md)
- User stories (online + offline): [user-stories.instructions.md](./instructions/user-stories.instructions.md)
- Frontend API client architecture: [frontend/src/services/api/README.md](../frontend/src/services/api/README.md)
- **GitHub Milestone**: <https://github.com/test3207/m3w/milestone/1>
- **GitHub Project Board**: <https://github.com/users/test3207/projects/3>
- Vite Documentation: <https://vitejs.dev/>
- React Router Documentation: <https://reactrouter.com/>
- Hono Documentation: <https://hono.dev/>
- Prisma Documentation: <https://www.prisma.io/docs>
- Tailwind CSS: <https://tailwindcss.com/docs>
- TypeScript Handbook: <https://www.typescriptlang.org/docs/>

**Document Version**: v4.2  
**Last Updated**: 2025-11-25

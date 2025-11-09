# M3W Copilot Instructions

## Metadata

**Created**: 2025-11-06  
**Last Updated**: 2025-11-09

## Mission Snapshot

- M3W is a self-hosted Next.js 15 music player that prioritizes full library ownership and offline resilience.
- Immediate roadmap covers upload deduplication, playlist management, offline caching polish, and the first user-testing deployment.
- Core stack: Next.js 15, React 18, Prisma/PostgreSQL, MinIO, Redis (reserved), shadcn/ui, Tailwind CSS v4, Serwist PWA, Dexie IndexedDB.
- Internationalization: Custom Proxy-based i18n system with full type safety and reactive language switching.

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
| `.github/instructions/server-action-pattern.instructions.md` | `**/*` | Server action design contract and return shape |
| `.github/instructions/ui-feedback-workflow.instructions.md` | `**/*` | Toast feedback pipeline and usage guidance |
| `.github/instructions/i18n-system.instructions.md` | `**/*` | Internationalization architecture and usage patterns |

## How to Use These Instructions

- Need business context, core flows, or roadmap? Open `project-context.instructions.md`.
- Touching code style, typing, Git flow, or testing? Review `development-standards.instructions.md`.
- Writing or adjusting a server action? Revisit `server-action-pattern.instructions.md` before and after changes.
- Emitting user-visible feedback? Follow `ui-feedback-workflow.instructions.md` so all toasts stay consistent.
- Adding or modifying user-facing text? Follow `i18n-system.instructions.md` for proper i18n integration.

## Core Context Highlights

- **Architecture**: Monolithic Next.js App Router with server components first, Prisma for PostgreSQL, MinIO for deduplicated audio storage, Redis earmarked for caching.
- **Primary domains**: Library management, playlist authoring and ordering, upload deduplication with metadata extraction, offline playback via IndexedDB and Service Worker.
- **Current phase**: Project bootstrap complete; preparing for the first round of user testing and deployment. Next milestones include richer user profile data, Redis-backed caching, stronger automated testing, and CI/CD rollout.

## Working Agreements

- Keep business logic inside `src/lib/services`; API routes stay thin wrappers.
- Export shared initial state objects alongside server actions so client forms reuse the same defaults.
- Server actions return `{ status, message, data? }`; client components convert these into toasts.
- Trigger toasts only from the client layer; never emit them directly inside server actions.
- All user-facing text must use the i18n system (`I18n.category.key`); never hardcode strings.
- Client components using i18n must call `useLocale()` to respond to language changes; API routes only need `I18n` import.
- After editing any instruction, update the metadata block in this document.

## References

- Project context instructions: [project-context.instructions.md](./instructions/project-context.instructions.md)
- Development standards instructions: [development-standards.instructions.md](./instructions/development-standards.instructions.md)
- Server action pattern: [server-action-pattern.instructions.md](./instructions/server-action-pattern.instructions.md)
- UI feedback workflow: [ui-feedback-workflow.instructions.md](./instructions/ui-feedback-workflow.instructions.md)
- i18n system: [i18n-system.instructions.md](./instructions/i18n-system.instructions.md)
- Next.js Documentation: <https://nextjs.org/docs>
- Prisma Documentation: <https://www.prisma.io/docs>
- NextAuth.js v5: <https://authjs.dev/>
- Tailwind CSS: <https://tailwindcss.com/docs>
- TypeScript Handbook: <https://www.typescriptlang.org/docs/>

**Document Version**: v2.2  
**Last Updated**: 2025-11-09

# Server Action Pattern Instruction

## Overview

Server Actions must remain thin wrappers around domain services to keep business logic centralized and testable. Each action should delegate work to a function in `src/lib/services` (or an equivalent layer) and only handle request validation, response shaping, and toast messaging.

## Requirements

- Always return a structured object in the shape `{ status, message, data? }` so client components can map directly to toast notifications.
- Normalize `status` to the string literals "success" or "error". Distinguish user-facing messaging (`message`) from developer diagnostics (log those separately).
- Perform input validation at the boundary using Zod schemas or typed helpers before calling the service layer.
- Catch service exceptions and translate them into the `{ status: "error", message }` payload while logging detailed errors with `src/lib/logger.ts`.
- Export a shared "initial state" object (for example `ADD_SONG_TO_PLAYLIST_INITIAL_STATE`) alongside the action to keep form state consistent across components.
- Never mutate global state directly inside an action—return data and let the caller update UI-specific stores.

## File Placement

- Action files live next to the UI route that invokes them (for example `src/app/(dashboard)/dashboard/playlists/[id]/actions.ts`).
- Service modules live under `src/lib/services` and must be free of framework-specific imports to stay unit-testable.
- Shared form state constants belong in the action file; extract to `src/lib/constants` only when reused across multiple actions.

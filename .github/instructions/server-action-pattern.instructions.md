# API Response Pattern Instruction

## Overview

API routes must remain thin wrappers around domain services to keep business logic centralized and testable. Each route handler should delegate work to a function in `backend/src/lib/services` and only handle request validation, response shaping, and error handling.

## Requirements

- Always return a structured object in the shape `{ status, message, data? }` so client components can map directly to toast notifications.
- Normalize `status` to the string literals "success" or "error". Distinguish user-facing messaging (`message`) from developer diagnostics (log those separately).
- Perform input validation at the boundary using Zod schemas or typed helpers before calling the service layer.
- Catch service exceptions and translate them into the `{ status: "error", message }` payload while logging detailed errors with `backend/src/lib/logger.ts`.
- Export shared response types from `shared/src/types` to keep frontend and backend in sync.
- Never expose internal implementation details in error messages—keep user-facing messages concise and actionable.

## File Placement

- API route handlers live in `backend/src/routes` (for example `backend/src/routes/playlists.ts`).
- Service modules live under `backend/src/lib/services` and must be free of framework-specific imports to stay unit-testable.
- Shared types and schemas belong in `shared/src` for use by both frontend and backend.

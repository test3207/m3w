# UI Feedback Workflow Instruction

## Goal

Ensure all transient feedback flows through a single toast pipeline so users receive consistent status updates for long-running actions such as library, playlist, and upload operations.

## Toast Store

- The canonical store lives in `frontend/src/components/ui/use-toast.ts`; do not create per-feature stores.
- Each toast must include an `id`, `title`, optional `description`, and optional `action` handler.
- Auto-dismiss remains enabled via the existing timeout mechanism—reuse helpers in `use-toast.ts` when extending functionality.

## Toaster Placement

- Mount exactly one `<Toaster />` component from `frontend/src/components/ui/toaster.tsx` in `frontend/src/main.tsx`.
- Do not mount additional toaster instances inside feature routes; they will cause duplicate toasts.

## Triggering Toasts

- API routes should return `{ status, message, data? }` payloads. Client components map `status === "success"` to `toast.success` and everything else to `toast.error`.
- For optimistic UI flows, fire a pending toast before the async call and replace it with the final toast when the promise resolves.
- Use descriptive `message` strings sourced from locale files under `frontend/src/locales` to keep translations centralized.

## Testing

- Cover toast store behavior with unit tests in `frontend/src/test/ui/toast.test.ts` (create or extend as needed).
- When adding new toast variants, update snapshot tests to prevent unintentional UI regressions.

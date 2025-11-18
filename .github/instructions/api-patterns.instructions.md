# API Patterns Instruction

## Metadata

**Created**: 2025-11-18  
**Last Updated**: 2025-11-18  
**Status**: Active

---

## Overview

This document defines the unified API response pattern and user feedback workflow for M3W. All API routes must follow these patterns to ensure consistent error handling, user feedback, and testability.

---

## API Response Pattern

### Core Principles

API routes must remain thin wrappers around domain services to keep business logic centralized and testable. Each route handler should delegate work to a function in `backend/src/lib/services` and only handle request validation, response shaping, and error handling.

### Response Structure

All API routes must return a structured object:

```typescript
{
  status: "success" | "error",
  message: string,
  data?: any
}
```

**Key Points**:
- `status`: Normalized to "success" or "error"
- `message`: User-facing message (localized)
- `data`: Optional response payload (only present on success)

### Implementation Requirements

1. **Input Validation**: Perform at the boundary using Zod schemas or typed helpers before calling services
2. **Error Translation**: Catch service exceptions and translate into `{ status: "error", message }` payload
3. **Logging**: Log detailed errors with `backend/src/lib/logger.ts` while keeping user messages concise
4. **Type Safety**: Export shared response types from `shared/src/types` to keep frontend and backend in sync
5. **Security**: Never expose internal implementation details in error messages

### File Placement

```
backend/src/
├── routes/              # API route handlers (thin wrappers)
│   ├── auth.ts
│   ├── libraries.ts
│   ├── playlists.ts
│   ├── songs.ts
│   ├── upload.ts
│   └── player.ts
└── lib/
    └── services/        # Business logic (framework-agnostic, unit-testable)
        ├── auth.service.ts
        ├── library.service.ts
        ├── playlist.service.ts
        └── upload.service.ts

shared/src/
├── types.ts            # Shared types for frontend/backend
└── schemas.ts          # Zod validation schemas
```

### Example Pattern

**Backend Route** (`backend/src/routes/playlists.ts`):
```typescript
import { playlistService } from '@/lib/services/playlist.service';
import { logger } from '@/lib/logger';
import { I18n } from '@/locales/i18n';

app.post('/api/playlists', async (c) => {
  try {
    // 1. Validate input
    const body = await c.req.json();
    const { name } = createPlaylistSchema.parse(body);
    
    // 2. Get authenticated user
    const userId = c.get('userId');
    
    // 3. Delegate to service
    const playlist = await playlistService.create(userId, name);
    
    // 4. Return success response
    return c.json({
      status: 'success',
      message: I18n.playlist.createSuccess,
      data: playlist,
    });
  } catch (error) {
    // 5. Log detailed error
    logger.error('Failed to create playlist', { error, userId });
    
    // 6. Return user-friendly error
    return c.json({
      status: 'error',
      message: I18n.error.playlistCreateFailed,
    }, 400);
  }
});
```

**Service Layer** (`backend/src/lib/services/playlist.service.ts`):
```typescript
// Framework-agnostic, pure business logic
export const playlistService = {
  async create(userId: string, name: string) {
    // Validation
    if (!name || name.trim().length === 0) {
      throw new Error('Playlist name cannot be empty');
    }
    
    // Business logic
    const playlist = await prisma.playlist.create({
      data: { userId, name: name.trim() },
    });
    
    return playlist;
  },
};
```

---

## User Feedback Workflow

### Toast System

All transient user feedback flows through a single toast pipeline for consistent status updates.

### Toast Store

- **Location**: `frontend/src/components/ui/use-toast.ts`
- **Rule**: Do not create per-feature toast stores
- **Structure**: Each toast includes `id`, `title`, optional `description`, optional `action`
- **Auto-dismiss**: Enabled via existing timeout mechanism

### Toaster Placement

- Mount exactly one `<Toaster />` in `frontend/src/main.tsx`
- Do not mount additional instances in feature routes (causes duplicates)

### Triggering Toasts

**From API Responses**:
```typescript
import { toast } from '@/components/ui/use-toast';
import { api } from '@/services';

const handleCreate = async () => {
  try {
    const result = await api.main.playlists.create({ name });
    
    if (result.status === 'success') {
      toast({ title: result.message });
    } else {
      toast({ title: result.message, variant: 'destructive' });
    }
  } catch (error) {
    toast({ title: I18n.error.generic, variant: 'destructive' });
  }
};
```

**Optimistic UI Flow**:
```typescript
// 1. Show pending toast
const pendingToast = toast({ 
  title: I18n.upload.uploading,
  description: `${files.length} files`,
});

// 2. Perform action
const result = await uploadFiles(files);

// 3. Replace with final toast
pendingToast.dismiss();
if (result.status === 'success') {
  toast({ title: result.message });
} else {
  toast({ title: result.message, variant: 'destructive' });
}
```

### Localization

- All user-facing messages must come from `frontend/src/locales`
- Use `I18n.category.key` pattern
- Never hardcode toast messages

### Testing

- Unit tests: `frontend/src/test/ui/toast.test.ts`
- Integration tests: Verify toast appears for user actions
- Snapshot tests: Prevent unintentional UI regressions

---

## Best Practices

### DO ✅

- Return `{ status, message, data? }` from all API routes
- Log detailed errors server-side with context
- Use descriptive, user-friendly error messages
- Centralize business logic in service layer
- Type API responses with shared types
- Use i18n for all user-facing text
- Test service layer independently of framework

### DON'T ❌

- Expose internal error details to users
- Create per-feature toast stores
- Hardcode error messages
- Put business logic in route handlers
- Return inconsistent response shapes
- Mount multiple `<Toaster />` components
- Skip error logging for debugging

---

## Migration Checklist

When adding new API endpoints:

- [ ] Create service function in `backend/src/lib/services`
- [ ] Add route handler in `backend/src/routes`
- [ ] Define Zod schema for input validation
- [ ] Return `{ status, message, data? }` structure
- [ ] Add error handling with logger
- [ ] Add i18n messages for success/error
- [ ] Update shared types in `shared/src/types`
- [ ] Add frontend API client method
- [ ] Wire up toast feedback in UI
- [ ] Write unit tests for service layer

---

## References

- Logger: `backend/src/lib/logger.ts`
- Toast Store: `frontend/src/components/ui/use-toast.ts`
- Toaster Component: `frontend/src/components/ui/toaster.tsx`
- i18n System: `.github/instructions/i18n-system.instructions.md`
- Shared Types: `shared/src/types.ts`
- API Service Layer: `frontend/src/services/api/README.md`

---

**Document Version**: v1.0  
**Last Updated**: 2025-11-18

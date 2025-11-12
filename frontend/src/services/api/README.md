# API Client Architecture

## Overview

The frontend uses a layered API client architecture to separate concerns and provide clean interfaces for different types of API calls.

## Architecture Layers

```Text
┌─────────────────────────────────────────────────┐
│           Business Logic Layer                  │
│  (Components, Hooks, Services)                  │
└─────────────────┬───────────────────────────────┘
                  │
        ┌─────────┴──────────┐
        │                    │
┌───────▼────────┐  ┌────────▼────────┐
│ mainApiClient  │  │ streamApiClient │
│ (JSON APIs)    │  │ (Binary Data)   │
└───────┬────────┘  └────────┬────────┘
        │                    │
        └─────────┬──────────┘
                  │
         ┌────────▼────────┐
         │   apiClient     │
         │ (Low-level HTTP)│
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │  fetch / router │
         │ (Network Layer) │
         └─────────────────┘
```

## Client Types

### 1. `apiClient` (Low-level)

**Location**: `src/lib/api/client.ts`

**Purpose**: Low-level HTTP client for direct network requests

**Features**:

- URL building with query parameters
- Common headers management
- Error handling and logging
- Support for both JSON and non-JSON responses
- Authentication via router

**⚠️ Warning**: Most code should NOT use this directly. Use higher-level clients instead.

**When to use directly**: Never in business logic. Only used internally by `mainApiClient` and `streamApiClient`.

---

### 2. `mainApiClient` (JSON APIs)

**Location**: `src/services/api/main/client.ts`

**Purpose**: High-level client for JSON API calls

**Features**:

- Automatic `{success, data}` response unwrapping
- Type-safe responses
- Consistent error handling
- Methods: `get`, `post`, `put`, `patch`, `delete`, `upload`

**When to use**: All JSON API calls (99% of API interactions)

**Example**:

```typescript
import { mainApiClient } from '@/services/api/main/client';

// Automatically unwraps {success: true, data: {...}}
const library = await mainApiClient.get<Library>('/api/libraries/123');
```

---

### 3. `streamApiClient` (Binary Data)

**Location**: `src/services/api/main/stream-client.ts`

**Purpose**: Specialized client for binary/stream data

**Features**:

- Returns raw `Response` objects (not JSON parsed)
- Suitable for audio, video, images, blobs
- Works with Cache API for offline storage
- Methods: `get`

**When to use**: Fetching binary data (audio streams, file downloads, blobs)

**Example**:

```typescript
import { streamApiClient } from '@/services/api/main/stream-client';

// Returns Response object for blob creation
const response = await streamApiClient.get('/api/songs/123/stream');
const blob = await response.blob();
const url = URL.createObjectURL(blob);
```

---

## Usage Guidelines

### ✅ DO Use Service Layer

Most business logic should use the service layer (`api.main.*`):

```typescript
import { api } from '@/services';

// Correct: Use service methods
const libraries = await api.main.libraries.list();
const songs = await api.main.libraries.getSongs(libraryId);
const playlist = await api.main.playlists.create({ name: 'My Playlist' });
```

### ✅ DO Use streamApiClient for Binary Data

```typescript
import { streamApiClient } from '@/services/api/main/stream-client';

// Correct: Fetch audio stream
const response = await streamApiClient.get(audioUrl);
const blob = await response.blob();

// Correct: Cache audio files
const response = await streamApiClient.get(streamUrl);
await cache.put(streamUrl, response.clone());
```

### ❌ DON'T Use apiClient Directly

```typescript
import { apiClient } from '@/lib/api/client';

// Wrong: Don't use apiClient in business logic
const response = await apiClient.get('/api/libraries');
const libraries = response.data; // Manual unwrapping
```

### ❌ DON'T Use mainApiClient for Binary Data

```typescript
import { mainApiClient } from '@/services/api/main/client';

// Wrong: mainApiClient expects JSON responses
const response = await mainApiClient.get('/api/songs/123/stream');
// This will fail because it tries to parse binary data as JSON
```

---

## File Structure

```
src/
├── lib/
│   └── api/
│       ├── client.ts           # Low-level HTTP client (⚠️ Internal use only)
│       └── router.ts           # Request routing (online/offline)
└── services/
    └── api/
        └── main/
            ├── client.ts       # JSON API client
            ├── stream-client.ts # Binary data client
            ├── endpoints.ts    # URL builders
            ├── types.ts        # Shared types
            └── resources/      # Service layer
                ├── auth.ts
                ├── libraries.ts
                ├── playlists.ts
                ├── songs.ts
                ├── upload.ts
                └── player.ts
```

---

## Response Format

### Main API (JSON)

```typescript
// Server returns:
{
  success: true,
  data: { id: '123', name: 'My Library' }
}

// mainApiClient unwraps to:
{ id: '123', name: 'My Library' }
```

### Stream API (Binary)

```typescript
// Server returns:
Response {
  headers: { 'content-type': 'audio/mpeg' },
  body: ReadableStream
}

// streamApiClient returns:
Response object (unchanged)
```

---

## Migration Notes

### Old Pattern (Deprecated)

```typescript
import { apiClient } from '@/lib/api/client';
import { API_ENDPOINTS } from '@/lib/constants/api-config';

const response = await apiClient.get<{success: boolean, data: Library[]}>(
  API_ENDPOINTS.libraries.list
);
const libraries = response.data;
```

### New Pattern (Correct)

```typescript
import { api } from '@/services';

const libraries = await api.main.libraries.list();
```

---

## Error Handling

All clients throw `ApiError` with consistent structure:

```typescript
import { ApiError } from '@/lib/api/client';

try {
  const data = await api.main.libraries.list();
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Error ${error.status}: ${error.message}`);
    console.error('Response data:', error.data);
  }
}
```

---

## Best Practices

1. **Use service layer** (`api.main.*`) for all business logic
2. **Use streamApiClient** for binary data (audio, images, files)
3. **Never use apiClient** directly in components or hooks
4. **Type your responses** using shared types from `@m3w/shared`
5. **Handle errors** at the UI boundary (components)
6. **Log appropriately** (errors in services, info in UI)

---

## Related Documentation

- Main API Service: `src/services/api/main/resources/README.md` (if exists)
- Offline Routing: `src/lib/api/router.ts`
- Error Handling: `src/lib/api/client.ts`

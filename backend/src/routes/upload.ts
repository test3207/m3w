/**
 * Upload Routes (Hono Backend)
 * Admin routes - online only
 */

import { Hono } from 'hono';
import type { Context } from 'hono';

const app = new Hono();

// POST /api/upload/song - Upload audio file to MinIO
app.post('/song', async (c: Context) => {
  // TODO: Implement file upload with:
  // 1. Extract file from multipart form data
  // 2. Calculate SHA256 hash
  // 3. Check if file exists in database (deduplication)
  // 4. If not exists, upload to MinIO
  // 5. Create File record
  // 6. Extract metadata using music-metadata
  // 7. Create Song record
  // 8. Increment file refCount
  return c.json(
    {
      success: false,
      error: 'Not implemented yet',
    },
    501
  );
});

export default app;

/**
 * Cover URL Helper
 * 
 * Handles conversion between storage paths and API URLs for cover images.
 * 
 * Design Decision:
 * - Database stores MinIO relative paths: "covers/{fileHash}.jpg"
 * - API returns accessible URLs: "/api/songs/{songId}/cover"
 * 
 * Benefits:
 * - Storage-agnostic: Can migrate MinIO → S3 → OSS without DB changes
 * - Future-proof: Can switch to presigned URLs without data migration
 * - Security: All access goes through authenticated API
 * - Multi-environment: Same DB data works across dev/staging/prod
 */

interface SongWithCover {
  id: string;
  coverUrl: string | null;
}

function getApiBaseUrl(): string {
  const explicitBase = process.env.API_BASE_URL;
  if (explicitBase && explicitBase.trim().length > 0) {
    return explicitBase;
  }

  const port = process.env.PORT || '4000';
  return `http://localhost:${port}`;
}

/**
 * Convert storage path to API URL
 * 
 * @param song - Song object with id and coverUrl
 * @returns API URL for cover image or null if no cover
 * 
 * @example
 * // MinIO path → API path
 * resolveCoverUrl({ id: "song123", coverUrl: "covers/abc.jpg" })
 * // Returns: "/api/songs/song123/cover"
 * 
 * @example
 * // External URL → unchanged
 * resolveCoverUrl({ id: "song123", coverUrl: "https://example.com/cover.jpg" })
 * // Returns: "https://example.com/cover.jpg"
 * 
 * @example
 * // No cover → null
 * resolveCoverUrl({ id: "song123", coverUrl: null })
 * // Returns: null
 */
export function resolveCoverUrl(song: SongWithCover): string | null {
  if (!song.coverUrl) return null;

  // External URL: return as-is (for future external API integration)
  if (song.coverUrl.startsWith('http://') || song.coverUrl.startsWith('https://')) {
    return song.coverUrl;
  }

  // MinIO relative path: convert to absolute API URL so the frontend can use it directly
  const apiBase = getApiBaseUrl();
  const coverPath = `/api/songs/${song.id}/cover`;
  return new URL(coverPath, apiBase).toString();
}

/**
 * Batch convert cover URLs for multiple songs
 * 
 * @param songs - Array of song objects
 * @returns Array with resolved cover URLs
 * 
 * @example
 * const songs = [
 *   { id: "1", coverUrl: "covers/a.jpg" },
 *   { id: "2", coverUrl: null }
 * ];
 * resolveCoverUrls(songs);
 * // Returns: [
 * //   { id: "1", coverUrl: "/api/songs/1/cover" },
 * //   { id: "2", coverUrl: null }
 * // ]
 */
export function resolveCoverUrls<T extends SongWithCover>(songs: T[]): T[] {
  return songs.map(song => ({
    ...song,
    coverUrl: resolveCoverUrl(song),
  }));
}

/**
 * Future Enhancement: Generate presigned URL for direct MinIO access
 * 
 * This will reduce backend load by allowing frontend to fetch images directly
 * from MinIO using temporary signed URLs (valid for 1 hour).
 * 
 * Implementation guide:
 * 1. Check if coverUrl is MinIO path (not external URL)
 * 2. Call minioClient.presignedGetObject(bucket, coverUrl, 3600)
 * 3. Return signed URL
 * 
 * No database migration needed - just change this helper function.
 * 
 * @example
 * // Future implementation
 * export async function resolvePresignedCoverUrl(
 *   song: SongWithCover,
 *   minioClient: MinioClient
 * ): Promise<string | null> {
 *   if (!song.coverUrl) return null;
 *   if (song.coverUrl.startsWith('http')) return song.coverUrl;
 *   
 *   const bucket = process.env.MINIO_BUCKET_NAME || 'm3w-music';
 *   return await minioClient.presignedGetObject(bucket, song.coverUrl, 3600);
 * }
 */

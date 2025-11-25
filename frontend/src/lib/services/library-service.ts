/**
 * Library Service - Cascade Delete Logic
 * 
 * Handles Library deletion with proper cascade logic:
 * 1. Remove LibrarySong relationships
 * 2. Remove PlaylistSong entries from that library
 * 3. Check Song reference count
 * 4. Delete Song metadata if count = 0
 * 5. Delete Cache Storage if no other library uses same fileHash
 */

import { db } from '@/lib/db/schema';
import { logger } from '@/lib/logger-client';
import { getCacheName } from '@/lib/pwa/cache-manager';

export interface DeleteProgress {
  stage: 'librarySongs' | 'playlistSongs' | 'songs' | 'cache' | 'library' | 'complete';
  total: number;
  current: number;
  message: string;
}

export interface DeleteResult {
  success: boolean;
  deletedLibrarySongs: number;
  deletedPlaylistSongs: number;
  deletedSongs: number;
  deletedCacheEntries: number;
  errors: string[];
}

class LibraryService {
  /**
   * Delete library with cascade logic
   * @param libraryId - Library ID to delete
   * @param onProgress - Progress callback
   * @returns Delete result
   */
  async deleteLibrary(
    libraryId: string,
    onProgress?: (progress: DeleteProgress) => void
  ): Promise<DeleteResult> {
    const result: DeleteResult = {
      success: true,
      deletedLibrarySongs: 0,
      deletedPlaylistSongs: 0,
      deletedSongs: 0,
      deletedCacheEntries: 0,
      errors: [],
    };

    try {
      logger.info('Starting library deletion', { libraryId });

      // Step 1: Get all librarySongs for this library
      const librarySongs = await db.librarySongs
        .where('libraryId')
        .equals(libraryId)
        .toArray();

      const songIds = librarySongs.map((ls) => ls.songId);
      const totalSteps = songIds.length;

      onProgress?.({
        stage: 'librarySongs',
        total: totalSteps,
        current: 0,
        message: `Found ${songIds.length} songs in library`,
      });

      // Step 2: Delete librarySongs
      await db.librarySongs.where('libraryId').equals(libraryId).delete();
      result.deletedLibrarySongs = librarySongs.length;

      onProgress?.({
        stage: 'playlistSongs',
        total: totalSteps,
        current: 0,
        message: 'Removing songs from playlists',
      });

      // Step 3: Delete playlistSongs from this library
      const playlistSongs = await db.playlistSongs
        .where('fromLibraryId')
        .equals(libraryId)
        .toArray();

      await db.playlistSongs.where('fromLibraryId').equals(libraryId).delete();
      result.deletedPlaylistSongs = playlistSongs.length;

      onProgress?.({
        stage: 'songs',
        total: totalSteps,
        current: 0,
        message: 'Checking song references',
      });

      // Step 4: Check each song's reference count
      const cache = await caches.open(getCacheName('audio'));
      let processed = 0;

      for (const songId of songIds) {
        try {
          processed++;
          
          // Check if song still referenced by other libraries
          const remainingRefs = await db.librarySongs
            .where('songId')
            .equals(songId)
            .count();

          if (remainingRefs === 0) {
            // No more references, delete song metadata
            const song = await db.songs.get(songId);
            if (song) {
              // Check cache deletion eligibility (only if fileHash exists)
              const shouldDeleteCache = song.fileHash 
                ? await this.shouldDeleteCache(song.fileHash)
                : true; // If no hash, safe to delete cache (unique to this song)
              
              if (shouldDeleteCache && song.streamUrl) {
                // Delete from Cache Storage
                await cache.delete(song.streamUrl);
                result.deletedCacheEntries++;

                logger.debug('Cache deleted', { songId, fileHash: song.fileHash });
              }

              // Delete song metadata
              await db.songs.delete(songId);
              result.deletedSongs++;

              logger.debug('Song deleted', { songId });
            }
          }

          onProgress?.({
            stage: 'songs',
            total: totalSteps,
            current: processed,
            message: `Processing song ${processed}/${totalSteps}`,
          });
        } catch (error) {
          result.errors.push(`Failed to process song ${songId}: ${String(error)}`);
          logger.error('Failed to process song deletion', { songId, error });
        }
      }

      onProgress?.({
        stage: 'library',
        total: totalSteps,
        current: totalSteps,
        message: 'Deleting library',
      });

      // Step 5: Delete library itself
      await db.libraries.delete(libraryId);

      onProgress?.({
        stage: 'complete',
        total: totalSteps,
        current: totalSteps,
        message: 'Deletion complete',
      });

      logger.info('Library deleted successfully', {
        libraryId,
        result,
      });

      return result;
    } catch (error) {
      result.success = false;
      result.errors.push(`Fatal error: ${String(error)}`);
      logger.error('Library deletion failed', { libraryId, error });
      return result;
    }
  }

  /**
   * Remove song from library (not used in current flow, but useful for future)
   * @param libraryId - Library ID
   * @param songId - Song ID
   */
  async removeSongFromLibrary(libraryId: string, songId: string): Promise<void> {
    try {
      // Delete librarySong relationship
      const librarySong = await db.librarySongs
        .where('[libraryId+songId]')
        .equals([libraryId, songId])
        .first();

      if (!librarySong) {
        logger.warn('LibrarySong not found', { libraryId, songId });
        return;
      }

      await db.librarySongs.delete(librarySong.id);

      // Delete playlistSongs from this library
      await db.playlistSongs
        .where('[songId+fromLibraryId]')
        .equals([songId, libraryId])
        .delete();

      // Check reference count
      const remainingRefs = await db.librarySongs.where('songId').equals(songId).count();

      if (remainingRefs === 0) {
        // Delete song and cache
        const song = await db.songs.get(songId);
        if (song) {
          const shouldDeleteCache = song.fileHash
            ? await this.shouldDeleteCache(song.fileHash)
            : true; // If no hash, safe to delete cache (unique to this song)
          
          if (shouldDeleteCache && song.streamUrl) {
            const cache = await caches.open(getCacheName('audio'));
            await cache.delete(song.streamUrl);
            logger.debug('Cache deleted after song removal', { songId });
          }

          await db.songs.delete(songId);
          logger.info('Song deleted after library removal', { songId });
        }
      }
    } catch (error) {
      logger.error('Failed to remove song from library', { libraryId, songId, error });
      throw error;
    }
  }

  /**
   * Check if cache should be deleted based on fileHash
   * Cache is deleted only if no other song uses the same fileHash
   */
  private async shouldDeleteCache(fileHash: string): Promise<boolean> {
    try {
      // Check if any other song uses this fileHash
      const count = await db.songs.where('fileHash').equals(fileHash).count();
      return count === 0;
    } catch (error) {
      logger.error('Failed to check cache deletion eligibility', { fileHash, error });
      return false;
    }
  }

  /**
   * Get library statistics
   */
  async getLibraryStats(libraryId: string): Promise<{
    songCount: number;
    totalSize: number;
    cachedCount: number;
    cachedSize: number;
  }> {
    try {
      const librarySongs = await db.librarySongs
        .where('libraryId')
        .equals(libraryId)
        .toArray();

      const songIds = librarySongs.map((ls) => ls.songId);
      const songs = await db.songs.bulkGet(songIds);

      let totalSize = 0;
      let cachedCount = 0;
      let cachedSize = 0;

      for (const song of songs) {
        if (!song) continue;
        
        if (song.isCached && song.cacheSize) {
          cachedCount++;
          cachedSize += song.cacheSize;
        }
        
        totalSize += song.cacheSize || 0;
      }

      return {
        songCount: songs.filter(Boolean).length,
        totalSize,
        cachedCount,
        cachedSize,
      };
    } catch (error) {
      logger.error('Failed to get library stats', { libraryId, error });
      return {
        songCount: 0,
        totalSize: 0,
        cachedCount: 0,
        cachedSize: 0,
      };
    }
  }
}

// Singleton instance
export const libraryService = new LibraryService();

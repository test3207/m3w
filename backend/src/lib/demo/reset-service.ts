/**
 * Demo Mode - Reset Service
 * 
 * Periodically resets all data in demo environments.
 * Runs hourly at :00 minutes (e.g., 13:00, 14:00, 15:00).
 */

import cron from 'node-cron';
import { prisma } from '../prisma';
import { logger } from '../logger';
import { getMinioClient } from '../minio-client';
import { setResetting } from './middleware';
import { storageTracker } from './storage-tracker';

/**
 * Clear all objects from MinIO bucket
 */
async function clearMinIOBucket(): Promise<void> {
  const bucketName = process.env.MINIO_BUCKET_NAME || 'm3w-music';
  const minioClient = getMinioClient();
  
  try {
    const objectsList = minioClient.listObjects(bucketName, '', true);
    const objectsToDelete: string[] = [];
    
    for await (const obj of objectsList) {
      if (obj.name) {
        objectsToDelete.push(obj.name);
      }
    }
    
    if (objectsToDelete.length > 0) {
      await minioClient.removeObjects(bucketName, objectsToDelete);
      logger.info({ count: objectsToDelete.length }, 'MinIO objects cleared');
    } else {
      logger.info('No MinIO objects to clear');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to clear MinIO bucket');
    throw error;
  }
}

/**
 * Start the demo reset service
 */
export function startDemoResetService(): void {
  // Runtime check: only start if reset is enabled
  const enabled = process.env.DEMO_RESET_ENABLED === 'true';
  
  if (!enabled) {
    logger.info('Demo reset service is disabled (set DEMO_RESET_ENABLED=true to enable)');
    return;
  }

  // Schedule: every hour at :00 minutes
  // Cron format: minute hour day month weekday
  // '0 * * * *' = at minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Starting demo reset...');
    
    // Set resetting flag to reject all requests with 503
    setResetting(true);
    
    try {
      // Step 1: Clear all database tables (including users)
      await prisma.$transaction([
        prisma.playbackProgress.deleteMany(),
        prisma.playbackPreference.deleteMany(),
        prisma.playlistSong.deleteMany(),
        prisma.playlist.deleteMany(),
        prisma.lyrics.deleteMany(),
        prisma.song.deleteMany(),
        prisma.library.deleteMany(),
        prisma.file.deleteMany(),
        prisma.session.deleteMany(),
        prisma.account.deleteMany(),
        prisma.user.deleteMany(),
      ]);
      
      logger.info('Database cleared');
      
      // Step 2: Clear all MinIO objects
      await clearMinIOBucket();
      
      // Step 3: Reset storage tracker
      storageTracker.reset();
      
      logger.info('Demo reset completed successfully');
      
    } catch (error) {
      logger.error({ error }, 'Demo reset failed - will retry next hour');
      // Don't rollback, let it fail and retry next hour
    } finally {
      // Always restore service after reset attempt
      setResetting(false);
    }
  });
  
  logger.info('Demo reset service started (runs every hour at :00)');
}

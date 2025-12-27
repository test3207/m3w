/**
 * Demo Mode - Reset Service
 * 
 * Periodically resets all data in demo environments.
 * Runs hourly at :00 minutes (e.g., 13:00, 14:00, 15:00).
 */

import cron from 'node-cron';
import { prisma } from '../prisma';
import { createLogger, generateTraceId } from '../logger';
import { getMinioClient } from '../minio-client';
import { setResetting } from './middleware';
import { storageTracker } from './storage-tracker';

/**
 * Clear all objects from MinIO bucket
 */
async function clearMinIOBucket(log: ReturnType<typeof createLogger>): Promise<void> {
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
      log.info({
        source: 'reset-service.clearMinIOBucket',
        col1: 'demo',
        col2: 'reset',
        raw: { count: objectsToDelete.length },
        message: 'MinIO objects cleared',
      });
    } else {
      log.info({
        source: 'reset-service.clearMinIOBucket',
        col1: 'demo',
        col2: 'reset',
        message: 'No MinIO objects to clear',
      });
    }
  } catch (error) {
    log.error({
      source: 'reset-service.clearMinIOBucket',
      col1: 'demo',
      col2: 'reset',
      message: 'Failed to clear MinIO bucket',
      error,
    });
    throw error;
  }
}

/**
 * Start the demo reset service
 */
export function startDemoResetService(): void {
  // Runtime check: only start if reset is enabled
  const enabled = process.env.DEMO_RESET_ENABLED === 'true';
  const startupLog = createLogger();
  
  if (!enabled) {
    startupLog.info({
      source: 'reset-service.start',
      col1: 'demo',
      col2: 'reset',
      message: 'Demo reset service is disabled (set DEMO_RESET_ENABLED=true to enable)',
    });
    return;
  }

  // Schedule: every hour at :00 minutes
  // Cron format: minute hour day month weekday
  // '0 * * * *' = at minute 0 of every hour
  cron.schedule('0 * * * *', async () => {
    // Create a logger with shared traceId for this reset cycle
    const resetTraceId = generateTraceId();
    const log = createLogger();
    // Note: We can't override traceId in RequestLogger, but raw field works
    const logWithTrace = {
      info: (params: Parameters<typeof log.info>[0]) =>
        log.info({ ...params, raw: { ...params.raw, resetTraceId } }),
      error: (params: Parameters<typeof log.error>[0]) =>
        log.error({ ...params, raw: { ...params.raw, resetTraceId } }),
    };
    
    logWithTrace.info({
      source: 'reset-service.cron',
      col1: 'demo',
      col2: 'reset',
      message: 'Starting demo reset...',
    });
    
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
      
      logWithTrace.info({
        source: 'reset-service.cron',
        col1: 'demo',
        col2: 'reset',
        message: 'Database cleared',
      });
      
      // Step 2: Clear all MinIO objects
      await clearMinIOBucket(log);
      
      // Step 3: Reset storage tracker
      storageTracker.reset();
      
      logWithTrace.info({
        source: 'reset-service.cron',
        col1: 'demo',
        col2: 'reset',
        message: 'Demo reset completed successfully',
      });
      
    } catch (error) {
      logWithTrace.error({
        source: 'reset-service.cron',
        col1: 'demo',
        col2: 'reset',
        message: 'Demo reset failed - will retry next hour',
        error,
      });
      // Don't rollback, let it fail and retry next hour
    } finally {
      // Always restore service after reset attempt
      setResetting(false);
    }
  });
  
  startupLog.info({
    source: 'reset-service.start',
    col1: 'demo',
    col2: 'reset',
    message: 'Demo reset service started (runs every hour at :00)',
  });
}

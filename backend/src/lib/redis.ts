import Redis from 'ioredis';
import { logger } from './logger.js';

/**
 * Redis client for cross-region user routing
 * 
 * Required for multi-region deployment: Stores github:{id} -> region mapping
 * Optional for All-in-One mode: Graceful degradation to local-only operation
 * 
 * Without Redis, multi-region duplicate prevention is disabled.
 */
export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => {
        // Exponential backoff: 100ms, 200ms, 400ms, ... up to 5s
        const delay = Math.min(times * 100, 5000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    })
  : null;

// Helper to check if Redis is available
export const isRedisAvailable = (): boolean => {
  return redis !== null && redis.status === 'ready';
};

// Log Redis status on startup
if (redis) {
  redis.on('connect', () => {
    logger.info('[Redis] Connected successfully');
  });
  redis.on('error', (err) => {
    logger.error({ err }, '[Redis] Error');
  });
} else {
  logger.info('[Redis] Running in local mode (Redis disabled)');
}

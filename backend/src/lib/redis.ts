import Redis from 'ioredis';
import { createLogger } from './logger.js';

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
const redisLog = createLogger();
if (redis) {
  redis.on('connect', () => {
    redisLog.info({
      source: 'redis.connect',
      col1: 'system',
      col2: 'connection',
      message: 'Redis connected successfully',
    });
  });
  redis.on('error', (err) => {
    redisLog.error({
      source: 'redis.error',
      col1: 'system',
      col2: 'connection',
      message: 'Redis error',
      error: err,
    });
  });
} else {
  redisLog.info({
    source: 'redis.init',
    col1: 'system',
    col2: 'connection',
    message: 'Running in local mode (Redis disabled)',
  });
}

import Redis from 'ioredis';
import { logger } from './logger.js';

// Optional dependency - graceful degradation for local dev
export const redis = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
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

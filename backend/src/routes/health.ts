/**
 * Health Check Routes
 *
 * Provides liveness and readiness probes for container orchestration.
 *
 * - /health (liveness): Returns 200 if process is running
 * - /ready (readiness): Returns 200 if all dependencies are available
 */

import { Hono } from 'hono';
import { prisma } from '../lib/prisma';
import { getMinioClient } from '../lib/minio-client';
import { logger } from '../lib/logger';

const app = new Hono();

/**
 * Liveness probe - /health
 *
 * Returns 200 if the server process is running.
 * Used by orchestrators to determine if the container should be restarted.
 */
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * Readiness probe - /ready
 *
 * Returns 200 if all dependencies (PostgreSQL, MinIO) are available.
 * Returns 503 if any dependency is unavailable.
 * Used by orchestrators to determine if the container should receive traffic.
 */
app.get('/ready', async (c) => {
  const checks: Record<string, { status: 'ok' | 'error'; latency?: number; error?: string }> = {};

  // Check PostgreSQL
  const pgStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latency: Date.now() - pgStart };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    checks.database = { status: 'error', error: message };
    logger.warn({ error: message }, 'PostgreSQL health check failed');
  }

  // Check MinIO
  const minioStart = Date.now();
  try {
    const minioClient = getMinioClient();
    await minioClient.listBuckets();
    checks.storage = { status: 'ok', latency: Date.now() - minioStart };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    checks.storage = { status: 'error', error: message };
    logger.warn({ error: message }, 'MinIO health check failed');
  }

  // Determine overall status
  const allHealthy = Object.values(checks).every((check) => check.status === 'ok');

  if (allHealthy) {
    return c.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks,
    });
  }

  return c.json(
    {
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      checks,
    },
    503
  );
});

export default app;

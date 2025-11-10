/**
 * M3W Backend Server (Hono)
 * Main entry point for the backend API
 */

import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import 'dotenv/config';
import { logger } from './lib/logger';
import { prisma } from './lib/prisma';

// Helper function to mask sensitive environment variables
function maskSensitiveValue(key: string, value: string): string {
  const sensitiveKeys = [
    'SECRET',
    'PASSWORD',
    'TOKEN',
    'KEY',
    'DATABASE_URL',
    'GITHUB_CLIENT_SECRET',
    'JWT_SECRET',
    'MINIO_SECRET_KEY',
  ];

  const isSensitive = sensitiveKeys.some((sensitive) =>
    key.toUpperCase().includes(sensitive)
  );

  if (!isSensitive) {
    return value;
  }

  // Show first 4 and last 4 characters for long values
  if (value.length > 12) {
    return `${value.substring(0, 4)}...${value.substring(value.length - 4)}`;
  }
  // For shorter values, just show length
  return `***${value.length} chars***`;
}

// Print all environment variables on startup
const envVars = Object.entries(process.env)
  .filter(([key]) => {
    // Only show M3W-related and common dev variables
    return (
      key.startsWith('DATABASE_') ||
      key.startsWith('REDIS_') ||
      key.startsWith('MINIO_') ||
      key.startsWith('JWT_') ||
      key.startsWith('GITHUB_') ||
      key.startsWith('HTTP_') ||
      key.startsWith('HTTPS_') ||
      key === 'PORT' ||
      key === 'HOST' ||
      key === 'NODE_ENV' ||
      key === 'CORS_ORIGIN'
    );
  })
  .reduce((acc, [key, value]) => {
    acc[key] = maskSensitiveValue(key, value || '');
    return acc;
  }, {} as Record<string, string>);

logger.info({ env: envVars }, 'Environment variables loaded');

// Import routes
import authRoutes from './routes/auth';
import librariesRoutes from './routes/libraries';
import playlistsRoutes from './routes/playlists';
import songsRoutes from './routes/songs';
import uploadRoutes from './routes/upload';
import playerRoutes from './routes/player';

const app = new Hono();

// Middleware
app.use('*', honoLogger());
app.use('*', prettyJSON());
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

// Health check
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.route('/api/auth', authRoutes);
app.route('/api/libraries', librariesRoutes);
app.route('/api/playlists', playlistsRoutes);
app.route('/api/songs', songsRoutes);
app.route('/api/upload', uploadRoutes);
app.route('/api/player', playerRoutes);

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

// Error handler
app.onError((err, c) => {
  logger.error({ err }, 'Unhandled error');
  return c.json(
    {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    },
    500
  );
});

// Start server
const port = Number(process.env.PORT) || 4000;

logger.info(`Starting M3W Backend on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

logger.info(`M3W Backend running at http://localhost:${port}`);

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

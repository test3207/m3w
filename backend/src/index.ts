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

// ============================================================================
// Demo Mode - Two-Layer Control
// ============================================================================
//
// Layer 1: Code Inclusion (Compile-time)
//   Variable: BUILD_TARGET (build) or .env (dev)
//   Values: 'rc' (include demo code) | 'prod' (exclude demo code)
//   Effect: Controls whether demo modules are bundled (~8KB difference)
//   
//   - Prod build:  BUILD_TARGET=prod  → Tree-shaking removes demo code
//   - RC build:    BUILD_TARGET=rc    → Demo code included in bundle
//   - Dev mode:    BUILD_TARGET in .env (default: 'rc')
//
// Layer 2: Feature Activation (Runtime)
//   Variable: DEMO_MODE
//   Values: 'true' (activate) | 'false' (inactive)
//   Effect: Controls whether demo features are active
//   Requirement: Only works when demo code is included (BUILD_TARGET=rc)
//
//   Examples:
//     RC deployment with demo active:   BUILD_TARGET=rc + DEMO_MODE=true
//     RC deployment with demo inactive: BUILD_TARGET=rc + DEMO_MODE=false
//     Dev with demo testing:            BUILD_TARGET=rc + DEMO_MODE=true
//     Dev without demo:                 BUILD_TARGET=prod + DEMO_MODE=* (ignored)
//
// ============================================================================

declare const __IS_DEMO_BUILD__: boolean;

// Dev mode: tsx doesn't process tsup's define, fallback to env var
if (typeof __IS_DEMO_BUILD__ === 'undefined') {
  const buildTarget = process.env.BUILD_TARGET || 'rc';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__IS_DEMO_BUILD__ = buildTarget === 'rc';
}

type DemoModules = {
  storageTracker: {
    enabled: boolean;
    initialize: () => Promise<void>;
    incrementUsage: (bytes: number) => void;
    canUpload: (bytes: number) => boolean;
    getCurrentUsage: () => import('@m3w/shared').StorageUsageInfo;
    reset: () => void;
  };
  demoStorageCheckMiddleware: () => (c: import('hono').Context, next: import('hono').Next) => Promise<void | Response>;
  registerDemoRoutes: (app: import('hono').Hono) => void;
  startDemoResetService: () => void;
};

// ============================================================================
// ⚠️ CRITICAL: Tree-shaking Requirements
// ============================================================================
// 
// The demo initialization code MUST stay inline within the if (__IS_DEMO_BUILD__) block.
// DO NOT extract it into a separate function!
//
// ❌ BAD (breaks tree-shaking):
//   async function initDemo() { /* demo code */ }
//   if (__IS_DEMO_BUILD__) { await initDemo(); }
//   // Function definition remains in PROD build even when if-block is removed
//
// ✅ GOOD (enables tree-shaking):
//   if (__IS_DEMO_BUILD__) { /* demo code inline */ }
//   // Entire block eliminated in PROD build (0 demo refs, -8.5KB)
//
// Verified: PROD 0 refs | RC 16 refs | Diff +8.5KB (+11.73%)
// ============================================================================

// Import demo modules only if built with demo support (RC build)
let demoModules: DemoModules | null = null;

if (__IS_DEMO_BUILD__) {
  logger.info('Demo mode code included (RC build)');
  
  const [storageTrackerModule, middlewareModule, resetServiceModule] = await Promise.all([
    import('./lib/demo/storage-tracker'),
    import('./lib/demo/middleware'),
    import('./lib/demo/reset-service'),
  ]);
  
  demoModules = {
    storageTracker: storageTrackerModule.storageTracker,
    demoStorageCheckMiddleware: middlewareModule.demoStorageCheckMiddleware,
    registerDemoRoutes: middlewareModule.registerDemoRoutes,
    startDemoResetService: resetServiceModule.startDemoResetService,
  };
  
  // Initialize storage tracker
  await demoModules.storageTracker.initialize();
  logger.info('Demo mode modules loaded');
} else {
  logger.info('Demo mode code excluded (Production build)');
}

const app = new Hono();

// Middleware
app.use('*', honoLogger());
app.use('*', prettyJSON());

// CORS must be before all routes
app.use(
  '*',
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

// Enable demo features if:
// 1. Demo modules are loaded (RC build), AND
// 2. DEMO_MODE=true in environment (runtime control)
const isDemoEnabled = process.env.DEMO_MODE === 'true';

if (demoModules && isDemoEnabled) {
  logger.info('Demo mode enabled (DEMO_MODE=true)');
  app.use('*', demoModules.demoStorageCheckMiddleware());
  demoModules.registerDemoRoutes(app);
  demoModules.startDemoResetService();
} else if (demoModules) {
  logger.info('Demo mode available but disabled (set DEMO_MODE=true to enable)');
}

// Health check endpoint for frontend network detection
app.get('/api/health', (c) => {
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

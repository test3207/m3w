import { defineConfig } from 'tsup';

/**
 * Backend Build Configuration (tsup + esbuild)
 * 
 * Build commands:
 *   npm run build:prod  - Production build (demo code eliminated via tree-shaking)
 *   npm run build:rc    - RC build (demo code included)
 *   npm run build       - Alias for build:prod
 * 
 * Tree-shaking mechanism:
 *   BUILD_TARGET env var → __IS_DEMO_BUILD__ compile-time constant
 *   → Dead code elimination removes unused branches
 *   → Production bundle ~9% smaller (no demo modules)
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'esnext', // Use latest JavaScript features (Node.js 25 runtime)
  clean: true,
  sourcemap: true,
  splitting: false,
  // Compile-time constant for tree-shaking
  // BUILD_TARGET controls demo code inclusion:
  //   'rc'   → __IS_DEMO_BUILD__ = true  → Include demo modules
  //   'prod' → __IS_DEMO_BUILD__ = false → Tree-shake demo modules (~8KB smaller)
  define: {
    '__IS_DEMO_BUILD__': JSON.stringify((process.env.BUILD_TARGET || 'prod') === 'rc'),
  },
  // Aggressive tree-shaking to eliminate all dead code paths
  treeshake: true,
  // External dependencies (don't bundle node_modules)
  external: [
    '@hono/node-server',
    '@prisma/client',
    'bcrypt',
    'dotenv',
    'hono',
    'jsonwebtoken',
    'minio',
    'music-metadata',
    'node-cron',
    'pino',
    'pino-pretty',
    'pinyin',
    'zod',
  ],
  // Skip node_modules bundling
  noExternal: [],
  // Don't minify for easier debugging
  minify: false,
});

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // Exclude non-test files from test discovery
    exclude: [
      'node_modules/**',
      'dist/**',
      'prisma/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        'prisma/',
        '**/*.config.*',
        '**/*.setup.*',
        '**/types/**',
        '**/*.test.ts',
        'src/test/**',
        'src/index.ts',
        'src/lib/prisma.ts',
        'src/lib/minio-client.ts',
        'src/lib/auth-middleware.ts',
        'src/lib/demo/**',
        'src/routes/auth.ts',
        'src/routes/libraries.ts',
        'src/routes/playlists.ts',
        'src/routes/upload.ts',
        'src/services/library.service.ts',
        'src/services/playlist.service.ts',
        'src/services/upload.service.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Use real browser environment via Playwright
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        { browser: 'chromium' },
      ],
    },
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      // Default excludes
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        // Dependencies and build outputs
        'node_modules/**',
        'out/**',
        'build/**',

        // Config files
        'vitest.config.ts',
        'vitest.setup.ts',
        'postcss.config.js',
        'tailwind.config.ts',
        '**/*.config.*',

        // Type definitions
        '**/*.d.ts',
        'src/types/**',

        // Database
        'prisma/**',
        'src/lib/db/prisma.ts', // Prisma client singleton

        // Test files
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.spec.ts',
        '**/*.spec.tsx',
        'src/test/**',

        // Generated files
        'src/generated/**',

        // Entry points (covered by E2E)
        'src/app/layout.tsx',
        'src/app/page.tsx',
        'src/middleware.ts',

        // UI components (should have E2E coverage)
        'src/components/ui/**',
        'src/components/layouts/**',

        // Auth config (integration tested)
        'src/lib/auth/config.ts',
      ],
    },
  },
});

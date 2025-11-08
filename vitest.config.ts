import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node', // Use node for non-React tests
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        // Dependencies and build outputs
        'node_modules/**',
        '.next/**',
        'out/**',
        'build/**',
        
        // Config files
        'vitest.config.ts',
        'vitest.setup.ts',
        'next.config.js',
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
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});

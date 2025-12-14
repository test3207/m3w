import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Use real browser environment via Playwright
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [
        { browser: "chromium" },
      ],
    },
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    exclude: [
      // Default excludes
      "**/node_modules/**",
      "**/dist/**",
      "**/cypress/**",
      "**/.{idea,git,cache,output,temp}/**",
      "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        // Dependencies and build outputs
        "node_modules/**",
        "out/**",
        "build/**",

        // Config files
        "vitest.config.ts",
        "vitest.setup.ts",
        "postcss.config.js",
        "tailwind.config.ts",
        "**/*.config.*",

        // Type definitions
        "**/*.d.ts",
        "src/types/**",

        // Database
        "prisma/**",
        "src/lib/db/prisma.ts", // Prisma client singleton

        // Test files
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.spec.ts",
        "**/*.spec.tsx",
        "src/test/**",

        // Generated files
        "src/generated/**",

        // Entry points (covered by E2E)
        "src/app/layout.tsx",
        "src/app/page.tsx",
        "src/middleware.ts",

        // UI components (should have E2E coverage)
        "src/components/ui/**",
        "src/components/layouts/**",

        // Auth config (integration tested)
        "src/lib/auth/config.ts",

        // IndexedDB schema definition (Dexie class declaration, runtime DB config)
        "src/lib/db/schema.ts",

        // Browser-only APIs (require real Service Worker / IndexedDB environment)
        "src/lib/pwa/**",                    // Cache Storage API
        "src/lib/auth/token-storage.ts",     // IndexedDB for SW token sync
        "src/service-worker-custom.ts",      // Service Worker entry

        // Storage modules with heavy browser API dependencies
        "src/lib/storage/audio-cache.ts",    // Cache Storage API
        "src/lib/storage/download-manager.ts", // Background fetch + cache
        "src/lib/storage/quota-manager.ts",  // StorageManager API
        "src/lib/storage/storage-monitor.ts", // navigator.storage

        // Sync services (complex IndexedDB + network coordination)
        "src/lib/sync/**",

        // Demo mode (compile-time Vite constants, no runtime logic to test)
        "src/lib/demo/**",

        // Entry point (bootstrapping only)
        "src/main.tsx",

        // React components (E2E tested, not unit testable without heavy mocking)
        "src/pages/**",
        "src/components/features/**",
        "src/components/providers/**",

        // Zustand stores (state management, integration tested with components)
        "src/stores/**",

        // React hooks (integration tested with components)
        "src/hooks/**",

        // API service layer (thin wrappers over fetch, integration tested)
        "src/services/**",

        // i18n generated types (auto-generated)
        "src/locales/generated/**",

        // React hook for locale (uses React hooks, integration tested)
        "src/locales/use-locale.ts",

        // Audio player (Howler.js integration, needs audio context)
        "src/lib/audio/player.ts",
        "src/lib/audio/prefetch.ts",

        // API client (thin HTTP wrapper, integration tested)
        "src/lib/api/client.ts",
        "src/lib/api/router.ts",

        // Constants (no logic, just values)
        "src/lib/constants/**",

        // Offline proxy index (just re-exports)
        "src/lib/offline-proxy/index.ts",

        // Guest service (heavy IndexedDB + complex async operations)
        "src/lib/offline-proxy/services/**",
      ],
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { readFileSync } from "fs";

// Read version from package.json as fallback
const rootPkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));
// APP_VERSION env var is set by build-docker.cjs (e.g., "v1.0.0-rc.1" or "v1.0.0")
// Falls back to package.json version for local dev
const appVersion = process.env.APP_VERSION || `v${rootPkg.version}-dev`;

export default defineConfig({
  define: {
    // Inject compile-time boolean constant for tree-shaking
    // When BUILD_TARGET=prod, this becomes literal `false` and dead code is eliminated
    // Default to 'rc' in development so demo features can be tested locally
    "__VITE_IS_DEMO_BUILD__": JSON.stringify((process.env.BUILD_TARGET || "rc") === "rc"),
    // Inject version info for display (set by CI or defaults to dev)
    "__APP_VERSION__": JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.png", "apple-touch-icon.png"],
      // Use custom service worker with token injection
      strategies: "injectManifest",
      srcDir: "src",
      filename: "service-worker-custom.ts",
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "M3W Music Player",
        short_name: "M3W",
        description: "Self-hosted music player with offline support",
        theme_color: "#000000",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      // injectManifest strategy uses custom service worker
      // No workbox configuration needed
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core libraries
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // Radix UI components
          "ui-vendor": [
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-toast",
          ],
          // PWA and offline support
          "pwa-vendor": [
            "workbox-core",
            "workbox-precaching",
            "workbox-routing",
            "workbox-strategies",
            "dexie",
            "dexie-react-hooks",
          ],
          // Audio and utilities
          "utils-vendor": ["howler", "zustand", "clsx", "tailwind-merge"],
        },
      },
    },
    // Increase chunk size warning limit to 600KB (still reasonable with code splitting)
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: "0.0.0.0", // Listen on all network interfaces
    port: 3000,
    open: true,
  },
  preview: {
    port: 3000,
    strictPort: true, // Fail if port is in use instead of trying another
  },
});

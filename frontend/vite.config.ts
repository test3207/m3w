import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import { readFileSync } from "fs";

// Load .env files (vite.config.ts runs in Node.js, doesn't auto-load .env)
const env = loadEnv(process.env.NODE_ENV || "development", process.cwd(), "VITE_");

// Read version from package.json as fallback
const rootPkg = JSON.parse(readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"));
// APP_VERSION env var is set by build-docker.cjs (e.g., "v1.0.0-rc.1" or "v1.0.0")
// Falls back to package.json version for local dev
const appVersion = process.env.APP_VERSION || `v${rootPkg.version}-dev`;

// Build target: 'rc' for release candidate (demo), 'prod' for production
// Default to 'rc' for local development to enable demo feature testing
const buildTarget = process.env.BUILD_TARGET || "rc";

// Demo mode: explicit control via VITE_DEMO_MODE, otherwise follows BUILD_TARGET
// - VITE_DEMO_MODE=true  → demo enabled (regardless of BUILD_TARGET)
// - VITE_DEMO_MODE=false → demo disabled (regardless of BUILD_TARGET)
// - Not set              → follows BUILD_TARGET (rc=enabled, prod=disabled)
const demoModeEnv = env.VITE_DEMO_MODE ?? process.env.VITE_DEMO_MODE;
const isDemoBuild = demoModeEnv !== undefined
  ? demoModeEnv === "true"
  : buildTarget === "rc";

/**
 * Vite plugin to convert render-blocking CSS to async loading.
 * This improves LCP by allowing the page to render with inline critical CSS
 * while the full stylesheet loads in the background.
 * 
 * Converts: <link rel="stylesheet" href="...">
 * To: <link rel="stylesheet" href="..." media="print" onload="this.media='all'">
 */
function asyncCssPlugin(): Plugin {
  return {
    name: "async-css",
    enforce: "post",
    transformIndexHtml(html) {
      // Convert stylesheet links to async loading using media="print" trick
      // This uses a small inline onload handler but doesn't require external JS files
      return html.replace(
        /<link rel="stylesheet"([^>]*) href="([^"]+)"([^>]*)>/g,
        (match, beforeHref: string, href: string, afterHref: string) => {
          // Skip if href is missing
          if (!href) return match;
          // Skip links that already have a media attribute to avoid duplicates
          if (/\smedia\s*=/.test(beforeHref) || /\smedia\s*=/.test(afterHref)) {
            return match;
          }
          return `<link rel="stylesheet"${beforeHref} href="${href}"${afterHref} media="print" onload="this.media='all'">`;
        }
      );
    },
  };
}

export default defineConfig({
  define: {
    // Inject compile-time boolean constant for tree-shaking
    // Controlled by VITE_DEMO_MODE env var, or falls back to BUILD_TARGET
    "__VITE_IS_DEMO_BUILD__": JSON.stringify(isDemoBuild),
    // Inject version info for display (set by CI or defaults to dev)
    "__APP_VERSION__": JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    // Convert CSS to async loading for better LCP
    asyncCssPlugin(),
    // Bundle analyzer - generates stats.html only when ANALYZE=true
    // Usage: ANALYZE=true npm run build (or use npm run analyze)
    process.env.ANALYZE === "true" &&
      visualizer({
        filename: "stats.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
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
    // RC builds include hidden sourcemaps for error tracking (Alloy/Faro)
    // Production builds exclude sourcemaps for smaller bundle size
    sourcemap: buildTarget === "rc" ? "hidden" : false,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core libraries - must load first
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          // Radix UI components (all used components)
          "ui-vendor": [
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-avatar",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
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
          // Gesture library (used by player and long-press hook)
          "gesture-vendor": ["@use-gesture/react"],
          // Lucide icons - merge all into one chunk instead of separate tiny files
          "icons-vendor": ["lucide-react"],
        },
        // Merge small chunks into their parent to reduce HTTP requests
        // Based on TCP initial congestion window (initcwnd = 10 × 1460 bytes ≈ 14.6KB)
        // Using 10KB to leave room for TLS/HTTP/2 overhead (~1-1.5KB per request)
        experimentalMinChunkSize: 10 * 1024, // 10KB minimum
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

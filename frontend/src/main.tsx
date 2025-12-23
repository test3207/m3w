import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/globals.css";

// Import i18n initialization
import "./locales/init";

// Initialize logger (must be early to catch startup errors)
import { logger } from "./lib/logger-client";
logger.initialize();

// Lazy load pages for code splitting
// HomePage is eagerly loaded as the landing page LCP target
import HomePage from "./pages/HomePage";
const SignInPage = lazy(() => import("./pages/SignInPage"));
const AuthCallbackPage = lazy(() => import("./pages/AuthCallbackPage"));
const LibrariesPage = lazy(() => import("./pages/LibrariesPage"));
const LibraryDetailPage = lazy(() => import("./pages/LibraryDetailPage"));
const PlaylistsPage = lazy(() => import("./pages/PlaylistsPage"));
const PlaylistDetailPage = lazy(() => import("./pages/PlaylistDetailPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));

// Lazy load MobileLayout - only needed for authenticated pages
// This removes playerStore + audio system from the critical path
const MobileLayout = lazy(() => import("./components/layouts/mobile-layout"));

// Lazy load PWA prompts - only shown when service worker updates or install available
const ReloadPrompt = lazy(() => import("./components/features/pwa/reload-prompt").then(m => ({ default: m.ReloadPrompt })));
const InstallPrompt = lazy(() => import("./components/features/pwa/install-prompt").then(m => ({ default: m.InstallPrompt })));

// Import UI components (keep these eager loaded as they're used globally)
import { Toaster } from "./components/ui/toaster";
import { PageLoader } from "./components/ui/page-loader";
import { ProtectedRoute } from "./components/providers/protected-route";
import { AuthProvider } from "./components/providers/auth-provider";
import { LocaleProvider } from "./components/providers/locale-provider";

// Get or create root for HMR compatibility
// Store root instance on the DOM element to prevent duplicate createRoot calls during HMR
interface RootElement extends HTMLElement {
  _reactRoot?: ReturnType<typeof ReactDOM.createRoot>;
}

const rootElement = document.getElementById("root") as RootElement;

if (!rootElement._reactRoot) {
  rootElement._reactRoot = ReactDOM.createRoot(rootElement);
}

rootElement._reactRoot.render(
  <React.StrictMode>
    <LocaleProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<HomePage />} />
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />

              {/* Protected routes with mobile layout */}
              <Route
                path="/libraries"
                element={
                  <ProtectedRoute>
                    <MobileLayout>
                      <LibrariesPage />
                    </MobileLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/libraries/:id"
                element={
                  <ProtectedRoute>
                    <MobileLayout>
                      <LibraryDetailPage />
                    </MobileLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/playlists"
                element={
                  <ProtectedRoute>
                    <MobileLayout>
                      <PlaylistsPage />
                    </MobileLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/playlists/:id"
                element={
                  <ProtectedRoute>
                    <MobileLayout>
                      <PlaylistDetailPage />
                    </MobileLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <MobileLayout>
                      <SettingsPage />
                    </MobileLayout>
                  </ProtectedRoute>
                }
              />

              {/* 404 catch-all route */}
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <Toaster />
          <ReloadPrompt />
          <InstallPrompt />
        </BrowserRouter>
      </AuthProvider>
    </LocaleProvider>
  </React.StrictMode>
);

// Dummy export to satisfy Vite Fast Refresh
export default {};

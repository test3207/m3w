import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './styles/globals.css';

// Import i18n initialization
import './locales/init';

// Import sync service
import { syncService } from './lib/sync/service';

// Lazy load pages for code splitting
const HomePage = lazy(() => import('./pages/HomePage'));
const SignInPage = lazy(() => import('./pages/SignInPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const NowPlayingPage = lazy(() => import('./pages/NowPlayingPage'));
const LibrariesPage = lazy(() => import('./pages/LibrariesPage'));
const LibraryDetailPage = lazy(() => import('./pages/LibraryDetailPage'));
const PlaylistsPage = lazy(() => import('./pages/PlaylistsPage'));
const PlaylistDetailPage = lazy(() => import('./pages/PlaylistDetailPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));

// Import UI components (keep these eager loaded as they're used globally)
import { Toaster } from './components/ui/toaster';
import { PageLoader } from './components/ui/page-loader';
import { ProtectedRoute } from './components/providers/protected-route';
import { ReloadPrompt } from './components/features/pwa/reload-prompt';
import { InstallPrompt } from './components/features/pwa/install-prompt';
import { NetworkStatusIndicator } from './components/features/network/network-status-indicator';
import { MobileLayout } from './components/layouts/MobileLayout';
import { AuthProvider } from './components/providers/auth-provider';

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // Retry failed requests once
      refetchOnWindowFocus: false, // Don't refetch on window focus by default
      staleTime: 30000, // Data is fresh for 30 seconds by default
    },
    mutations: {
      retry: 0, // Don't retry mutations
    },
  },
});

// Start background sync service
syncService.start();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
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
                path="/now-playing"
                element={
                  <ProtectedRoute>
                    <MobileLayout>
                      <NowPlayingPage />
                    </MobileLayout>
                  </ProtectedRoute>
                }
              />
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

              {/* Legacy upload page - will be converted to drawer */}
              <Route
                path="/upload"
                element={
                  <ProtectedRoute>
                    <MobileLayout>
                      <UploadPage />
                    </MobileLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Suspense>
          <Toaster />
          <NetworkStatusIndicator />
          <ReloadPrompt />
          <InstallPrompt />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
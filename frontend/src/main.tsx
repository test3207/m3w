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
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const LibrariesPage = lazy(() => import('./pages/LibrariesPage'));
const LibraryDetailPage = lazy(() => import('./pages/LibraryDetailPage'));
const PlaylistsPage = lazy(() => import('./pages/PlaylistsPage'));
const PlaylistDetailPage = lazy(() => import('./pages/PlaylistDetailPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));

// Import UI components (keep these eager loaded as they're used globally)
import { Toaster } from './components/ui/toaster';
import { PageLoader } from './components/ui/page-loader';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ReloadPrompt } from './components/features/pwa/reload-prompt';
import { InstallPrompt } from './components/features/pwa/install-prompt';
import { NetworkStatusIndicator } from './components/features/network-status-indicator';
import { DashboardLayout } from './components/layouts/DashboardLayout';
import { AuthProvider } from './components/providers/AuthProvider';

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
              <Route path="/" element={<HomePage />} />
              <Route path="/signin" element={<SignInPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <DashboardPage />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/libraries"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <LibrariesPage />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/libraries/:id"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <LibraryDetailPage />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/playlists"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <PlaylistsPage />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/playlists/:id"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <PlaylistDetailPage />
                    </DashboardLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/upload"
                element={
                  <ProtectedRoute>
                    <DashboardLayout>
                      <UploadPage />
                    </DashboardLayout>
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
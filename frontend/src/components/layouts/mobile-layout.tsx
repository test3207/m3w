/**
 * Mobile Layout Component
 * Main layout for mobile-first design with header, bottom navigation and mini player
 */

import { useEffect, useMemo, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { usePlayerStore } from "@/stores/playerStore";
import { MobileHeader } from "@/components/layouts/mobile-header";
import { BottomNavigation } from "@/components/features/navigation/bottom-navigation";
import { MiniPlayer } from "@/components/features/player";
import { useDemoMode, DEMO_BANNER_HEIGHT } from "@/hooks/useDemoMode";
import { useLocale } from "@/locales/use-locale";
import { logger } from "@/lib/logger-client";

// Lazy load heavy components that are initially hidden (drawers/sheets/overlays)
// These components won't block initial render since they're closed by default
const FullPlayer = lazy(() => import("@/components/features/player/full-player").then(m => ({ default: m.FullPlayer })));
const PlayQueueDrawer = lazy(() => import("@/components/features/player/play-queue-drawer").then(m => ({ default: m.PlayQueueDrawer })));
const UploadDrawer = lazy(() => import("@/components/features/upload/upload-drawer").then(m => ({ default: m.UploadDrawer })));
const AddToPlaylistSheet = lazy(() => import("@/components/features/playlists/AddToPlaylistSheet").then(m => ({ default: m.AddToPlaylistSheet })));
const DemoBanner = lazy(() => import("@/components/features/demo/DemoBanner").then(m => ({ default: m.DemoBanner })));

/**
 * Error boundary for lazy-loaded chunks.
 * Handles chunk loading failures (e.g., after deployment when old chunks are gone)
 * by prompting user to refresh the page.
 */
interface ChunkErrorBoundaryState {
  hasError: boolean;
}

class ChunkErrorBoundary extends Component<{ children: ReactNode }, ChunkErrorBoundaryState> {
  state: ChunkErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChunkErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log chunk loading errors for debugging
    logger.error("Chunk loading error:", { error: error.message, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Silently fail for overlay components - they're not critical
      // User can refresh if needed
      return null;
    }
    return this.props.children;
  }
}

interface MobileLayoutProps {
  children: React.ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  // Subscribe to locale changes - use locale as key to force content re-render
  const locale = useLocale();

  const currentSong = usePlayerStore((state) => state.currentSong);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const loadPlaybackProgress = usePlayerStore((state) => state.loadPlaybackProgress);
  const savePlaybackProgress = usePlayerStore((state) => state.savePlaybackProgress);
  const hasSong = currentSong !== null;
  const { isEnabled: isDemoMode } = useDemoMode();

  // Memoize content height calculation
  const contentHeight = useMemo(() => {
    const baseHeight = 56 + 64; // header + bottom nav
    const miniPlayerHeight = hasSong ? 72 : 0;
    const demoBannerHeight = isDemoMode ? DEMO_BANNER_HEIGHT : 0;
    const totalOffset = baseHeight + miniPlayerHeight + demoBannerHeight;
    return `calc(100vh - ${totalOffset}px)`;
  }, [hasSong, isDemoMode]);

  // Load playback progress on mount (once)
  useEffect(() => {
    loadPlaybackProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save progress before page unload (using fetch with keepalive for reliability)
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Get latest state directly from store
      const state = usePlayerStore.getState();
      if (state.currentSong) {
        state.savePlaybackProgressSync(); // Use keepalive for guaranteed delivery
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []); // Empty deps - listener always uses latest store state

  // Save progress when song changes (immediate) or periodically while playing
  useEffect(() => {
    if (!currentSong || !isPlaying) {
      return;
    }

    // Immediate save on song change
    savePlaybackProgress();

    // Set up interval for periodic saves while playing
    const interval = setInterval(() => {
      // Always save, don't check currentTime here (it's captured in closure)
      savePlaybackProgress();
    }, 5000); // Save every 5 seconds while playing

    return () => {
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSong?.id, isPlaying]);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* Demo Banner (if enabled) - lazy loaded */}
      <Suspense fallback={null}>
        <DemoBanner />
      </Suspense>

      {/* Top Header with status indicators (56px) */}
      <MobileHeader />

      {/* Main content area - fixed height excluding header, bottom nav, mini player, and demo banner */}
      {/* Key on locale to force re-render children when locale changes (doesn't affect AudioPlayer) */}
      <main 
        key={locale}
        className="overflow-hidden"
        style={{ height: contentHeight }}
      >
        {children}
      </main>

      {/* Mini Player (floating above bottom nav) */}
      {hasSong && <MiniPlayer />}

      {/* Bottom Navigation */}
      <BottomNavigation />

      {/* Lazy loaded overlays - wrapped in ErrorBoundary to handle chunk loading failures */}
      <ChunkErrorBoundary>
        <Suspense fallback={null}>
          {/* Full Player Overlay */}
          <FullPlayer />

          {/* Play Queue Drawer */}
          <PlayQueueDrawer />

          {/* Upload Drawer */}
          <UploadDrawer />

          {/* Add to Playlist Sheet */}
          <AddToPlaylistSheet />
        </Suspense>
      </ChunkErrorBoundary>
    </div>
  );
}

// Default export for lazy loading in main.tsx
export default MobileLayout;
